const functions = require('firebase-functions');
const { getFirestore } = require('firebase-admin/firestore');

// API 키를 서버에 안전하게 보관
exports.getHolidays = functions.https.onRequest(async (req, res) => {
    // CORS 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        const db = getFirestore();

        // 1. Firestore 캐시 확인
        const cacheRef = db.collection('holidays').doc('cache');
        const cacheDoc = await cacheRef.get();
        const now = Date.now();
        const THREE_MONTHS = 90 * 24 * 60 * 60 * 1000;

        if (cacheDoc.exists) {
            const cacheData = cacheDoc.data();
            // 캐시가 있고 3개월 이내라면 바로 반환
            if (cacheData.timestamp && (now - cacheData.timestamp < THREE_MONTHS)) {
                console.log('Serving from Firestore Cache (Holidays)');
                res.status(200).json({
                    success: true,
                    holidays: cacheData.holidays,
                    count: Object.keys(cacheData.holidays).length,
                    timestamp: cacheData.timestamp,
                    source: 'cache'
                });
                return;
            }
        }

        console.log('Cache miss or stale. Fetching from Open API...');

        // 2. Open API에서 데이터 가져오기 (올해 + 내년, 총 24개월)
        const API_KEY = functions.config().holiday?.apikey || process.env.HOLIDAY_API_KEY;
        if (!API_KEY) {
            throw new Error('API key not configured');
        }

        const API_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';
        const currentDate = new Date();
        const currentYear = currentDate.getFullYear();

        // 올해와 내년 데이터 수집
        const targetYears = [currentYear, currentYear + 1];
        const holidays = {};

        for (const year of targetYears) {
            for (let month = 1; month <= 12; month++) {
                const monthStr = String(month).padStart(2, '0');

                // 공휴일 URL
                const restUrl = `${API_URL}/getRestDeInfo?serviceKey=${API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json`;
                // 국경일 URL (제헌절 등)
                const holiUrl = `${API_URL}/getHoliDeInfo?serviceKey=${API_KEY}&solYear=${year}&solMonth=${monthStr}&_type=json`;

                try {
                    // 병렬 요청으로 속도 향상 (Node 22 native fetch)
                    const [restRes, holiRes] = await Promise.all([fetch(restUrl), fetch(holiUrl)]);
                    const [restData, holiData] = await Promise.all([restRes.json(), holiRes.json()]);

                    const processItems = (data) => {
                        if (data.response?.body?.items?.item) {
                            const items = Array.isArray(data.response.body.items.item)
                                ? data.response.body.items.item
                                : [data.response.body.items.item];

                            items.forEach(item => {
                                // locdate는 숫자나 문자열일 수 있음
                                holidays[String(item.locdate)] = item.dateName;
                            });
                        }
                    };

                    processItems(restData);
                    processItems(holiData);

                } catch (e) {
                    console.warn(`Failed to fetch holidays for ${year}-${monthStr}:`, e);
                }
            }
        }

        // 3. Firestore에 저장 (캐시 업데이트)
        await cacheRef.set({
            holidays: holidays,
            timestamp: now
        });

        // 4. 응답 반환
        res.status(200).json({
            success: true,
            holidays: holidays,
            count: Object.keys(holidays).length,
            timestamp: now,
            source: 'api'
        });

    } catch (error) {
        console.error('Holiday API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
