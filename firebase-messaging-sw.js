// Scripts for firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// TODO: Replace with your project's Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyDl6M8OR7b19jd8P4NvBwSNNe0LvUPHjs8",
  authDomain: "adgd-bab-test.firebaseapp.com",
  projectId: "adgd-bab-test",
  storageBucket: "adgd-bab-test.firebasestorage.app",
  messagingSenderId: "152340406464",
  appId: "1:152340406464:web:038f9a29bc0b98dd4a0d25",
  measurementId: "G-WW41J0SJWW"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  // If the browser already shows a notification (because 'notification' key is in payload),
  // we don't need to call showNotification manually.
  if (payload.notification) {
    console.log('Notification already handled by browser.');
    return;
  }

  // Fallback for data-only messages
  const title = (payload.data && payload.data.title) || '오늘의 급식 🍚';
  const body = (payload.data && payload.data.body) || '메뉴 정보가 없습니다.';

  const notificationOptions = {
    body: body,
    icon: 'icons/icon-192.png',
    tag: 'daily-meal-notification',
    renotify: true,
    data: {
      url: self.registration.scope
    }
  };

  self.registration.showNotification(title, notificationOptions);
});

// Handle notification click
self.addEventListener('notificationclick', function (event) {
  event.notification.close(); // Close the notification

  const targetUrl = event.notification.data.url || self.registration.scope;

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      // If a window is already open, focus it
      for (const client of clientList) {
        if (client.url === targetUrl && 'focus' in client) {
          return client.focus();
        }
      }
      // Otherwise, open a new window
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});
