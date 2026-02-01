# BLO 세미나 - Windows 배포 스크립트 (PowerShell)
# 사용법: .\deploy.ps1

param(
    [switch]$ValidateOnly,
    [switch]$SkipValidation,
    [switch]$Firebase
)

# 색상 출력 함수
function Write-ColorOutput($ForegroundColor) {
    $fc = $host.UI.RawUI.ForegroundColor
    $host.UI.RawUI.ForegroundColor = $ForegroundColor
    if ($args) {
        Write-Output $args
    }
    $host.UI.RawUI.ForegroundColor = $fc
}

# 헤더
Write-Host "╔════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║    🚀 BLO 세미나 배포 스크립트        ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# 1. Git 상태 확인
Write-Host "[1/5] Git 상태 확인..." -ForegroundColor Blue

# Git 저장소 확인
try {
    git rev-parse --git-dir 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "❌ Git 저장소가 아닙니다." -ForegroundColor Red
        exit 1
    }
} catch {
    Write-Host "❌ Git이 설치되지 않았습니다." -ForegroundColor Red
    exit 1
}

# 변경사항 확인
$gitStatus = git status -s
if ($gitStatus) {
    Write-Host "⚠️  커밋되지 않은 변경사항이 있습니다:" -ForegroundColor Yellow
    git status -s
    Write-Host ""
    $response = Read-Host "계속하시겠습니까? (y/N)"
    if ($response -ne 'y' -and $response -ne 'Y') {
        Write-Host "배포가 취소되었습니다." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✅ 커밋되지 않은 변경사항 없음" -ForegroundColor Green
}

# 현재 브랜치
$currentBranch = git rev-parse --abbrev-ref HEAD
Write-Host "✅ 현재 브랜치: $currentBranch" -ForegroundColor Green
Write-Host ""

# 2. 파일 구조 검증
Write-Host "[2/5] 파일 구조 검증..." -ForegroundColor Blue

$requiredFiles = @("index.html", "archive.html", "schedule.html", "admin.html")
$missingFiles = @()

foreach ($file in $requiredFiles) {
    if (Test-Path $file) {
        Write-Host "✅ $file" -ForegroundColor Green
    } else {
        Write-Host "❌ $file 누락" -ForegroundColor Red
        $missingFiles += $file
    }
}

if ($missingFiles.Count -gt 0) {
    Write-Host "❌ 필수 파일이 누락되었습니다: $($missingFiles -join ', ')" -ForegroundColor Red
    exit 1
}

# data 폴더 확인
if (Test-Path "data") {
    Write-Host "✅ data 폴더 존재" -ForegroundColor Green
    $dataFileCount = (Get-ChildItem -Path "data" -Filter "*.json" -ErrorAction SilentlyContinue).Count
    Write-Host "   JSON 파일: $dataFileCount 개" -ForegroundColor Green
} else {
    Write-Host "⚠️  data 폴더가 없습니다." -ForegroundColor Yellow
}
Write-Host ""

# 3. 데이터 검증
if (-not $SkipValidation) {
    Write-Host "[3/5] 데이터 검증..." -ForegroundColor Blue
    
    # JSON 문법 검증
    if (Test-Path "data") {
        $jsonError = $false
        Get-ChildItem -Path "data" -Filter "*.json" | ForEach-Object {
            try {
                $content = Get-Content $_.FullName -Raw | ConvertFrom-Json
                Write-Host "✅ $($_.Name)" -ForegroundColor Green
            } catch {
                Write-Host "❌ $($_.Name) - JSON 문법 오류" -ForegroundColor Red
                $jsonError = $true
            }
        }
        
        if ($jsonError) {
            Write-Host "❌ JSON 파일에 오류가 있습니다." -ForegroundColor Red
            exit 1
        }
    }
    
    # Node.js 스크립트로 상세 검증
    if (Test-Path "scripts\validate-data.js") {
        if (Get-Command node -ErrorAction SilentlyContinue) {
            Write-Host ""
            node scripts\validate-data.js
            if ($LASTEXITCODE -ne 0) {
                Write-Host "❌ 데이터 검증 실패" -ForegroundColor Red
                exit 1
            }
        } else {
            Write-Host "⚠️  Node.js가 설치되지 않아 상세 검증을 스킵합니다." -ForegroundColor Yellow
        }
    }
    Write-Host ""
} else {
    Write-Host "[3/5] 데이터 검증 스킵" -ForegroundColor Yellow
    Write-Host ""
}

# 검증만 수행하는 경우 여기서 종료
if ($ValidateOnly) {
    Write-Host "✅ 검증 완료!" -ForegroundColor Green
    exit 0
}

# 4. Git 커밋 및 푸시
Write-Host "[4/5] Git 커밋 및 푸시..." -ForegroundColor Blue

# 변경사항이 있는 경우만 커밋
$gitStatus = git status -s
if ($gitStatus) {
    $commitMessage = Read-Host "커밋 메시지 입력 (기본: 자동 배포)"
    if (-not $commitMessage) {
        $commitMessage = "🚀 자동 배포 - $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
    }
    
    git add .
    git commit -m $commitMessage
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 커밋 완료" -ForegroundColor Green
    } else {
        Write-Host "❌ 커밋 실패" -ForegroundColor Red
        exit 1
    }
    
    # 푸시
    Write-Host "푸시 중..." -ForegroundColor Yellow
    git push origin $currentBranch
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "✅ 푸시 완료" -ForegroundColor Green
    } else {
        Write-Host "❌ 푸시 실패" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "✅ 변경사항 없음 (이미 최신 상태)" -ForegroundColor Green
}
Write-Host ""

# 5. 배포 정보
Write-Host "[5/5] 배포 정보" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Green
Write-Host "✅ 배포 성공!" -ForegroundColor Green
Write-Host ""
Write-Host "📅 배포 시간: $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')"
$commitHash = git rev-parse --short HEAD
Write-Host "🔖 커밋: $commitHash"
Write-Host "🌿 브랜치: $currentBranch"
Write-Host ""

if ($Firebase) {
    Write-Host "Firebase 배포 시작..." -ForegroundColor Yellow
    
    if (Get-Command firebase -ErrorAction SilentlyContinue) {
        firebase deploy
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✅ Firebase 배포 완료" -ForegroundColor Green
        } else {
            Write-Host "❌ Firebase 배포 실패" -ForegroundColor Red
            exit 1
        }
    } else {
        Write-Host "❌ Firebase CLI가 설치되지 않았습니다." -ForegroundColor Red
        Write-Host "   설치: npm install -g firebase-tools" -ForegroundColor Yellow
        exit 1
    }
} else {
    Write-Host "🌐 GitHub Pages: https://jbebakpark.github.io/blo-seminar-2026/"
    Write-Host "⏱️  약 1-2분 후 사이트 업데이트 완료"
}

Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "💡 Tip: GitHub Actions에서 자동 배포 진행 상황을 확인하세요!" -ForegroundColor Cyan
Write-Host "   https://github.com/jbebakPark/blo-seminar-2026/actions" -ForegroundColor Cyan
Write-Host ""
