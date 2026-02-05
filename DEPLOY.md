# BLO 세미나 2026 - 배포 가이드

## 🚀 자동 배포 방법

### 방법 1: 브라우저에서 직접 배포 (가장 간단)

1. Firebase 콘솔 접속: https://console.firebase.google.com
2. 프로젝트 선택: `admin-samsung-vvip`
3. 좌측 메뉴에서 **Hosting** 클릭
4. **배포** 버튼 클릭
5. 프로젝트 폴더 전체를 드래그 앤 드롭

### 방법 2: 명령어로 배포

#### 1단계: Firebase 로그인
```powershell
firebase login
```
브라우저가 열리면 Google 계정으로 로그인

#### 2단계: 배포 실행
```powershell
cd d:\Project\jbpark\blo-seminar-2026
firebase deploy --only hosting
```

### 방법 3: GitHub Actions 자동 배포 (설정 필요)

1. Firebase CI 토큰 생성:
```powershell
firebase login:ci
```

2. 생성된 토큰을 복사

3. GitHub 저장소 설정:
   - Settings > Secrets and variables > Actions
   - New repository secret 클릭
   - Name: `FIREBASE_TOKEN`
   - Value: 복사한 토큰 붙여넣기

4. 이후 main 브랜치에 push하면 자동 배포됨

## 📝 관리자 로그인 정보

- **URL**: https://admin-samsung-vvip.web.app/pages/admin.html
- **이메일**: jb2park@naver.com
- **비밀번호**: BLO2030Admin!

## 🔗 주요 링크

- **메인 사이트**: https://admin-samsung-vvip.web.app
- **Firebase 콘솔**: https://console.firebase.google.com/project/admin-samsung-vvip
- **카카오톡 문의**: https://open.kakao.com/o/sleUSUei

## 📌 최근 변경사항

- ✅ 관리자 이메일 변경: jb2park@naver.com
- ✅ 관리자 페이지 로그인 보안 강화
- ✅ 네비게이션에서 관리자 링크 숨김
- ✅ 카카오톡 링크 통일
- ✅ "주체"를 "주최"로 수정
