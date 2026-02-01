# BLO 세미나 사이트 운영 가이드

## 📌 개요

매월 바뀌는 세미나 정보를 JSON 데이터 파일로 관리하여, 코드 수정 없이 **데이터만 변경**하면 자동으로 사이트가 업데이트됩니다.

---

## 📁 파일 구조

```
/blo-seminar-2026
├── index.html              (메인 페이지 - 거의 수정 안 함)
├── data-2026-02.json       (2월 데이터)
├── data-2026-03.json       (3월 데이터)
├── data-2026-04.json       (4월 데이터) - 필요시 추가
└── README.md               (이 문서)
```

---

## 🚀 월별 업데이트 방법 (3단계)

### 1단계: 새 데이터 파일 복사

이전 달의 JSON 파일을 복사하여 새 파일을 만듭니다.

```bash
# 예: 2월 데이터를 복사하여 3월 데이터 만들기
cp data-2026-02.json data-2026-03.json
```

### 2단계: 데이터 파일 수정

`data-2026-03.json` 파일을 열어서 다음 정보만 수정합니다:

```json
{
  "month": "2026-03",           // 월 변경
  "monthName": "3월",           // 월 이름 변경
  "date": "2026-03-24",         // 날짜 변경
  "seminar": {
    "title": "새로운 주제",     // 주제 변경
    "date": "2026년 3월 24일(화)",  // 날짜 변경
    "speaker": {
      "name": "강사 이름",      // 강사 변경
      "title": "강사 직함",
      "credentials": [          // 강사 이력 변경
        "첫 번째 이력",
        "두 번째 이력"
      ]
    }
  },
  "registration": {
    "offline": {
      "deadline": "3/19(목) 17시까지"  // 마감일 변경
    },
    "online": {
      "startDate": "2/28(금) 14시 이후"  // 온라인 신청 시작일 변경
    }
  }
}
```

### 3단계: index.html에서 현재 파일 지정

`index.html` 파일을 열어서 **딱 한 줄만** 변경합니다:

```javascript
// index.html 파일의 43번째 줄 정도
const CURRENT_DATA_FILE = 'data-2026-03.json';  // 파일명만 변경!
```

---

## 💡 수정이 필요한 항목 체크리스트

매월 세미나마다 다음 항목들을 확인하고 수정하세요:

### ✅ 필수 변경 항목
- [ ] 월/날짜 (month, monthName, date)
- [ ] 세미나 제목 (seminar.title)
- [ ] 세미나 날짜/시간 (seminar.date, seminar.time)
- [ ] 강사 정보 (seminar.speaker.name, title, credentials)
- [ ] 신청 마감일 (registration.offline.deadline)
- [ ] 온라인 신청 시작일 (registration.online.startDate)

### 📝 선택 변경 항목
- [ ] 부제목 (seminar.subtitle)
- [ ] 세미나 설명 (seminar.description)
- [ ] 조찬/세미나 시간 (변경되는 경우만)
- [ ] 장소 (변경되는 경우만)
- [ ] 연락처 정보 (변경되는 경우만)

---

## 🎯 실제 작업 예시

### 예시: 3월 세미나로 변경하기

#### 1. 데이터 파일 수정 (data-2026-03.json)

```json
{
  "month": "2026-03",
  "monthName": "3월",
  "date": "2026-03-24",
  "seminar": {
    "title": "인간과 로봇이 함께하는 미래",
    "date": "2026년 3월 24일(화)",
    "speaker": {
      "name": "김로봇 박사",
      "title": "로봇공학 전문가",
      "credentials": [
        "MIT 로봇공학 박사",
        "휴머노이드 로봇 개발 권위자"
      ]
    }
  },
  "registration": {
    "offline": {
      "deadline": "3/19(목) 17시까지"
    },
    "online": {
      "startDate": "2/28(금) 14시 이후"
    }
  }
}
```

#### 2. index.html 수정 (한 줄만!)

```javascript
const CURRENT_DATA_FILE = 'data-2026-03.json';
```

#### 3. GitHub에 업로드

```bash
git add .
git commit -m "3월 세미나 정보 업데이트"
git push origin main
```

완료! 사이트가 자동으로 업데이트됩니다.

---

## 🔧 문제 해결

### 사이트가 업데이트되지 않을 때

1. **브라우저 캐시 삭제**: Ctrl+F5 (Windows) 또는 Cmd+Shift+R (Mac)
2. **파일명 확인**: index.html의 `CURRENT_DATA_FILE`과 실제 JSON 파일명이 일치하는지 확인
3. **JSON 문법 오류**: https://jsonlint.com 에서 JSON 파일 검증

### 데이터가 제대로 표시되지 않을 때

1. 브라우저 개발자 도구(F12) > Console 탭에서 오류 확인
2. JSON 파일의 따옴표(`"`)가 제대로 닫혔는지 확인
3. 쉼표(`,`)가 빠지거나 추가로 있는지 확인

---

## 📦 백업 및 아카이브

### 지난 달 데이터 보관하기

```
/blo-seminar-2026
├── index.html
├── data-2026-02.json  (현재)
└── archive/
    ├── data-2026-01.json  (1월 백업)
    └── data-2025-12.json  (12월 백업)
```

매월 말에 이전 달 데이터를 `archive` 폴더로 이동하여 보관하세요.

---

## 🎨 디자인 변경이 필요한 경우

디자인을 변경하려면 `index.html` 파일의 `<style>` 섹션을 수정하세요.

주요 색상 변수:
- 메인 블루: `#0066b3`
- 다크 블루: `#0f3460`
- 골드: `#FFD700`
- 레드: `#FF6B6B`

---

## 📞 기술 지원

JSON 파일 수정이나 사이트 업데이트에 문제가 있을 경우:
1. 이 가이드 문서를 다시 확인
2. JSON 검증 사이트에서 문법 확인
3. 이전 달의 정상 작동하던 파일과 비교

---

## ✨ 장점

- ✅ **간편함**: HTML 코드 수정 없이 데이터만 변경
- ✅ **안전함**: 실수로 HTML 구조를 망가뜨릴 위험 없음
- ✅ **빠름**: 3단계만 거치면 업데이트 완료
- ✅ **관리 용이**: 월별 데이터 파일로 깔끔한 관리
- ✅ **백업 쉬움**: JSON 파일만 복사하면 백업 완료
