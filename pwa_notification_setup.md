# PWA 및 Firebase 푸시 알림 구현 가이드

이 문서는 PWA(Progressive Web App) 환경에서 Firebase Cloud Messaging (FCM)을 사용하여 푸시 알림을 구현하는 방법과 코드를 정리한 기술 문서입니다.

## 1. 프로젝트 설정 및 필수 파일

### 1-1. Manifest 설정 (`manifest.json`)
PWA 설치 및 앱 구동 방식을 정의합니다. `gcm_sender_id`는 Firebase 구버전 설정이므로 최신 웹 푸시 표준에서는 `manifest.json`에 포함하지 않아도 됩니다.

```json
{
    "name": "오늘의 급식 알리미",
    "short_name": "오늘의 급식",
    "start_url": "./index.html",
    "display": "standalone",
    "background_color": "#ffffff",
    "theme_color": "#4CAF50",
    "icons": [
        {
            "src": "icons/icon-192.png",
            "sizes": "192x192",
            "type": "image/png"
        },
        {
            "src": "icons/icon-512.png",
            "sizes": "512x512",
            "type": "image/png",
            "purpose": "any maskable"
        }
    ]
}
```

### 1-2. Firebase SDK 설정
HTML 파일 또는 모듈 스크립트에서 Firebase SDK를 로드합니다.

```javascript
// script.js (Client Side)
import { initializeApp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-app.js";
import { getMessaging, getToken, onMessage, deleteToken } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging.js";
import { getFirestore, doc, setDoc, deleteDoc, serverTimestamp } from "https://www.gstatic.com/firebasejs/9.22.0/firebase-firestore.js";

const firebaseConfig = {
    // Firebase Console > Project Settings에서 확인
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.firebasestorage.app",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID",
    measurementId: "YOUR_MEASUREMENT_ID"
};

const app = initializeApp(firebaseConfig);
const messaging = getMessaging(app);
const db = getFirestore(app);
```

---

## 2. Service Worker (`firebase-messaging-sw.js`)

백그라운드 상태(앱이 닫혀있거나 다른 탭을 보고 있을 때)에서 알림을 수신하고 처리합니다. **이 파일은 반드시 `public` 폴더(루트)에 위치해야 합니다.**

```javascript
// firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

const firebaseConfig = {
    // script.js와 동일한 설정
    // ...
};

firebase.initializeApp(firebaseConfig);
const messaging = firebase.messaging();

// 백그라운드 메시지 수신 핸들러
messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // 브라우저가 자동으로 알림을 표시하지 않는 경우(data-only message 등) 수동 처리
  if (payload.notification) {
    return; // notification 키가 있으면 브라우저가 자동 표시함
  }

  const title = (payload.data && payload.data.title) || '알림';
  const body = (payload.data && payload.data.body) || '메시지가 도착했습니다.';
  
  const notificationOptions = {
    body: body,
    icon: '/icons/icon-192.png',
    tag: 'notification-tag',
    renotify: true,
    data: {
      url: self.registration.scope // 클릭 시 이동할 URL
    }
  };

  self.registration.showNotification(title, notificationOptions);
});

// 알림 클릭 이벤트 핸들러
self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // 이미 열려있는 창이 있으면 포커스
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // 없으면 새 창 열기
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
```

---

## 3. 클라이언트 로직 (알림 권한 및 토큰 관리)

### 3-1. Service Worker 등록
```javascript
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
```

### 3-2. 알림 권한 요청 및 토큰 저장
사용자에게 알림 권한을 요청하고, 승인 시 FCM 토큰을 발급받아 Firestore에 저장합니다.

```javascript
// VAPID Key: Firebase Console > Cloud Messaging > Web configuration에서 생성
const VAPID_KEY = "YOUR_VAPID_KEY";

async function requestPermissionAndSaveToken() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.getRegistration();
            const token = await getToken(messaging, {
                vapidKey: VAPID_KEY,
                serviceWorkerRegistration: registration
            });

            if (token) {
                // Firestore에 토큰 저장 (사용자 식별 및 발송 타겟팅용)
                await saveTokenToFirestore(token); 
                console.log('Token saved:', token);
            }
        } else {
            console.log('Permission denied');
        }
    } catch (error) {
        console.error('Error:', error);
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
```

### 3-3. 포그라운드 메시지 수신
앱이 열려있는 상태(Foreground)에서 메시지를 받을 때 처리합니다.

```javascript
onMessage(messaging, (payload) => {
    console.log('Message received in foreground:', payload);
    // UI 업데이트 또는 토스트 메시지 띄우기
    // *주의: 포그라운드에서는 시스템 알림이 자동으로 뜨지 않으므로 필요 시 직접 구현해야 함
});
```

---

## 4. 서버 측 발송 로직 (Firebase Cloud Functions)

Firebase Admin SDK를 사용하여 다수의 사용자에게 메시지를 발송합니다.

### 4-1. 초기화 및 스케줄러 설정
```javascript
// functions/index.js
const { onSchedule } = require("firebase-functions/v2/scheduler");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();
const db = getFirestore();
const messaging = getMessaging();

exports.dailyNotification = onSchedule({
    schedule: "30 7 * * *", // 매일 오전 7시 30분
    timeZone: "Asia/Seoul",
}, async (event) => {
    // 1. 발송 대상 토큰 수집
    const usersSnapshot = await db.collection('users').get();
    const tokens = [];
    usersSnapshot.forEach(doc => {
        if (doc.data().token) tokens.push(doc.data().token);
    });

    if (tokens.length === 0) return;

    // 2. 메시지 구성
    const message = {
        notification: {
            title: '알림 제목',
            body: '알림 내용입니다.',
        },
        webpush: {
            notification: {
                icon: 'https://your-domain.com/icons/icon-192.png',
                click_action: 'https://your-domain.com/' // 클릭 시 이동 URL (일부 브라우저)
            },
            fcmOptions: {
                link: 'https://your-domain.com/' // 최신 표준 링크
            }
        },
        tokens: tokens, // Multicast 발송
    };

    // 3. 발송
    const response = await messaging.sendEachForMulticast(message);
    console.log(`${response.successCount} messages sent successfully.`);
});
```

## 5. 핵심 포인트 및 주의사항

1.  **HTTPS 필수**: Service Worker와 PWA 기능은 HTTPS 환경(또는 localhost)에서만 작동합니다.
2.  **VAPID Key 일치**: 클라이언트 `getToken` 호출 시 사용하는 VAPID Key와 Firebase 프로젝트 설정이 일치해야 합니다.
3.  **Service Worker Scope**: `firebase-messaging-sw.js` 파일은 가급적 루트 디렉토리에 위치해야 전체 도메인(`/`)을 제어할 수 있습니다.
4.  **토큰 갱신**: 토큰이 만료되거나 변경될 수 있으므로, 앱 시작 시마다 토큰을 확인하고 필요 시 업데이트하는 로직을 권장합니다.
5.  **백그라운드 vs 포그라운드**:
    *   **백그라운드**: Service Worker가 `onBackgroundMessage`를 통해 처리하거나, FCM이 자동으로 시스템 알림 표시.
    *   **포그라운드**: `onMessage` 콜백이 실행됨. 기본적으로 알림이 뜨지 않으므로 UI(Toast 등)로 보여주거나 직접 `new Notification()`을 호출해야 함.
