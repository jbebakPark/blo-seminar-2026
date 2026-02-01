#!/bin/bash

###############################################################################
# BLO 세미나 - 로컬 배포 스크립트
# 
# 사용법: ./deploy.sh [옵션]
# 
# 옵션:
#   --validate-only   검증만 수행 (배포 안 함)
#   --skip-validation 검증 스킵하고 바로 배포
#   --firebase        Firebase 배포
#   --help            도움말 표시
###############################################################################

# 색상 정의
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# 옵션 파싱
VALIDATE_ONLY=false
SKIP_VALIDATION=false
FIREBASE_DEPLOY=false

for arg in "$@"; do
  case $arg in
    --validate-only)
      VALIDATE_ONLY=true
      shift
      ;;
    --skip-validation)
      SKIP_VALIDATION=true
      shift
      ;;
    --firebase)
      FIREBASE_DEPLOY=true
      shift
      ;;
    --help)
      echo "사용법: ./deploy.sh [옵션]"
      echo ""
      echo "옵션:"
      echo "  --validate-only   검증만 수행 (배포 안 함)"
      echo "  --skip-validation 검증 스킵하고 바로 배포"
      echo "  --firebase        Firebase 배포"
      echo "  --help            이 도움말 표시"
      exit 0
      ;;
  esac
done

# 헤더 출력
echo -e "${CYAN}╔════════════════════════════════════════╗${NC}"
echo -e "${CYAN}║    🚀 BLO 세미나 배포 스크립트        ║${NC}"
echo -e "${CYAN}╚════════════════════════════════════════╝${NC}"
echo ""

# 1. Git 상태 확인
echo -e "${BLUE}[1/5] Git 상태 확인...${NC}"

if ! git rev-parse --git-dir > /dev/null 2>&1; then
    echo -e "${RED}❌ Git 저장소가 아닙니다.${NC}"
    exit 1
fi

# 변경사항 확인
if [[ -n $(git status -s) ]]; then
    echo -e "${YELLOW}⚠️  커밋되지 않은 변경사항이 있습니다:${NC}"
    git status -s
    echo ""
    read -p "계속하시겠습니까? (y/N): " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        echo -e "${YELLOW}배포가 취소되었습니다.${NC}"
        exit 0
    fi
else
    echo -e "${GREEN}✅ 커밋되지 않은 변경사항 없음${NC}"
fi

# 현재 브랜치 확인
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD)
echo -e "${GREEN}✅ 현재 브랜치: ${CURRENT_BRANCH}${NC}"
echo ""

# 2. 파일 구조 검증
echo -e "${BLUE}[2/5] 파일 구조 검증...${NC}"

REQUIRED_FILES=("index.html" "archive.html" "schedule.html" "admin.html")
MISSING_FILES=()

for file in "${REQUIRED_FILES[@]}"; do
    if [ -f "$file" ]; then
        echo -e "${GREEN}✅ ${file}${NC}"
    else
        echo -e "${RED}❌ ${file} 누락${NC}"
        MISSING_FILES+=("$file")
    fi
done

if [ ${#MISSING_FILES[@]} -ne 0 ]; then
    echo -e "${RED}❌ 필수 파일이 누락되었습니다: ${MISSING_FILES[*]}${NC}"
    exit 1
fi

# data 폴더 확인
if [ -d "data" ]; then
    echo -e "${GREEN}✅ data 폴더 존재${NC}"
    DATA_FILE_COUNT=$(ls data/*.json 2>/dev/null | wc -l)
    echo -e "${GREEN}   JSON 파일: ${DATA_FILE_COUNT}개${NC}"
else
    echo -e "${YELLOW}⚠️  data 폴더가 없습니다.${NC}"
fi
echo ""

# 3. 데이터 검증
if [ "$SKIP_VALIDATION" = false ]; then
    echo -e "${BLUE}[3/5] 데이터 검증...${NC}"
    
    # JSON 문법 검증
    if [ -d "data" ]; then
        JSON_ERROR=false
        for file in data/*.json; do
            if [ -f "$file" ]; then
                if python3 -m json.tool "$file" > /dev/null 2>&1; then
                    echo -e "${GREEN}✅ $(basename "$file")${NC}"
                else
                    echo -e "${RED}❌ $(basename "$file") - JSON 문법 오류${NC}"
                    JSON_ERROR=true
                fi
            fi
        done
        
        if [ "$JSON_ERROR" = true ]; then
            echo -e "${RED}❌ JSON 파일에 오류가 있습니다.${NC}"
            exit 1
        fi
    fi
    
    # Node.js 스크립트로 상세 검증
    if [ -f "scripts/validate-data.js" ]; then
        if command -v node &> /dev/null; then
            echo ""
            node scripts/validate-data.js
            if [ $? -ne 0 ]; then
                echo -e "${RED}❌ 데이터 검증 실패${NC}"
                exit 1
            fi
        else
            echo -e "${YELLOW}⚠️  Node.js가 설치되지 않아 상세 검증을 스킵합니다.${NC}"
        fi
    fi
    echo ""
else
    echo -e "${YELLOW}[3/5] 데이터 검증 스킵${NC}"
    echo ""
fi

# 검증만 수행하는 경우 여기서 종료
if [ "$VALIDATE_ONLY" = true ]; then
    echo -e "${GREEN}✅ 검증 완료!${NC}"
    exit 0
fi

# 4. Git 커밋 및 푸시
echo -e "${BLUE}[4/5] Git 커밋 및 푸시...${NC}"

# 변경사항이 있는 경우만 커밋
if [[ -n $(git status -s) ]]; then
    read -p "커밋 메시지 입력 (기본: 자동 배포): " COMMIT_MESSAGE
    COMMIT_MESSAGE=${COMMIT_MESSAGE:-"🚀 자동 배포 - $(date '+%Y-%m-%d %H:%M:%S')"}
    
    git add .
    git commit -m "$COMMIT_MESSAGE"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 커밋 완료${NC}"
    else
        echo -e "${RED}❌ 커밋 실패${NC}"
        exit 1
    fi
    
    # 푸시
    echo -e "${YELLOW}푸시 중...${NC}"
    git push origin "$CURRENT_BRANCH"
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✅ 푸시 완료${NC}"
    else
        echo -e "${RED}❌ 푸시 실패${NC}"
        exit 1
    fi
else
    echo -e "${GREEN}✅ 변경사항 없음 (이미 최신 상태)${NC}"
fi
echo ""

# 5. 배포 정보
echo -e "${BLUE}[5/5] 배포 정보${NC}"
echo -e "${GREEN}════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ 배포 성공!${NC}"
echo ""
echo -e "📅 배포 시간: $(date '+%Y-%m-%d %H:%M:%S')"
echo -e "🔖 커밋: $(git rev-parse --short HEAD)"
echo -e "🌿 브랜치: $CURRENT_BRANCH"
echo ""

if [ "$FIREBASE_DEPLOY" = true ]; then
    echo -e "${YELLOW}Firebase 배포 시작...${NC}"
    
    if command -v firebase &> /dev/null; then
        firebase deploy
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✅ Firebase 배포 완료${NC}"
        else
            echo -e "${RED}❌ Firebase 배포 실패${NC}"
            exit 1
        fi
    else
        echo -e "${RED}❌ Firebase CLI가 설치되지 않았습니다.${NC}"
        echo -e "${YELLOW}   설치: npm install -g firebase-tools${NC}"
        exit 1
    fi
else
    echo -e "🌐 GitHub Pages: https://jbebakpark.github.io/blo-seminar-2026/"
    echo -e "⏱️  약 1-2분 후 사이트 업데이트 완료"
fi

echo -e "${GREEN}════════════════════════════════════════${NC}"
echo ""
echo -e "${CYAN}💡 Tip: GitHub Actions에서 자동 배포 진행 상황을 확인하세요!${NC}"
echo -e "${CYAN}   https://github.com/jbebakPark/blo-seminar-2026/actions${NC}"
echo ""
