// 공휴일 API 통합 모듈
// Firebase Functions를 통해 안전하게 API 호출

const HOLIDAY_CACHE_KEY = 'korean_holidays_cache';
const HOLIDAY_CACHE_DURATION = 6 * 30 * 24 * 60 * 60 * 1000; // 6개월

// Firebase Functions 엔드포인트
const FUNCTIONS_URL = 'https://us-central1-adgd-bab.cloudfunctions.net/getHolidays';

// API 실패 시 사용할 하드코딩된 공휴일 데이터 (2024-2025)
const FALLBACK_HOLIDAYS = {
    // 2024년
    "20240101": "신정",
    "20240209": "설날 연휴",
    "20240210": "설날",
    "20240211": "설날 연휴",
    "20240212": "대체공휴일(설날)",
    "20240301": "삼일절",
    "20240410": "제22대 국회의원선거",
    "20240505": "어린이날",
    "20240506": "대체공휴일(어린이날)",
    "20240515": "부처님오신날",
    "20240606": "현충일",
    "20240815": "광복절",
    "20240916": "추석 연휴",
    "20240917": "추석",
    "20240918": "추석 연휴",
    "20241003": "개천절",
    "20241009": "한글날",
    "20241225": "기독탄신일",

    // 2025년
    "20250101": "신정",
    "20250128": "설날 연휴",
    "20250129": "설날",
    "20250130": "설날 연휴",
    "20250301": "삼일절",
    "20250303": "대체공휴일(삼일절)",
    "20250505": "어린이날",
    "20250506": "부처님오신날/대체공휴일",
    "20250606": "현충일",
    "20250815": "광복절",
    "20251003": "개천절",
    "20251005": "추석 연휴",
    "20251006": "추석",
    "20251007": "추석 연휴",
    "20251008": "대체공휴일(추석)",
    "20251009": "한글날",
    "20251225": "기독탄신일",

    // 2026년
    "20260101": "신정",
    "20260216": "설날 연휴",
    "20260217": "설날",
    "20260218": "설날 연휴",
    "20260301": "삼일절",
    "20260302": "대체공휴일(삼일절)",
    "20260505": "어린이날",
    "20260524": "부처님오신날",
    "20260525": "대체공휴일(부처님오신날)",
    "20260603": "제9회 전국동시지방선거",
    "20260606": "현충일",
    "20260815": "광복절",
    "20260924": "추석 연휴",
    "20260925": "추석",
    "20260926": "추석 연휴",
    "20261003": "개천절",
    "20261009": "한글날",
    "20261225": "기독탄신일"
};

// 공휴일 데이터 저장소
let holidaysData = {};

// 날짜를 YYYYMMDD 형식으로 변환
function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Firebase Functions에서 공휴일 데이터 가져오기 (실패 시 Fallback 사용)
async function fetchHolidaysFromAPI() {
    try {
        console.log('🔄 Fetching holidays from Firebase Functions...');
        const response = await fetch(FUNCTIONS_URL);

        if (!response.ok) {
            throw new Error(`Server returned status: ${response.status}`);
        }

        const data = await response.json();

        if (data.success && data.holidays) {
            // 서버 데이터와 Fallback 데이터 병합 (서버 데이터가 우선)
            // 이를 통해 서버가 과거 데이터를 안 주더라도 하드코딩된 과거 데이터는 유지됨
            const mergedHolidays = { ...FALLBACK_HOLIDAYS, ...data.holidays };

            // 캐시에 저장
            const cacheData = {
                holidays: mergedHolidays,
                timestamp: Date.now()
            };
            localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify(cacheData));

            console.log(`✅ Fetched ${data.count} holidays from Firebase Functions (Merged with fallback)`);
            return mergedHolidays;
        } else {
            throw new Error(data.error || 'Invalid data format');
        }
    } catch (error) {
        console.warn('⚠️ Server fetch failed. Using FALLBACK data.', error);

        // 서버 실패 시 Fallback 데이터 사용 (캐시는 업데이트하지 않음 - 나중에 서버 복구 시 갱신되도록)
        return FALLBACK_HOLIDAYS;
    }
}

// 캐시에서 공휴일 데이터 가져오기
function getHolidaysFromCache() {
    try {
        const cached = localStorage.getItem(HOLIDAY_CACHE_KEY);
        if (!cached) return null;

        const cacheData = JSON.parse(cached);
        const age = Date.now() - cacheData.timestamp;

        if (age < HOLIDAY_CACHE_DURATION) {
            const days = Math.floor(age / (24 * 60 * 60 * 1000));
            console.log(`✅ Using cached holidays (age: ${days} days, expires in ${180 - days} days)`);
            return cacheData.holidays;
        }

        console.log('⚠️ Holiday cache expired (> 6 months)');
        return null;
    } catch (e) {
        console.error('Cache read error:', e);
        return null;
    }
}

// 공휴일 데이터 초기화
async function initHolidays() {
    // 1. 먼저 캐시 확인
    const cached = getHolidaysFromCache();
    if (cached) {
        holidaysData = cached;
        return;
    }

    // 2. 캐시가 없거나 만료된 경우 API 호출 (내부적으로 Fallback 처리됨)
    holidaysData = await fetchHolidaysFromAPI();
}

// 공휴일 여부 확인
function isHoliday(date) {
    const dateStr = formatDateStr(date);
    return holidaysData.hasOwnProperty(dateStr);
}

// 공휴일 이름 가져오기
function getHolidayName(date) {
    const dateStr = formatDateStr(date);
    return holidaysData[dateStr] || null;
}

// Export functions
window.holidayAPI = {
    init: initHolidays,
    isHoliday: isHoliday,
    getHolidayName: getHolidayName,
    refreshCache: fetchHolidaysFromAPI
};
