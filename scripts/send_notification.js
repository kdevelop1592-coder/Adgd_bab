import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';
import fetch from 'node-fetch';
import { readFile } from 'fs/promises';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

// 1. Initialize Firebase Admin
// The service account key should be stored in an environment variable 'FIREBASE_SERVICE_ACCOUNT'
// as a JSON string.
// Example in GitHub Secrets: FIREBASE_SERVICE_ACCOUNT = {"type": "service_account", ...}

let serviceAccount;

if (process.env.FIREBASE_SERVICE_ACCOUNT) {
    serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
} else {
    // Try local file for development
    try {
        const __dirname = dirname(fileURLToPath(import.meta.url));
        const localKeyPath = join(__dirname, '../adgd-bab-firebase-adminsdk-fbsvc-56691a83c0.json');
        const data = await readFile(localKeyPath, 'utf8');
        serviceAccount = JSON.parse(data);
        console.log('Loaded service account from local file.');
    } catch (e) {
        console.log('No environment variable or local key file found.');
    }
}

if (!serviceAccount) {
    console.error('Error: FIREBASE_SERVICE_ACCOUNT environment variable is missing.');
    process.exit(1);
}

const app = initializeApp({
    credential: cert(serviceAccount)
});

const db = getFirestore(app, 'adgd-bab');
const messaging = getMessaging(app);

console.log('Service Account Project ID:', serviceAccount.project_id);
// 2. Configuration
// TODO: Update these codes for your target school
const NEIS_API_KEY = ''; // Optional for small testing
const ATPT_OFCDC_SC_CODE = 'R10'; // Gyeongbuk Office of Education
const SD_SCHUL_CODE = '8750186';  // Andong Jungang High School

async function getTodaysMeal() {
    const today = new Date();
    const year = today.getFullYear();
    const month = String(today.getMonth() + 1).padStart(2, '0');
    const day = String(today.getDate()).padStart(2, '0');
    const dateStr = `${year}${month}${day}`;

    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;

    try {
        const response = await fetch(url);
        const data = await response.json();

        if (data.mealServiceDietInfo && data.mealServiceDietInfo[1] && data.mealServiceDietInfo[1].row) {
            // Find lunch (MMEAL_SC_CODE usually 2)
            const meals = data.mealServiceDietInfo[1].row;
            const lunch = meals.find(m => m.MMEAL_SC_CODE === "2") || meals[0];

            // Clean up the menu string (remove HTML tags like <br/>)
            const menu = lunch.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, ''); // Remove allergy info numbers
            return menu.trim();
        } else {
            console.log('No meal data found for today.');
            return null;
        }
    } catch (error) {
        console.error('Error fetching meal data:', error);
        return null;
    }
}

async function sendNotifications(mealMenu) {
    if (!mealMenu) return;

    // 3. Get all user tokens from Firestore
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];
    usersSnapshot.forEach(doc => {
        if (doc.data().token) {
            tokens.push(doc.data().token);
        }
    });

    if (tokens.length === 0) {
        console.log('No users to notify.');
        return;
    }

    console.log(`Found ${tokens.length} tokens.`);

    // 4. Send Multicast Message
    // FCM multicast allows up to 500 tokens per call.
    // If > 500, user needs to chunk the array. (Assuming < 500 for this demo)

    const message = {
        notification: {
            title: '오늘의 급식 🍚',
            body: mealMenu,
        },
        webpush: {
            fcmOptions: {
                link: 'https://kdevelop1592-coder.github.io/Adgd_bab/'
            }
        },
        tokens: tokens,
    };

    try {
        const response = await messaging.sendEachForMulticast(message);
        console.log(`${response.successCount} messages were sent successfully.`);
        if (response.failureCount > 0) {
            const failedTokens = [];
            response.responses.forEach((resp, idx) => {
                if (!resp.success) {
                    failedTokens.push(tokens[idx]);
                }
            });
            console.log('List of tokens that caused failures: ' + failedTokens);
            // Optional: Remove invalid tokens from Firestore
        }
    } catch (error) {
        console.log('Error sending message:', error);
    }
}

async function main() {
    console.log('Starting daily meal notification job...');
    const mealMenu = await getTodaysMeal();
    if (mealMenu) {
        console.log('Menu fetched: ', mealMenu);
        await sendNotifications(mealMenu);
    } else {
        console.log('Skipping notification as no menu found.');
    }
}

main();
