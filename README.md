# 🎯 2030 Business Live ON 세미나 2026

> 삼성생명 WM사업부 프리미엄 경영 세미나 공식 웹사이트

[![Version](https://img.shields.io/badge/version-1.0.0-blue)](https://github.com/jbebakPark/blo-seminar-2026)
[![License](https://img.shields.io/badge/license-MIT-green)](LICENSE)
[![Status](https://img.shields.io/badge/status-active-success)](https://jbebakpark.github.io/blo-seminar-2026)

---

## 🚀 빠른 시작

### 사이트 접속
🌐 **https://jbebakpark.github.io/blo-seminar-2026**

### 페이지 목록
- 🏠 [메인 페이지](https://jbebakpark.github.io/blo-seminar-2026)
- 📚 [세미나 아카이브](https://jbebakpark.github.io/blo-seminar-2026/pages/archive.html)
- 📅 [연간 일정](https://jbebakpark.github.io/blo-seminar-2026/pages/schedule.html)
- ⚙️ [관리자](https://jbebakpark.github.io/blo-seminar-2026/pages/admin.html)

---

## 📁 폴더 구조

```
blo-seminar-2026/
├── 📄 index.html                ← 메인 페이지
├── 📁 pages/                    ← 추가 페이지
│   ├── archive.html
│   ├── schedule.html
│   └── admin.html
├── 📁 data/                     ← 세미나 데이터
│   ├── current.json
│   ├── seminars/
│   ├── schedule-2026.json
│   └── archive/
├── 📁 js/                       ← JavaScript
├── 📁 css/                      ← 스타일시트
├── 📁 assets/                   ← 이미지, 아이콘
├── 📁 templates/                ← 템플릿
├── 📁 scripts/                  ← 배포 스크립트
└── 📁 docs/                     ← 문서
```

상세 구조는 [`docs/STRUCTURE.md`](docs/STRUCTURE.md) 참조

---

## ✨ 주요 기능

### 1. 📚 세미나 아카이브
- 지난 세미나 자동 표시
- 필터링 및 검색
- 신청자 통계

### 2. 📅 연간 일정
- 2026년 12개 세미나
- 분기별 구성
- 진행 상태 실시간 표시

### 3. 📊 실시간 카운터
- 온라인/오프라인 신청자 수
- 실시간 업데이트
- 애니메이션 효과

### 4. 📧 이메일 알림
- 신청 확인 메일
- 세미나 리마인더
- 자동 발송 시스템

### 5. ⚙️ 관리자 페이지
- GUI 데이터 편집
- 통계 대시보드
- 이메일 발송 관리

---

## 🔧 로컬 개발

### 필요 사항
- Python 3.x 또는 Node.js
- Git
- 웹 브라우저

### 설치 및 실행

```bash
# 저장소 클론
git clone https://github.com/jbebakPark/blo-seminar-2026.git
cd blo-seminar-2026

# 로컬 서버 실행 (Python)
python -m http.server 8000

# 또는 Node.js
npx http-server

# 브라우저에서 http://localhost:8000 접속
```

---

## 📝 월별 업데이트

### 1단계: 데이터 파일 생성
```bash
# 이전 달 복사
cp data/seminars/2026-02.json data/seminars/2026-03.json
```

### 2단계: 데이터 편집
관리자 페이지(`pages/admin.html`)에서 GUI로 편집하거나
JSON 파일을 직접 수정

### 3단계: current.json 업데이트
```json
{
  "currentSeminarId": "2026-03",
  "currentDataFile": "data/seminars/2026-03.json"
}
```

### 4단계: 배포
```bash
git add .
git commit -m "3월 세미나 업데이트"
git push
```

자동 배포됨! 🚀

---

## 🎯 관리자 기능

### 접속
🔐 **https://jbebakpark.github.io/blo-seminar-2026/pages/admin.html**

### 로그인
- 이메일: `admin@samsung.com`
- 비밀번호: `password123`

### 기능
- 📝 세미나 데이터 편집
- 📊 신청자 현황 확인
- 📧 이메일 발송
- 📅 연간 일정 관리

---

## 📚 문서

| 문서 | 설명 |
|------|------|
| [FINAL-GUIDE.md](docs/FINAL-GUIDE.md) | 📚 전체 시스템 완전 가이드 |
| [GUIDE.md](docs/GUIDE.md) | 기본 운영 가이드 |
| [SYSTEM-GUIDE.md](docs/SYSTEM-GUIDE.md) | 시스템 구조 가이드 |
| [DEPLOY-GUIDE.md](docs/DEPLOY-GUIDE.md) | 배포 가이드 |
| [STRUCTURE.md](STRUCTURE.md) | 폴더 구조 설명 |

---

## 🚀 배포

### ⚡ 빠른 배포 (추천)

프로젝트 폴더에서 실행:
```bash
# Windows
.\quick-deploy.bat

# 또는 고급 옵션
.\deploy.bat
```

**동작 과정:**
1. Git 커밋 및 푸시
2. GitHub Actions 자동 배포 (1-2분)
3. Firebase Hosting 업데이트

### 🤖 GitHub Actions (자동)

- `main` 브랜치에 푸시하면 자동 배포
- Firebase Hosting으로 배포
- 약 1-2분 소요

**배포 상태 확인:**
- 📊 [GitHub Actions](https://github.com/jbebakPark/blo-seminar-2026/actions)

### 📖 상세 가이드

배포 방법 및 문제 해결은 [`DEPLOY.md`](DEPLOY.md) 참조

**주요 배포 옵션:**
- 🚀 빠른 배포: `quick-deploy.bat`
- 🎯 고급 배포: `deploy.bat` (모드 선택 가능)
- 🤖 자동 배포: Git push → GitHub Actions

---

## 🔐 보안

### 관리자 페이지 보안 강화

- ✅ **로그인 시도 제한**: 5회 실패 시 15분간 계정 잠금
- ✅ **세션 타임아웃**: 30분 비활동 시 자동 로그아웃
- ✅ **페이지 접근 제어**: 비인증 사용자 완전 차단
- ✅ **세션 모니터링**: 실시간 세션 유효성 검증
- ✅ **활동 감지**: 마우스, 키보드, 스크롤 활동 자동 추적
- ✅ **역할 기반 권한**: 관리자/데모 계정 분리

### 로그인 정보

#### 관리자 계정
- **URL**: https://admin-samsung-vvip.web.app/pages/admin.html
- **이메일**: jb2park@naver.com
- **비밀번호**: BLO2030Admin!

#### 데모 계정
- **용도**: 시스템 데모, 교육, 테스트 (읽기 전용)
- **정보**: 내부 문서 [`DEMO-ACCOUNT.md`](DEMO-ACCOUNT.md) 참조

### 보안 정책

- 로그인 실패 5회 → 15분 잠금
- 비활동 30분 → 자동 로그아웃
- 페이지 직접 접근 → 인증 필요
- 데모 계정 → 읽기 전용 권한

### 상세 가이드

- **보안 기능**: [`SECURITY.md`](SECURITY.md)
- **데모 계정**: [`DEMO-ACCOUNT.md`](DEMO-ACCOUNT.md) (내부용)

---

## 💰 비용

**완전 무료!** 🎉

- GitHub Pages: 무료
- Firebase (선택): 무료 플랜
- EmailJS (선택): 무료 200건/월

---

## 📞 문의

### 담당자
- 이름: 박재박 팀장
- 전화: 010-5137-2327
- 이메일: (필요시 추가)

### 기술 지원
- 문서: `docs/` 폴더
- Issues: GitHub Issues 탭
- 이메일: (필요시 추가)

---

## 📄 라이선스

MIT License - 자유롭게 사용, 수정, 배포 가능

---

## 🎉 버전 히스토리

### v1.0.0 (2026-02-01)
- ✅ 초기 릴리스
- ✅ 5대 핵심 기능 완성
- ✅ 배포 자동화
- ✅ 완전한 문서화

---

**제작**: 삼성생명 WM사업부  
**담당**: 박재박 팀장  
**최종 업데이트**: 2026-02-01
