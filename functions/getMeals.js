const { onRequest } = require("firebase-functions/v2/https");
const { getFirestore } = require('firebase-admin/firestore');
const { logger } = require("firebase-functions");
const cheerio = require('cheerio');

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
    // 월간 달력 뷰 URL (표 형태)
    const url = `${SCHOOL_MEAL_URL}&viewType=tbl&schYy=${year}&schMm=${paddedMonth}`;

    try {
        const headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/146.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7',
            'Accept-Language': 'ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7',
            'Referer': 'https://school.gyo6.net/adgd/main.do',
            'Connection': 'keep-alive'
        };

        // 1. 세션 쿠키 획득 (메인 페이지 방문)
        const mainResponse = await fetch('https://school.gyo6.net/adgd/main.do', { headers });
        const setCookies = mainResponse.headers.get('set-cookie');
        const cookies = setCookies ? setCookies.split(',').map(c => c.split(';')[0]).join('; ') : '';

        // 2. 쿠키와 함께 급식 페이지 요청
        const response = await fetch(url, {
            headers: {
                ...headers,
                'Cookie': cookies
            }
        });
        const html = await response.text();
        const $ = cheerio.load(html);
        const imagesMap = {};

        // 달력 형식(tbl)에서의 선택자: td.selectDay, .meal_tab_icon img
        $('td.selectDay').each((_, td) => {
            const $td = $(td);
            // 날짜 추출 (id="20260303")
            const dateStr = $td.attr('id');
            if (!dateStr || !dateStr.startsWith(year)) return;

            // 이미지 태그 찾기 (.meal_tab_icon img)
            const $img = $td.find('.meal_tab_icon img').first();
            if ($img.length > 0) {
                let imgSrc = $img.attr('src');
                if (imgSrc && imgSrc.startsWith('/')) {
                    imgSrc = `https://school.gyo6.net${imgSrc}`;
                }
                imagesMap[dateStr] = imgSrc;
            }
        });

        logger.info(`Successfully crawled ${Object.keys(imagesMap).length} photos for ${year}-${paddedMonth}`);
        return imagesMap;
    } catch (error) {
        logger.error('Error crawling meal photos:', error);
    }
    return imagesMap;
}

exports.getMeals = onRequest({
    secrets: ["NEIS_API_KEY"],
    cors: true, // Gen 2 handles CORS via this option
    region: "us-central1"
}, async (req, res) => {
    try {
        const NEIS_API_KEY = process.env.NEIS_API_KEY;
        const db = getFirestore();
        const year = req.query.year;
        const month = req.query.month; // 1 ~ 12 (문자열)
        const refresh = req.query.refresh === 'true'; // 캐시 무시 여부

        if (!year || !month) {
            res.status(400).json({ error: 'Missing year or month parameters' });
            return;
        }

        const paddedMonth = String(month).padStart(2, '0');
        const docId = `${year}${paddedMonth}`; // 예: 202505

        // 1. Firestore 캐시 확인
        const cacheRef = db.collection('meals').doc(docId);
        const cacheDoc = await cacheRef.get();
        const now = Date.now();
        const ONE_DAY = 24 * 60 * 60 * 1000; // 하루 (급식 메뉴 변경 가능성 고려)

        if (cacheDoc.exists) {
            const cacheData = cacheDoc.data();
            // 캐시가 있고 24시간 이내라면 반환
            // 단, imageUrl 필드가 없는 구형 데이터인 경우 새로고침 시도
            const hasImages = Object.values(cacheData.data || {}).some(meal => typeof meal === 'object' && meal.imageUrl);

            if (cacheData.timestamp && (now - cacheData.timestamp < ONE_DAY) && hasImages && !refresh) {
                logger.info(`Serving meals from cache for ${docId}`);
                res.status(200).json({
                    success: true,
                    data: cacheData.data,
                    timestamp: cacheData.timestamp,
                    source: 'cache'
                });
                return;
            }
        }

        logger.info(`Fetching meals for ${docId} from NEIS API and school website...`);

        // 2. NEIS API에서 한 달 치 데이터 가져오기 및 사진 크롤링 (병렬 실행)
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
                const date = row.MLSV_YMD; // YYYYMMDD
                if (row.MMEAL_SC_CODE === "2") {
                    const menu = row.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim();
                    // 메뉴 텍스트와 이미지 URL을 객체로 통합
                    mealsMap[date] = {
                        menu: menu,
                        imageUrl: photosMap[date] || null
                    };
                }
            });
        }

        // 3. Firestore 저장
        await cacheRef.set({
            data: mealsMap,
            timestamp: now
        });

        res.status(200).json({
            success: true,
            data: mealsMap,
            timestamp: now,
            source: 'api'
        });

    } catch (error) {
        logger.error('Meal API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
