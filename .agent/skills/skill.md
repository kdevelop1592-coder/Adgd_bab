---
name: firebase_pwa_deployment
description: Guidelines and workflows for deploying the Meal Notification PWA to test and production servers.
---

# Firebase PWA Deployment Skill

이 스킬은 "오늘의 급식 알리미" PWA 애플리케이션의 테스트 및 운영 환경 배포를 안전하게 관리하기 위한 지침을 제공합니다.

## 1. 배포 환경 구성

프로젝트는 두 가지 환경을 사용합니다:
- **Test**: `adgd-bab-test` (개발 및 검증용)
- **Production (Prod)**: `adgd-bab` (실제 서비스용)

### 환경별 주요 설정 (script.js, admin.js, firebase-messaging-sw.js)
배포 전에 반드시 해당 환경의 `firebaseConfig`와 `VAPID_KEY`가 올바르게 설정되어 있는지 체크해야 합니다.

| 항목 | Test 환경 | Prod 환경 |
| :--- | :--- | :--- |
| **projectId** | `adgd-bab-test` | `adgd-bab` |
| **VAPID Key** | 테스트용 고유 키 | 운영용 고유 키 |

## 2. 배포 명령어 활용

별도의 빌드 스크립트가 없는 경우, Firebase CLI의 프로젝트 별칭(-P) 기능을 사용합니다.

### 테스트 서버 배포 (Verification)
```powershell
firebase deploy -P test
```

### 본서버 패치 (Production Deployment)
> [!IMPORTANT]
> 본서버 배포 전에는 반드시 `script.js` 등의 설정이 운영용으로 전환되었는지 재확인하십시오.

```powershell
firebase deploy -P prod
```

## 3. Cloud Functions 설정 (Secrets)

Functions에서 NEIS API를 사용하기 위해 환경 변수(Secret) 설정이 필요합니다.

```powershell
# API 키 설정 (새 프로젝트 배포 시 필수)
firebase functions:secrets:set NEIS_API_KEY
```

## 4. 사후 검증 체크리스트

배포 완료 후 다음 사항을 반드시 확인합니다:
- [ ] 사이트 접속 성공 및 오늘 급식 로드 확인.
- [ ] 알림 설정 토글 버튼이 활성화되는지 확인 (권한 허용 시).
- [ ] (운용 시) 푸시 알림 발송 테스트 (`daily_meal.yml` manual trigger).

## 5. 트러블슈팅

### 401 Unauthorized (FCM 전송 실패)
- `VAPID_KEY`가 해당 프로젝트와 일치하는지 확인하십시오.
- Firebase Console의 '웹 푸시 인증서' 탭에서 키를 다시 확인하거나 갱신하십시오.

### 칼로리 정보 미표시
- 백엔드(`getMeals.js`)의 캐시 로직이 최신인지 확인하십시오. (Kcal 필드 유무 체크 로직 포함 여부)
