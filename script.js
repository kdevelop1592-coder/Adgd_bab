// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { getFirestore, doc, setDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// TODO: YOUR FIREBASE CONFIGURATION REPLACES THIS
const firebaseConfig = {
    apiKey: "AIzaSyD-6VZb7DYLBLwungZRvhfNLS9T5-RXtrM",
    authDomain: "adgd-bab.firebaseapp.com",
    projectId: "adgd-bab",
    storageBucket: "adgd-bab.firebasestorage.app",
    messagingSenderId: "445040265724",
    appId: "1:445040265724:web:e971afd0ae1533a2d24a79",
    measurementId: "G-RND2J0EBBN"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app);

// VAPID Key (Web Push Certificate) setup required in Firebase Console -> Cloud Messaging
// TODO: Replace with your generate VAPID Key
const VAPID_KEY = "BP-wVz5j889jR_q--YLtDlicDyeGRkelnsVdl87lVu0Uv6ukgq2YC774E61v31IA2Cns4lcnu9h6mWz_OK4lgkY";

// UI Elements
const notificationBtn = document.getElementById('enable-notifications');
const statusMsg = document.getElementById('status-message');
const installSection = document.getElementById('install-section');
const installBtn = document.getElementById('install-btn');

// --- Notification Logic ---

async function requestPermissionAndSaveToken() {
    try {
        notificationBtn.disabled = true;
        notificationBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            // Get the service worker registration
            const registration = await navigator.serviceWorker.getRegistration();
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });
            if (token) {
                await saveTokenToFirestore(token);
                updateStatus('알림 설정이 완료되었습니다! 내일 아침부터 급식 소식을 전해드릴게요.', 'success');
                notificationBtn.innerHTML = '<i class="fas fa-check"></i> 알림 설정 완료';
            } else {
                updateStatus('토큰을 가져올 수 없습니다. 권한 설정을 확인해주세요.', 'error');
                notificationBtn.disabled = false;
                notificationBtn.innerHTML = '<i class="fas fa-bell"></i> 알림 켜기';
            }
        } else {
            updateStatus('알림 권한이 거부되었습니다.', 'error');
            notificationBtn.disabled = false;
            notificationBtn.innerHTML = '<i class="fas fa-bell"></i> 알림 켜기';
        }
    } catch (error) {
        console.error('Notification Error:', error);
        updateStatus('오류가 발생했습니다: ' + error.message, 'error');
        notificationBtn.disabled = false;
        notificationBtn.innerHTML = '<i class="fas fa-bell"></i> 알림 켜기';
    }
}

async function saveTokenToFirestore(token) {
    // We use the token itself as the document ID to prevent duplicates
    const userRef = doc(db, "users", token);
    await setDoc(userRef, {
        token: token,
        createdAt: serverTimestamp(),
        platform: navigator.userAgent
    });
}

function updateStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status-message ' + type;
}

notificationBtn.addEventListener('click', requestPermissionAndSaveToken);

// --- PWA Install Logic ---

let deferredPrompt;

window.addEventListener('beforeinstallprompt', (e) => {
    // Prevent the mini-infobar from appearing on mobile
    e.preventDefault();
    // Stash the event so it can be triggered later.
    deferredPrompt = e;
    // Update UI notify the user they can install the PWA
    installSection.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        console.log(`User response to the install prompt: ${outcome}`);
        deferredPrompt = null;
        installSection.style.display = 'none';
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./firebase-messaging-sw.js')
            .then(registration => {
                console.log('Service Worker registered with scope:', registration.scope);
            })
            .catch(err => {
                console.log('Service Worker registration failed:', err);
            });
    });
}
