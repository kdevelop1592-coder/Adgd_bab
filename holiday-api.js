// 공휴일 API 통합 모듈
// Firebase Functions를 통해 안전하게 API 호출

const HOLIDAY_CACHE_KEY = 'korean_holidays_cache';
const HOLIDAY_CACHE_DURATION = 6 * 30 * 24 * 60 * 60 * 1000; // 6개월

// Firebase Functions 엔드포인트
const FUNCTIONS_URL = 'https://us-central1-adgd-bab.cloudfunctions.net/getHolidays';

// 공휴일 데이터 저장소
let holidaysData = {};

// 날짜를 YYYYMMDD 형식으로 변환
function formatDateStr(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

// Firebase Functions에서 공휴일 데이터 가져오기
async function fetchHolidaysFromAPI() {
    try {
        console.log('🔄 Fetching holidays from Firebase Functions...');

        const response = await fetch(FUNCTIONS_URL);
        const data = await response.json();

        if (data.success && data.holidays) {
            // 캐시에 저장
            const cacheData = {
                holidays: data.holidays,
                timestamp: Date.now()
            };
            localStorage.setItem(HOLIDAY_CACHE_KEY, JSON.stringify(cacheData));

            console.log(`✅ Fetched ${data.count} holidays from Firebase Functions`);
            return data.holidays;
        } else {
            console.error('Failed to fetch holidays:', data.error);
            return {};
        }
    } catch (error) {
        console.error('Holiday API error:', error);
        return {};
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
    // 먼저 캐시 확인
    const cached = getHolidaysFromCache();
    if (cached) {
        holidaysData = cached;
        return;
    }

    // 캐시가 없거나 만료된 경우 Firebase Functions 호출
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
