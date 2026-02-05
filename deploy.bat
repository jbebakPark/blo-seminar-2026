@echo off
echo ========================================
echo BLO 세미나 2026 - Firebase 자동 배포
echo ========================================
echo.

echo [1/3] Firebase 로그인 확인 중...
firebase projects:list >nul 2>&1
if errorlevel 1 (
    echo Firebase 로그인이 필요합니다.
    echo 브라우저가 열리면 Google 계정으로 로그인해주세요.
    echo.
    firebase login
    if errorlevel 1 (
        echo.
        echo ❌ 로그인 실패
        pause
        exit /b 1
    )
)

echo ✅ 로그인 확인 완료
echo.

echo [2/3] 변경사항 Git 커밋 중...
git add .
git commit -m "자동 배포: %date% %time%"
echo ✅ Git 커밋 완료
echo.

echo [3/3] Firebase에 배포 중...
firebase deploy --only hosting
if errorlevel 1 (
    echo.
    echo ❌ 배포 실패
    echo.
    echo 수동 배포 방법:
    echo 1. https://console.firebase.google.com 접속
    echo 2. admin-samsung-vvip 프로젝트 선택
    echo 3. Hosting 메뉴에서 파일 업로드
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 배포 완료!
echo ========================================
echo.
echo 🌐 사이트 URL: https://admin-samsung-vvip.web.app
echo 📊 콘솔: https://console.firebase.google.com/project/admin-samsung-vvip
echo.
pause
