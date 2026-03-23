const { onRequest } = require("firebase-functions/v2/https");
const { initializeApp, getApps } = require("firebase-admin/app");
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require("firebase-functions");
const cheerio = require('cheerio');

// Initialize Admin SDK once
if (getApps().length === 0) {
    initializeApp();
}

// NEIS API 및 학교 홈페이지 설정
const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186';
const SCHOOL_MEAL_URL = 'https://school.gyo6.net/adgd/ad/fm/foodmenu/selectFoodMenuView.do?mi=100561';

/**
 * 학교 홈페이지에서 해당 월의 급식 사진 URL들을 크롤링합니다.
 * @returns {Promise<Object>} Key: YYYYMMDD, Value: imageUrl
 */
async function fetchMealPhotos(year, month) {
    const imagesMap = {};
    const paddedMonth = String(month).padStart(2, '0');
    const url = `${SCHOOL_MEAL_URL}&viewType=tbl&schYy=${year}&schMm=${paddedMonth}`;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'ko-KR,ko;q=0.9',
            'Referer': 'https://school.gyo6.net/adgd/main.do'
        };

        const mainResponse = await fetch('https://school.gyo6.net/adgd/main.do', { headers });
        const setCookies = mainResponse.headers.get('set-cookie');
        const cookies = setCookies ? setCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

        const response = await fetch(url, { headers: { ...headers, 'Cookie': cookies } });
        const html = await response.text();
        const $ = cheerio.load(html);

        $('td.selectDay').each((_, td) => {
            const $td = $(td);
            const dateStr = $td.attr('id');
            if (!dateStr || !dateStr.startsWith(year)) return;

            const $img = $td.find('.meal_tab_icon img').first();
            if ($img.length > 0) {
                let imgSrc = $img.attr('src');
                if (imgSrc) {
                    // 진짜 사진(/upload/)만 수집하고 아이콘(/common/)은 무시
                    if (imgSrc.includes('/upload/')) {
                        if (imgSrc.startsWith('/')) {
                            imgSrc = `https://school.gyo6.net${imgSrc}`;
                        }
                        imagesMap[dateStr] = imgSrc;
                    } else {
                        // 아이콘인 경우 null로 처리하여 나중에 다시 긁어올 기회를 줌
                        imagesMap[dateStr] = null;
                    }
                }
            }
        });

        logger.info(`Successfully crawled ${Object.keys(imagesMap).filter(k => imagesMap[k]).length} photos for ${year}-${paddedMonth}`);
        return imagesMap;
    } catch (error) {
        logger.error('Error crawling meal photos:', error);
    }
    return imagesMap;
}

exports.getMeals = onRequest({
    secrets: ["NEIS_API_KEY"],
    cors: true,
    region: "us-central1"
}, async (req, res) => {
    try {
        const NEIS_API_KEY = process.env.NEIS_API_KEY;
        if (!NEIS_API_KEY) {
            logger.error('NEIS_API_KEY Missing');
            res.status(500).json({ error: 'Missing NEIS_API_KEY' });
            return;
        }

        // Use named database 'adgd-bab' for production
    const db = getFirestore(process.env.GCLOUD_PROJECT === 'adgd-bab' ? 'adgd-bab' : undefined);
        const year = req.query.year;
        const month = req.query.month;
        const refresh = req.query.refresh === 'true';

        if (!year || !month) {
            res.status(400).json({ error: 'Missing year or month' });
            return;
        }

        const paddedMonth = String(month).padStart(2, '0');
        const docId = `${year}${paddedMonth}`;
        const cacheRef = db.collection('meals').doc(docId);
        const cacheDoc = await cacheRef.get();
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000;

        if (cacheDoc.exists && !refresh) {
            const cacheData = cacheDoc.data();
            const nowTime = new Date(now);
            const isCurrentMonth = nowTime.getFullYear() == year && (nowTime.getMonth() + 1) == month;
            const todayStr = `${year}${paddedMonth}${String(nowTime.getDate()).padStart(2, '0')}`;
            
            let shouldRefresh = false;

            if (isCurrentMonth) {
                const todayData = cacheData.data ? cacheData.data[todayStr] : null;
                const hasTodayImage = todayData && typeof todayData === 'object' && todayData.imageUrl;
                const ONE_HOUR = 60 * 60 * 1000;
                
                // 오늘 사진이 없는데 캐시가 1시간 이상 된 경우
                if (!hasTodayImage && (now - cacheData.timestamp > ONE_HOUR)) {
                    shouldRefresh = true;
                }
            }

            if (!shouldRefresh && (now - cacheData.timestamp < ONE_DAY)) {
                res.status(200).json({
                    success: true,
                    data: cacheData.data,
                    timestamp: cacheData.timestamp,
                    source: 'cache'
                });
                return;
            }
        }

        logger.info(`Fetching data for ${docId}... refresh=${refresh}`);

        const fromDate = `${year}${paddedMonth}01`;
        const lastDay = new Date(year, month, 0).getDate();
        const toDate = `${year}${paddedMonth}${lastDay}`;
        const neisUrl = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${fromDate}&MLSV_TO_YMD=${toDate}`;

        const [neisResponse, photosMap] = await Promise.all([
            fetch(neisUrl),
            fetchMealPhotos(year, month)
        ]);

        const neisData = await neisResponse.json();
        const mealsMap = {};

        if (neisData.mealServiceDietInfo && neisData.mealServiceDietInfo[1] && neisData.mealServiceDietInfo[1].row) {
            neisData.mealServiceDietInfo[1].row.forEach(row => {
                const date = row.MLSV_YMD;
                if (row.MMEAL_SC_CODE === "2") {
                    mealsMap[date] = {
                        menu: row.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim(),
                        imageUrl: photosMap[date] || null,
                        kcal: row.CAL_INFO || null
                    };
                }
            });
        }

        await cacheRef.set({ data: mealsMap, timestamp: now });

        res.status(200).json({
            success: true,
            data: mealsMap,
            timestamp: now,
            source: 'api'
        });

    } catch (error) {
        logger.error('Meal API error:', error);
        res.status(500).json({ success: false, error: error.message });
    }
});
