@echo off
chcp 65001 >nul

echo 🚀 빠른 배포 시작...
echo.

REM Git 커밋
git add .
git commit -m "빠른 배포: %date% %time%"

REM GitHub 푸시
git push origin main

if errorlevel 1 (
    echo ❌ 푸시 실패
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ GitHub에 푸시 완료!
echo ========================================
echo.
echo ℹ️  GitHub Actions가 자동으로 배포를 시작합니다.
echo.
echo 📊 배포 상태 확인: https://github.com/jbebakPark/blo-seminar-2026/actions
echo 🌐 사이트 URL: https://admin-samsung-vvip.web.app
echo.
echo 💡 배포는 약 1-2분 후 완료됩니다.
echo.
pause
