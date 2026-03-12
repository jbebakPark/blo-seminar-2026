@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

REM SSL 인증서 검증 우회 (회사 네트워크 환경)
set NODE_TLS_REJECT_UNAUTHORIZED=0

echo ========================================
echo 🚀 BLO 세미나 2026 - Firebase 자동 배포
echo ========================================
echo.

REM 배포 모드 선택
echo 배포 모드를 선택하세요:
echo [1] 빠른 배포 (Git 커밋 + Firebase 배포)
echo [2] Firebase만 배포 (Git 커밋 없이)
echo [3] Git 커밋만 (배포 없이)
echo [4] 변경사항 확인만
echo [5] 취소
echo.
set /p MODE="선택 (1-5): "

if "%MODE%"=="5" (
    echo 배포를 취소했습니다.
    pause
    exit /b 0
)

if "%MODE%"=="4" (
    echo.
    echo 📋 변경된 파일 목록:
    echo ========================================
    git status --short
    echo ========================================
    echo.
    pause
    exit /b 0
)

echo.
echo [1/4] 🔍 변경사항 확인 중...
git status --short
if errorlevel 1 (
    echo ❌ Git 저장소가 아닙니다.
    pause
    exit /b 1
)

REM 변경사항이 있는지 확인
git diff-index --quiet HEAD --
if %errorlevel% equ 0 (
    echo ℹ️  변경사항이 없습니다.
    if "%MODE%"=="1" (
        echo Firebase 배포만 진행합니다...
        set MODE=2
    )
) else (
    echo ✅ 변경사항 발견
)
echo.

REM Git 커밋 처리
if "%MODE%"=="1" (
    echo [2/4] 📝 Git 커밋 중...
    
    REM 커밋 메시지 입력
    set /p COMMIT_MSG="커밋 메시지 (Enter=자동): "
    if "!COMMIT_MSG!"=="" (
        set COMMIT_MSG=자동 배포: %date% %time%
    )
    
    git add .
    git commit -m "!COMMIT_MSG!"
    
    if errorlevel 1 (
        echo ⚠️  커밋 실패 (변경사항이 없을 수 있습니다)
    ) else (
        echo ✅ Git 커밋 완료
        
        REM GitHub에 푸시할지 물어보기
        set /p PUSH="GitHub에 푸시하시겠습니까? (y/n): "
        if /i "!PUSH!"=="y" (
            echo 📤 GitHub에 푸시 중...
            git push origin main
            if errorlevel 1 (
                echo ⚠️  푸시 실패 (나중에 수동으로 푸시하세요)
            ) else (
                echo ✅ GitHub 푸시 완료
                echo ℹ️  GitHub Actions가 자동으로 배포를 시작합니다.
                echo.
                set /p SKIP_FIREBASE="로컬 Firebase 배포를 건너뛰시겠습니까? (y/n): "
                if /i "!SKIP_FIREBASE!"=="y" (
                    echo.
                    echo ========================================
                    echo ✅ GitHub Actions 배포 대기 중
                    echo ========================================
                    echo.
                    echo 📊 배포 상태: https://github.com/jbebakPark/blo-seminar-2026/actions
                    echo 🌐 사이트 URL: https://admin-samsung-vvip.web.app
                    echo.
                    pause
                    exit /b 0
                )
            )
        )
    )
    echo.
) else if "%MODE%"=="3" (
    echo [2/4] 📝 Git 커밋 중...
    
    set /p COMMIT_MSG="커밋 메시지 (Enter=자동): "
    if "!COMMIT_MSG!"=="" (
        set COMMIT_MSG=업데이트: %date% %time%
    )
    
    git add .
    git commit -m "!COMMIT_MSG!"
    
    if errorlevel 1 (
        echo ❌ 커밋 실패
        pause
        exit /b 1
    )
    
    echo ✅ Git 커밋 완료
    echo.
    
    set /p PUSH="GitHub에 푸시하시겠습니까? (y/n): "
    if /i "!PUSH!"=="y" (
        echo 📤 GitHub에 푸시 중...
        git push origin main
        if errorlevel 1 (
            echo ❌ 푸시 실패
            pause
            exit /b 1
        )
        echo ✅ GitHub 푸시 완료
    )
    echo.
    pause
    exit /b 0
)

REM Firebase 로그인 확인
if "%MODE%"=="1" (
    echo [3/4] 🔐 Firebase 로그인 확인 중...
) else (
    echo [2/4] 🔐 Firebase 로그인 확인 중...
)

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

REM Firebase 배포
if "%MODE%"=="1" (
    echo [4/4] 🔥 Firebase에 배포 중...
) else (
    echo [3/4] 🔥 Firebase에 배포 중...
)

firebase deploy --only hosting
if errorlevel 1 (
    echo.
    echo ❌ 배포 실패
    echo.
    echo 🔧 문제 해결 방법:
    echo 1. Firebase 프로젝트 확인: firebase projects:list
    echo 2. 프로젝트 선택: firebase use admin-samsung-vvip
    echo 3. 수동 배포: https://console.firebase.google.com
    echo.
    pause
    exit /b 1
)

echo.
echo ========================================
echo ✅ 배포 완료!
echo ========================================
echo.
echo 🌐 사이트 URL: https://admin-samsung-vvip.web.app
echo 📊 Firebase 콘솔: https://console.firebase.google.com/project/admin-samsung-vvip
echo 👤 관리자 페이지: https://admin-samsung-vvip.web.app/pages/admin.html
echo.
echo 💡 팁: GitHub에 푸시하면 자동으로 배포됩니다!
echo.
pause
