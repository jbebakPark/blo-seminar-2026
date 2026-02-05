# BLO 세미나 2026 - 배포 가이드

## 🚀 자동 배포 시스템

이 프로젝트는 **3가지 자동 배포 방법**을 지원합니다:

### ⚡ 방법 1: 빠른 배포 (추천)

가장 간단하고 빠른 방법입니다!

```powershell
# 프로젝트 폴더에서 실행
.\quick-deploy.bat
```

**동작 과정:**
1. 모든 변경사항을 Git에 커밋
2. GitHub에 푸시
3. GitHub Actions가 자동으로 Firebase에 배포 (1-2분 소요)

**장점:**
- ✅ 가장 간단함 (더블클릭만 하면 됨)
- ✅ GitHub에 자동 백업
- ✅ 배포 기록이 GitHub Actions에 남음

---

### 🎯 방법 2: 고급 배포 (세밀한 제어)

더 많은 옵션을 제공하는 배포 스크립트입니다.

```powershell
# 프로젝트 폴더에서 실행
.\deploy.bat
```

**배포 모드 선택:**
- **[1] 빠른 배포**: Git 커밋 + Firebase 배포
- **[2] Firebase만 배포**: Git 커밋 없이 바로 배포
- **[3] Git 커밋만**: 배포 없이 커밋만
- **[4] 변경사항 확인**: 수정된 파일 목록 확인
- **[5] 취소**: 배포 취소

**기능:**
- ✅ 커밋 메시지 직접 입력 가능
- ✅ GitHub 푸시 여부 선택 가능
- ✅ 변경사항 미리 확인 가능
- ✅ Firebase 로그인 자동 확인

---

### 🤖 방법 3: GitHub Actions 자동 배포

코드를 GitHub에 푸시하면 자동으로 배포됩니다.

```powershell
# 일반적인 Git 워크플로우
git add .
git commit -m "업데이트 내용"
git push origin main
```

**설정 상태:**
- ✅ GitHub Actions 워크플로우 설정 완료
- ⚠️ GitHub Secrets에 `FIREBASE_TOKEN` 등록 필요

**배포 상태 확인:**
- 📊 https://github.com/jbebakPark/blo-seminar-2026/actions

---

## 🔧 초기 설정 (한 번만 실행)

### GitHub Actions 자동 배포 활성화

1. **Firebase CI 토큰 생성**:
```bash
firebase login:ci
```
생성된 토큰을 복사하세요.

2. **GitHub Secrets 등록**:
   - GitHub 저장소 → Settings → Secrets and variables → Actions
   - **New repository secret** 클릭
   - Name: `FIREBASE_TOKEN`
   - Value: 생성한 토큰 붙여넣기
   - **Add secret** 클릭

3. **완료!** 이제 main 브랜치에 푸시하면 자동 배포됩니다.

> 💡 자세한 설정 방법은 [`GITHUB-SETUP.md`](GITHUB-SETUP.md) 참조

---

## 📋 배포 체크리스트

배포 전 확인사항:

- [ ] 로컬에서 테스트 완료
- [ ] HTML/CSS/JS 파일 문법 오류 없음
- [ ] Firebase 설정 파일 (`firebase.json`, `.firebaserc`) 확인
- [ ] 관리자 페이지 로그인 테스트
- [ ] 모바일 반응형 확인

---

## 🔗 주요 링크

### 사이트
- **메인 사이트**: https://admin-samsung-vvip.web.app
- **관리자 페이지**: https://admin-samsung-vvip.web.app/pages/admin.html

### 관리 콘솔
- **Firebase 콘솔**: https://console.firebase.google.com/project/admin-samsung-vvip
- **GitHub Actions**: https://github.com/YOUR_USERNAME/blo-seminar-2026/actions

### 문의
- **카카오톡**: https://open.kakao.com/o/sleUSUei

---

## 👤 관리자 로그인 정보

- **이메일**: jb2park@naver.com
- **비밀번호**: BLO2030Admin!

---

## 🆘 문제 해결

### Firebase 배포 실패

```powershell
# 1. Firebase 로그인 확인
firebase login

# 2. 프로젝트 목록 확인
firebase projects:list

# 3. 프로젝트 선택
firebase use admin-samsung-vvip

# 4. 다시 배포
firebase deploy --only hosting
```

### GitHub Actions 배포 실패

1. GitHub Actions 탭에서 에러 로그 확인
2. `FIREBASE_TOKEN` Secret이 올바르게 설정되었는지 확인
3. 토큰이 만료된 경우 새로 생성:
   ```powershell
   firebase login:ci
   ```

### Git 푸시 실패

```powershell
# 원격 저장소 확인
git remote -v

# 원격 저장소 재설정
git remote set-url origin https://github.com/YOUR_USERNAME/blo-seminar-2026.git

# 다시 푸시
git push origin main
```

---

## 📌 최근 변경사항

### 2026-02-05
- ✅ 개선된 자동배포 시스템 구축
- ✅ `quick-deploy.bat` 추가 (빠른 배포)
- ✅ `deploy.bat` 고급 기능 추가 (모드 선택, 커밋 메시지 입력)
- ✅ GitHub Actions 워크플로우 개선 (상세 로깅, 에러 처리)

### 이전 변경사항
- ✅ 관리자 이메일 변경: jb2park@naver.com
- ✅ 관리자 페이지 로그인 보안 강화
- ✅ 네비게이션에서 관리자 링크 숨김
- ✅ 카카오톡 링크 통일
- ✅ "주체"를 "주최"로 수정

