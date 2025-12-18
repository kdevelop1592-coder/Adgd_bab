# 🍚 PWA 급식 알리미 만들기: A to Z 가이드

이 문서는 사용자가 직접 학교 급식 정보를 가져와 매일 아침 알림을 보내주는 Progressive Web App(PWA)을 처음부터 끝까지 만드는 방법을 설명합니다.

---

## 🛠 준비물
1.  **Google 계정**: Firebase 사용을 위해 필요합니다.
2.  **나이스(NEIS) 오픈 API 키**: [나이스 교육정보 개방 포털](https://open.neis.go.kr/)에서 신청 (즉시 발급).
3.  **GitHub 계정**: 코드 저장 및 자동화(GitHub Actions)를 위해 필요합니다.

---

## 🏗 STEP 1: Firebase 프로젝트 설정
1.  [Firebase 콘솔](https://console.firebase.google.com/)에서 프로젝트를 생성합니다.
2.  **Firestore Database**: 데이터베이스를 생성하고 `users` 컬렉션을 준비합니다 (토큰 저장용).
3.  **Cloud Messaging**: 설정에서 `Web Push certificates` (VAPID 키)를 생성합니다.
4.  **Project Settings**: `Service accounts` 탭에서 **새 비공개 키(JSON)**를 생성하여 다운로드합니다 (알림 발송 스크립트용).

---

## 💻 STEP 2: 프론트엔드 (PWA) 구현

### 1. HTML/CSS/JS (기본 웹사이트)
*   사용자가 급식을 확인할 수 있는 인터페이스를 만듭니다.
*   Firebase SDK를 사용하여 사용자의 '알림 권한'을 요청하고, 허용 시 **FCM 토큰**을 발급받아 Firestore에 저장합니다.

### 2. PWA 설정 (`manifest.json`)
*   앱 이름, 아이콘, 테마 색상을 정의하여 브라우저가 "앱으로 설치"할 수 있게 합니다.

### 3. 서비스 워커 (`firebase-messaging-sw.js`)
*   브라우저가 꺼져 있을 때도 배경에서 알림 메시지를 수신할 수 있도록 설정합니다.

---

## 📡 STEP 3: 알림 발송 스크립트 (`Node.js`)
배경에서 실행될 `scripts/send_notification.js`를 작성합니다.
1.  **나이스 API 호출**: 오늘 날짜의 급식 정보를 가져옵니다.
2.  **Firestore 조회**: 알림을 신청한 모든 사용자의 토큰 리스트를 가져옵니다.
3.  **FCM 발송**: `firebase-admin` SDK를 사용하여 사용자들에게 푸시 알림을 보냅니다.

---

## 🤖 STEP 4: GitHub Actions 자동화
매일 아침 정해진 시간에 알림을 보내도록 설정합니다.
1.  `.github/workflows/daily_meal.yml` 파일을 생성합니다.
2.  **Cron 설정**: `30 22 * * *` (UTC 기준 22:30은 한국 시간 오전 7:30입니다).
3.  **Secrets 설정**: GitHub 저장소 설정에서 `FIREBASE_SERVICE_ACCOUNT` (JSON 내용 전체)와 `NEIS_API_KEY`를 비밀 변수로 등록합니다.

---

## 🚀 STEP 5: 배포 및 테스트
1.  **Firebase Hosting** 또는 **GitHub Pages**를 통해 사이트를 배포합니다.
    > [!IMPORTANT]
    > 알림 기능은 반드시 **HTTPS** 환경에서 접속해야 보안 정책상 정상적으로 작동합니다.
2.  모바일 브라우저로 접속하여 **"홈 화면에 추가"**를 누릅니다.
3.  설치된 앱을 열고 **"알림 켜기"**를 눌러 권한을 허용합니다.
4.  내일 아침 7시 30분에 알림이 오는지 기다리거나, GitHub Actions에서 `workflow_dispatch`로 즉시 테스트해 봅니다.

---

## 💡 팁
*   **아이폰(iOS) 설치**: 아이폰의 사파리 브라우저는 "설치 버튼"을 자동으로 띄워주지 않습니다. 따라서 사용자에게 하단의 **공유 버튼(네모에 화살표)**을 눌러 직접 **'홈 화면에 추가'**를 하도록 안내하는 별도의 로직이 필요합니다. (현재 프로젝트에는 이 안내 로직이 추가되어 있습니다.)
*   **학교 코드**: 학교마다 `ATPT_OFCDC_SC_CODE`(시도교육청)와 `SD_SCHUL_CODE`(행정표준코드)가 다릅니다. 나이스 포털에서 본인 학교의 코드를 확인하여 적용하세요.

이제 여러분만의 급식 알리미가 완성되었습니다! 🍴
