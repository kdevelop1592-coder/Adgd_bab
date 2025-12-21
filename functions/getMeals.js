const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');

// NEIS API 설정 (환경 변수 권장하지만, 기존 클라이언트 코드 참조)
const NEIS_API_KEY = 'f94bd02dd9df439e9c1f4b136dc9df26';
const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186';

exports.getMeals = functions.https.onRequest(async (req, res) => {
    // CORS 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const db = getFirestore('adgd-bab');
        const year = req.query.year;
        const month = req.query.month; // 1 ~ 12 (문자열)

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
            if (cacheData.timestamp && (now - cacheData.timestamp < ONE_DAY)) {
                console.log(`Serving meals from cache for ${docId}`);
                res.status(200).json({
                    success: true,
                    data: cacheData.data,
                    timestamp: cacheData.timestamp,
                    source: 'cache'
                });
                return;
            }
        }

        console.log(`Fetching meals for ${docId} from NEIS API...`);

        // 2. NEIS API에서 한 달 치 데이터 가져오기
        const fromDate = `${year}${paddedMonth}01`;
        const lastDay = new Date(year, month, 0).getDate();
        const toDate = `${year}${paddedMonth}${lastDay}`;

        const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_FROM_YMD=${fromDate}&MLSV_TO_YMD=${toDate}`;

        const response = await fetch(url);
        const data = await response.json();

        const mealsMap = {};

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
            data.mealServiceDietInfo[1].row.forEach(row => {
                const date = row.MLSV_YMD; // YYYYMMDD
                if (row.MMEAL_SC_CODE === "2") {
                    mealsMap[date] = row.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim();
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
        console.error('Meal API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
