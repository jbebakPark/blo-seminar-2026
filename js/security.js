// ================================================================
// 🔒 2030 BUSINESS LIVE ON - 사이트 보안 시스템 v2.0
// Copyright (c) 2026 Samsung Life Insurance WM Division
// 무단 복제·배포·도용 엄격히 금지 (저작권법 위반 시 법적 조치)
// ================================================================

(function () {
    'use strict';

    // ────────────────────────────────────────────────
    // ⚙️ 보안 설정
    // ────────────────────────────────────────────────
    const SEC = {
        // 허용 도메인 (여기 없으면 전부 차단)
        ALLOWED_DOMAINS: [
            'samsung2030blo.com',
            'www.samsung2030blo.com',
            'admin-samsung-vvip.web.app',
            'localhost',
            '127.0.0.1'
        ],

        // Firebase 프로젝트 (도용 로그 저장)
        FIREBASE_PROJECT: 'samsung-blo',
        FIREBASE_API_KEY: 'AIzaSyPlaceholderReplaceWithRealKey',   // ← 실제 키로 교체

        // 저작권 안내 (복사 시 클립보드에 삽입)
        COPYRIGHT_TEXT: '\n\n─────────────────────────────\n⚠️  저작권 안내\n본 내용은 삼성생명 WM사업부 2030 Business Live ON의 저작물입니다.\n무단 복제·배포 시 저작권법에 따라 법적 책임을 질 수 있습니다.\n© 2026 Samsung Life Insurance. All Rights Reserved.\n─────────────────────────────\n',
    };

    // ────────────────────────────────────────────────
    // 🛡️ 1. 도메인 무결성 검증 (핵심 차단 장치)
    // ────────────────────────────────────────────────
    function verifyDomain() {
        const host = window.location.hostname.toLowerCase();
        const allowed = SEC.ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));

        if (!allowed) {
            // 즉시 접근 로그 전송
            reportViolation('UNAUTHORIZED_DOMAIN', { domain: host });
            // 페이지 전체 차단
            lockdown('⛔ 불법 도용 사이트 감지', `이 사이트는 허용되지 않은 도메인(${host})에서 복제·운영되고 있습니다.\n이 접근 시도는 서버에 기록되었으며 법적 조치의 근거로 활용됩니다.`);
            return false;
        }
        return true;
    }

    // ────────────────────────────────────────────────
    // 🛡️ 2. iframe 임베딩 차단
    // ────────────────────────────────────────────────
    function verifyTopFrame() {
        if (window.top !== window.self) {
            reportViolation('IFRAME_EMBED', { embedDomain: document.referrer });
            lockdown('⛔ iframe 무단 임베딩 감지', '이 사이트를 외부 페이지에 iframe으로 삽입하는 것은 금지되어 있습니다.');
            return false;
        }
        return true;
    }

    // ────────────────────────────────────────────────
    // 🚫 3. 페이지 잠금 (콘텐츠 전체 차단)
    // ────────────────────────────────────────────────
    function lockdown(title, message) {
        // 스타일 제거 및 콘텐츠 은폐
        document.documentElement.innerHTML = `
        <!DOCTYPE html>
        <html lang="ko">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width,initial-scale=1">
            <title>접근 차단됨</title>
            <style>
                * { margin:0; padding:0; box-sizing:border-box; }
                body {
                    background: #0a0a0a;
                    color: #fff;
                    font-family: 'Malgun Gothic', sans-serif;
                    min-height: 100vh;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    text-align: center;
                }
                .wrap { max-width: 600px; padding: 40px 20px; }
                .icon { font-size: 96px; margin-bottom: 30px; display: block; }
                h1 { font-size: 28px; color: #ff4444; margin-bottom: 20px; }
                p  { font-size: 15px; color: #aaa; line-height: 1.9; margin-bottom: 10px; }
                .badge {
                    display: inline-block;
                    background: #1a1a1a;
                    border: 1px solid #333;
                    border-radius: 6px;
                    padding: 12px 24px;
                    margin-top: 30px;
                    font-size: 12px;
                    color: #555;
                }
                .log-id { font-size: 11px; color: #333; margin-top: 20px; font-family: monospace; }
            </style>
        </head>
        <body>
            <div class="wrap">
                <span class="icon">🚫</span>
                <h1>${title}</h1>
                <p>${message.replace(/\n/g, '<br>')}</p>
                <p>이 접근 기록은 IP, 브라우저 정보, 참조 URL과 함께 자동 수집됩니다.</p>
                <div class="badge">
                    © 2026 Samsung Life Insurance WM Division<br>
                    2030 Business Live ON — All Rights Reserved
                </div>
                <p class="log-id">LOG ID: ${generateLogId()}</p>
            </div>
        </body>
        </html>`;
    }

    // ────────────────────────────────────────────────
    // 📡 4. 위반 행위 Firebase 로그 전송
    // ────────────────────────────────────────────────
    async function reportViolation(type, extra = {}) {
        const logData = {
            fields: {
                type: { stringValue: type },
                domain: { stringValue: window.location.hostname },
                url: { stringValue: window.location.href },
                referrer: { stringValue: document.referrer || '(direct)' },
                userAgent: { stringValue: navigator.userAgent },
                language: { stringValue: navigator.language },
                screenSize: { stringValue: `${screen.width}x${screen.height}` },
                timestamp: { timestampValue: new Date().toISOString() },
                logId: { stringValue: generateLogId() },
                ...Object.fromEntries(
                    Object.entries(extra).map(([k, v]) => [k, { stringValue: String(v) }])
                )
            }
        };

        // Firebase Firestore REST API
        const url = `https://firestore.googleapis.com/v1/projects/${SEC.FIREBASE_PROJECT}/databases/(default)/documents/security_violations?key=${SEC.FIREBASE_API_KEY}`;

        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(logData),
                keepalive: true
            });
        } catch (_) {
            // 네트워크 실패 시 LocalStorage에 임시 저장
            try {
                const saved = JSON.parse(localStorage.getItem('_sec_viol') || '[]');
                saved.push({ type, ts: new Date().toISOString(), url: window.location.href });
                localStorage.setItem('_sec_viol', JSON.stringify(saved.slice(-50)));
            } catch (_2) { /* ignore */ }
        }
    }

    // ────────────────────────────────────────────────
    // 🔑 고유 로그 ID 생성
    // ────────────────────────────────────────────────
    function generateLogId() {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
        return `BLO-${ts}-${rand}`;
    }

    // ────────────────────────────────────────────────
    // 🖱️ 5. 우클릭 방지
    // ────────────────────────────────────────────────
    document.addEventListener('contextmenu', e => e.preventDefault());

    // ────────────────────────────────────────────────
    // ⌨️ 6. 키보드 단축키 차단
    // ────────────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        const c = e.key.toLowerCase();

        // F12 - 개발자 도구
        if (e.key === 'F12') { e.preventDefault(); return false; }

        // Ctrl 조합
        if (e.ctrlKey || e.metaKey) {
            if ([
                'u',    // 소스 보기
                's',    // 저장
                'a',    // 전체 선택
                'p',    // 인쇄
            ].includes(c)) {
                e.preventDefault();
                return false;
            }
            // Ctrl+Shift+I/J/C - 개발자 도구/콘솔/검사
            if (e.shiftKey && ['i', 'j', 'c'].includes(c)) {
                e.preventDefault();
                return false;
            }
        }
    });

    // ────────────────────────────────────────────────
    // 📋 7. 복사 시 저작권 안내 자동 삽입
    // ────────────────────────────────────────────────
    document.addEventListener('copy', function (e) {
        e.preventDefault();
        const selected = window.getSelection()?.toString() || '';
        if (selected && e.clipboardData) {
            e.clipboardData.setData(
                'text/plain',
                selected + SEC.COPYRIGHT_TEXT
            );
        }
    });

    // ────────────────────────────────────────────────
    // 🚫 8. 텍스트 선택 & 드래그 제한
    // ────────────────────────────────────────────────
    document.addEventListener('dragstart', e => e.preventDefault());

    // ────────────────────────────────────────────────
    // 🖨️ 9. 인쇄 방지
    // ────────────────────────────────────────────────
    const noPrintStyle = document.createElement('style');
    noPrintStyle.textContent = `@media print { body * { display: none !important; } body::after { display: block !important; content: '© 2026 Samsung Life Insurance WM Division. 무단 인쇄 금지.'; font-size: 20px; text-align: center; padding: 40px; } }`;
    document.head.appendChild(noPrintStyle);

    // ────────────────────────────────────────────────
    // 🔍 10. 개발자 도구 열림 감지
    // ────────────────────────────────────────────────
    let _devReported = false;
    function detectDevTools() {
        const threshold = 160;
        const wDiff = window.outerWidth - window.innerWidth;
        const hDiff = window.outerHeight - window.innerHeight;
        if ((wDiff > threshold || hDiff > threshold) && !_devReported) {
            _devReported = true;
            reportViolation('DEVTOOLS_OPENED', { domain: window.location.hostname });
        }
        if (wDiff <= threshold && hDiff <= threshold) {
            _devReported = false; // 닫히면 리셋
        }
    }
    setInterval(detectDevTools, 2000);

    // ────────────────────────────────────────────────
    // 💬 11. 콘솔 저작권 경고
    // ────────────────────────────────────────────────
    const cs = (color, size = 14) => `color:${color};font-size:${size}px;font-weight:bold;`;
    console.log('%c🚫 STOP!', cs('#ff0000', 22));
    console.log('%c이 브라우저 기능은 개발자를 위한 것입니다.', cs('#ff4444'));
    console.log('%c본 사이트의 소스코드·콘텐츠는 저작권법의 보호를 받습니다.', cs('#ffaa00'));
    console.log('%c무단 복제 및 도용 시 민·형사상 책임을 물을 수 있습니다.', cs('#ff6666'));
    console.log('%c© 2026 Samsung Life Insurance WM Division. All Rights Reserved.', cs('#888', 12));

    // ────────────────────────────────────────────────
    // 🔒 12. 숨겨진 디지털 워터마크 삽입
    // ────────────────────────────────────────────────
    function injectWatermark() {
        const wm = document.createElement('div');
        wm.id = '__samsung_blo_watermark__';
        wm.setAttribute('data-owner', 'samsung-life-wm-2030blo');
        wm.setAttribute('data-created', '2026');
        wm.setAttribute('data-site', 'admin-samsung-vvip.web.app');
        wm.style.cssText = 'position:fixed;pointer-events:none;opacity:0;z-index:-9999;width:1px;height:1px;';
        wm.textContent = '© 2026 Samsung Life Insurance WM 2030 Business Live ON';
        document.body?.appendChild(wm);
    }

    // ────────────────────────────────────────────────
    // 🚀 초기화
    // ────────────────────────────────────────────────
    function init() {
        if (!verifyDomain()) return;
        if (!verifyTopFrame()) return;
        injectWatermark();
    }

    // DOM 준비 후 실행
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 도메인 체크는 즉시 실행 (DOM 대기 없이)
    verifyDomain();
    verifyTopFrame();

})();
