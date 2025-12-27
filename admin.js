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

// Auth State Observer
onAuthStateChanged(auth, async (user) => {
    if (user && user.email === "kdevelop1592@gmail.com") {
        currentUser = user;
        userInfoEl.textContent = `${user.displayName} (${user.email})`;
        loginSection.style.display = 'none';
        dashboardSection.style.display = 'block';

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
function renderCalendar() {
    const year = currentViewDate.getFullYear();
    const month = currentViewDate.getMonth();

    currentMonthEl.textContent = `${year}년 ${month + 1}월`;
    adminCalendarEl.innerHTML = '';

    const firstDay = new Date(year, month, 1).getDay();
    const totalDays = new Date(year, month + 1, 0).getDate();

    // Empty cells
    for (let i = 0; i < firstDay; i++) {
        const empty = document.createElement('div');
        empty.className = 'calendar-day empty';
        adminCalendarEl.appendChild(empty);
    }

    // Day cells
    for (let i = 1; i <= totalDays; i++) {
        const dayEl = document.createElement('div');
        dayEl.className = 'calendar-day';
        dayEl.textContent = i;

        const dateStr = formatDate(new Date(year, month, i));
        if (disabledDates.includes(dateStr)) {
            dayEl.classList.add('disabled-date');
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
