// Import Firebase SDKs
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
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

// --- School Configuration ---
const NEIS_API_KEY = 'f94bd02dd9df439e9c1f4b136dc9df26';
const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186'; // 안동중앙고등학교 정정 (8750186)

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app, "adgd-bab");

// --- UI Elements ---
const notificationBtn = document.getElementById('enable-notifications');
const statusMsg = document.getElementById('status-message');
const installSection = document.getElementById('install-section');
const installBtn = document.getElementById('install-btn');
const tabBtns = document.querySelectorAll('.tab-btn');
const tabPanes = document.querySelectorAll('.tab-pane');
const todayDateEl = document.getElementById('today-date');
const todayMealInfoEl = document.getElementById('today-meal-info');
const weeklyMealListEl = document.getElementById('weekly-meal-list');
const monthlyMealCalendarEl = document.getElementById('monthly-meal-calendar');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const mealModal = document.getElementById('meal-modal');
const closeModal = document.querySelector('.close-modal');
const modalDateEl = document.getElementById('modal-date');
const modalMealInfoEl = document.getElementById('modal-meal-info');
const prevDayBtn = document.getElementById('prev-day');
const nextDayBtn = document.getElementById('next-day');

// Current viewed date in monthly view
let viewDate = new Date();
// Current viewed date in today view
let currentDay = new Date();

// Foreground notification handler
onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    alert(`[알림 확인] ${payload.notification.title}\n\n${payload.notification.body}`);
});

// VAPID Key ...
const VAPID_KEY = "BP-wVz5j889jR_q--YLtDlicDyeGRkelnsVdl87lVu0Uv6ukgq2YC774E61v31IA2Cns4lcnu9h6mWz_OK4lgkY";

// --- Tab Logic ---
tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.tab;

        // Update active class
        tabBtns.forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        tabPanes.forEach(pane => {
            pane.classList.remove('active');
            if (pane.id === `${target}-view`) {
                pane.classList.add('active');
            }
        });

        if (target === 'weekly') loadWeeklyMeal();
        if (target === 'monthly') loadMonthlyMeal();
    });
});

// --- Meal API Logic ---
async function fetchMeal(dateStr) {
    const url = `https://open.neis.go.kr/hub/mealServiceDietInfo?KEY=${NEIS_API_KEY}&Type=json&ATPT_OFCDC_SC_CODE=${ATPT_OFCDC_SC_CODE}&SD_SCHUL_CODE=${SD_SCHUL_CODE}&MLSV_YMD=${dateStr}`;
    try {
        const response = await fetch(url);
        const data = await response.json();
        if (data.mealServiceDietInfo?.[1]?.row) {
            const meals = data.mealServiceDietInfo[1].row;
            const lunch = meals.find(m => m.MMEAL_SC_CODE === "2") || meals[0];
            return lunch.DDISH_NM.replace(/<br\/>/g, '\n').replace(/\([0-9.]+\)/g, '').trim();
        }
        return null;
    } catch (e) {
        console.error('Fetch error:', e);
        return null;
    }
}

function formatDate(date) {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
}

function getDayName(date) {
    const days = ['일', '월', '화', '수', '목', '금', '토'];
    return days[date.getDay()];
}

// Today View
async function loadTodayMeal() {
    const dateStr = formatDate(currentDay);
    todayDateEl.textContent = `${currentDay.getMonth() + 1}월 ${currentDay.getDate()}일 (${getDayName(currentDay)})`;

    todayMealInfoEl.innerHTML = '<span class="loading-spinner"></span> 정보를 불러오는 중...';
    const menu = await fetchMeal(dateStr);
    todayMealInfoEl.innerHTML = menu ? menu.replace(/\n/g, '<br>') : '오늘은 급식 정보가 없습니다. 🏖️';
}

// Day Navigation
prevDayBtn.onclick = () => {
    currentDay.setDate(currentDay.getDate() - 1);
    loadTodayMeal();
};

nextDayBtn.onclick = () => {
    currentDay.setDate(currentDay.getDate() + 1);
    loadTodayMeal();
};

// Weekly View
async function loadWeeklyMeal() {
    weeklyMealListEl.innerHTML = '<p class="status-message">주간 급식을 불러오는 중...</p>';
    const startOfWeek = new Date();
    // Monday of this week
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    let html = '';
    for (let i = 0; i < 5; i++) {
        const current = new Date(startOfWeek);
        current.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(current);
        const menu = await fetchMeal(dateStr);

        html += `
            <div class="weekly-item">
                <h4>${current.getMonth() + 1}/${current.getDate()} (${getDayName(current)})</h4>
                <p>${menu ? menu.replace(/\n/g, ', ') : '정보 없음'}</p>
            </div>
        `;
    }
    weeklyMealListEl.innerHTML = html;
}

// Monthly View (Full Calendar Grid)
async function loadMonthlyMeal() {
    currentMonthEl.textContent = `${viewDate.getFullYear()}년 ${viewDate.getMonth() + 1}월`;
    monthlyMealCalendarEl.innerHTML = '<p class="status-message">월간 일정을 생성 중...</p>';

    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const firstDay = new Date(year, month, 1).getDay(); // 0 is Sun
    const totalDays = new Date(year, month + 1, 0).getDate();

    let html = '';

    // Add empty slots for days before the 1st
    for (let i = 0; i < firstDay; i++) {
        html += '<div class="calendar-day empty"></div>';
    }

    // Add actual days
    const now = new Date();
    for (let i = 1; i <= totalDays; i++) {
        const isToday = i === now.getDate() && month === now.getMonth() && year === now.getFullYear();
        const date = new Date(year, month, i);
        const dayOfWeek = date.getDay();

        let dayClass = '';
        if (dayOfWeek === 0) dayClass = 'sun';
        else if (dayOfWeek === 6) dayClass = 'sat';

        html += `<div class="calendar-day ${isToday ? 'has-meal' : ''} ${dayClass}" onclick="showMealDetail(${i})">${i}</div>`;
    }
    monthlyMealCalendarEl.innerHTML = html;
}

// Month Navigation
prevMonthBtn.onclick = () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    loadMonthlyMeal();
};

nextMonthBtn.onclick = async () => {
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);
    const dateStr = formatDate(nextDate);

    // Check if next month has data
    const menu = await fetchMeal(dateStr);
    if (!menu && nextDate > new Date()) {
        alert("아직 다음 달 급식 정보가 없습니다. 🏖️");
        return;
    }

    viewDate.setMonth(viewDate.getMonth() + 1);
    loadMonthlyMeal();
};

window.showMealDetail = async function (day) {
    const year = viewDate.getFullYear();
    const month = viewDate.getMonth();
    const selectedDate = new Date(year, month, day);
    const dateStr = formatDate(selectedDate);

    modalDateEl.textContent = `${month + 1}월 ${day}일 (${getDayName(selectedDate)})`;
    modalMealInfoEl.innerHTML = '<span class="loading-spinner"></span> 정보를 불러오는 중...';
    mealModal.classList.add('active');

    const menu = await fetchMeal(dateStr);
    modalMealInfoEl.innerHTML = menu ? menu.replace(/\n/g, '<br>') : '급식 정보가 없습니다. 🏖️';
}

closeModal.onclick = () => mealModal.classList.remove('active');
window.onclick = (event) => {
    if (event.target == mealModal) mealModal.classList.remove('active');
}

// Initial Load
loadTodayMeal();
loadMonthlyMeal();


// --- Notification Logic ---

async function requestPermissionAndSaveToken() {
    try {
        notificationBtn.disabled = true;
        notificationBtn.innerHTML = '<span class="loading-spinner"></span> 처리 중...';

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            updateStatus('권한 허용됨. 토큰 발급 중...', 'loading');

            const registration = await navigator.serviceWorker.getRegistration();
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                updateStatus('토큰 발급 완료. 서버에 저장 중...', 'loading');
                await saveTokenToFirestore(token);
                updateStatus('알림 설정이 완료되었습니다! ✅', 'success');
                notificationBtn.innerHTML = '<i class="fas fa-check"></i> 설정 완료';
            } else {
                updateStatus('토큰 발급 실패. 다시 시도해 주세요.', 'error');
                notificationBtn.disabled = false;
                notificationBtn.innerHTML = '<i class="fas fa-bell"></i> 알림 켜기';
            }
        } else {
            updateStatus('알림 권한이 거부되었습니다.', 'error');
            notificationBtn.disabled = false;
        }
    } catch (error) {
        console.error('Notification Error:', error);
        updateStatus('오류: ' + error.message, 'error');
        notificationBtn.disabled = false;
    }
}

async function saveTokenToFirestore(token) {
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
    e.preventDefault();
    deferredPrompt = e;
    installSection.style.display = 'block';
});

installBtn.addEventListener('click', async () => {
    if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        deferredPrompt = null;
        installSection.style.display = 'none';
    }
});

// Service Worker Registration
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./firebase-messaging-sw.js')
            .then(registration => {
                console.log('SW registered:', registration.scope);
            })
            .catch(err => {
                console.log('SW failed:', err);
            });
    });
}
