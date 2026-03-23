import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// TODO: YOUR FIREBASE CONFIGURATION REPLACES THIS
// --- Firebase Configuration ---
const ENV = 'prod';
const VAPID_KEY = "BP-wVz5j889jR_q--YLtDlicDyeGRkelnsVdl87lVu0Uv6ukgq2YC774E61v31IA2Cns4lcnu9h6mWz_OK4lgkY";

const firebaseConfig = {
  apiKey: "AIzaSyD-6VZb7DYLBLwungZRvhfNLS9T5-RXtrM",
  authDomain: "adgd-bab.firebaseapp.com",
  projectId: "adgd-bab",
  storageBucket: "adgd-bab.firebasestorage.app",
  messagingSenderId: "445040265724",
  appId: "1:445040265724:web:e971afd0ae1533a2d24a79",
  measurementId: "G-RND2J0EBBN"
};

const ATPT_OFCDC_SC_CODE = 'R10';
const SD_SCHUL_CODE = '8750186'; // 안동중앙고등학교 (식당 공유)

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);

// 운영 서버(prod)의 경우 데이터베이스 명이 'adgd-bab'로 되어 있는 경우에 대응
const db = getFirestore(app, ENV === 'prod' ? 'adgd-bab' : undefined);
console.log(`[Debug] App initialized. ENV: ${ENV}, Database: ${ENV === 'prod' ? 'adgd-bab' : '(default)'}`);

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
const themeToggleBtn = document.getElementById('theme-toggle');
const themeIcon = themeToggleBtn.querySelector('i');
let currentToken = null;
let currentRegistration = null;
let isProcessingNotification = false;

// --- Debugging Helper ---
const withTimeout = (promise, ms, name) => {
    console.log(`[Debug] Starting ${name}...`);
    return Promise.race([
        promise.then(res => {
            console.log(`[Debug] ${name} resolved.`);
            return res;
        }),
        new Promise((_, reject) => setTimeout(() => {
            console.error(`[Debug] ${name} timed out after ${ms}ms`);
            reject(new Error(`${name} 요청 시간이 초과되었습니다.`));
        }, ms))
    ]);
};

// --- Theme Logic ---
const currentTheme = localStorage.getItem('theme') || 'light';
if (currentTheme === 'dark') {
    document.documentElement.classList.add('dark');
    if(themeIcon) {
        themeIcon.classList.remove('fa-moon');
        themeIcon.classList.add('fa-sun');
    }
}

themeToggleBtn.addEventListener('click', () => {
    document.documentElement.classList.toggle('dark');
    const isDark = document.documentElement.classList.contains('dark');
    localStorage.setItem('theme', isDark ? 'dark' : 'light');
    
    if(themeIcon) {
        if (isDark) {
            themeIcon.classList.remove('fa-moon');
            themeIcon.classList.add('fa-sun');
        } else {
            themeIcon.classList.remove('fa-sun');
            themeIcon.classList.add('fa-moon');
        }
    }
});

// Help function to get current date in KST
function getKSTDate() {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: 'Asia/Seoul',
        year: 'numeric',
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: 'numeric',
        second: 'numeric'
    });
    return new Date(formatter.format(now));
}

// Current viewed date in monthly view (Initialize with KST)
let viewDate = getKSTDate();
// Current viewed date in today view (Initialize with KST)
let currentDay = getKSTDate();

// Foreground notification handler
onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    // Removed alert to prevent double notification confusion (alert + system notification)
});

// VAPID Key ...
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
// 메모리 캐시 (월별 급식 데이터)
const mealCache = {}; // Key: "YYYYMM", Value: Object { "YYYYMMDD": "메뉴..." }

// --- Meal API Logic (Improved) ---
// 개별 호출 대신 월 단위로 서버에서 가져옴
async function fetchMonthlyMeals(year, month) {
    const monthKey = `${year}${String(month).padStart(2, '0')}`;
    if (mealCache[monthKey]) {
        return mealCache[monthKey];
    }

    const url = `https://us-central1-${firebaseConfig.projectId}.cloudfunctions.net/getMeals?year=${year}&month=${month}`;
    try {
        const response = await fetch(url);
        const json = await response.json();

        if (json.success && json.data) {
            mealCache[monthKey] = json.data;
            return json.data;
        }
        return {};
    } catch (e) {
        console.error('Failed to fetch monthly meals:', e);
        return {};
    }
}

// 특정 날짜의 급식 가져오기 (캐시 활용)
async function fetchMeal(dateStr) {
    // dateStr format: YYYYMMDD
    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const monthKey = `${year}${String(month).padStart(2, '0')}`;

    // 캐시에 없으면 해당 월 전체 데이터를 요청
    if (!mealCache[monthKey]) {
        await fetchMonthlyMeals(year, month);
    }

    const monthlyData = mealCache[monthKey] || {};
    return monthlyData[dateStr] || null;
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
    const meal = await fetchMeal(dateStr);
    
    if (meal) {
        const menu = (typeof meal === 'object') ? meal.menu : meal;
        const imageUrl = (typeof meal === 'object') ? meal.imageUrl : null;
        const kcal = (typeof meal === 'object' && meal.kcal) ? meal.kcal : null;
        
        let html = '';
        if (imageUrl) {
            html += `<div class="meal-image-container"><img src="${imageUrl}" class="meal-image" alt="오늘의 급식 사진" onclick="window.open('${imageUrl}', '_blank')"></div>`;
        }
        html += `<div class="meal-text">${menu.replace(/\n/g, '<br>')}</div>`;
        if (kcal) {
            html += `<div class="calorie-info"><i class="fas fa-fire-alt"></i> 총 ${kcal}</div>`;
        }
        todayMealInfoEl.innerHTML = html;
    } else {
        todayMealInfoEl.innerHTML = '오늘은 급식 정보가 없습니다. 🏖️';
    }
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
    const startOfWeek = new Date(currentDay);
    const day = startOfWeek.getDay();
    const diff = startOfWeek.getDate() - day + (day === 0 ? -6 : 1);
    startOfWeek.setDate(diff);

    const endOfWeek = new Date(startOfWeek);
    endOfWeek.setDate(startOfWeek.getDate() + 4);

    // Monthly fetch already handles this via fetchMeal

    let html = '';
    for (let i = 0; i < 5; i++) {
        const current = new Date(startOfWeek);
        current.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(current);
        const meal = await fetchMeal(dateStr);
        
        const menu = meal ? ((typeof meal === 'object') ? meal.menu : meal) : '정보 없음';
        const kcal = meal ? ((typeof meal === 'object' && meal.kcal) ? meal.kcal : '') : '';

        let kcalHtml = kcal ? `<p class="weekly-calorie"><i class="fas fa-fire-alt"></i> 총 ${kcal}</p>` : '';

        html += `
            <div class="weekly-item">
                <h4>${current.getMonth() + 1}/${current.getDate()} (${getDayName(current)})</h4>
                <p>${menu.replace(/\n/g, ', ')}</p>
                ${kcalHtml}
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

    // Fetching handled within loadMonthlyMeal's date loop if not in cache
    await fetchMonthlyMeals(year, month + 1);

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
        const holiday = window.holidayAPI.isHoliday(date);
        const holidayName = window.holidayAPI.getHolidayName(date);

        let dayClass = '';
        if (holiday) {
            dayClass = 'holiday';
        } else if (dayOfWeek === 0) {
            dayClass = 'sun';
        } else if (dayOfWeek === 6) {
            dayClass = 'sat';
        }

        // Check if meal exists in cache to highlight
        const dateStr = formatDate(date);
        const hasMealData = await fetchMeal(dateStr);

        const title = holidayName ? `title="${holidayName}"` : '';
        const labelHtml = holidayName ? `<span class="holiday-label">${holidayName}</span>` : '';

        html += `<div class="calendar-day ${isToday ? 'today' : ''} ${hasMealData ? 'has-meal' : ''} ${dayClass}" onclick="showMealDetail(${i})" ${title}>
            <span class="day-number">${i}</span>
            ${labelHtml}
        </div>`;
    }
    monthlyMealCalendarEl.innerHTML = html;

    // 데이터 존재 여부 확인 및 표시 (비동기로 처리하여 UI 렌더링 방해 않음)
    checkDataStatus(year, month);
}

async function checkDataStatus(year, month) {
    let hasData = false;
    // 월 초 7일간 데이터 확인
    for (let i = 1; i <= 7; i++) {
        const checkDate = new Date(year, month, i);
        const dateStr = formatDate(checkDate);
        const meal = await fetchMeal(dateStr);
        if (meal) {
            hasData = true;
            break;
        }
    }

    if (!hasData) {
        const currentText = currentMonthEl.textContent;
        // 이미 표시된 경우 중복 방지
        if (!currentText.includes('(정보 없음)')) {
            currentMonthEl.innerHTML = `${currentText} <span style="font-size: 0.7em; color: var(--text-sub); font-weight: normal;">(급식 정보 없음)</span>`;
        }
    }
}
prevMonthBtn.onclick = () => {
    viewDate.setMonth(viewDate.getMonth() - 1);
    loadMonthlyMeal();
};

nextMonthBtn.onclick = async () => {
    // 급식 정보가 없더라도 달력은 볼 수 있게 제한 해제
    /*
    const nextDate = new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1);

    // Check if next month has data (check first 7 days to account for holidays/weekends)
    let hasData = false;
    for (let i = 0; i < 7; i++) {
        const checkDate = new Date(nextDate);
        checkDate.setDate(nextDate.getDate() + i);
        const dateStr = formatDate(checkDate);
        const menu = await fetchMeal(dateStr);
        if (menu) {
            hasData = true;
            break;
        }
    }

    if (!hasData && nextDate > new Date()) {
        alert("아직 다음 달 급식 정보가 없습니다. 🏖️");
        return;
    }
    */

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

    const meal = await fetchMeal(dateStr);
    if (meal) {
        const menu = (typeof meal === 'object') ? meal.menu : meal;
        const imageUrl = (typeof meal === 'object') ? meal.imageUrl : null;
        const kcal = (typeof meal === 'object' && meal.kcal) ? meal.kcal : null;
        
        let html = '';
        if (imageUrl) {
            html += `<div class="meal-image-container large"><img src="${imageUrl}" class="meal-image" alt="급식 사진" onclick="window.open('${imageUrl}', '_blank')"></div>`;
        }
        html += `<div class="meal-text">${menu.replace(/\n/g, '<br>')}</div>`;
        if (kcal) {
            html += `<div class="calorie-info"><i class="fas fa-fire-alt"></i> 총 ${kcal}</div>`;
        }
        modalMealInfoEl.innerHTML = html;
    } else {
        modalMealInfoEl.innerHTML = '급식 정보가 없습니다. 🏖️';
    }
}

closeModal.onclick = () => mealModal.classList.remove('active');
window.onclick = (event) => {
    if (event.target == mealModal) mealModal.classList.remove('active');
}

// Initial Load
(async () => {
    await window.holidayAPI.init();
    loadTodayMeal();
    loadMonthlyMeal();
    // v4.1: Meal photo filter & robust initialization fix
    const debugEl = document.getElementById('debug-info');
    if (debugEl) {
        debugEl.textContent = `v4.1 | ${ENV} | ${firebaseConfig.projectId}`;
    }
    
    // checkNotificationState(); // SW 등록 후 실행하도록 아래로 이동
})();


// --- Notification Logic ---

// 알림 상태 확인 및 UI 업데이트
async function checkNotificationState() {
    try {
        if (!('serviceWorker' in navigator) || !('Notification' in window)) {
            notificationBtn.style.display = 'none';
            return;
        }

        if (Notification.permission === 'denied') {
            updateStatus('알림 권한이 차단되어 있습니다. 브라우저 설정에서 허용해 주세요.', 'error');
            notificationBtn.disabled = true;
            return;
        }

        console.log('[Debug] Checking Service Worker...');
        // 서비스 워커 등록 정보를 한 번만 가져와서 유지
        if (!currentRegistration) {
            currentRegistration = await navigator.serviceWorker.getRegistration();
            console.log('[Debug] Registration found:', !!currentRegistration);
        }
        
        if (!currentRegistration) {
            console.warn('[Debug] No Service Worker registration found.');
            setNotificationUI(false);
            return;
        }

        console.log('[Debug] Fetching FCM token...');
        currentToken = await getToken(messaging, {
            vapidKey: VAPID_KEY,
            serviceWorkerRegistration: currentRegistration
        }).catch(err => {
            console.error('[Debug] getToken error:', err);
            return null;
        });
        console.log('[Debug] Current token:', currentToken ? 'exists' : 'null');

        if (currentToken) {
            setNotificationUI(true);
            // 캐시가 있더라도 서버 상태 확인을 위해 저장 시도 (백그라운드)
            saveTokenToFirestore(currentToken).catch(e => console.error('[Debug] Background sync failed:', e));
        } else {
            setNotificationUI(false);
        }
    } catch (error) {
        console.error('Check notification state error:', error);
        setNotificationUI(false);
    }
}

function setNotificationUI(isEnabled) {
    if (isEnabled) {
        notificationBtn.classList.add('active');
    } else {
        notificationBtn.classList.remove('active');
    }
    notificationBtn.classList.remove('loading');
    notificationBtn.disabled = false;
    notificationBtn.style.opacity = '1';
}

async function handleNotificationToggle() {
    if (isProcessingNotification) return;
    
    const isCurrentlyEnabled = notificationBtn.classList.contains('active');
    
    if (isCurrentlyEnabled) {
        await unsubscribeFromNotifications();
    } else {
        await requestPermissionAndSaveToken();
    }
}

async function requestPermissionAndSaveToken() {
    try {
        isProcessingNotification = true;
        notificationBtn.classList.add('loading');
        notificationBtn.disabled = true;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            updateStatus('권한 허용됨. 토큰 발급 중...', 'loading');

            if (!currentRegistration) {
                currentRegistration = await navigator.serviceWorker.getRegistration();
            }

            currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: currentRegistration
            });

            if (currentToken) {
                updateStatus('서버에 저장 중...', 'loading');
                await withTimeout(saveTokenToFirestore(currentToken), 5000, 'saveTokenToFirestore');
                updateStatus('알림 설정이 완료되었습니다! ✅', 'success');
                setNotificationUI(true);
            } else {
                throw new Error('토큰 발급에 실패했습니다.');
            }
        } else {
            updateStatus('알림 권한이 거부되었습니다.', 'error');
            setNotificationUI(false);
        }
    } catch (error) {
        console.error('Notification Subscription Error:', error);
        updateStatus('오류: ' + error.message, 'error');
        setNotificationUI(false);
    } finally {
        isProcessingNotification = false;
    }
}

async function unsubscribeFromNotifications() {
    try {
        if (!confirm('정말로 급식 알림을 끄시겠습니까?')) return;

        isProcessingNotification = true;
        notificationBtn.classList.add('loading');
        notificationBtn.disabled = true;

        // 이미 가지고 있는 토큰이 있으면 그것을 사용, 없으면 새로 시도
        if (!currentToken && currentRegistration) {
            currentToken = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: currentRegistration
            }).catch(() => null);
        }

        if (currentToken) {
            console.log('[Debug] Deleting token from Firestore...');
            await withTimeout(deleteDoc(doc(db, "users", currentToken)), 5000, 'deleteDoc');
            console.log('[Debug] Deleting FCM token...');
            await withTimeout(deleteToken(messaging), 5000, 'deleteToken');
            currentToken = null;
            updateStatus('알림 서비스가 해지되었습니다. 🔕', 'success');
            setNotificationUI(false);
        } else {
            // 토큰이 없더라도 UI는 끈 상태로 맞춤
            setNotificationUI(false);
        }
    } catch (error) {
        console.error('Unsubscribe Error:', error);
        updateStatus('알림 해지 중 오류가 발생했습니다.', 'error');
        notificationBtn.disabled = false;
        notificationBtn.classList.remove('loading');
    } finally {
        isProcessingNotification = false;
    }
}

async function saveTokenToFirestore(token) {
    const userRef = doc(db, "users", token);
    await setDoc(userRef, {
        token: token,
        updatedAt: serverTimestamp(),
        platform: navigator.userAgent
    }, { merge: true });
}

notificationBtn.onclick = handleNotificationToggle;

function updateStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status-message ' + type;
    if (type === 'success') {
        setTimeout(() => {
            if (statusMsg.textContent === msg) statusMsg.textContent = '';
        }, 3000);
    }
}

// notificationBtn.addEventListener('click', requestPermissionAndSaveToken); // onClick으로 관리하도록 변경

// --- PWA Install Logic ---
let deferredPrompt;

// Check for iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
const isStandalone = window.navigator.standalone || window.matchMedia('(display-mode: standalone)').matches;

if (isIOS && !isStandalone) {
    // Show iOS manual install instructions
    installSection.style.display = 'block';
    installSection.innerHTML = `
        <h3>앱 설치</h3>
        <p style="font-size: 0.9rem; color: var(--text-main); margin-bottom: 15px;">
            아이폰에서는 하단의 <strong>공유 버튼 <i class="fas fa-external-link-alt"></i></strong>을 누르고<br>
            <strong>'홈 화면에 추가'</strong>를 선택하여 설치해 주세요!
        </p>
    `;
}

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

// Service Worker Registration with versioning
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        // v4.1: Meal photo filter & robust initialization fix
        navigator.serviceWorker.register('./firebase-messaging-sw.js?v=4.1')
            .then(registration => {
                console.log('SW registered:', registration.scope);
                // 서비스 워커 등록 성공 후 알림 상태 확인
                checkNotificationState();
            })
            .catch(err => {
                console.log('SW failed:', err);
                checkNotificationState(); // 실패하더라도 기본 상태 확인 시도
            });
    });
}
