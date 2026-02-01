# 📁 BLO 세미나 2026 - 배포용 폴더 구조

```
blo-seminar-2026/
│
├── 📄 README.md                          ← 시작 가이드 (필독!)
├── 📄 index.html                         ← 메인 페이지 (여기서 시작)
│
├── 📁 pages/                             ← 추가 페이지들
│   ├── archive.html                     ← 지난 세미나 아카이브
│   ├── schedule.html                    ← 연간 일정
│   └── admin.html                       ← 관리자 페이지
│
├── 📁 data/                              ← 세미나 데이터
│   ├── current.json                     ← 현재 표시 중인 세미나 ID
│   ├── seminars/                        ← 월별 세미나 데이터
│   │   ├── 2026-01.json
│   │   ├── 2026-02.json
│   │   ├── 2026-03.json
│   │   └── ...
│   ├── schedule-2026.json               ← 연간 일정
│   └── archive/                         ← 완료된 세미나 백업
│       ├── 2025-12.json
│       └── ...
│
├── 📁 js/                                ← JavaScript 파일
│   ├── config/
│   │   └── firebase-config.js           ← Firebase 설정
│   ├── modules/
│   │   ├── seminar-loader.js            ← 데이터 로더
│   │   ├── counter.js                   ← 실시간 카운터
│   │   └── email-service.js             ← 이메일 서비스
│   └── utils/
│       └── validate-data.js             ← 데이터 검증
│
├── 📁 css/                               ← 스타일 시트
│   ├── main.css                         ← 메인 스타일
│   ├── archive.css                      ← 아카이브 스타일
│   └── admin.css                        ← 관리자 스타일
│
├── 📁 assets/                            ← 정적 리소스
│   ├── images/
│   │   ├── logo.png
│   │   ├── samsung-logo.png
│   │   └── speakers/                    ← 강사 사진
│   ├── fonts/                           ← 폰트 (선택)
│   └── icons/                           ← 아이콘
│
├── 📁 docs/                              ← 문서
│   ├── FINAL-GUIDE.md                   ← 완전 가이드
│   ├── GUIDE.md                         ← 운영 가이드
│   ├── SYSTEM-GUIDE.md                  ← 시스템 가이드
│   ├── DEPLOY-GUIDE.md                  ← 배포 가이드
│   └── API.md                           ← API 문서
│
├── 📁 templates/                         ← 템플릿 파일
│   ├── email/
│   │   ├── confirmation.html            ← 신청 확인 메일
│   │   ├── reminder.html                ← 리마인더 메일
│   │   └── thank-you.html               ← 감사 메일
│   └── office/
│       ├── seminar-template.docx        ← Word 템플릿
│       └── seminar-template.pptx        ← PPT 템플릿
│
├── 📁 scripts/                           ← 배포/관리 스크립트
│   ├── deploy/
│   │   ├── deploy.sh                    ← Linux/Mac 배포
│   │   ├── deploy.ps1                   ← Windows 배포
│   │   └── deploy.yml                   ← GitHub Actions
│   ├── update/
│   │   ├── update-seminar.sh            ← 세미나 업데이트
│   │   └── backup-data.sh               ← 데이터 백업
│   └── utils/
│       ├── validate-all.js              ← 전체 검증
│       └── generate-report.js           ← 리포트 생성
│
├── 📁 .github/                           ← GitHub 설정
│   └── workflows/
│       └── deploy.yml                   ← 자동 배포
│
├── 📄 .gitignore                         ← Git 무시 파일
├── 📄 package.json                       ← 프로젝트 설정
├── 📄 firebase.json                      ← Firebase 설정 (선택)
└── 📄 LICENSE                            ← 라이선스

```

---

## 🎯 핵심 파일 설명

### 🏠 루트 레벨

| 파일 | 설명 | 필수 |
|------|------|------|
| `index.html` | 메인 페이지 | ✅ 필수 |
| `README.md` | 시작 가이드 | ✅ 필수 |
| `.gitignore` | Git 무시 설정 | ⭐ 권장 |
| `package.json` | 프로젝트 정보 | ⭐ 권장 |

### 📁 pages/ - 추가 페이지

| 파일 | 설명 | 필수 |
|------|------|------|
| `archive.html` | 지난 세미나 | ✅ 필수 |
| `schedule.html` | 연간 일정 | ✅ 필수 |
| `admin.html` | 관리자 페이지 | ⭐ 권장 |

### 📁 data/ - 데이터 파일

| 경로 | 설명 | 필수 |
|------|------|------|
| `current.json` | 현재 세미나 ID | ✅ 필수 |
| `seminars/2026-XX.json` | 월별 데이터 | ✅ 필수 |
| `schedule-2026.json` | 연간 일정 | ✅ 필수 |
| `archive/` | 백업 폴더 | ⭐ 권장 |

### 📁 js/ - JavaScript

| 경로 | 설명 | 필수 |
|------|------|------|
| `config/firebase-config.js` | Firebase 설정 | 🔧 선택 |
| `modules/seminar-loader.js` | 데이터 로더 | ✅ 필수 |
| `modules/counter.js` | 실시간 카운터 | ⭐ 권장 |

---

## 🚀 배포 시나리오별 구조

### 시나리오 1: 기본 배포 (GitHub Pages)
```
최소 필수 파일:
✅ index.html
✅ pages/archive.html
✅ pages/schedule.html
✅ data/seminars/2026-XX.json
✅ data/schedule-2026.json
✅ README.md
```

### 시나리오 2: 실시간 기능 포함 (Firebase)
```
기본 + 추가:
✅ js/config/firebase-config.js
✅ js/modules/counter.js
✅ firebase.json
✅ pages/admin.html
```

### 시나리오 3: 완전한 시스템
```
모든 파일 포함
```

---

## 📦 폴더별 용도

### /pages
- **용도**: HTML 페이지들
- **관리**: 월 1회 업데이트
- **백업**: Git으로 자동

### /data
- **용도**: 세미나 데이터 저장
- **관리**: 매월 새 파일 추가
- **백업**: 매월 archive/ 폴더로 이동

### /js
- **용도**: JavaScript 기능
- **관리**: 기능 추가 시만 수정
- **백업**: Git으로 자동

### /css
- **용도**: 스타일 시트
- **관리**: 디자인 변경 시만
- **백업**: Git으로 자동

### /assets
- **용도**: 이미지, 폰트 등
- **관리**: 필요시 추가
- **백업**: Git으로 자동

### /templates
- **용도**: 재사용 가능한 템플릿
- **관리**: 거의 수정 안함
- **백업**: Git으로 자동

### /scripts
- **용도**: 배포/관리 자동화
- **관리**: 초기 설정 후 거의 수정 안함
- **백업**: Git으로 자동

### /docs
- **용도**: 문서
- **관리**: 기능 추가 시 업데이트
- **백업**: Git으로 자동

---

## 🔄 월별 업데이트 워크플로우

### Step 1: 새 데이터 파일 생성
```bash
# 이전 달 복사
cp data/seminars/2026-02.json data/seminars/2026-03.json

# 관리자 페이지에서 편집 또는 수동 편집
```

### Step 2: current.json 업데이트
```json
{
  "currentSeminarId": "2026-03",
  "lastUpdated": "2026-03-01T10:00:00Z"
}
```

### Step 3: 배포
```bash
# 자동 배포 (GitHub Actions)
git add .
git commit -m "3월 세미나 업데이트"
git push

# 또는 수동 배포
./scripts/deploy/deploy.sh
```

---

## 📊 파일 크기 가이드

| 폴더/파일 | 예상 크기 |
|-----------|----------|
| HTML 파일 (전체) | ~150KB |
| JSON 데이터 | ~50KB |
| JavaScript | ~30KB |
| CSS | ~20KB |
| 이미지 | ~500KB |
| 문서 | ~100KB |
| **전체** | **~850KB** |

---

## 🔐 보안 고려사항

### 공개 저장소
```
✅ 포함 가능:
- HTML, CSS, JS
- JSON 데이터 (개인정보 없는)
- 문서
- 템플릿

❌ 제외해야 할 것:
- Firebase API Key (환경 변수 사용)
- 관리자 비밀번호
- 신청자 개인정보
- 이메일 목록
```

### .gitignore 설정
```
# 민감한 데이터
.env
.env.local
firebase-config-secret.js

# 개인정보
data/registrations/
data/emails/

# 빌드 파일
node_modules/
dist/
.cache/
```

---

## 🎯 배포 체크리스트

### 초기 배포
- [ ] 폴더 구조 생성
- [ ] 필수 파일 복사
- [ ] index.html 확인
- [ ] data/current.json 설정
- [ ] .gitignore 설정
- [ ] GitHub 저장소 생성
- [ ] GitHub Pages 활성화
- [ ] 사이트 접속 확인

### 매월 업데이트
- [ ] 새 JSON 파일 생성
- [ ] 데이터 입력/검증
- [ ] current.json 업데이트
- [ ] 로컬 테스트
- [ ] Git 커밋 & 푸시
- [ ] 배포 확인

---

## 💡 폴더 구조의 장점

### ✅ 명확한 분리
- 각 폴더가 명확한 역할
- 찾기 쉬운 파일 구조
- 유지보수 용이

### ✅ 확장 가능
- 새 기능 추가 쉬움
- 모듈화된 구조
- 재사용 가능

### ✅ 협업 친화적
- 여러 사람이 작업 가능
- 충돌 최소화
- 명확한 책임 분리

### ✅ 자동화 가능
- 스크립트로 관리
- CI/CD 통합 쉬움
- 백업 자동화

---

## 🔄 버전 관리 전략

### main 브랜치
```
운영 중인 실제 사이트
항상 안정적인 상태 유지
```

### develop 브랜치
```
개발/테스트용
새 기능 추가
월별 업데이트 준비
```

### feature 브랜치
```
특정 기능 개발
완료 후 develop에 병합
```

---

이 구조를 기반으로 실제 배포용 파일을 생성하겠습니다!
