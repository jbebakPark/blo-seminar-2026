# BLO 세미나 통합 관리 시스템

## 📁 전체 파일 구조

```
/blo-seminar-2026
├── index.html                    # 메인 페이지
├── archive.html                  # 지난 세미나 아카이브
├── schedule.html                 # 연간 일정 페이지
├── admin.html                    # 관리자 페이지 (로그인 필요)
│
├── js/
│   ├── firebase-config.js       # Firebase 설정
│   ├── seminar-loader.js        # 세미나 데이터 로더
│   ├── counter.js               # 신청자 카운터
│   ├── email-service.js         # 이메일 알림 서비스
│   └── admin.js                 # 관리자 기능
│
├── css/
│   └── style.css                # 공통 스타일
│
├── data/
│   ├── schedule-2026.json       # 연간 일정
│   └── current.json             # 현재 활성 세미나
│
└── README.md                     # 시스템 가이드
```

## 🔧 필요한 서비스

### 1. Firebase (무료 플랜 사용 가능)
- **Firestore Database**: 세미나 데이터, 신청자 수 저장
- **Authentication**: 관리자 로그인
- **Hosting**: 사이트 호스팅
- **Functions**: 이메일 발송 (Cloud Functions)

### 2. EmailJS (무료 플랜: 월 200건)
- 이메일 알림 발송 서비스
- Firebase Functions 대신 사용 가능

## 🚀 설정 방법

### Step 1: Firebase 프로젝트 생성

1. https://console.firebase.google.com 접속
2. "프로젝트 추가" 클릭
3. 프로젝트 이름: "blo-seminar-2026"
4. Google Analytics: 선택사항
5. 프로젝트 생성 완료

### Step 2: Firebase 설정

#### Firestore Database 활성화
1. 좌측 메뉴 > Firestore Database
2. "데이터베이스 만들기" 클릭
3. 보안 규칙: "프로덕션 모드로 시작" 선택
4. 위치: asia-northeast3 (서울) 선택

#### Authentication 활성화
1. 좌측 메뉴 > Authentication
2. "시작하기" 클릭
3. 로그인 방법 > "이메일/비밀번호" 활성화
4. 사용자 추가 > 관리자 계정 생성

#### Firebase Config 가져오기
1. 프로젝트 설정 (⚙️ 아이콘)
2. "내 앱"에서 웹 앱 추가 (</>)
3. 앱 닉네임: "BLO Seminar Web"
4. Firebase SDK 구성 복사

```javascript
// firebase-config.js에 넣을 내용
const firebaseConfig = {
  apiKey: "YOUR_API_KEY",
  authDomain: "blo-seminar-2026.firebaseapp.com",
  projectId: "blo-seminar-2026",
  storageBucket: "blo-seminar-2026.appspot.com",
  messagingSenderId: "YOUR_SENDER_ID",
  appId: "YOUR_APP_ID"
};
```

### Step 3: Firestore 데이터 구조

```
firestore/
├── seminars/                    # 세미나 컬렉션
│   ├── 2026-01/                # 1월 세미나 문서
│   ├── 2026-02/                # 2월 세미나 문서
│   └── 2026-03/                # 3월 세미나 문서
│
├── counters/                    # 신청자 카운터
│   ├── 2026-01/                # 1월 신청자 수
│   └── 2026-02/                # 2월 신청자 수
│
├── registrations/               # 신청자 목록 (선택사항)
│   ├── {userId}/               # 신청자별 문서
│   └── ...
│
└── schedule/                    # 연간 일정
    └── 2026/                    # 2026년 전체 일정
```

### Step 4: EmailJS 설정 (이메일 알림)

1. https://www.emailjs.com 가입
2. Email Services 추가
   - Gmail, Outlook 등 연동
3. Email Templates 생성
   - 신청 확인 메일 템플릿
   - 리마인더 메일 템플릿
4. API Keys 복사

### Step 5: Firestore 보안 규칙 설정

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // 누구나 세미나 정보 읽기 가능
    match /seminars/{seminarId} {
      allow read: if true;
      allow write: if request.auth != null;  // 로그인한 사용자만 수정
    }
    
    // 카운터 읽기는 누구나, 쓰기는 인증된 사용자
    match /counters/{counterId} {
      allow read: if true;
      allow update: if request.auth != null || 
                      request.resource.data.diff(resource.data).affectedKeys()
                        .hasOnly(['online', 'offline', 'total']);
    }
    
    // 일정은 누구나 읽기, 관리자만 수정
    match /schedule/{year} {
      allow read: if true;
      allow write: if request.auth != null;
    }
    
    // 신청자 정보는 관리자만 접근
    match /registrations/{userId} {
      allow read, write: if request.auth != null;
    }
  }
}
```

## 📊 데이터베이스 스키마

### seminars 컬렉션
```json
{
  "month": "2026-02",
  "monthName": "2월",
  "date": "2026-02-24",
  "status": "upcoming",  // upcoming, ongoing, completed
  "seminar": {
    "title": "인류의 새로운 도전, 우주 탐사와 그 너머",
    "speaker": { ... }
  },
  "registration": { ... },
  "createdAt": "2026-01-15T10:00:00Z",
  "updatedAt": "2026-01-20T14:30:00Z"
}
```

### counters 컬렉션
```json
{
  "seminarId": "2026-02",
  "online": 150,
  "offline": 45,
  "total": 195,
  "lastUpdated": "2026-02-10T09:30:00Z"
}
```

### schedule 컬렉션
```json
{
  "year": "2026",
  "quarters": [
    {
      "quarter": 1,
      "theme": "Tech Insight, 차세대 혁신 기술",
      "sessions": [...]
    }
  ]
}
```

## 🎨 기능별 설명

### 1. 지난 세미나 아카이브
- Firestore에서 status가 "completed"인 세미나 자동 표시
- 날짜별 정렬, 검색 기능
- 각 세미나별 신청자 수, 참석률 표시

### 2. 연간 일정 자동 표시
- schedule 컬렉션에서 전체 일정 가져오기
- 분기별, 월별 필터링
- 현재 진행 중인 세미나 하이라이트

### 3. 신청자 수 실시간 카운터
- Firestore 실시간 리스너 활용
- 온라인/오프라인 신청 수 분리 표시
- 목표 인원 대비 달성률 표시

### 4. 이메일 알림 자동 발송
- 신청 완료 시 확인 메일
- 세미나 D-7, D-1 리마인더
- 세미나 후 감사 메일

### 5. 관리자 페이지
- 드래그 앤 드롭 방식의 직관적 UI
- 세미나 정보 CRUD
- 신청자 현황 대시보드
- 이메일 발송 관리

## 💰 비용 (무료 플랜 기준)

| 서비스 | 무료 한도 | 예상 사용량 |
|--------|----------|------------|
| Firebase Firestore | 50K reads/day | 충분 |
| Firebase Hosting | 10GB/month | 충분 |
| Firebase Auth | 무제한 | 충분 |
| EmailJS | 200 emails/month | 충분 (월 4회 x 200명 = 실제 필요량 고려) |

**결론**: 완전 무료로 운영 가능! 🎉

## 🔐 보안 고려사항

1. **관리자 계정**: 강력한 비밀번호 사용
2. **Firebase 보안 규칙**: 위 규칙 그대로 적용
3. **API Key 보호**: GitHub에 업로드 시 환경 변수 사용
4. **HTTPS**: Firebase Hosting 자동 제공

## 📱 반응형 디자인

- 모바일, 태블릿, 데스크톱 완벽 지원
- Progressive Web App (PWA) 가능

## 🚀 배포 방법

```bash
# Firebase CLI 설치
npm install -g firebase-tools

# 로그인
firebase login

# 프로젝트 초기화
firebase init

# 배포
firebase deploy
```

## 📞 다음 단계

위 설정을 완료하시면, 제가 각 기능별 상세 코드를 작성해드리겠습니다.
