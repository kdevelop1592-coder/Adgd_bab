// Scripts for firebase-messaging-sw.js
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.22.0/firebase-messaging-compat.js');

// TODO: Replace with your project's Firebase Config
const firebaseConfig = {
  apiKey: "AIzaSyD-6VZb7DYLBLwungZRvhfNLS9T5-RXtrM",
  authDomain: "adgd-bab.firebaseapp.com",
  projectId: "adgd-bab",
  storageBucket: "adgd-bab.firebasestorage.app",
  messagingSenderId: "445040265724",
  appId: "1:445040265724:web:e971afd0ae1533a2d24a79",
  measurementId: "G-RND2J0EBBN"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage(function (payload) {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);

  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: 'icons/icon-192.png'
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
