# 🎯 BLO 세미나 통합 관리 시스템 - 완전판

## 📦 제공된 파일 목록

### 🌐 웹 페이지
- `index-with-counter.html` - 메인 페이지 (실시간 카운터 포함)
- `archive.html` - 지난 세미나 아카이브
- `schedule.html` - 연간 일정 페이지
- `admin.html` - 관리자 페이지 (GUI 편집기)

### 📊 데이터 파일
- `data-2026-02.json` - 2월 세미나 데이터
- `data-2026-03.json` - 3월 세미나 샘플
- `schedule-2026.json` - 2026년 연간 일정

### 🔧 JavaScript 파일
- `firebase-config.js` - Firebase 연동 설정
- `counter-widget.js` - 실시간 카운터 위젯

### 📚 문서
- `GUIDE.md` - 기본 운영 가이드
- `SYSTEM-GUIDE.md` - 시스템 구조 및 설정 가이드
- `FINAL-GUIDE.md` - 이 문서

---

## ✨ 핵심 기능

### 1. 📚 지난 세미나 아카이브
**파일**: `archive.html`

**기능**:
- 완료된 세미나 자동 표시
- 날짜별 정렬 및 검색
- 상세보기 모달
- 신청자 수 통계 표시

**사용법**:
1. `archive.html` 파일을 GitHub 저장소에 업로드
2. 완료된 세미나는 자동으로 표시됨
3. 필터 버튼으로 연도별, 타입별 검색

### 2. 📅 연간 일정 자동 표시
**파일**: `schedule.html`, `schedule-2026.json`

**기능**:
- 분기별 세미나 일정
- 진행 상태 자동 표시 (완료/진행중/예정)
- 실시간 업데이트
- 반응형 디자인

**업데이트 방법**:
```json
// schedule-2026.json 수정
{
  "sessions": [
    {
      "id": "2026-03",
      "date": "2026-03-24",
      "title": "새로운 제목",
      "speakers": ["강사명"],
      "status": "upcoming"  // completed, current, upcoming
    }
  ]
}
```

### 3. 📊 신청자 수 실시간 카운터
**파일**: `index-with-counter.html`, `counter-widget.js`

**기능**:
- 온라인/오프라인 신청자 수 분리 표시
- 실시간 업데이트 (Firebase 연동 시)
- 애니메이션 효과
- 로컬 스토리지 백업

**두 가지 모드**:

#### A. Firebase 연동 모드 (권장)
- 실시간 동기화
- 여러 장치에서 동시 업데이트
- 자동 백업

#### B. 로컬 모드
- Firebase 없이도 작동
- 브라우저 로컬 스토리지 사용
- 데모/시뮬레이션 기능 포함

**설정**:
```javascript
// index-with-counter.html에서 설정
const firebaseConfig = {
    apiKey: "YOUR_API_KEY",  // Firebase 설정 입력
    // ...
};

// 또는 로컬 모드로 사용 (기본값 유지)
```

### 4. 📧 이메일 알림 자동 발송
**파일**: `admin.html` (이메일 발송 탭)

**기능**:
- 신청 확인 메일
- 세미나 리마인더 (D-7, D-1)
- 감사 메일
- 대량 발송

**설정 방법**:

#### Option 1: EmailJS (간단, 무료 200건/월)
```javascript
// admin.html에 추가
emailjs.init("YOUR_USER_ID");

function sendEmail(recipient, subject, message) {
    emailjs.send("service_id", "template_id", {
        to_email: recipient,
        subject: subject,
        message: message
    });
}
```

#### Option 2: 서버 사이드 (PHP/Node.js)
```php
// send-email.php
<?php
$to = $_POST['email'];
$subject = $_POST['subject'];
$message = $_POST['message'];

mail($to, $subject, $message);
?>
```

### 5. ⚙️ 관리자 페이지 (GUI 편집기)
**파일**: `admin.html`

**기능**:
- 드래그 앤 드롭 편집
- 실시간 미리보기
- JSON 자동 생성 및 다운로드
- 신청자 현황 대시보드
- 이메일 발송 관리
- 연간 일정 편집

**로그인**:
- 데모 계정: `admin@samsung.com` / `password123`
- 실제 사용시 Firebase Authentication 연동

**사용법**:
1. 관리자 페이지 접속
2. 로그인
3. 원하는 탭 선택
4. 데이터 수정
5. "저장하기" 클릭 → JSON 다운로드
6. GitHub에 업로드

---

## 🚀 빠른 시작 (3가지 방법)

### 방법 1: 로컬 테스트 (Firebase 없이)
```bash
# 1. 모든 파일을 한 폴더에 넣기
mkdir blo-seminar
cd blo-seminar

# 2. 파일 복사
# - index-with-counter.html → index.html로 이름 변경
# - 나머지 파일들 그대로 복사

# 3. 로컬 서버 실행
python -m http.server 8000

# 4. 브라우저에서 http://localhost:8000 접속
```

### 방법 2: GitHub Pages (무료 호스팅)
```bash
# 1. GitHub 저장소에 모든 파일 업로드
git add .
git commit -m "BLO 세미나 시스템 추가"
git push origin main

# 2. GitHub 저장소 Settings
# 3. Pages 메뉴 선택
# 4. Source: main branch
# 5. Save

# 완료! https://username.github.io/blo-seminar-2026 에서 접속
```

### 방법 3: Firebase Hosting (실시간 기능 포함)
```bash
# 1. Firebase CLI 설치
npm install -g firebase-tools

# 2. 로그인
firebase login

# 3. 프로젝트 초기화
firebase init

# 4. Hosting, Firestore 선택
# 5. public 폴더에 모든 파일 복사

# 6. firebase-config.js에 Firebase 설정 입력

# 7. 배포
firebase deploy

# 완료! Firebase URL에서 접속
```

---

## 📊 월별 업데이트 워크플로우

### 매월 초 (신규 세미나 등록)

**Step 1**: 데이터 파일 생성
```bash
# 이전 달 파일 복사
cp data-2026-02.json data-2026-03.json
```

**Step 2**: 관리자 페이지에서 편집
1. `admin.html` 접속
2. 로그인
3. "📝 세미나 편집" 탭
4. 월 선택: 2026-03
5. 정보 입력:
   - 날짜, 제목, 강사, 설명 등
6. "JSON 미리보기" → 확인
7. "저장하기" → 파일 다운로드

**Step 3**: 메인 페이지 업데이트
```javascript
// index.html에서 한 줄만 수정
const CURRENT_DATA_FILE = 'data-2026-03.json';  // 파일명 변경
const CURRENT_SEMINAR_ID = '2026-03';            // ID 변경
```

**Step 4**: GitHub 업로드
```bash
git add data-2026-03.json index.html
git commit -m "3월 세미나 정보 업데이트"
git push origin main
```

**완료!** 사이트가 자동으로 업데이트됩니다. ✅

### 세미나 종료 후

**Step 1**: 상태 변경
```json
// schedule-2026.json에서
{
  "status": "completed",  // upcoming → completed
  "attendees": {
    "online": 850,
    "offline": 120,
    "total": 970
  }
}
```

**Step 2**: 아카이브 자동 표시
- `archive.html`에서 자동으로 표시됨
- 추가 작업 불필요

---

## 🎨 커스터마이징

### 색상 변경
```css
/* 모든 HTML 파일의 <style> 섹션에서 */

/* 메인 색상 */
#0066b3  → 원하는 색상
#0f3460  → 원하는 색상
#FFD700  → 원하는 색상
```

### 로고 변경
```html
<!-- top-logo 섹션에서 -->
<div class="samsung-logo">SAMSUNG</div>  <!-- 회사명 변경 -->
<div class="samsung-sub">삼성생명</div>  <!-- 부서명 변경 -->
```

### 연락처 변경
```json
// 각 데이터 파일에서
{
  "contact": {
    "name": "박재박 팀장",  ← 변경
    "phone": "010-5137-2327",  ← 변경
    "website": "www.samsung2030blo.com",  ← 변경
    "kakao": "https://open.kakao.com/..."  ← 변경
  }
}
```

---

## 🔐 보안 설정

### 관리자 페이지 보호

#### Option 1: 간단한 비밀번호 (데모용)
```javascript
// admin.html에서
function login() {
    if (email === 'admin@samsung.com' && password === 'YOUR_PASSWORD') {
        // 로그인 성공
    }
}
```

#### Option 2: Firebase Authentication (권장)
```javascript
// firebase-config.js 설정 후
async function login() {
    try {
        await firebase.auth()
            .signInWithEmailAndPassword(email, password);
        // 로그인 성공
    } catch (error) {
        alert('로그인 실패');
    }
}
```

#### Option 3: 별도 도메인
- admin.html을 별도 비공개 저장소에 보관
- 관리자만 URL 공유

---

## 📱 모바일 최적화

모든 페이지는 자동으로 모바일 반응형입니다:
- 모바일: 세로 1단 레이아웃
- 태블릿: 2단 그리드
- 데스크톱: 전체 레이아웃

추가 최적화 불필요!

---

## 🐛 문제 해결

### 1. 사이트가 업데이트되지 않음
**해결**:
- 브라우저 캐시 삭제: `Ctrl+F5` (Windows) / `Cmd+Shift+R` (Mac)
- GitHub Pages: 업데이트 최대 10분 소요
- 파일명 확인

### 2. 카운터가 작동하지 않음
**해결**:
- Firebase 설정 확인
- 브라우저 콘솔(F12)에서 에러 확인
- 로컬 모드로 전환 (Firebase 설정 제거)

### 3. JSON 파일 오류
**해결**:
- https://jsonlint.com 에서 문법 검증
- 따옴표("), 쉼표(,) 확인
- 관리자 페이지에서 다시 생성

### 4. 관리자 페이지 로그인 안됨
**해결**:
- 데모 계정 확인: admin@samsung.com / password123
- Firebase 설정 확인
- 브라우저 쿠키 허용 확인

---

## 💰 비용 (무료로 운영 가능!)

| 서비스 | 무료 한도 | 월 예상 사용량 | 비용 |
|--------|----------|--------------|------|
| GitHub Pages | 100GB 대역폭 | ~1GB | **무료** |
| Firebase Firestore | 50K reads/day | ~1K/day | **무료** |
| Firebase Hosting | 10GB/month | ~500MB | **무료** |
| EmailJS | 200 emails/month | ~100/month | **무료** |
| **총계** | - | - | **₩0** |

**결론**: 완전 무료로 운영 가능! 🎉

---

## 🎯 다음 단계

### 단계별 구현

#### Phase 1: 기본 사이트 (지금 바로 가능)
- ✅ `index.html` 업로드
- ✅ `archive.html` 업로드
- ✅ `schedule.html` 업로드
- ✅ 데이터 파일 업로드
- ✅ GitHub Pages 활성화

**소요 시간**: 30분

#### Phase 2: 실시간 카운터 (선택)
- Firebase 프로젝트 생성
- Firestore 활성화
- `firebase-config.js` 설정
- `index-with-counter.html` 적용

**소요 시간**: 1시간

#### Phase 3: 관리자 페이지 (선택)
- Firebase Authentication 활성화
- 관리자 계정 생성
- `admin.html` 업로드
- 접근 제한 설정

**소요 시간**: 1시간

#### Phase 4: 이메일 자동화 (선택)
- EmailJS 계정 생성
- 템플릿 설정
- `admin.html` 연동

**소요 시간**: 30분

---

## 📞 추가 지원

### 문의사항
- 파일 구조 질문
- 커스터마이징 요청
- 기능 추가 제안

### 제공 가능한 추가 기능
1. 신청 폼 자동화
2. QR 코드 생성
3. 참석 확인 시스템
4. 설문조사 통합
5. SNS 공유 기능
6. 다국어 지원

---

## 🎉 완료!

축하합니다! 이제 다음 기능을 모두 갖춘 BLO 세미나 관리 시스템을 사용하실 수 있습니다:

- ✅ 지난 세미나 아카이브
- ✅ 연간 일정 자동 표시
- ✅ 신청자 수 실시간 카운터
- ✅ 이메일 알림 자동 발송
- ✅ 관리자 페이지 (GUI 편집)

**모든 기능이 완전 무료로 운영됩니다!** 🎊

---

## 📋 체크리스트

시작 전 확인:
- [ ] GitHub 계정 있음
- [ ] 저장소 생성 완료
- [ ] 모든 파일 다운로드 완료

기본 설정:
- [ ] index.html 업로드
- [ ] archive.html 업로드
- [ ] schedule.html 업로드
- [ ] 데이터 파일 업로드
- [ ] GitHub Pages 활성화

선택적 기능:
- [ ] Firebase 설정 (실시간 카운터)
- [ ] EmailJS 설정 (이메일 발송)
- [ ] 관리자 페이지 접근 제한

테스트:
- [ ] 메인 페이지 정상 작동
- [ ] 아카이브 페이지 확인
- [ ] 연간 일정 표시 확인
- [ ] 모바일 반응형 확인

준비 완료! 🚀
