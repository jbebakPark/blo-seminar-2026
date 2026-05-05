// ================================================================
// 🔒 2030 BUSINESS LIVE ON - 사이트 보안 시스템 v3.0
// Copyright (c) 2026 Samsung Life Insurance WM Division
// 무단 복제·배포·도용 엄격히 금지 (저작권법 위반 시 법적 조치)
//
// ▶ Firebase API 키 설정 방법:
//   Firebase 콘솔 → 프로젝트 설정 → 일반 → 내 앱 → 웹 앱 → 구성
//   아래 FIREBASE_API_KEY 에 apiKey 값을 붙여넣으세요.
//   Firestore 콘솔에서 access_logs / security_violations 컬렉션을
//   공개 쓰기 허용으로 보안 규칙 설정 필요:
//     rules_version = '2';
//     service cloud.firestore {
//       match /databases/{database}/documents {
//         match /access_logs/{doc} { allow create: if true; }
//         match /security_violations/{doc} { allow create: if true; }
//       }
//     }
// ================================================================

(function () {
    'use strict';

    // ────────────────────────────────────────────────
    // ⚙️ 보안 설정  ← Firebase 콘솔에서 실제 값으로 교체
    // ────────────────────────────────────────────────
    const SEC = {
        ALLOWED_DOMAINS: [
            'samsung2030blo.com',
            'www.samsung2030blo.com',
            'admin-samsung-vvip.web.app',
            'localhost',
            '127.0.0.1'
        ],

        // Firebase 프로젝트 정보 — Firebase 콘솔에서 확인
        FIREBASE_PROJECT: 'admin-samsung-vvip',
        FIREBASE_API_KEY: 'AIzaSyCnAY6JbQLLkpidwzhtCLFKpRB9cBOU_so',

        COPYRIGHT_TEXT: '\n\n─────────────────────────────\n⚠️  저작권 안내\n본 내용은 삼성생명 WM사업부 2030 Business Live ON의 저작물입니다.\n무단 복제·배포 시 저작권법에 따라 법적 책임을 질 수 있습니다.\n© 2026 Samsung Life Insurance. All Rights Reserved.\n─────────────────────────────\n',
    };

    // ────────────────────────────────────────────────
    // 🔑 고유 세션 ID 생성 (페이지 로드마다 고유값)
    // ────────────────────────────────────────────────
    const SESSION_ID = (function () {
        const ts = Date.now().toString(36).toUpperCase();
        const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
        return `BLO-${ts}-${rand}`;
    })();

    // 전역 노출 (워터마크 등에서 사용)
    window.__BLO_SESSION__ = SESSION_ID;

    // ────────────────────────────────────────────────
    // 📡 Firestore REST API 공통 전송
    // ────────────────────────────────────────────────
    async function firestoreWrite(collection, data) {
        if (SEC.FIREBASE_API_KEY === 'REPLACE_WITH_REAL_API_KEY') return; // 키 미설정 시 skip
        const url = `https://firestore.googleapis.com/v1/projects/${SEC.FIREBASE_PROJECT}/databases/(default)/documents/${collection}?key=${SEC.FIREBASE_API_KEY}`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ fields: data }),
                keepalive: true
            });
        } catch (_) {
            // 네트워크 실패 시 LocalStorage에 임시 저장
            try {
                const saved = JSON.parse(localStorage.getItem('_blo_log') || '[]');
                const record = {};
                for (const [k, v] of Object.entries(data)) {
                    record[k] = v.stringValue || v.timestampValue || v.integerValue || '';
                }
                saved.push(record);
                localStorage.setItem('_blo_log', JSON.stringify(saved.slice(-100)));
            } catch (_2) { /* ignore */ }
        }
    }

    // ────────────────────────────────────────────────
    // 📋 방문 기록 로그 (모든 페이지 로드 시 기록)
    //    → Firestore access_logs 컬렉션에 저장
    //    → Firebase Hosting 서버 로그에도 IP 자동 기록됨
    // ────────────────────────────────────────────────
    function logPageVisit() {
        const urlParams = new URLSearchParams(window.location.search);
        const fpCode = urlParams.get('fp') || '';

        const fields = {
            sessionId:    { stringValue: SESSION_ID },
            page:         { stringValue: window.location.pathname },
            url:          { stringValue: window.location.href },
            referrer:     { stringValue: document.referrer || '(direct)' },
            userAgent:    { stringValue: navigator.userAgent },
            language:     { stringValue: navigator.language },
            screenSize:   { stringValue: `${screen.width}x${screen.height}` },
            timezone:     { stringValue: Intl.DateTimeFormat().resolvedOptions().timeZone || '' },
            timestamp:    { timestampValue: new Date().toISOString() },
            cookieEnabled:{ stringValue: String(navigator.cookieEnabled) },
        };
        if (fpCode) fields.fpCode = { stringValue: fpCode };

        firestoreWrite('access_logs', fields);
        if (fpCode) trackFpClick(fpCode);
    }

    // FP 링크 클릭 카운터 (inviteClicks/{month}_{fpCode})
    async function trackFpClick(fpCode) {
        if (SEC.FIREBASE_API_KEY === 'REPLACE_WITH_REAL_API_KEY') return;
        const month  = new Date().toISOString().slice(0, 7); // "2026-05"
        const docId  = `${month}_${fpCode}`;
        const base   = `projects/${SEC.FIREBASE_PROJECT}/databases/(default)/documents`;
        const url    = `https://firestore.googleapis.com/v1/${base}:commit?key=${SEC.FIREBASE_API_KEY}`;
        try {
            await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    writes: [
                        {
                            update: {
                                name: `${base}/inviteClicks/${docId}`,
                                fields: {
                                    month:  { stringValue: month },
                                    fpCode: { stringValue: fpCode }
                                }
                            },
                            updateMask: { fieldPaths: ['month', 'fpCode'] }
                        },
                        {
                            transform: {
                                document: `${base}/inviteClicks/${docId}`,
                                fieldTransforms: [
                                    { fieldPath: 'count',     increment: { integerValue: '1' } },
                                    { fieldPath: 'lastClick', setToServerValue: 'REQUEST_TIME' }
                                ]
                            }
                        }
                    ]
                }),
                keepalive: true
            });
        } catch (_) {}
    }

    // ────────────────────────────────────────────────
    // 🚨 위반 행위 로그 (도용·무단 접근 시 기록)
    // ────────────────────────────────────────────────
    function reportViolation(type, extra = {}) {
        const base = {
            sessionId:  { stringValue: SESSION_ID },
            type:       { stringValue: type },
            domain:     { stringValue: window.location.hostname },
            url:        { stringValue: window.location.href },
            referrer:   { stringValue: document.referrer || '(direct)' },
            userAgent:  { stringValue: navigator.userAgent },
            screenSize: { stringValue: `${screen.width}x${screen.height}` },
            timestamp:  { timestampValue: new Date().toISOString() },
        };
        const extraFields = Object.fromEntries(
            Object.entries(extra).map(([k, v]) => [k, { stringValue: String(v) }])
        );
        firestoreWrite('security_violations', { ...base, ...extraFields });
    }

    // ────────────────────────────────────────────────
    // 🛡️ 1. 도메인 무결성 검증 — 복제 사이트 즉시 차단
    // ────────────────────────────────────────────────
    function verifyDomain() {
        const host = window.location.hostname.toLowerCase();
        const allowed = SEC.ALLOWED_DOMAINS.some(d => host === d || host.endsWith('.' + d));
        if (!allowed) {
            reportViolation('UNAUTHORIZED_DOMAIN', { illegalDomain: host });
            lockdown(
                '⛔ 불법 도용 사이트 감지',
                `이 사이트는 허용되지 않은 도메인(${host})에서 복제·운영되고 있습니다.\n이 접근 시도는 서버에 기록되었으며 법적 조치의 근거로 활용됩니다.`
            );
            return false;
        }
        return true;
    }

    // ────────────────────────────────────────────────
    // 🛡️ 2. iframe 임베딩 차단
    // ────────────────────────────────────────────────
    function verifyTopFrame() {
        if (window.top !== window.self) {
            reportViolation('IFRAME_EMBED', { embedReferrer: document.referrer });
            lockdown('⛔ iframe 무단 임베딩 감지', '이 사이트를 외부 페이지에 iframe으로 삽입하는 것은 금지되어 있습니다.');
            return false;
        }
        return true;
    }

    // ────────────────────────────────────────────────
    // 🚫 3. 페이지 전체 잠금 (불법 복제 시)
    // ────────────────────────────────────────────────
    function lockdown(title, message) {
        document.documentElement.innerHTML = `
        <html lang="ko"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">
        <title>접근 차단됨</title>
        <style>
            *{margin:0;padding:0;box-sizing:border-box}
            body{background:#0a0a0a;color:#fff;font-family:'Malgun Gothic',sans-serif;min-height:100vh;display:flex;align-items:center;justify-content:center;text-align:center}
            .w{max-width:600px;padding:40px 20px}
            .ico{font-size:80px;margin-bottom:24px;display:block}
            h1{font-size:24px;color:#ff4444;margin-bottom:16px}
            p{font-size:14px;color:#aaa;line-height:1.9;margin-bottom:8px}
            .sid{font-size:11px;color:#444;margin-top:20px;font-family:monospace}
            .badge{display:inline-block;background:#1a1a1a;border:1px solid #333;border-radius:6px;padding:10px 20px;margin-top:24px;font-size:11px;color:#555}
        </style></head><body>
        <div class="w">
            <span class="ico">🚫</span>
            <h1>${title}</h1>
            <p>${message.replace(/\n/g, '<br>')}</p>
            <p>이 접근 기록(IP, 브라우저 정보, 참조 URL, 시각)은 자동으로 수집됩니다.</p>
            <div class="badge">© 2026 Samsung Life Insurance WM Division<br>2030 Business Live ON — All Rights Reserved</div>
            <p class="sid">SESSION: ${SESSION_ID}</p>
        </div></body></html>`;
    }

    // ────────────────────────────────────────────────
    // 🖱️ 4. 우클릭 방지
    // ────────────────────────────────────────────────
    document.addEventListener('contextmenu', e => e.preventDefault());

    // ────────────────────────────────────────────────
    // ⌨️ 5. 키보드 단축키 차단
    // ────────────────────────────────────────────────
    document.addEventListener('keydown', function (e) {
        const c = (e.key || '').toLowerCase();
        if (e.key === 'F12') { e.preventDefault(); return false; }
        if (e.ctrlKey || e.metaKey) {
            if (['u', 's', 'a', 'p'].includes(c)) { e.preventDefault(); return false; }
            if (e.shiftKey && ['i', 'j', 'c'].includes(c)) { e.preventDefault(); return false; }
        }
    });

    // ────────────────────────────────────────────────
    // 📋 6. 복사 시 저작권 안내 자동 삽입
    // ────────────────────────────────────────────────
    document.addEventListener('copy', function (e) {
        e.preventDefault();
        const selected = window.getSelection()?.toString() || '';
        if (selected && e.clipboardData) {
            e.clipboardData.setData('text/plain', selected + SEC.COPYRIGHT_TEXT);
        }
    });

    // ────────────────────────────────────────────────
    // 🚫 7. 드래그·선택 제한
    // ────────────────────────────────────────────────
    document.addEventListener('dragstart', e => e.preventDefault());

    // ────────────────────────────────────────────────
    // 🖨️ 8. 인쇄 차단
    // ────────────────────────────────────────────────
    const noPrint = document.createElement('style');
    noPrint.textContent = '@media print{body *{display:none!important}body::after{display:block!important;content:"© 2026 Samsung Life Insurance WM Division. 무단 인쇄 금지.";font-size:20px;text-align:center;padding:40px}}';
    document.head.appendChild(noPrint);
    window.addEventListener('beforeprint', function (e) { e.preventDefault(); return false; });

    // ────────────────────────────────────────────────
    // 🔍 9. 개발자 도구 감지 → 위반 로그 전송
    // ────────────────────────────────────────────────
    let _devReported = false;
    function detectDevTools() {
        const wD = window.outerWidth  - window.innerWidth;
        const hD = window.outerHeight - window.innerHeight;
        if ((wD > 160 || hD > 160) && !_devReported) {
            _devReported = true;
            reportViolation('DEVTOOLS_OPENED');
        }
        if (wD <= 160 && hD <= 160) _devReported = false;
    }
    setInterval(detectDevTools, 2000);

    // ────────────────────────────────────────────────
    // 💬 10. 콘솔 저작권 경고
    // ────────────────────────────────────────────────
    const cs = (color, size = 14) => `color:${color};font-size:${size}px;font-weight:bold`;
    console.log('%c🚫 STOP!', cs('#ff0000', 22));
    console.log('%c이 브라우저 기능은 개발자를 위한 것입니다.', cs('#ff4444'));
    console.log('%c본 사이트의 소스코드·콘텐츠는 저작권법의 보호를 받습니다.', cs('#ffaa00'));
    console.log('%c무단 복제 및 도용 시 민·형사상 책임을 물을 수 있습니다.', cs('#ff6666'));
    console.log('%c© 2026 Samsung Life Insurance WM Division. All Rights Reserved.', cs('#888', 12));

    // ────────────────────────────────────────────────
    // 🔒 11. 숨겨진 HTML 디지털 워터마크 삽입
    // ────────────────────────────────────────────────
    function injectHiddenWatermark() {
        const wm = document.createElement('div');
        wm.id = '__samsung_blo_wm__';
        wm.setAttribute('data-owner', 'samsung-life-wm-2030blo');
        wm.setAttribute('data-session', SESSION_ID);
        wm.setAttribute('data-created', '2026');
        wm.setAttribute('data-site', 'admin-samsung-vvip.web.app');
        wm.style.cssText = 'position:fixed;pointer-events:none;opacity:0;z-index:-9999;width:1px;height:1px;overflow:hidden';
        wm.textContent = `© 2026 Samsung Life Insurance WM 2030 Business Live ON | Session: ${SESSION_ID}`;
        document.body?.appendChild(wm);
    }

    // ────────────────────────────────────────────────
    // 🚀 초기화
    // ────────────────────────────────────────────────
    function init() {
        if (!verifyDomain()) return;
        if (!verifyTopFrame()) return;
        injectHiddenWatermark();
        logPageVisit();     // 모든 방문 기록
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // 도메인·프레임 체크는 즉시 실행
    verifyDomain();
    verifyTopFrame();

})();
