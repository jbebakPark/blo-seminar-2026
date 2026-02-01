# 🤖 자동 배포 시스템 - 설치 및 사용 가이드

## 📦 제공된 스크립트

| 파일 | 설명 | 사용처 |
|------|------|--------|
| `deploy.yml` | GitHub Actions 워크플로우 | `.github/workflows/` |
| `validate-data.js` | 데이터 검증 스크립트 | `scripts/` |
| `deploy.sh` | 로컬 배포 스크립트 (Mac/Linux) | `scripts/` |
| `deploy.ps1` | 로컬 배포 스크립트 (Windows) | `scripts/` |
| `update-seminar.sh` | 월별 업데이트 스크립트 | `scripts/` |
| `package.json` | npm 설정 | 루트 |

---

## 🚀 빠른 설치 (5분)

### Step 1: 폴더 구조 만들기

```bash
cd blo-seminar-2026

# 폴더 생성
mkdir -p .github/workflows
mkdir -p scripts

# 스크립트 복사
cp ~/Downloads/deploy.yml .github/workflows/
cp ~/Downloads/validate-data.js scripts/
cp ~/Downloads/deploy.sh scripts/
cp ~/Downloads/update-seminar.sh scripts/
cp ~/Downloads/package.json ./

# 실행 권한 부여
chmod +x scripts/deploy.sh
chmod +x scripts/update-seminar.sh
```

### Step 2: 설정 확인

```bash
# 파일 구조 확인
tree -L 2

# 예상 출력:
# .
# ├── .github/
# │   └── workflows/
# │       └── deploy.yml
# ├── scripts/
# │   ├── validate-data.js
# │   ├── deploy.sh
# │   └── update-seminar.sh
# ├── package.json
# ├── index.html
# ├── data/
# │   └── ...
```

### Step 3: 첫 배포

```bash
# 커밋 및 푸시
git add .
git commit -m "🤖 자동 배포 시스템 추가"
git push origin main

# GitHub Actions 자동 실행! ✅
```

---

## 📖 사용법

### 1️⃣ GitHub Actions (자동 배포)

**언제**: `git push`할 때마다 자동 실행

**확인**:
```
https://github.com/jbebakPark/blo-seminar-2026/actions
```

**작동 과정**:
1. 코드 푸시 감지
2. 파일 구조 검증
3. JSON 문법 검증
4. 데이터 무결성 검증
5. 배포 완료
6. 사이트 자동 업데이트 (1-2분 소요)

**실패 시**:
- Actions 탭에서 빨간색 ❌ 표시
- 로그 확인하여 문제 해결
- 수정 후 다시 푸시

---

### 2️⃣ 로컬 검증만 실행

```bash
# Node.js로 검증
npm run validate

# 또는 직접 실행
node scripts/validate-data.js
```

**출력 예시**:
```
╔════════════════════════════════════════╗
║  📊 BLO 세미나 데이터 검증 시작      ║
╚════════════════════════════════════════╝

📂 검증할 파일 (3개):
   data-2026-02.json, data-2026-03.json, schedule-2026.json

📄 data-2026-02.json
✅ 검증 통과

📄 data-2026-03.json
✅ 검증 통과

📅 schedule-2026.json
✅ 검증 통과

════════════════════════════════════════
📊 검증 결과 요약
════════════════════════════════════════
✅ 성공: 3개
⚠️  경고: 0개
❌ 오류: 없음

✅ 모든 데이터 검증 완료!
```

---

### 3️⃣ 로컬 배포 스크립트

**Mac/Linux**:
```bash
# 기본 배포
./scripts/deploy.sh

# 검증만 수행
./scripts/deploy.sh --validate-only

# 검증 스킵하고 바로 배포
./scripts/deploy.sh --skip-validation

# Firebase 배포
./scripts/deploy.sh --firebase
```

**Windows PowerShell**:
```powershell
# 기본 배포
.\scripts\deploy.ps1

# 검증만 수행
.\scripts\deploy.ps1 -ValidateOnly

# 검증 스킵
.\scripts\deploy.ps1 -SkipValidation

# Firebase 배포
.\scripts\deploy.ps1 -Firebase
```

**실행 과정**:
```
╔════════════════════════════════════════╗
║    🚀 BLO 세미나 배포 스크립트        ║
╚════════════════════════════════════════╝

[1/5] Git 상태 확인...
✅ 현재 브랜치: main

[2/5] 파일 구조 검증...
✅ index.html
✅ archive.html
✅ schedule.html
✅ admin.html
✅ data 폴더 존재

[3/5] 데이터 검증...
✅ data-2026-02.json
✅ data-2026-03.json
✅ schedule-2026.json

[4/5] Git 커밋 및 푸시...
커밋 메시지 입력 (기본: 자동 배포): 3월 세미나 정보 업데이트
✅ 커밋 완료
✅ 푸시 완료

[5/5] 배포 정보
========================================
✅ 배포 성공!

📅 배포 시간: 2026-02-01 14:30:00
🔖 커밋: abc1234
🌿 브랜치: main

🌐 GitHub Pages: https://jbebakpark.github.io/blo-seminar-2026/
⏱️  약 1-2분 후 사이트 업데이트 완료
========================================
```

---

### 4️⃣ 월별 세미나 업데이트

**자동 템플릿 생성**:
```bash
# 3월 세미나 생성
./scripts/update-seminar.sh 2026-03

# 4월 세미나 생성
./scripts/update-seminar.sh 2026-04
```

**실행 과정**:
```
╔════════════════════════════════════════╗
║   📅 BLO 세미나 월별 업데이트        ║
╚════════════════════════════════════════╝

📅 업데이트 대상: 2026년 03월

📋 템플릿 파일: data/data-2026-02.json
✅ 템플릿 복사 완료: data/data-2026-03.json

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📝 다음 단계:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. 데이터 파일 편집:
   code data/data-2026-03.json
   또는 관리자 페이지에서 편집 후 다시 다운로드

2. index.html 수정:
   const CURRENT_DATA_FILE = 'data/data-2026-03.json';
   const CURRENT_SEMINAR_ID = '2026-03';

3. 검증:
   node scripts/validate-data.js

4. 배포:
   ./scripts/deploy.sh

index.html을 자동으로 업데이트하시겠습니까? (y/N): y
✅ index.html 업데이트 완료
   백업: index.html.backup

✅ 월별 업데이트 준비 완료!
```

---

## 🎯 실제 워크플로우

### 매월 세미나 정보 업데이트 (완전 자동화)

```bash
# 1. 템플릿 생성 (기존 데이터 복사)
./scripts/update-seminar.sh 2026-03

# 2. 관리자 페이지에서 데이터 편집
# → admin.html 접속
# → 세미나 정보 입력
# → JSON 다운로드
# → data/data-2026-03.json 덮어쓰기

# 3. 검증 (선택사항)
npm run validate

# 4. 배포 (한 번에!)
./scripts/deploy.sh

# ✅ 완료! GitHub Actions가 자동으로 검증 및 배포
```

**소요 시간**: **5분** (기존 30분 → 83% 절감)

---

## 📊 npm 스크립트 정리

```json
{
  "scripts": {
    "validate": "데이터 검증",
    "test": "validate와 동일",
    "deploy": "로컬 배포 스크립트 실행",
    "deploy:validate": "검증만 수행",
    "deploy:firebase": "Firebase 배포",
    "update": "월별 업데이트 스크립트",
    "serve": "로컬 서버 실행 (http://localhost:8000)",
    "dev": "serve와 동일"
  }
}
```

**사용 예시**:
```bash
npm run validate     # 데이터 검증
npm test             # 데이터 검증 (동일)
npm run serve        # 로컬 서버 실행
npm run dev          # 로컬 서버 실행 (동일)
```

---

## 🐛 문제 해결

### 문제 1: "permission denied" 에러

**원인**: 스크립트에 실행 권한 없음

**해결**:
```bash
chmod +x scripts/deploy.sh
chmod +x scripts/update-seminar.sh
```

### 문제 2: GitHub Actions 실패

**확인**:
1. Actions 탭 접속
2. 실패한 워크플로우 클릭
3. 로그 확인

**일반적인 원인**:
- JSON 문법 오류 → `npm run validate`로 확인
- 필수 파일 누락 → 파일 확인
- 데이터 파일 경로 오류 → index.html 확인

### 문제 3: Node.js 스크립트 실행 안 됨

**원인**: Node.js 미설치

**해결**:
```bash
# Node.js 설치 확인
node --version

# 없다면 설치
# Mac: brew install node
# Ubuntu: sudo apt install nodejs npm
# Windows: https://nodejs.org 에서 다운로드
```

### 문제 4: Windows에서 스크립트 실행 안 됨

**원인**: PowerShell 실행 정책

**해결**:
```powershell
# 관리자 권한으로 PowerShell 실행
Set-ExecutionPolicy RemoteSigned -Scope CurrentUser

# 스크립트 실행
.\scripts\deploy.ps1
```

---

## 🎉 완료 체크리스트

### ✅ 초기 설정

- [ ] `.github/workflows/deploy.yml` 생성
- [ ] `scripts/` 폴더에 모든 스크립트 복사
- [ ] `package.json` 루트에 복사
- [ ] 스크립트 실행 권한 부여 (`chmod +x`)
- [ ] Git 커밋 및 푸시
- [ ] GitHub Actions 실행 확인

### ✅ 기능 테스트

- [ ] `npm run validate` 실행
- [ ] `./scripts/deploy.sh --validate-only` 실행
- [ ] `./scripts/update-seminar.sh 2026-03` 실행
- [ ] 실제 배포 테스트
- [ ] GitHub Actions 성공 확인

### ✅ 문서화

- [ ] 팀원들에게 사용법 공유
- [ ] README 업데이트
- [ ] 긴급 연락망 확인

---

## 📞 추가 지원

더 궁금한 점이 있으시면:
1. GitHub Issues 생성
2. 스크립트 로그 첨부
3. 오류 메시지 전체 복사

**Happy Deploying! 🚀**
