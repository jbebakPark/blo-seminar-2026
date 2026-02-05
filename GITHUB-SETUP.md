# 🔧 GitHub Actions 자동배포 활성화 가이드

## 📋 현재 상태

✅ GitHub 저장소: `jbebakPark/blo-seminar-2026`
✅ Firebase 토큰: 생성 완료
✅ GitHub Actions 워크플로우: 설정 완료
⚠️ GitHub Secrets: **설정 필요**

---

## 🚀 GitHub Secrets 설정 방법

### 1단계: GitHub 저장소 Settings 페이지로 이동

**URL을 복사하여 브라우저에 붙여넣으세요:**
```
https://github.com/jbebakPark/blo-seminar-2026/settings/secrets/actions
```

### 2단계: "New repository secret" 버튼 클릭

오른쪽 상단의 초록색 버튼을 클릭하세요.

### 3단계: Secret 정보 입력

**Name (이름):**
```
FIREBASE_TOKEN
```

**Value (값):**
```
[Firebase CLI에서 생성한 토큰을 여기에 붙여넣으세요]
```

> ⚠️ **보안 주의사항**  
> Firebase 토큰은 민감한 정보입니다. 실제 토큰 값은:
> 1. 터미널에서 `firebase login:ci` 명령으로 생성
> 2. 생성된 토큰을 복사하여 위의 Value 필드에 붙여넣기
> 3. 이 문서에는 실제 토큰을 기록하지 마세요

### 4단계: "Add secret" 버튼 클릭

### 5단계: 완료 확인

Secret이 추가되면 다음과 같이 표시됩니다:
- FIREBASE_TOKEN (Updated now)

---

## ✅ 설정 완료 후 테스트

### 방법 1: 빠른 배포로 테스트

```bash
# 프로젝트 폴더에서 실행
.\quick-deploy.bat
```

### 방법 2: 수동으로 테스트

```bash
git add .
git commit -m "GitHub Actions 자동배포 테스트"
git push origin main
```

### 배포 상태 확인

**GitHub Actions 페이지:**
```
https://github.com/jbebakPark/blo-seminar-2026/actions
```

1-2분 후 배포가 완료되면:
- ✅ 초록색 체크 표시
- 🌐 사이트 업데이트 완료

---

## 🔗 주요 링크

### GitHub
- **저장소**: https://github.com/jbebakPark/blo-seminar-2026
- **Settings**: https://github.com/jbebakPark/blo-seminar-2026/settings
- **Secrets**: https://github.com/jbebakPark/blo-seminar-2026/settings/secrets/actions
- **Actions**: https://github.com/jbebakPark/blo-seminar-2026/actions

### Firebase
- **콘솔**: https://console.firebase.google.com/project/admin-samsung-vvip
- **Hosting**: https://console.firebase.google.com/project/admin-samsung-vvip/hosting
- **사이트**: https://admin-samsung-vvip.web.app

---

## 🆘 문제 해결

### Secret이 보이지 않는 경우

1. GitHub 저장소의 **Settings** 탭이 보이는지 확인
   - 안 보이면: 저장소 권한이 없음 (Owner에게 요청)
2. 왼쪽 메뉴에서 **Secrets and variables** → **Actions** 클릭

### 배포가 실패하는 경우

1. GitHub Actions 탭에서 에러 로그 확인
2. Secret 이름이 정확히 `FIREBASE_TOKEN`인지 확인 (대소문자 구분)
3. 토큰 값에 공백이나 줄바꿈이 없는지 확인

### 404 에러가 발생하는 경우

저장소가 Private인 경우 로그인이 필요합니다:
1. GitHub에 로그인
2. 위의 URL로 다시 접속

---

## 📝 다음 단계

1. ✅ GitHub Secrets 설정
2. ✅ 테스트 배포 실행
3. ✅ Actions 탭에서 배포 상태 확인
4. ✅ 사이트 접속하여 확인

모든 설정이 완료되면 **main 브랜치에 push할 때마다 자동으로 배포**됩니다! 🎉
