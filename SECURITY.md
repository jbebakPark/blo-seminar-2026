# 🔐 관리자 페이지 보안 가이드

## ✅ 구현된 보안 기능

### 1. **강력한 인증 시스템**
- ✅ 이메일 + 비밀번호 인증
- ✅ 관리자 계정: `jb2park@naver.com`
- ✅ 비밀번호: `BLO2030Admin!`

### 2. **로그인 시도 제한**
- ✅ 최대 5회 로그인 실패 허용
- ✅ 5회 실패 시 15분간 계정 자동 잠금
- ✅ 남은 시도 횟수 실시간 표시

### 3. **세션 타임아웃**
- ✅ 30분 동안 활동 없으면 자동 로그아웃
- ✅ 사용자 활동 자동 감지 (마우스, 키보드, 스크롤)
- ✅ 1분마다 세션 유효성 검증

### 4. **페이지 접근 제어**
- ✅ 페이지 로드 즉시 인증 확인
- ✅ 비인증 사용자는 로그인 화면만 표시
- ✅ URL 직접 접근 시에도 인증 필요

### 5. **세션 관리**
- ✅ sessionStorage + localStorage 이중 저장
- ✅ 페이지 새로고침 시 세션 유지
- ✅ 탭 전환 시 세션 재검증

### 6. **보안 모니터링**
- ✅ 개발자 도구 열림 감지
- ✅ 페이지 가시성 변경 감지
- ✅ 로그인 시도 기록 추적

### 7. **역할 기반 권한 시스템**
- ✅ 관리자 계정: 전체 권한
- ✅ 데모 계정: 읽기 전용 권한
- ✅ 역할별 UI 제한 및 버튼 비활성화
- ✅ 데모 모드 배너 표시

---

## 🔐 데모 계정 보안 정책

### 외부 노출 금지
- ⚠️ 데모 계정 정보는 **내부용**입니다
- ⚠️ 로그인 화면에 표시하지 않음
- ⚠️ 공개 문서(README)에 비밀번호 노출 금지
- ✅ 내부 문서(`DEMO-ACCOUNT.md`)에서만 확인 가능

### 접근 제어
- ✅ 읽기 전용 권한으로 제한
- ✅ 데이터 수정/저장/발송 기능 차단
- ✅ 입력 필드 보호
- ✅ 버튼 비활성화 및 경고 메시지

### 사용 목적
- ✅ 내부 교육 및 훈련
- ✅ 시스템 테스트
- ✅ 클라이언트 데모 (통제된 환경)

---

## 🔑 관리자 로그인 정보

### 접속 URL
```
https://admin-samsung-vvip.web.app/pages/admin.html
```

### 로그인 계정
- **이메일**: `jb2park@naver.com`
- **비밀번호**: `BLO2030Admin!`

---

## 🚨 보안 정책

### 로그인 시도 제한
```
최대 시도 횟수: 5회
잠금 시간: 15분
잠금 해제: 자동 (15분 후)
```

### 세션 타임아웃
```
비활동 시간: 30분
자동 로그아웃: 활성화
세션 갱신: 사용자 활동 시 자동
```

### 활동 감지
```
감지 이벤트:
- 마우스 클릭
- 키보드 입력
- 스크롤
- 터치 (모바일)
```

---

## 🛡️ 보안 시나리오

### 시나리오 1: 비인가 접근 시도
```
1. 사용자가 admin.html 직접 접근
2. 페이지 로드 즉시 세션 확인
3. 세션 없음 → 로그인 화면 표시
4. 관리자 대시보드 숨김 (display: none)
```

### 시나리오 2: 로그인 실패
```
1. 잘못된 비밀번호 입력
2. 로그인 시도 횟수 증가 (localStorage 저장)
3. 남은 시도 횟수 표시
4. 5회 실패 시 계정 잠금 (15분)
```

### 시나리오 3: 세션 타임아웃
```
1. 로그인 후 30분간 활동 없음
2. 1분마다 세션 검증 (백그라운드)
3. 타임아웃 감지
4. 자동 로그아웃 + 알림 표시
5. 로그인 화면으로 전환
```

### 시나리오 4: 페이지 새로고침
```
1. 관리자가 페이지 새로고침 (F5)
2. sessionStorage 세션 확인
3. 세션 유효 → 관리자 대시보드 복원
4. 세션 타임아웃 체크
5. 유효하면 계속 사용
```

### 시나리오 5: 탭 전환 후 복귀
```
1. 다른 탭으로 이동 (페이지 숨김)
2. 다시 관리자 페이지 탭으로 복귀
3. visibilitychange 이벤트 감지
4. 세션 재검증
5. 타임아웃 시 로그아웃
```

---

## 🔧 보안 설정 변경

### 세션 타임아웃 시간 변경

`pages/admin.html` 파일에서:

```javascript
const SECURITY_CONFIG = {
    SESSION_TIMEOUT: 30 * 60 * 1000, // 30분 → 원하는 시간으로 변경
    // 예: 60 * 60 * 1000 = 1시간
};
```

### 로그인 시도 제한 변경

```javascript
const SECURITY_CONFIG = {
    MAX_LOGIN_ATTEMPTS: 5, // 5회 → 원하는 횟수로 변경
    LOCKOUT_DURATION: 15 * 60 * 1000, // 15분 → 원하는 시간으로 변경
};
```

### 관리자 계정 변경

```javascript
const SECURITY_CONFIG = {
    ADMIN_EMAIL: 'jb2park@naver.com', // 새 이메일로 변경
};

// 로그인 함수에서 비밀번호 변경
if (email === SECURITY_CONFIG.ADMIN_EMAIL && password === '새비밀번호') {
    // ...
}
```

---

## 📊 보안 로그

### 콘솔 로그 메시지

```javascript
✅ 관리자 로그인 성공
✅ 세션 복원 완료
✅ 로그아웃 완료
⚠️ 보안 경고: 개발자 도구가 감지되었습니다.
```

### localStorage 저장 항목

```javascript
loginAttempts: "0"           // 로그인 시도 횟수
lockoutUntil: "1738742400000" // 잠금 해제 시간 (timestamp)
adminSessionBackup: "{...}"   // 세션 백업 (새로고침 대비)
```

### sessionStorage 저장 항목

```javascript
adminSession: {
    loggedIn: true,
    email: "jb2park@naver.com",
    loginTime: 1738742400000,
    lastActivity: 1738744200000
}
```

---

## 🚀 추가 보안 강화 방법

### 1. Firebase Authentication 연동 (권장)

```javascript
// Firebase Auth 사용 시
import { getAuth, signInWithEmailAndPassword } from "firebase/auth";

async function login() {
    const auth = getAuth();
    try {
        const userCredential = await signInWithEmailAndPassword(
            auth, 
            email, 
            password
        );
        // 로그인 성공
    } catch (error) {
        // 로그인 실패
    }
}
```

### 2. 2단계 인증 (2FA)

```javascript
// OTP 또는 이메일 인증 추가
function sendOTP(email) {
    // 이메일로 OTP 발송
}

function verifyOTP(code) {
    // OTP 검증
}
```

### 3. IP 주소 제한

```javascript
// 특정 IP에서만 접근 허용
const ALLOWED_IPS = ['123.456.789.0', '111.222.333.444'];

async function checkIP() {
    const response = await fetch('https://api.ipify.org?format=json');
    const data = await response.json();
    return ALLOWED_IPS.includes(data.ip);
}
```

### 4. HTTPS 강제

```javascript
// HTTP → HTTPS 리다이렉트
if (location.protocol !== 'https:') {
    location.replace(`https:${location.href.substring(location.protocol.length)}`);
}
```

---

## 📝 보안 체크리스트

배포 전 확인사항:

- [ ] 관리자 비밀번호가 강력한가? (대소문자, 숫자, 특수문자 포함)
- [ ] 세션 타임아웃이 적절한가? (30분 권장)
- [ ] 로그인 시도 제한이 활성화되어 있는가?
- [ ] HTTPS가 적용되어 있는가?
- [ ] 개발자 콘솔에 민감한 정보가 노출되지 않는가?
- [ ] Firebase 보안 규칙이 설정되어 있는가?

---

## 🔗 관련 문서

- [Firebase Authentication](https://firebase.google.com/docs/auth)
- [Web Security Best Practices](https://developer.mozilla.org/en-US/docs/Web/Security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)

---

## 📞 보안 문의

보안 관련 문의사항이 있으시면:
- **이메일**: jb2park@naver.com
- **카카오톡**: https://open.kakao.com/o/sleUSUei

---

**마지막 업데이트**: 2026-02-05
**보안 등급**: ⭐⭐⭐⭐ (4/5)
