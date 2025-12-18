import { onSchedule } from "firebase-functions/v2/scheduler";
import { logger } from "firebase-functions";
import { initializeApp } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import fetch from "node-fetch";

initializeApp();

const db = getFirestore();
const messaging = getMessaging();

// 학교 설정 (기존 scripts/send_notification.js에서 복사)
const NEIS_API_KEY = process.env.NEIS_API_KEY || 'f94bd02dd9df439e9c1f4b136dc9df26';
const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186';

async function getTodaysMeal() {
    const today = new Date(new Date().toLocaleString("en-US", { timeZone: "Asia/Seoul" }));
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
            const meals = data.mealServiceDietInfo[1].row;
            const lunch = meals.find(m => m.MMEAL_SC_CODE === "2") || meals[0];
            const menu = lunch.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '');
            return menu.trim();
        }
        return null;
    } catch (error) {
        logger.error('Error fetching meal data:', error);
        return null;
    }
}

export const dailyMealNotification = onSchedule({
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
