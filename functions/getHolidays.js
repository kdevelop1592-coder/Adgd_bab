import * as functions from 'firebase-functions';
import fetch from 'node-fetch';

// Firebase Functions로 공휴일 API 프록시
// API 키를 서버에 안전하게 보관

export const getHolidays = functions.https.onRequest(async (req, res) => {
    // CORS 설정
    res.set('Access-Control-Allow-Origin', '*');
    res.set('Access-Control-Allow-Methods', 'GET');
    res.set('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(204).send('');
        return;
    }

    try {
        // 환경 변수에서 API 키 가져오기
        const API_KEY = functions.config().holiday?.apikey || process.env.HOLIDAY_API_KEY;

        if (!API_KEY) {
            res.status(500).json({ error: 'API key not configured' });
            return;
        }

        const API_URL = 'http://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService';

        // 현재 월부터 6개월치 데이터 가져오기
        const now = new Date();
        const currentYear = now.getFullYear();
        const currentMonth = now.getMonth() + 1;

        const holidays = {};

        for (let i = 0; i < 6; i++) {
            const targetDate = new Date(currentYear, currentMonth - 1 + i, 1);
            const year = targetDate.getFullYear();
            const month = String(targetDate.getMonth() + 1).padStart(2, '0');

            // 공휴일 정보 가져오기
            const restUrl = `${API_URL}/getRestDeInfo?serviceKey=${API_KEY}&solYear=${year}&solMonth=${month}&_type=json`;
            const holiUrl = `${API_URL}/getHoliDeInfo?serviceKey=${API_KEY}&solYear=${year}&solMonth=${month}&_type=json`;

            try {
                // 공휴일 (휴일)
                const restResponse = await fetch(restUrl);
                const restData = await restResponse.json();

                if (restData.response?.body?.items?.item) {
                    const items = Array.isArray(restData.response.body.items.item)
                        ? restData.response.body.items.item
                        : [restData.response.body.items.item];

                    items.forEach(item => {
                        holidays[String(item.locdate)] = item.dateName;
                    });
                }

                // 국경일
                const holiResponse = await fetch(holiUrl);
                const holiData = await holiResponse.json();

                if (holiData.response?.body?.items?.item) {
                    const items = Array.isArray(holiData.response.body.items.item)
                        ? holiData.response.body.items.item
                        : [holiData.response.body.items.item];

                    items.forEach(item => {
                        const dateStr = String(item.locdate);
                        if (!holidays[dateStr]) {
                            holidays[dateStr] = item.dateName;
                        }
                    });
                }
            } catch (e) {
                console.warn(`Failed to fetch holidays for ${year}-${month}:`, e);
            }

            // API 호출 제한 방지
            await new Promise(resolve => setTimeout(resolve, 100));
        }

        // 성공 응답
        res.status(200).json({
            success: true,
            holidays: holidays,
            count: Object.keys(holidays).length,
            timestamp: Date.now()
        });

    } catch (error) {
        console.error('Holiday API error:', error);
        res.status(500).json({
            success: false,
            error: error.message
        });
    }
});
