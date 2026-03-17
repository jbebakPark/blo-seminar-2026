#!/bin/bash

###############################################################################
# BLO 세미나 - 월별 업데이트 자동화 스크립트
# 
# 사용법: ./update-seminar.sh YYYY-MM
# 예시: ./update-seminar.sh 2026-03
###############################################################################

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m'

# 헤더
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║   📅 BLO 세미나 월별 업데이트        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# 인자 확인
if [ $# -eq 0 ]; then
    echo -e "${RED}❌ 월을 지정해주세요.${NC}"
    echo -e "사용법: ./update-seminar.sh YYYY-MM"
    echo -e "예시: ./update-seminar.sh 2026-03"
    exit 1
fi

NEW_MONTH=$1

# 날짜 형식 검증
if [[ ! $NEW_MONTH =~ ^[0-9]{4}-[0-9]{2}$ ]]; then
    echo -e "${RED}❌ 잘못된 날짜 형식입니다.${NC}"
    echo -e "형식: YYYY-MM (예: 2026-03)"
    exit 1
fi

# 연도와 월 추출
YEAR=${NEW_MONTH:0:4}
MONTH=${NEW_MONTH:5:2}

echo -e "${BLUE}📅 업데이트 대상: ${YEAR}년 ${MONTH}월${NC}"
echo ""

# 데이터 폴더 확인
if [ ! -d "data" ]; then
    echo -e "${YELLOW}⚠️  data 폴더가 없습니다. 생성합니다.${NC}"
    mkdir -p data
fi

# 새 데이터 파일명
NEW_FILE="data/data-${NEW_MONTH}.json"

# 파일이 이미 존재하는 경우
if [ -f "$NEW_FILE" ]; then
    echo -e "${YELLOW}⚠️  $NEW_FILE 파일이 이미 존재합니다.${NC}"
    read -p "덮어쓰시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}작업이 취소되었습니다.${NC}"
        exit 0
    fi
fi

# 템플릿 파일 찾기 (가장 최근 월 데이터)
TEMPLATE_FILE=$(ls -t data/data-*.json 2>/dev/null | head -1)

if [ -z "$TEMPLATE_FILE" ]; then
    echo -e "${YELLOW}⚠️  기존 데이터 파일이 없습니다. 기본 템플릿을 생성합니다.${NC}"
    
    # 기본 템플릿 생성
    cat > "$NEW_FILE" << EOF
{
  "month": "${NEW_MONTH}",
  "monthName": "${MONTH#0}월",
  "date": "${NEW_MONTH}-24",
  "seminar": {
    "title": "세미나 제목을 입력하세요",
    "subtitle": "세미나 부제목 또는 짧은 설명",
    "date": "${YEAR}년 ${MONTH#0}월 24일(화)",
    "time": "오전 07:30 ~ 09:00",
    "speaker": {
      "name": "강사 이름",
      "title": "강사 직함",
      "credentials": [
        "강사 이력 1",
        "강사 이력 2",
        "강사 이력 3"
      ]
    },
    "description": "세미나에 대한 자세한 설명을 입력하세요."
  },
  "registration": {
    "offline": {
      "title": "조찬세미나 신청하기",
      "deadline": "${MONTH#0}/19(목) 17시까지",
      "method": "박재박 팀장 010-5137-2327",
      "breakfast": {
        "time": "06:30 ~ 07:20",
        "location": "삼성금융캠퍼스 B2F 카페테리아"
      },
      "seminar": {
        "time": "07:30 ~ 09:00",
        "location": "삼성금융캠퍼스 B2F 비전홀"
      },
      "address": "서울특별시 서초구 사임당로 23길 27"
    },
    "online": {
      "title": "온라인 강연 시청",
      "startDate": "${MONTH#0 - 1}/28(수) 14시 이후 신청 가능",
      "watchTime": "${YEAR}.${MONTH#0}.24(화) 오전 7:30~9:00",
      "accessTime": "7:15분부터 접속 가능",
      "website": "www.samsung2030blo.com",
      "steps": [
        "www.samsung2030blo.com 접속 > 신청",
        "1회 신청 시 ${YEAR:2}년 12월까지 시청 가능",
        "www.samsung2030blo.com 접속 > ID 입력",
        "ID : D-4일 문자 안내 예정"
      ]
    }
  },
  "benefits": [
    {
      "icon": "🍳",
      "title": "프리미엄 조찬",
      "description": "삼성금융캠퍼스 B2F 특별 조찬 제공"
    },
    {
      "icon": "🎥",
      "title": "실시간 온라인 참여",
      "description": "어디서나 편하게 실시간 시청 가능"
    },
    {
      "icon": "🤝",
      "title": "프리미엄 네트워킹",
      "description": "오프라인 참석시 교류의 장 제공"
    },
    {
      "icon": "📅",
      "title": "연간 세미나 우선권",
      "description": "1회 신청으로 ${YEAR:2}년 12월까지 시청"
    }
  ],
  "contact": {
    "name": "박재박 팀장",
    "phone": "010-5137-2327",
    "website": "www.samsung2030blo.com",
    "kakao": "https://open.kakao.com/o/sleUSUei"
  },
  "organizer": "삼성생명 WM 사업부"
}
EOF
    
    echo -e "${GREEN}✅ 기본 템플릿 생성 완료: $NEW_FILE${NC}"
    
else
    echo -e "${BLUE}📋 템플릿 파일: $TEMPLATE_FILE${NC}"
    
    # 기존 파일 복사
    cp "$TEMPLATE_FILE" "$NEW_FILE"
    
    # 월 정보 자동 업데이트 (sed 사용)
    if [[ "$OSTYPE" == "darwin"* ]]; then
        # macOS
        sed -i '' "s/\"month\": \"[0-9-]*\"/\"month\": \"${NEW_MONTH}\"/" "$NEW_FILE"
        sed -i '' "s/\"monthName\": \"[0-9]*월\"/\"monthName\": \"${MONTH#0}월\"/" "$NEW_FILE"
    else
        # Linux
        sed -i "s/\"month\": \"[0-9-]*\"/\"month\": \"${NEW_MONTH}\"/" "$NEW_FILE"
        sed -i "s/\"monthName\": \"[0-9]*월\"/\"monthName\": \"${MONTH#0}월\"/" "$NEW_FILE"
    fi
    
    echo -e "${GREEN}✅ 템플릿 복사 완료: $NEW_FILE${NC}"
fi

echo ""
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${YELLOW}📝 다음 단계:${NC}"
echo -e "${YELLOW}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo ""
echo -e "${CYAN}1. 데이터 파일 편집:${NC}"
echo -e "   ${GREEN}code $NEW_FILE${NC}"
echo -e "   또는 관리자 페이지에서 편집 후 다시 다운로드"
echo ""
echo -e "${CYAN}2. index.html 수정:${NC}"
echo -e "   ${GREEN}const CURRENT_DATA_FILE = 'data/data-${NEW_MONTH}.json';${NC}"
echo -e "   ${GREEN}const CURRENT_SEMINAR_ID = '${NEW_MONTH}';${NC}"
echo ""
echo -e "${CYAN}3. 검증:${NC}"
echo -e "   ${GREEN}node scripts/validate-data.js${NC}"
echo ""
echo -e "${CYAN}4. 배포:${NC}"
echo -e "   ${GREEN}./deploy.sh${NC}"
echo ""

# index.html 자동 업데이트 제안
if [ -f "index.html" ]; then
    read -p "index.html을 자동으로 업데이트하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ $REPLY =~ ^[Yy]$ ]]; then
        # 백업 생성
        cp index.html index.html.backup
        
        # 파일명 업데이트
        if [[ "$OSTYPE" == "darwin"* ]]; then
            sed -i '' "s/const CURRENT_DATA_FILE = 'data\/data-[0-9-]*\.json'/const CURRENT_DATA_FILE = 'data\/data-${NEW_MONTH}.json'/" index.html
            sed -i '' "s/const CURRENT_SEMINAR_ID = '[0-9-]*'/const CURRENT_SEMINAR_ID = '${NEW_MONTH}'/" index.html
        else
            sed -i "s/const CURRENT_DATA_FILE = 'data\/data-[0-9-]*\.json'/const CURRENT_DATA_FILE = 'data\/data-${NEW_MONTH}.json'/" index.html
            sed -i "s/const CURRENT_SEMINAR_ID = '[0-9-]*'/const CURRENT_SEMINAR_ID = '${NEW_MONTH}'/" index.html
        fi
        
        echo -e "${GREEN}✅ index.html 업데이트 완료${NC}"
        echo -e "${YELLOW}   백업: index.html.backup${NC}"
    fi
fi

echo ""
echo -e "${GREEN}✅ 월별 업데이트 준비 완료!${NC}"
echo ""
