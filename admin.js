import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-auth.js";
import { getFirestore, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

// Firebase Configuration (Same as script.js)
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
const auth = getAuth(app);
const db = getFirestore(app, "adgd-bab");
const provider = new GoogleAuthProvider();

// UI Elements
const loginSection = document.getElementById('login-section');
const dashboardSection = document.getElementById('dashboard-section');
const loginBtn = document.getElementById('google-login-btn');
const logoutBtn = document.getElementById('logout-btn');
const userInfoEl = document.getElementById('user-info');
const adminCalendarEl = document.getElementById('admin-calendar');
const currentMonthEl = document.getElementById('current-month');
const prevMonthBtn = document.getElementById('prev-month');
const nextMonthBtn = document.getElementById('next-month');
const disabledDatesListEl = document.getElementById('disabled-dates-list');
const saveSettingsBtn = document.getElementById('save-settings-btn');
const statusMsg = document.getElementById('status-message');

// State
let currentUser = null;
let currentViewDate = new Date();
let disabledDates = []; // Array of YYYYMMDD strings
const mealCache = {}; // Global cache for meals

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user && user.email === "kdevelop1592@gmail.com") {
        currentUser = user;
        userInfoEl.textContent = `${user.displayName} (${user.email})`;
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

        await window.holidayAPI.init();
        await loadSettings();
        renderCalendar();
    } else if (user) {
        // Not an admin
        alert("관리자 권한이 없습니다. (" + user.email + ")");
        signOut(auth);
    } else {
        currentUser = null;
        loginSection.style.display = 'block';
        dashboardSection.style.display = 'none';
    }
});

// Login/Logout
loginBtn.onclick = async () => {
    try {
        await signInWithPopup(auth, provider);
    } catch (error) {
        console.error("Login failed:", error);
        alert("로그인에 실패했습니다: " + error.message);
    }
};

logoutBtn.onclick = () => signOut(auth);

// Meal API Logic (Shared with script.js)
async function fetchMonthlyMeals(year, month) {
    const monthKey = `${year}${String(month).padStart(2, '0')}`;
    if (mealCache[monthKey]) return mealCache[monthKey];

    const url = `https://us-central1-adgd-bab.cloudfunctions.net/getMeals?year=${year}&month=${month}`;
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

async function fetchMeal(dateStr) {
    const year = dateStr.substring(0, 4);
    const month = parseInt(dateStr.substring(4, 6), 10);
    const monthKey = `${year}${String(month).padStart(2, '0')}`;

    if (!mealCache[monthKey]) {
        await fetchMonthlyMeals(year, month);
    }

    const monthlyData = mealCache[monthKey] || {};
    return monthlyData[dateStr] || null;
}

// Settings Management
async function loadSettings() {
    try {
        const docRef = doc(db, "admin_config", "notifications");
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
            disabledDates = docSnap.data().disabledDates || [];
        }
        updateDisabledDatesList();
    } catch (error) {
        console.error("Failed to load settings:", error);
    }
}

async function saveSettings() {
    saveSettingsBtn.disabled = true;
    saveSettingsBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...';

    try {
        const docRef = doc(db, "admin_config", "notifications");
        await setDoc(docRef, {
            disabledDates: disabledDates,
            updatedAt: new Date(),
            updatedBy: currentUser.email
        }, { merge: true });

        showStatus("설정이 성공적으로 저장되었습니다! ✅", "success");
    } catch (error) {
        console.error("Failed to save settings:", error);
        showStatus("저장 중 오류가 발생했습니다. ❌", "error");
    } finally {
        saveSettingsBtn.disabled = false;
        saveSettingsBtn.innerHTML = '<i class="fas fa-save"></i> 설정 저장';
    }
}

saveSettingsBtn.onclick = saveSettings;

// Calendar Logic
async function renderCalendar() {
    if (!window.holidayAPI) {
        console.error("Holiday API not found");
        return;
    }

    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    currentMonthEl.textContent = `${year}년 ${month + 1}월`;
    adminCalendarEl.innerHTML = '<div class="loading-spinner"></div>';

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();
    const now = new Date(); // KST handled loosely here for 'today' marker

    // Fetch meals for current month to show markers
    await fetchMonthlyMeals(year, month + 1);

    adminCalendarEl.innerHTML = '';

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        adminCalendarEl.appendChild(empty);
    }

    // Day cells
    for (let i = 1; i <= totalDays; i++) {
        const date = new Date(year, month, i);
        const dateStr = formatDate(date);
        const dayOfWeek = date.getDay();
        const isToday = i === now.getDate() && month === now.getMonth() && year === now.getFullYear();

        const holiday = window.holidayAPI.isHoliday(date);
        const holidayName = window.holidayAPI.getHolidayName(date);
        const hasMealData = !!(mealCache[`${year}${String(month + 1).padStart(2, '0')}`]?.[dateStr]);

        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        if (isToday) dayEl.classList.add('today');
        if (holiday) dayEl.classList.add('holiday');
        else if (dayOfWeek === 0) dayEl.classList.add('sun');
        else if (dayOfWeek === 6) dayEl.classList.add('sat');

        if (hasMealData) dayEl.classList.add('has-meal');
        if (disabledDates.includes(dateStr)) {
            dayEl.classList.add('disabled-date');
        }

        const spanNum = document.createElement('span');
        spanNum.className = 'day-number';
        spanNum.textContent = i;
        dayEl.appendChild(spanNum);

        if (holidayName) {
            const spanHoliday = document.createElement('span');
            spanHoliday.className = 'holiday-label';
            spanHoliday.textContent = holidayName;
            dayEl.appendChild(spanHoliday);
        }

        dayEl.onclick = () => toggleDate(dateStr);
        adminCalendarEl.appendChild(dayEl);
    }
}

function toggleDate(dateStr) {
    const index = disabledDates.indexOf(dateStr);
    if (index > -1) {
        disabledDates.splice(index, 1);
    } else {
        disabledDates.push(dateStr);
    }

    disabledDates.sort();
    updateDisabledDatesList();
    renderCalendar();
}

function updateDisabledDatesList() {
    disabledDatesListEl.innerHTML = '';

    if (disabledDates.length === 0) {
        disabledDatesListEl.innerHTML = '<p style="color: #666; font-size: 0.85rem;">중지된 날짜가 없습니다.</p>';
        return;
    }

    disabledDates.forEach(dateStr => {
        const tag = document.createElement('span');
        tag.className = 'date-tag disabled';
        tag.innerHTML = `<i class="fas fa-times"></i> ${formatDisplayDate(dateStr)}`;
        tag.querySelector('i').onclick = (e) => {
            e.stopPropagation();
            toggleDate(dateStr);
        };
        disabledDatesListEl.appendChild(tag);
    });
}

// Helpers
function formatDate(date) {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}${m}${d}`;
}

function formatDisplayDate(dateStr) {
    return `${dateStr.substring(4, 6)}/${dateStr.substring(6, 8)}`;
}

function showStatus(msg, type) {
    statusMsg.textContent = msg;
    statusMsg.className = 'status-message ' + type;
    setTimeout(() => { statusMsg.className = 'status-message'; }, 3000);
}

// Navigation
prevMonthBtn.onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() - 1);
    renderCalendar();
};

nextMonthBtn.onclick = () => {
    currentViewDate.setMonth(currentViewDate.getMonth() + 1);
    renderCalendar();
};
