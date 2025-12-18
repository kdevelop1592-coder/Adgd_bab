 # 오늘의 급식 알리미 (Today Meal PWA)

매일 아침 7시 30분, 따뜻한 급식 소식을 푸시 알림으로 전해드리는 PWA 웹 애플리케이션입니다.

## ✨ 주요 기능
- **푸시 알림**: 매일 아침 오늘의 급식 메뉴 자동 발송.
- **PWA 지원**: 앱처럼 홈 화면에 설치하여 사용 가능.
- **자동화**: GitHub Actions를 통한 서버리스 스케줄링 (완전 무료).

## 🛠 시스템 아키텍처
- **Frontend**: Firebase Hosting (HTML, CSS, JS)
- **Database**: Cloud Firestore (FCM 토큰 저장)
- **Messaging**: Firebase Cloud Messaging (FCM)
- **Scheduling**: GitHub Actions (매일 07:30 KST 실행)

## 🚀 설치 및 설정 방법
이 프로젝트를 직접 배포하려면 `walkthrough.md` 가이드를 참고하세요.

### 1. Firebase 설정
- `firebase.json`, `.firebaserc` 설정.
- Firestore Database 생성 (`users` 컬렉션).
- FCM(Web Push) 인증서 발급.

### 2. GitHub Actions Secrets
- `FIREBASE_SERVICE_ACCOUNT` 시크릿 등록 필요.

### 3. 로컬 실행
```bash
# 의존성 설치
npm install

# 로컬 서버 실행 (http-server 권장)
npx http-server .
```

## 📱 기여하기
이 프로젝트는 오픈 소스입니다. PR과 이슈 등록을 환영합니다.
