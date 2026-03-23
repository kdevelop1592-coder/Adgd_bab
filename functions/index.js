const { onSchedule } = require("firebase-functions/v2/scheduler");
const { logger } = require("firebase-functions");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");
const { getHolidays } = require("./getHolidays.js");
const { getMeals } = require("./getMeals.js");

initializeApp();

const db = getFirestore(process.env.GCLOUD_PROJECT === 'adgd-bab' ? 'adgd-bab' : undefined);
const messaging = getMessaging();

exports.getHolidays = getHolidays;
exports.getMeals = getMeals;

// 학교 설정 (기존 scripts/send_notification.js에서 복사)
const NEIS_API_KEY = process.env.NEIS_API_KEY;
const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186';

async function getTodaysMeal() {
    // 서버 시간(UTC)에 관계없이 한국 시간(KST) 기준으로 날짜 생성
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });

    const parts = formatter.formatToParts(now);
    const year = parts.find(p => p.type === 'year').value;
    const month = parts.find(p => p.type === 'month').value;
    const day = parts.find(p => p.type === 'day').value;
    const dateStr = `${year}${month}${day}`;

    logger.info(`Fetching meal for date: ${dateStr} (KST)`);

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
            const meals = data.mealServiceDietInfo[1].row;
            const lunch = meals.find(m => m.MMEAL_SC_CODE === "2") || meals[0];
            const menu = lunch.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim();
            const kcal = lunch.CAL_INFO;
            return kcal ? `${menu}\n\n[총 ${kcal}]` : menu;
        }
        return null;
    } catch (error) {
        logger.error('Error fetching meal data:', error);
        return null;
    }
}

exports.dailyMealNotification = onSchedule({
    schedule: "30 7 * * *",
    timeZone: "Asia/Seoul",
    memory: "256MiB",
    secrets: ["NEIS_API_KEY"],
}, async (event) => {
    logger.info("Starting daily meal notification job...");

    const mealMenu = await getTodaysMeal();
    if (!mealMenu) {
        logger.info("Skipping notification as no menu found localy.");
        return;
    }

    // 오늘 날짜 문자열 생성 (YYYYMMDD)
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('ko-KR', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    const parts = formatter.formatToParts(now);
    const dateStr = `${parts.find(p => p.type === 'year').value}${parts.find(p => p.type === 'month').value}${parts.find(p => p.type === 'day').value}`;

    // Firestore에서 알림 중지 날짜 확인
    try {
        const configDoc = await db.collection('admin_config').doc('notifications').get();
        if (configDoc.exists) {
            const disabledDates = configDoc.data().disabledDates || [];
            if (disabledDates.includes(dateStr)) {
                logger.info(`Notification for ${dateStr} is disabled by admin.`);
                return;
            }
        }
    } catch (error) {
        logger.error('Error checking disabled dates in Firestore:', error);
    }

    // Firestore에서 토큰 조회
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];
    usersSnapshot.forEach(doc => {
        if (doc.data().token) {
            tokens.push(doc.data().token);
        }
    });

    if (tokens.length === 0) {
        logger.info("No users to notify.");
        return;
    }

    const message = {
        notification: {
            title: '오늘의 급식 🍚',
            body: mealMenu,
        },
        webpush: {
            notification: {
                tag: 'daily-meal-notification',
                icon: 'https://kdevelop1592-coder.github.io/Adgd_bab/icons/icon-192.png',
                renotify: true,
            },
            fcmOptions: {
                link: 'https://kdevelop1592-coder.github.io/Adgd_bab/'
            }
        },
        tokens: tokens,
    };

    try {
        const response = await messaging.sendEachForMulticast(message);
        logger.info(`${response.successCount} messages were sent successfully.`);
    } catch (error) {
        logger.error('Error sending message:', error);
    }
});
