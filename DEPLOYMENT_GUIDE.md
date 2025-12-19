# Firebase Functions 배포 및 GitHub Secrets 설정 가이드

## 1. Firebase Functions에 환경 변수 설정

### 방법 1: Firebase CLI 사용 (로컬)

```bash
# API 키 설정
firebase functions:config:set holiday.apikey="rvWv1FKlRuABdkHqT5Jl0Iq%2B%2BDLwDLxdMqRSs%2BbQnQmMRxKjPfRjNvhZJDgCPCjTNcfJJqHPnZGLnlZJJA%3D%3D"

# 설정 확인
firebase functions:config:get

# Functions 배포
firebase deploy --only functions:getHolidays
```

### 방법 2: .env 파일 사용 (로컬 개발)

1. `.env` 파일 생성:
```bash
HOLIDAY_API_KEY=rvWv1FKlRuABdkHqT5Jl0Iq%2B%2BDLwDLxdMqRSs%2BbQnQmMRxKjPfRjNvhZJDgCPCjTNcfJJqHPnZGLnlZJJA%3D%3D
```

2. Firebase Emulator로 테스트:
```bash
firebase emulators:start --only functions
```

## 2. GitHub Secrets 설정

### GitHub Repository Settings

1. GitHub 저장소 페이지로 이동
2. **Settings** → **Secrets and variables** → **Actions**
3. **New repository secret** 클릭
4. 다음 Secret 추가:

| Name | Value |
|------|-------|
| `HOLIDAY_API_KEY` | `rvWv1FKlRuABdkHqT5Jl0Iq%2B%2BDLwDLxdMqRSs%2BbQnQmMRxKjPfRjNvhZJDgCPCjTNcfJJqHPnZGLnlZJJA%3D%3D` |

## 3. GitHub Actions 워크플로우 수정

`.github/workflows/firebase-hosting-merge.yml` 파일에 Functions 배포 추가:

```yaml
name: Deploy to Firebase Hosting on merge
on:
  push:
    branches:
      - main

jobs:
  build_and_deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Setup Node.js
        uses: actions/setup-node@v3
        with:
          node-version: '22'
      
      - name: Install Functions dependencies
        run: cd functions && npm ci
      
      - name: Set Firebase Functions config
        run: |
          firebase functions:config:set holiday.apikey="${{ secrets.HOLIDAY_API_KEY }}"
        env:
          FIREBASE_TOKEN: ${{ secrets.FIREBASE_TOKEN }}
      
      - name: Deploy to Firebase
        uses: FirebaseExtended/action-hosting-deploy@v0
        with:
          repoToken: '${{ secrets.GITHUB_TOKEN }}'
          firebaseServiceAccount: '${{ secrets.FIREBASE_SERVICE_ACCOUNT_ADGD_BAB }}'
          channelId: live
          projectId: adgd-bab
```

## 4. 배포 확인

### 로컬 테스트

```bash
# Functions 로컬 실행
firebase emulators:start --only functions

# 테스트 요청
curl http://localhost:5001/adgd-bab/us-central1/getHolidays
```

### 프로덕션 배포

```bash
# Functions 배포
firebase deploy --only functions:getHolidays

# 배포 확인
curl https://us-central1-adgd-bab.cloudfunctions.net/getHolidays
```

## 5. 클라이언트 테스트

브라우저에서 `http://localhost:8000` 접속 후:

1. 개발자 도구 (F12) → Console 탭 확인
2. "Fetching holidays from Firebase Functions..." 메시지 확인
3. 월간 탭에서 공휴일 빨간색 표시 확인

## 보안 체크리스트

- [x] API 키가 클라이언트 코드에 없음
- [x] `.env` 파일이 `.gitignore`에 추가됨
- [x] GitHub Secrets에 API 키 저장
- [x] Firebase Functions에서만 API 키 사용
- [x] CORS 설정으로 허용된 도메인만 접근 가능

## 문제 해결

### Functions 배포 실패 시

```bash
# 로그 확인
firebase functions:log

# Functions 삭제 후 재배포
firebase functions:delete getHolidays
firebase deploy --only functions:getHolidays
```

### API 키 오류 시

```bash
# 현재 설정 확인
firebase functions:config:get

# 설정 초기화
firebase functions:config:unset holiday
firebase functions:config:set holiday.apikey="YOUR_API_KEY"
```
