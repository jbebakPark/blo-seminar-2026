// 삼성생명 GFC 지원자 관리 시스템
// Version: 2.0.0 (Firestore 직접 연결)
// Last Updated: 2026-02-16

console.log('GFC Applications Management - Loaded Successfully');

// ========================================
// 1. 전역 변수
// ========================================
let allApplications = [];
let filteredApplications = [];
let currentApplication = null;
let db = null; // Firestore database reference
let managementSortDirection = '';
let submissionSortDirection = '';

// ── 관리자 접근 로그 헬퍼 ─────────────────────────────────────────────────
function logAdminAction(action, targetId, extra = {}) {
    try {
        var dbRef = db || (typeof firebase !== 'undefined' ? firebase.firestore() : null);
        if (!dbRef) return;
        var user = firebase.auth && firebase.auth().currentUser;
        dbRef.collection('admin_logs').add({
            admin_uid: user ? user.uid : 'unknown',
            admin_email: user ? (user.email || user.uid) : 'unknown',
            action,
            target_id: targetId || '',
            ...extra,
            timestamp: new Date().toISOString()
        }).catch(e => console.warn('[logAdminAction]', e.message));
    } catch (e) { /* ignore */ }
}

function normalizeToISOString(value) {
    if (!value) return '';
    if (typeof value === 'string') return value;
    if (value?.toDate) return value.toDate().toISOString();
    if (value instanceof Date) return value.toISOString();
    return String(value);
}

function normalizeToString(value) {
    if (value === undefined || value === null) return '';
    return String(value).trim();
}

function getReviewerName() {
    const adminUser = (typeof window !== 'undefined' && window._adminUser) || {};
    return normalizeToString(
        adminUser.name ||
        adminUser.displayName ||
        adminUser.email ||
        adminUser.uid ||
        '관리자'
    );
}

function getSubmissionDateRaw(app = {}) {
    return (
        app.submission_datetime ||
        app.submitted_at ||
        app.submittedAt ||
        app.created_at ||
        app.createdAt ||
        ''
    );
}

function getSubmissionTimestamp(app = {}) {
    const raw = getSubmissionDateRaw(app);
    const date = new Date(raw);
    return Number.isNaN(date.getTime()) ? 0 : date.getTime();
}

function getSubmissionDateDisplay(app = {}, { withTime = false } = {}) {
    const kst = normalizeToString(app.submission_datetime_kst);
    if (kst) {
        if (withTime) return kst;
        return kst.split(' ')[0] || kst;
    }

    const raw = getSubmissionDateRaw(app);
    if (!raw) return '-';
    return withTime ? formatDateTime(raw) : formatDate(raw);
}

function getManagementNumber(app = {}) {
    const number = normalizeToString(app.managementNumber || app.management_number);
    return number || '-';
}

function getManagementNumberSortKey(app = {}) {
    const digits = getManagementNumber(app).replace(/\D/g, '');
    return digits || '';
}

function sortApplicationsByManagementNumber(applications = []) {
    if (managementSortDirection !== 'asc' && managementSortDirection !== 'desc') {
        return applications;
    }

    const direction = managementSortDirection;
    return [...applications].sort((a, b) => {
        const aKey = getManagementNumberSortKey(a);
        const bKey = getManagementNumberSortKey(b);

        if (aKey && bKey) {
            const keyCompare = aKey.localeCompare(bKey, 'ko-KR', { numeric: true });
            if (keyCompare !== 0) {
                return direction === 'asc' ? keyCompare : -keyCompare;
            }
        } else if (aKey && !bKey) {
            return -1;
        } else if (!aKey && bKey) {
            return 1;
        }

        const aTime = getSubmissionTimestamp(a);
        const bTime = getSubmissionTimestamp(b);
        return direction === 'asc' ? (aTime - bTime) : (bTime - aTime);
    });
}

function sortApplicationsBySubmissionDate(applications = []) {
    if (submissionSortDirection !== 'asc' && submissionSortDirection !== 'desc') {
        return applications;
    }

    const direction = submissionSortDirection;
    return [...applications].sort((a, b) => {
        const aTime = getSubmissionTimestamp(a);
        const bTime = getSubmissionTimestamp(b);

        if (aTime !== bTime) {
            return direction === 'asc' ? (aTime - bTime) : (bTime - aTime);
        }

        const aKey = getManagementNumberSortKey(a);
        const bKey = getManagementNumberSortKey(b);
        return aKey.localeCompare(bKey, 'ko-KR', { numeric: true });
    });
}

function applyActiveSort(applications = []) {
    if (managementSortDirection === 'asc' || managementSortDirection === 'desc') {
        return sortApplicationsByManagementNumber(applications);
    }
    if (submissionSortDirection === 'asc' || submissionSortDirection === 'desc') {
        return sortApplicationsBySubmissionDate(applications);
    }
    return applications;
}

function updateSortButtons() {
    const ascBtn = document.getElementById('sort-mgmt-asc');
    const descBtn = document.getElementById('sort-mgmt-desc');
    const submissionAscBtn = document.getElementById('sort-date-asc');
    const submissionDescBtn = document.getElementById('sort-date-desc');
    if (ascBtn) {
        ascBtn.classList.toggle('active', managementSortDirection === 'asc');
    }
    if (descBtn) {
        descBtn.classList.toggle('active', managementSortDirection === 'desc');
    }
    if (submissionAscBtn) {
        submissionAscBtn.classList.toggle('active', submissionSortDirection === 'asc');
    }
    if (submissionDescBtn) {
        submissionDescBtn.classList.toggle('active', submissionSortDirection === 'desc');
    }
}

function setManagementSort(direction) {
    const nextDirection = direction === 'asc' || direction === 'desc' ? direction : '';
    managementSortDirection = managementSortDirection === nextDirection ? '' : nextDirection;
    if (managementSortDirection) {
        submissionSortDirection = '';
    }
    updateSortButtons();
    applyFilters();
}

function setSubmissionSort(direction) {
    const nextDirection = direction === 'asc' || direction === 'desc' ? direction : '';
    submissionSortDirection = submissionSortDirection === nextDirection ? '' : nextDirection;
    if (submissionSortDirection) {
        managementSortDirection = '';
    }
    updateSortButtons();
    applyFilters();
}

function resetSort() {
    managementSortDirection = '';
    submissionSortDirection = '';
    updateSortButtons();
    applyFilters();
}

function resetAllFilters() {
    const typeFilter = document.getElementById('filter-type');
    const statusFilter = document.getElementById('filter-status');
    const searchInput = document.getElementById('search-input');

    if (typeFilter) typeFilter.value = '';
    if (statusFilter) statusFilter.value = '';
    if (searchInput) searchInput.value = '';
    var channelFilter = document.getElementById('filter-channel');
    if (channelFilter) channelFilter.value = '';

    managementSortDirection = '';
    submissionSortDirection = '';
    updateSortButtons();
    applyFilters();
}

// ========================================
// 2. 초기 로드 및 Firebase 초기화
// ========================================
document.addEventListener('DOMContentLoaded', function () {
    console.log('Initializing applications management system');

    // Shared initialization
    if (window.initializeFirebase) {
        window.initializeFirebase();
    }

    // Set local db reference from global window.db or firebase instance
    if (typeof window !== 'undefined' && window.db) {
        db = window.db;
    } else if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
        db = firebase.firestore();
    }

    // loadApplications()는 applications.html 인증 체크 후 호출됨
    // 인증이 DOMContentLoaded보다 빠른 경우 대비
    if (window._adminUser) {
        loadApplications();
    }
});

// Firebase 초기화 (Legacy wrapper removed, using shared config)
// Shared initialization handles winddow.db setup

// ========================================
// 3. 지원자 데이터 로드
// ========================================
async function loadApplications() {
    console.log('Loading applications...');

    const container = document.getElementById('applications-container');
    if (!container) {
        console.error('applications-container element not found. loadApplications aborted.');
        return;
    }

    container.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>지원자 정보를 불러오는 중...</p>
        </div>
    `;

    try {
        // db 재확인 및 초기화 (인증 후 호출 타이밍 대응)
        if (!db) {
            if (window.db) {
                db = window.db;
            } else if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                db = firebase.firestore();
                window.db = db;
            }
        }
        if (!db) {
            throw new Error('Firestore not initialized');
        }

        console.log('📡 Fetching applications from Firestore...');

        const PAGE_SIZE = 100;

        // orderBy 없이 limit만 사용 (필드 타입 혼재로 인한 무한대기 방지)
        // 15초 타임아웃 적용
        const fetchPromise = db.collection('applications').limit(PAGE_SIZE).get();
        const timeoutPromise = new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Firestore 응답 시간 초과 (15초)')), 15000)
        );
        const snapshot = await Promise.race([fetchPromise, timeoutPromise]);
        window._lastAppDoc = snapshot.docs[snapshot.docs.length - 1] || null;
        window._totalLoadedAll = snapshot.docs.length < PAGE_SIZE; // 더 불러올 게 없으면 true

        const mapDoc = doc => ({
            id: doc.id,
            ...doc.data(),
            managementNumber: normalizeToString(doc.data().managementNumber || doc.data().management_number),
            management_number: normalizeToString(doc.data().management_number || doc.data().managementNumber),
            submission_datetime: normalizeToISOString(doc.data().submission_datetime || doc.data().submitted_at || doc.data().submittedAt),
            submission_datetime_kst: normalizeToString(doc.data().submission_datetime_kst),
            submitted_at: normalizeToISOString(doc.data().submitted_at || doc.data().submittedAt),
            created_at: normalizeToISOString(doc.data().created_at || doc.data().createdAt),
            updated_at: normalizeToISOString(doc.data().updated_at || doc.data().updatedAt)
        });

        allApplications = snapshot.docs.map(mapDoc);

        // submitted_at 기준 내림차순 (서버 정렬 실패 대비 보조 정렬)
        allApplications.sort((a, b) => getSubmissionTimestamp(b) - getSubmissionTimestamp(a));

        filteredApplications = [...allApplications];

        console.log(`✅ Loaded ${allApplications.length} applications from Firestore`);

        // 통계 업데이트
        updateStatistics();

        // 차트 초기화
        initializeCharts();

        // 테이블 렌더링
        renderApplicationsTable();
        updateSortButtons();

        // 더 불러오기 버튼 표시
        renderLoadMoreBtn();

    } catch (error) {
        console.error('Error loading applications:', error);
        console.log('Loading sample data instead...');

        // 샘플 데이터 로드 (API 연동 전 테스트용)
        allApplications = getSampleApplications();
        filteredApplications = [...allApplications];

        console.log(`Loaded ${allApplications.length} sample applications`);

        // 통계 업데이트
        updateStatistics();

        // 차트 초기화
        initializeCharts();

        // 테이블 렌더링
        renderApplicationsTable();
        updateSortButtons();

        // 안내 메시지 표시
        if (allApplications.length > 0) {
            const notice = document.createElement('div');
            notice.style.cssText = 'background: #fff3cd; border-left: 4px solid #ffc107; padding: 1rem; margin-bottom: 1rem; border-radius: 8px;';
            notice.innerHTML = `
                <p style="margin: 0; color: #856404;">
                    <i class="fas fa-info-circle"></i> 
                    <strong>샘플 데이터 모드</strong>: API 연동 전이므로 샘플 데이터를 표시합니다.
                </p>
            `;
            container.parentElement.insertBefore(notice, container);
        }
    }
}

// ========================================
// 샘플 데이터 생성 함수
// ========================================
function getSampleApplications() {
    return [
        {
            id: 'app001',
            application_type: 'jobfair',
            name: '김철수',
            birth_date: '1985-03-15',
            gender: '남성',
            phone: '010-1234-5678',
            email: 'kim.cs@example.com',
            address: '서울특별시 강남구 테헤란로 123',
            address_detail: '456호',
            education_level: '대학교 졸업',
            education_school: '서울대학교',
            education_major: '경영학',
            education_status: '졸업',
            career_years: 10,
            certificates: 'CPA, 재무분석사',
            career_summary: '대기업 재무팀 10년 경력\n중소기업 컨설팅 3년',
            motivation: '평생 일할 수 있는 전문직으로 제2의 인생을 시작하고 싶습니다.',
            strengths: '재무 분석 및 기업 컨설팅 경험이 풍부합니다.',
            job_fair_date: '2026-02-15',
            job_fair_location: '서울',
            consent_collection: true,
            consent_third_party: true,
            consent_credit_inquiry: true,
            consent_marketing: true,
            status: 'pending',
            submitted_at: '2026-02-01T09:30:00Z'
        },
        {
            id: 'app002',
            application_type: 'referral',
            name: '이영희',
            birth_date: '1978-07-22',
            gender: '여성',
            phone: '010-2345-6789',
            email: 'lee.yh@example.com',
            address: '경기도 성남시 분당구 판교로 234',
            address_detail: '',
            education_level: '대학원 졸업',
            education_school: '연세대학교',
            education_major: '경제학',
            education_status: '석사 졸업',
            career_years: 15,
            certificates: 'CFP, 증권분석사',
            career_summary: '금융권 15년 경력\n자산관리 전문가',
            motivation: '고객에게 실질적인 도움을 줄 수 있는 일을 하고 싶습니다.',
            strengths: '고객 관리 및 재무 설계 전문성',
            referrer_name: '박지성',
            referrer_branch: '강남지점',
            referrer_phone: '010-3456-7890',
            consent_collection: true,
            consent_third_party: true,
            consent_credit_inquiry: true,
            consent_marketing: false,
            status: 'approved',
            submitted_at: '2026-01-28T14:20:00Z',
            reviewed_at: '2026-01-29T10:15:00Z',
            reviewed_by: '관리자'
        },
        {
            id: 'app003',
            application_type: 'direct',
            name: '박민수',
            birth_date: '1990-11-05',
            gender: '남성',
            phone: '010-3456-7890',
            email: 'park.ms@example.com',
            address: '부산광역시 해운대구 센텀로 345',
            address_detail: '101동 1502호',
            education_level: '대학교 졸업',
            education_school: '부산대학교',
            education_major: '회계학',
            education_status: '졸업',
            career_years: 7,
            certificates: '세무사, 회계사',
            career_summary: '회계법인 7년 근무\n중소기업 세무 컨설팅',
            motivation: '지역 중소기업에 실질적인 도움을 주고 싶습니다.',
            strengths: '세무 및 회계 전문성, 지역 네트워크',
            consent_collection: true,
            consent_third_party: true,
            consent_credit_inquiry: true,
            consent_marketing: true,
            status: 'reviewing',
            submitted_at: '2026-02-02T11:45:00Z'
        },
        {
            id: 'app004',
            application_type: 'jobfair',
            name: '최지혜',
            birth_date: '1982-04-18',
            gender: '여성',
            phone: '010-4567-8901',
            email: 'choi.jh@example.com',
            address: '인천광역시 연수구 송도과학로 456',
            address_detail: '',
            education_level: '대학교 졸업',
            education_school: '인하대학교',
            education_major: '금융학',
            education_status: '졸업',
            career_years: 12,
            certificates: 'FRM, 투자분석사',
            career_summary: '은행 PB 12년 경력\nVIP 고객 관리',
            motivation: '더 많은 고객에게 전문적인 재무 서비스를 제공하고 싶습니다.',
            strengths: 'VIP 고객 관리 경험, 투자 포트폴리오 구성 능력',
            job_fair_date: '2026-02-20',
            job_fair_location: '인천',
            consent_collection: true,
            consent_third_party: true,
            consent_credit_inquiry: true,
            consent_marketing: true,
            status: 'pending',
            submitted_at: '2026-02-03T08:15:00Z'
        },
        {
            id: 'app005',
            application_type: 'referral',
            name: '정우성',
            birth_date: '1975-12-30',
            gender: '남성',
            phone: '010-5678-9012',
            email: 'jung.ws@example.com',
            address: '대전광역시 유성구 대학로 567',
            address_detail: '202호',
            education_level: '대학원 졸업',
            education_school: 'KAIST',
            education_major: '산업공학',
            education_status: '박사 졸업',
            career_years: 20,
            certificates: 'PMP, 경영지도사',
            career_summary: '대기업 경영전략팀 20년\n중소기업 컨설팅 다수',
            motivation: '학문적 지식과 실무 경험을 바탕으로 중소기업 성장에 기여하고 싶습니다.',
            strengths: '전략 수립 및 실행 능력, 데이터 분석',
            referrer_name: '김태희',
            referrer_branch: '대전지점',
            referrer_phone: '010-6789-0123',
            consent_collection: true,
            consent_third_party: true,
            consent_credit_inquiry: true,
            consent_marketing: true,
            status: 'rejected',
            submitted_at: '2026-01-25T16:30:00Z',
            reviewed_at: '2026-01-26T09:00:00Z',
            reviewed_by: '관리자'
        }
    ];
}

// ========================================
// 4. 통계 업데이트
// ========================================
function updateStatistics() {
    const total = allApplications.length;
    const pending = allApplications.filter(app => app.status === 'pending').length;
    const approved = allApplications.filter(app => app.status === 'approved').length;

    // 이번 달 신규 지원자
    const thisMonth = new Date();
    thisMonth.setDate(1);
    thisMonth.setHours(0, 0, 0, 0);

    const monthCount = allApplications.filter(app => {
        const submitDate = new Date(getSubmissionDateRaw(app));
        if (Number.isNaN(submitDate.getTime())) return false;
        return submitDate >= thisMonth;
    }).length;

    // 통계 업데이트
    document.getElementById('stat-total').textContent = total;
    document.getElementById('stat-pending').textContent = pending;
    document.getElementById('stat-approved').textContent = approved;
    document.getElementById('stat-month').textContent = monthCount;
}

// ========================================
// 5. 테이블 렌더링
// ========================================
function renderLoadMoreBtn() {
    const existing = document.getElementById('loadMoreBtn');
    if (existing) existing.remove();
    if (window._totalLoadedAll) return; // 전체 로딩 완료면 버튼 불필요

    const container = document.getElementById('applications-container');
    if (!container) return;
    const btn = document.createElement('div');
    btn.id = 'loadMoreBtn';
    btn.style.cssText = 'text-align:center; padding:1.2rem 0;';
    btn.innerHTML = `<button onclick="loadMoreApplications()" style="background:#1428A0;color:#fff;border:none;border-radius:8px;padding:0.6rem 2rem;font-size:0.9rem;cursor:pointer;">
        <i class="fas fa-chevron-down"></i> 이전 지원자 더 불러오기
    </button>
    <p style="font-size:0.78rem;color:#999;margin-top:0.4rem;">최근 ${allApplications.length}건 표시 중</p>`;
    container.after(btn);
}

async function loadMoreApplications() {
    if (!window._lastAppDoc || window._totalLoadedAll) return;
    const btn = document.getElementById('loadMoreBtn');
    if (btn) btn.querySelector('button').innerHTML = '<i class="fas fa-spinner fa-spin"></i> 불러오는 중...';

    try {
        const PAGE_SIZE = 100;
        const snapshot = await db.collection('applications')
            .startAfter(window._lastAppDoc)
            .limit(PAGE_SIZE)
            .get();

        if (snapshot.empty) { window._totalLoadedAll = true; if (btn) btn.remove(); return; }

        window._lastAppDoc = snapshot.docs[snapshot.docs.length - 1];
        window._totalLoadedAll = snapshot.docs.length < PAGE_SIZE;

        const mapDoc = doc => ({
            id: doc.id, ...doc.data(),
            managementNumber: normalizeToString(doc.data().managementNumber || doc.data().management_number),
            management_number: normalizeToString(doc.data().management_number || doc.data().managementNumber),
            submission_datetime: normalizeToISOString(doc.data().submission_datetime || doc.data().submitted_at || doc.data().submittedAt),
            submitted_at: normalizeToISOString(doc.data().submitted_at || doc.data().submittedAt),
            created_at: normalizeToISOString(doc.data().created_at || doc.data().createdAt),
            updated_at: normalizeToISOString(doc.data().updated_at || doc.data().updatedAt)
        });
        const newDocs = snapshot.docs.map(mapDoc);
        allApplications = [...allApplications, ...newDocs];
        filteredApplications = [...allApplications];
        applyFilters(); // 기존 필터 재적용
        renderLoadMoreBtn();
    } catch(e) {
        if (btn) btn.querySelector('button').innerHTML = '<i class="fas fa-exclamation-triangle"></i> 불러오기 실패 - 다시 시도';
        console.error('loadMore 실패:', e.message);
    }
}

function renderApplicationsTable() {
    const container = document.getElementById('applications-container');

    if (filteredApplications.length === 0) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-inbox"></i>
                <p>지원자가 없습니다.</p>
                <p style="font-size: 0.9rem; margin-top: 0.5rem;">필터를 초기화하거나 새로운 지원을 기다려주세요.</p>
            </div>
        `;
        return;
    }

    const tableHTML = `
        <div id="bulkActionBar" style="display:none; background:#e8f0fe; border:1px solid #4285f4; border-radius:8px; padding:0.6rem 1rem; margin-bottom:0.75rem; align-items:center; gap:0.75rem; flex-wrap:wrap;">
            <span id="bulkSelCount" style="font-weight:600; font-size:0.9rem; color:#1428A0;"></span>
            <button class="btn btn-primary" style="font-size:0.85rem; padding:0.35rem 0.9rem;" onclick="bulkSendEmail()">
                <i class="fas fa-envelope"></i> 이메일 일괄 발송
            </button>
            <button class="btn" style="font-size:0.85rem; padding:0.35rem 0.9rem; background:#eee; color:#333;" onclick="clearBulkSelection()">
                <i class="fas fa-times"></i> 선택 해제
            </button>
        </div>
        <div style="overflow-x: auto;">
            <table class="applications-table">
                <thead>
                    <tr>
                        <th style="width:36px;"><input type="checkbox" id="checkAll" title="전체 선택" onchange="toggleCheckAll(this)"></th>
                        <th>관리번호</th>
                        <th>접수채널</th>
                        <th>지원일시</th>
                        <th>유형</th>
                        <th>이름</th>
                        <th>연락처</th>
                        <th>이메일</th>
                        <th>상태</th>
                        <th>작업</th>
                    </tr>
                </thead>
                <tbody>
                    ${filteredApplications.map(app => `
                        <tr>
                            <td><input type="checkbox" class="app-row-check" data-id="${app.id}" onchange="updateBulkBar()"></td>
                            <td>${getManagementNumber(app)}</td>
                            <td>${getChannelBadge(app)}</td>
                            <td>${getSubmissionDateDisplay(app, { withTime: true })}</td>
                            <td>${getTypeBadge(getApplicationTypeKey(app))}</td>
                            <td><strong>${(app.name || '').trim() ? app.name : '<span style="color:#D32F2F;">⚠️ 이름없음</span>'}</strong></td>
                            <td>${app.phone}</td>
                            <td>${app.email}</td>
                            <td>${getStatusBadge(app.status)}</td>
                            <td>
                                <div class="action-buttons">
                                    <button class="btn btn-sm btn-primary" onclick="viewDetails('${app.id}')">
                                        <i class="fas fa-eye"></i> 상세
                                    </button>
                                </div>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;

    container.innerHTML = tableHTML;
}

// ========================================
// 6. 필터링 및 검색
// ========================================
function applyFilters() {
    const typeFilter = document.getElementById('filter-type').value;
    const statusFilter = document.getElementById('filter-status').value;
    const channelFilter = (document.getElementById('filter-channel') || {}).value || '';
    const searchQuery = document.getElementById('search-input').value.toLowerCase();

    filteredApplications = allApplications.filter(app => {
        const appType = getApplicationTypeKey(app);

        // 유형 필터
        if (typeFilter && appType !== typeFilter) return false;

        // 상태 필터
        if (statusFilter && app.status !== statusFilter) return false;

        // 접수채널 필터
        if (channelFilter) {
            const ch = app.submission_channel || 'online';
            if (ch !== channelFilter) return false;
        }

        // 검색
        if (searchQuery) {
            const searchableText = `
                ${getManagementNumber(app)}
                ${app.name} 
                ${app.email} 
                ${app.phone}
            `.toLowerCase();

            if (!searchableText.includes(searchQuery)) {
                return false;
            }
        }

        return true;
    });

    filteredApplications = applyActiveSort(filteredApplications);
    updateSortButtons();

    console.log(`Filtered: ${filteredApplications.length} / ${allApplications.length}`);

    // 차트 업데이트
    initializeCharts();

    renderApplicationsTable();
}

function handleSearch(event) {
    if (event.key === 'Enter') {
        applyFilters();
    }
}

// ========================================
// 7. 상세 보기
// ========================================
function viewDetails(id) {
    const app = allApplications.find(a => a.id === id);
    if (!app) return;
    const appType = getApplicationTypeKey(app);

    currentApplication = app;
    // ★ 관리자 접근 로그
    logAdminAction('view_detail', id, { name: app.name || '', mgmt: app.management_number || '' });

    const modalBody = document.getElementById('modal-body');

    // ★ 생년월일 폴백: birth_date 없으면 birth_year/month/day 조합
    function resolveBirthDate(a) {
        if (a.birth_date) return a.birth_date;
        const y = a.birth_year || '';
        const m = String(a.birth_month || '').padStart(2, '0');
        const d = String(a.birth_day || '').padStart(2, '0');
        if (y) return y + (m !== '00' ? '-' + m : '') + (d !== '00' ? '-' + d : '');
        return '-';
    }

    // ★ 이름 빈값 경고
    const nameDisplay = (app.name || '').trim()
        ? `<strong>${app.name}</strong>`
        : '<strong style="color:#D32F2F;">⚠️ 이름 없음 (미입력)</strong>';

    // ★ 보험사 경력 표시
    const insExp = app.insurance_experience === 'yes' ? '있음'
        : app.insurance_experience === 'no' ? '없음'
            : app.insurance_experience || '-';

    // JOB FAIR 지원 여부
    const isJobFairApp = appType === 'jobfair' || appType === 'referral_jobfair';

    modalBody.innerHTML = `
        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-user"></i> 기본 정보</h3>
            <div class="detail-grid">
                <div class="detail-label">지원 유형</div>
                <div class="detail-value">${getTypeText(appType)}</div>

                <div class="detail-label">성명</div>
                <div class="detail-value">${nameDisplay}</div>

                <div class="detail-label">생년월일</div>
                <div class="detail-value">
                    ${resolveBirthDate(app)}
                    ${app.birth_calendar === 'lunar'
                        ? '<span style="margin-left:6px;font-size:0.78rem;background:#EDE7F6;color:#6A1B9A;padding:2px 8px;border-radius:10px;font-weight:700;">🌙 음력</span>'
                        : '<span style="margin-left:6px;font-size:0.78rem;background:#FFF8E1;color:#F57F17;padding:2px 8px;border-radius:10px;font-weight:700;">☀️ 양력</span>'
                    }
                </div>

                <div class="detail-label">주민등록번호</div>
                <div class="detail-value">
                    ${app.rrn
                        ? `<span id="rrn-display-${app.id}" style="font-family:monospace;letter-spacing:0.1em;">${app.rrn.slice(0,6)}-<span style="color:#999;">*******</span></span>
                           <span style="margin-left:6px;font-size:0.75rem;background:#E8F5E9;color:#2E7D32;padding:2px 8px;border-radius:10px;">등록됨</span>
                           <button id="rrn-btn-${app.id}" onclick="toggleRrn('${app.id}')"
                               style="margin-left:8px;padding:3px 10px;font-size:0.78rem;background:#FFF8E1;color:#E65100;border:1px solid #FFE082;border-radius:6px;cursor:pointer;font-weight:600;">
                               <i class="fas fa-eye"></i> 전체 보기
                           </button>`
                        : '<span style="color:#999;">미등록</span>'
                    }
                </div>

                <div class="detail-label">성별</div>
                <div class="detail-value">${app.gender || '-'}</div>

                <div class="detail-label">결혼 여부</div>
                <div class="detail-value">${app.marital_status || '-'}</div>

                <div class="detail-label">연락처(휴대폰)</div>
                <div class="detail-value">${app.phone || '-'}</div>

                <div class="detail-label">전화번호(자택)</div>
                <div class="detail-value">${app.home_phone || '-'}</div>

                <div class="detail-label">이메일</div>
                <div class="detail-value">${app.email || '-'}</div>

                <div class="detail-label">우편번호</div>
                <div class="detail-value">${app.postal_code || '-'}</div>

                <div class="detail-label">주소</div>
                <div class="detail-value">${app.address ? String(app.address + ' ' + (app.address_detail || '')).trim() : '-'}</div>

                <div class="detail-label">금융불량 여부</div>
                <div class="detail-value">${app.financial_delinquency === 'yes'
            ? '<span style="color:#D32F2F;font-weight:700;">불량 (YES)</span>'
            : app.financial_delinquency === 'no' ? '정상 (NO)'
                : (app.financial_delinquency || '-')
        }</div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-graduation-cap"></i> 학력 정보</h3>
            <div class="detail-grid">
                <div class="detail-label">최종학력</div>
                <div class="detail-value">${app.education_level || '-'}</div>

                <div class="detail-label">학교명</div>
                <div class="detail-value">${app.education_school || '-'}</div>

                <div class="detail-label">전공</div>
                <div class="detail-value">${app.education_major || '-'}</div>

                <div class="detail-label">졸업구분</div>
                <div class="detail-value">${app.education_status || '-'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-shield-halved"></i> 보험사 경력</h3>
            <div class="detail-grid">
                <div class="detail-label">보험사 경력 여부</div>
                <div class="detail-value">${insExp}</div>

                ${app.insurance_experience === 'yes' ? `
                <div class="detail-label" style="padding-left:14px;">└ 보험사명</div>
                <div class="detail-value">${app.insurance_company || '-'}</div>
                <div class="detail-label" style="padding-left:14px;">└ 근무기간</div>
                <div class="detail-value">${app.insurance_period || '-'}</div>
                <div class="detail-label" style="padding-left:14px;">└ 월급여(만원)</div>
                <div class="detail-value">${app.insurance_salary ? app.insurance_salary + '만원' : '-'}</div>
                ` : ''}
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-briefcase"></i> 경력 정보</h3>
            <div class="detail-grid">
                <div class="detail-label">총 경력</div>
                <div class="detail-value">${(app.career_years != null && app.career_years !== '') ? `${app.career_years}년` : '-'}</div>

                <div class="detail-label">자격증</div>
                <div class="detail-value">${app.certificates || '-'}</div>

                <div class="detail-label">경력 상세</div>
                <div class="detail-value" style="white-space: pre-wrap;">${app.career_summary || '-'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-pen"></i> 지원 동기</h3>
            <p style="white-space: pre-wrap; line-height: 1.8; color: var(--text-light);">${app.motivation || '-'}</p>
        </div>

        ${app.strengths ? `
        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-star"></i> 강점</h3>
            <p style="white-space: pre-wrap; line-height: 1.8; color: var(--text-light);">${app.strengths}</p>
        </div>
        ` : ''}

        ${hasJobfairType(appType) ? `
        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-calendar-alt"></i> 채용설명회 정보</h3>
            <div class="detail-grid">
                <div class="detail-label">희망 날짜</div>
                <div class="detail-value">${app.job_fair_date || '-'}</div>

                <div class="detail-label">희망 지역</div>
                <div class="detail-value">${app.job_fair_location || '-'}</div>
            </div>
        </div>
        ` : ''}

        ${(hasReferralType(appType) || app.has_referrer === true || app.has_referrer === 'on') ? `
        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-user-check"></i> 추천인 정보 <small style="font-size:0.8rem; font-weight:400; color:#888;">(지원자 입력)</small></h3>
            <div class="detail-grid">
                <div class="detail-label">추천인 기록 여부</div>
                <div class="detail-value">${(app.has_referrer === true || app.has_referrer === 'on' || app.referrer_name) ? '✅ 추천인 있음' : '❌ 추천인 없음'}</div>

                <div class="detail-label">추천인 성명</div>
                <div class="detail-value">${app.referrer_name || '-'}</div>

                <div class="detail-label">추천인 전화번호</div>
                <div class="detail-value">${app.referrer_phone || '-'}</div>

                <div class="detail-label">추천인 소속(지점)</div>
                <div class="detail-value">${app.referrer_branch || '-'}</div>
            </div>
        </div>
        ` : ''}

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-user-tie"></i> 유치자 정보 <small style="font-size:0.8rem; font-weight:400; color:#888;">(관리자 입력)</small></h3>
            <div class="detail-grid">
                <div class="detail-label">유치자 성명</div>
                <div class="detail-value">${app.recruiter || '-'}</div>

                <div class="detail-label">유치자 전화번호</div>
                <div class="detail-value">${app.recruiter_phone || '-'}</div>

                <div class="detail-label">유치자 소속(지점)</div>
                <div class="detail-value">${app.branch || '-'}</div>
            </div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-shield-alt"></i> 개인정보 동의</h3>
            <div class="detail-grid">
                ${(() => {
                    const ts = app.consent_timestamps || {};
                    const fmtTs = (key) => ts[key] ? `<span style="font-size:0.75rem;color:#888;margin-left:4px;">(${new Date(ts[key]).toLocaleString('ko-KR')})</span>` : '';
                    const yn = (val, name) => {
                        const checked = val === true || val === 'on';
                        return checked
                            ? `<span style="color:#2E7D32;font-weight:700;">✅ 동의</span>${fmtTs(name)}`
                            : `<span style="color:#D32F2F;">❌ 미동의</span>`;
                    };
                    const rows = [
                        ['수집·이용 동의', '필수', yn(app.consent_collection_yn ?? app.consent_collection, 'consent_collection')],
                        ['제3자 정보 제공 동의', '필수', yn(app.consent_third_party_yn ?? app.consent_third_party, 'consent_third_party')],
                        ['신용정보 조회 동의', '필수', yn(app.consent_credit_inquiry_yn ?? app.consent_credit_inquiry, 'consent_credit_inquiry')],
                        ['합숙교육 참석 확인', '필수', yn(app.consent_training_schedule_yn ?? app.consent_training_schedule, 'consent_training_schedule')],
                        ['문자(SMS) 수신 동의', '기본', yn(app.consent_sms_yn ?? app.consent_marketing, 'consent_sms')],
                        ['카카오톡 수신 동의', '선택', yn(app.consent_kakao_yn, 'consent_kakao')],
                        ['이메일 수신 동의', '기본', yn(app.consent_email_marketing_yn, 'consent_email_marketing')],
                    ];
                    const badgeStyle = (cat) => {
                        if (cat === '필수') return 'background:#FFEBEE;color:#C62828;';
                        if (cat === '기본') return 'background:#E3F2FD;color:#01579B;';
                        return 'background:#F3E5F5;color:#6A1B9A;';
                    };
                    return rows.map(([label, category, val]) => `
                        <div class="detail-label">${label}
                            <span style="margin-left:4px;font-size:0.72rem;padding:1px 6px;border-radius:8px;
                                ${badgeStyle(category)}
                                font-weight:700;">${category}</span>
                        </div>
                        <div class="detail-value">${val}</div>
                    `).join('');
                })()}
            </div>
            ${app.consent_agreed_at ? `
            <div style="margin-top:8px;font-size:0.8rem;color:#888;padding:6px 10px;background:#F8F9FA;border-radius:6px;">
                <i class="fas fa-clock" style="margin-right:4px;"></i>
                필수 동의 완료 일시: <strong style="color:#444;">${new Date(app.consent_agreed_at).toLocaleString('ko-KR')}</strong>
            </div>` : ''}
        </div>

        <!-- ★ 수신거부 현황 (실시간 자동 반영) -->
        <div class="detail-section" id="optout-status-section">
            <h3 class="detail-section-title">
                <i class="fas fa-ban"></i> 수신거부 현황
                <span id="optout-realtime-dot" style="display:inline-block;width:8px;height:8px;background:#27ae60;border-radius:50%;margin-left:8px;vertical-align:middle;" title="실시간 연동 중"></span>
                <span style="font-size:0.72rem;color:#27ae60;font-weight:600;margin-left:4px;">실시간</span>
            </h3>
            <div id="optout-channels-grid" style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:10px;">
                <!-- 채널별 카드 — JS로 렌더 -->
                <div style="text-align:center;color:#999;font-size:0.85rem;grid-column:1/-1;padding:12px;">
                    <i class="fas fa-spinner fa-spin"></i> 로딩 중...
                </div>
            </div>
            <div id="optout-history-list" style="margin-top:8px;"></div>
        </div>

        <div class="detail-section">
            <h3 class="detail-section-title"><i class="fas fa-info-circle"></i> 관리 정보</h3>
            <div class="detail-grid">
                <div class="detail-label">관리번호</div>
                <div class="detail-value">${getManagementNumber(app)}</div>

                <div class="detail-label">접수 채널</div>
                <div class="detail-value">
                    ${getChannelBadge(app)}
                    ${app.registered_by ? `<span style="font-size:0.8rem; color:#888; margin-left:0.5rem;">등록자: ${app.registered_by}</span>` : ''}
                    ${app.registered_at ? `<span style="font-size:0.8rem; color:#aaa; margin-left:0.4rem;">(${new Date(app.registered_at).toLocaleString('ko-KR')})</span>` : ''}
                </div>

                <div class="detail-label">지원 일시</div>
                <div class="detail-value">${getSubmissionDateDisplay(app, { withTime: true })}</div>

                <div class="detail-label">현재 상태</div>
                <div class="detail-value">${getStatusBadge(app.status)}</div>
                
                ${app.reviewed_at ? `
                <div class="detail-label">검토일</div>
                <div class="detail-value">${formatDateTime(app.reviewed_at)}</div>
                ` : ''}
                
                ${app.reviewed_by ? `
                <div class="detail-label">검토자</div>
                <div class="detail-value">${app.reviewed_by}</div>
                ` : ''}

            </div>
        </div>

        <!-- 수정 이력 섹션 -->
        <div class="detail-section" id="edit-log-section">
            <h3 class="detail-section-title"><i class="fas fa-history"></i> 수정 이력</h3>
            ${renderEditLog(app.edit_log)}
        </div>

        <!-- 필드 직접 수정 패널 (숨겨져 있다가 버튼 클릭 시 표시) -->
        <div class="detail-section" id="edit-mode-panel" style="display:none; border:2px solid #1428A0; border-radius:8px; padding:1rem; margin-top:1rem;">
            <h3 class="detail-section-title" style="color:#1428A0;"><i class="fas fa-pen"></i> 정보 수정 (관리자)</h3>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.75rem; margin-top:0.75rem;">
                ${buildEditField('성명', 'edit-name', app.name)}
                ${buildEditField('휴대전화', 'edit-phone', app.phone)}
                ${buildEditField('이메일', 'edit-email', app.email)}
                ${buildEditField('주소', 'edit-address', app.address)}
                ${buildEditField('유치자(추천자)', 'edit-recruiter', app.recruiter)}
                ${buildEditField('소속 지점', 'edit-branch', app.branch)}
                ${isJobFairApp ? buildEditSelectField('📍 JOB FAIR 희망 지역', 'edit-job-fair-location', app.job_fair_location,
                    ['서울/경기','부산/경남','대구/경북','광주/전남','대전/충청','온라인']) : ''}
                ${buildEditField('메모', 'edit-notes', app.notes, true)}
            </div>
            <div style="display:flex; gap:0.75rem; margin-top:1rem; justify-content:flex-end;">
                <button class="btn" style="background:#eee; color:#333;" onclick="cancelEditMode()">취소</button>
                <button class="btn btn-primary" onclick="saveFieldEdits('${app.id}')"><i class="fas fa-save"></i> 수정 저장</button>
            </div>
        </div>

        <div style="margin-top:1.5rem; border-top:1px solid #eee; padding-top:1rem; display:flex; flex-direction:column; gap:0.6rem;">
            <!-- 상태 변경 행 -->
            <div style="display:flex; align-items:center; gap:0.5rem; background:#f5f5f5; border-radius:10px; padding:0.5rem 0.75rem; flex-wrap:wrap;">
                <label style="font-size:0.82rem; color:#555; white-space:nowrap; font-weight:600;"><i class="fas fa-exchange-alt"></i> 상태 변경</label>
                <select id="statusChangeSelect" onchange="onStatusSelectChange(this)" style="flex:1; min-width:140px; border:1px solid #ddd; border-radius:6px; padding:0.4rem 0.6rem; font-size:0.88rem;">
                    <option value="">-- 선택 --</option>
                    <option value="pending" ${app.status==='pending'?'selected':''}>대기 중</option>
                    <option value="reviewing" ${app.status==='reviewing'?'selected':''}>검토 중</option>
                    ${isJobFairApp ? `<option value="receipt_confirmed" ${app.status==='receipt_confirmed'?'selected':''}>✅ JOB FAIR 접수확인</option>` : ''}
                    <option value="interview_scheduled" ${app.status==='interview_scheduled'?'selected':''}>📅 면접 통보</option>
                    <option value="interviewed" ${app.status==='interviewed'?'selected':''}>면접 완료</option>
                    <option value="approved" ${app.status==='approved'?'selected':''}>승인됨</option>
                    <option value="rejected" ${app.status==='rejected'?'selected':''}>거부됨</option>
                    <option value="withdrawn" ${app.status==='withdrawn'?'selected':''}>지원 취소</option>
                </select>
                <button class="btn btn-primary" style="padding:0.4rem 1rem; font-size:0.88rem; white-space:nowrap;" onclick="applyStatusChange('${app.id}')">
                    <i class="fas fa-check"></i> 적용
                </button>
            </div>
            <!-- 액션 버튼 행 -->
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:0.5rem;">
                <button class="btn" style="background:#1428A0; color:#fff; font-size:0.85rem;" onclick="startEditMode()"><i class="fas fa-pen"></i> 정보 수정</button>
                <button class="btn" style="background:#00796B; color:#fff; font-size:0.85rem;" onclick="toggleInterviewPanel()"><i class="fas fa-calendar-alt"></i> 면접 일정</button>
            </div>
            <button class="btn btn-primary" style="width:100%; font-size:0.9rem;" onclick="closeModal()">닫기</button>
        </div>

        <!-- 면접 일정 패널 -->
        <div id="interviewPanel" style="display:none; margin-top:1rem; background:#e8f5e9; border:1px solid #a5d6a7; border-radius:12px; padding:1rem;">
            <h4 style="margin:0 0 0.75rem; color:#1b5e20; font-size:0.92rem;"><i class="fas fa-calendar-check"></i> 면접 일정 등록</h4>
            <div style="display:flex; flex-direction:column; gap:0.6rem;">
                <div>
                    <label style="font-size:0.8rem; color:#555; display:block; margin-bottom:0.25rem;">면접 일시 <span style="color:red;">*</span></label>
                    <input type="datetime-local" id="interviewDateInput" style="width:100%; border:1px solid #ccc; border-radius:6px; padding:0.45rem 0.7rem; font-size:0.92rem; box-sizing:border-box;"
                        value="${app.interview_date ? (app.interview_date.includes('T') ? app.interview_date.slice(0,16) : '') : ''}">
                </div>
                <div>
                    <label style="font-size:0.8rem; color:#555; display:block; margin-bottom:0.25rem;">면접 장소</label>
                    <input type="text" id="interviewLocInput" placeholder="예: 삼성생명 강남지점 2층" style="width:100%; border:1px solid #ccc; border-radius:6px; padding:0.45rem 0.7rem; font-size:0.92rem; box-sizing:border-box;"
                        value="${app.interview_location || ''}">
                </div>
                <div>
                    <label style="font-size:0.8rem; color:#555; display:block; margin-bottom:0.25rem;">안내 사항</label>
                    <input type="text" id="interviewNoteInput" placeholder="준비물, 복장 등 안내" style="width:100%; border:1px solid #ccc; border-radius:6px; padding:0.45rem 0.7rem; font-size:0.92rem; box-sizing:border-box;"
                        value="${app.interview_note || ''}">
                </div>
            </div>
            <div style="margin-top:0.85rem; display:grid; grid-template-columns:auto 1fr; gap:0.5rem;">
                <button class="btn" style="background:#eee; color:#333; font-size:0.85rem; padding:0.5rem 1rem; white-space:nowrap;" onclick="toggleInterviewPanel()">취소</button>
                <button class="btn" style="background:#1428A0; color:#fff; font-size:0.85rem; padding:0.5rem 0.75rem; line-height:1.5; text-align:center;" onclick="saveInterviewSchedule('${app.id}', '${(app.name||'').replace(/'/g,"\\'")}', '${(app.email||'')}', '${(app.phone||'')}', '${(app.managementNumber||app.management_number||'')}')">
                    <i class="fas fa-calendar-check"></i> 저장 + 면접통보 예약<br>
                    <span style="font-size:0.72rem; opacity:0.9;">📅 D-1 오후 4시 SMS·이메일 자동발송</span>
                </button>
            </div>
        </div>
    `;

    document.getElementById('detailModal').classList.add('active');

    // ★ 수신거부 현황 실시간 초기화
    initOptOutSection(app);

    // ★ 첨부파일 인라인 미리보기
    renderAttachmentSection(app);

    // ★ 내부 메모/태그 섹션 초기화
    renderMemoTagSection(app);

    // ★ 통보 발송 이력 섹션
    renderNotificationHistory(app.id);
}

// 수정 이력 렌더링
function renderEditLog(editLog) {
    if (!Array.isArray(editLog) || editLog.length === 0) {
        return '<p style="color:#999; font-size:0.85rem; text-align:center; padding:0.5rem 0;">수정 이력 없음</p>';
    }
    return editLog.map(entry => {
        const sourceLabel = entry.source === 'admin' ? '🔧 관리자' : '✏️ 지원자';
        return `
        <div style="border:1px solid #e5e7eb; border-radius:6px; padding:0.75rem; margin-bottom:0.5rem; font-size:0.82rem;">
            <div style="display:flex; justify-content:space-between; margin-bottom:0.4rem; color:#555;">
                <span>${sourceLabel} — <strong>${escapeHtml(entry.updatedBy || '-')}</strong></span>
                <span style="color:#999;">${formatDateTime(entry.timestamp)}</span>
            </div>
            ${(entry.changes || []).map(c => `
            <div style="display:grid; grid-template-columns:auto 1fr 1fr; gap:0.5rem; align-items:center; padding:0.2rem 0; border-top:1px solid #f0f0f0;">
                <span style="background:#f3f4f6; padding:2px 8px; border-radius:4px; font-weight:600; white-space:nowrap;">${escapeHtml(c.label || c.field)}</span>
                <span style="color:#e53e3e; text-decoration:line-through; word-break:break-all;">${escapeHtml(c.before || '(없음)')}</span>
                <span style="color:#276749; font-weight:600; word-break:break-all;">→ ${escapeHtml(c.after || '(없음)')}</span>
            </div>`).join('')}
        </div>`;
    }).join('');
}

function escapeHtml(str) {
    return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function buildEditSelectField(label, id, value, options) {
    const opts = options.map(o =>
        `<option value="${o}"${o === value ? ' selected' : ''}>${o}</option>`
    ).join('');
    return `<div>
        <label style="font-size:0.8rem; color:#555; font-weight:600;">${label}</label>
        <select id="${id}" style="width:100%; border:1px solid #d1d5db; border-radius:6px; padding:6px 10px; font-size:0.85rem; margin-top:4px;">
            <option value="">-- 선택 --</option>
            ${opts}
        </select>
    </div>`;
}

function buildEditField(label, id, value, isTextarea) {
    if (isTextarea) {
        return `<div style="grid-column:1/-1;">
            <label style="font-size:0.8rem; color:#555; font-weight:600;">${label}</label>
            <textarea id="${id}" style="width:100%; border:1px solid #d1d5db; border-radius:6px; padding:6px 10px; font-size:0.85rem; margin-top:4px; resize:vertical; min-height:60px;">${escapeHtml(value || '')}</textarea>
        </div>`;
    }
    return `<div>
        <label style="font-size:0.8rem; color:#555; font-weight:600;">${label}</label>
        <input type="text" id="${id}" value="${escapeHtml(value || '')}" style="width:100%; border:1px solid #d1d5db; border-radius:6px; padding:6px 10px; font-size:0.85rem; margin-top:4px;">
    </div>`;
}

function startEditMode() {
    document.getElementById('edit-mode-panel').style.display = 'block';
}

function cancelEditMode() {
    document.getElementById('edit-mode-panel').style.display = 'none';
}

async function saveFieldEdits(appId) {
    const app = allApplications.find(a => a.id === appId);
    if (!app) return;

    const fieldMap = {
        'edit-name': { field: 'name', label: '성명', orig: app.name },
        'edit-phone': { field: 'phone', label: '휴대전화', orig: app.phone },
        'edit-email': { field: 'email', label: '이메일', orig: app.email },
        'edit-address': { field: 'address', label: '주소', orig: app.address },
        'edit-recruiter': { field: 'recruiter', label: '유치자(추천자)', orig: app.recruiter },
        'edit-branch': { field: 'branch', label: '소속 지점', orig: app.branch },
        'edit-job-fair-location': { field: 'job_fair_location', label: 'JOB FAIR 희망 지역', orig: app.job_fair_location },
        'edit-notes': { field: 'notes', label: '메모', orig: app.notes }
    };

    const changes = [];
    Object.entries(fieldMap).forEach(([elId, meta]) => {
        const el = document.getElementById(elId);
        if (!el) return;
        const newVal = el.value.trim();
        const oldVal = (meta.orig || '').trim();
        if (newVal !== oldVal) {
            changes.push({ field: meta.field, label: meta.label, before: oldVal, after: newVal });
        }
    });

    if (changes.length === 0) {
        alert('변경된 내용이 없습니다.');
        return;
    }

    const confirmMsg = changes.map(c => `• ${c.label}: "${c.before}" → "${c.after}"`).join('\n');
    if (!confirm(`다음 항목을 수정하시겠습니까?\n\n${confirmMsg}`)) return;

    try {
        const fn = firebase.functions().httpsCallable('updateApplicationField');
        await fn({ applicationId: appId, changes });

        // 로컬 캐시 갱신
        changes.forEach(c => { app[c.field] = c.after; });
        if (!Array.isArray(app.edit_log)) app.edit_log = [];
        app.edit_log.push({
            timestamp: new Date().toISOString(),
            updatedBy: (window._adminUser && window._adminUser.email) || 'Admin',
            source: 'admin',
            changes
        });

        alert('수정이 완료되었습니다.');
        viewDetails(appId); // 모달 새로고침
    } catch (err) {
        console.error('수정 실패:', err);
        alert('수정 중 오류가 발생했습니다: ' + err.message);
    }
}

function closeModal() {
    document.getElementById('detailModal').classList.remove('active');
    // 수신거부 실시간 리스너 해제
    if (window._optOutUnsubscribe) {
        window._optOutUnsubscribe();
        window._optOutUnsubscribe = null;
    }
}

// ========================================
// 8. 상태 업데이트
// ========================================
function promptForRequiredText(label, initialValue = '') {
    const seed = String(initialValue || '').trim();
    const input = window.prompt(`${label}을(를) 입력하세요.`, seed);
    if (input === null) return null;
    const normalized = String(input).trim();
    if (!normalized) {
        alert(`${label}은(는) 필수 입력입니다.`);
        return null;
    }
    return normalized;
}

// ========================================
// 면접 일정 관리
// ========================================
function toggleInterviewPanel() {
    var panel = document.getElementById('interviewPanel');
    if (!panel) return;
    panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
}

async function saveInterviewSchedule(appId, name, email, phone, mgmtNum) {
    var dateVal = (document.getElementById('interviewDateInput') || {}).value;
    var loc = (document.getElementById('interviewLocInput') || {}).value || '';
    var note = (document.getElementById('interviewNoteInput') || {}).value || '';
    if (!dateVal) { alert('면접 일시를 입력해주세요.'); return; }

    var btn = document.querySelector('#interviewPanel button:last-child');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 저장 중...'; }

    try {
        const scheduleInterview = firebase.functions().httpsCallable('scheduleInterview');
        await scheduleInterview({
            applicationId: appId,
            interviewDate: dateVal,
            interviewLocation: loc,
            interviewNote: note,
            name: name,
            email: email,
            phone: phone,
            managementNumber: mgmtNum
        });
        alert('✅ 면접 일정 등록 완료!\n\n면접 전날(D-1) 16:00에 지원자에게\n문자(SMS) + 이메일이 자동 발송됩니다.');
        toggleInterviewPanel();
        loadApplications();
    } catch(e) {
        console.error(e);
        alert('면접 일정 저장 실패: ' + e.message);
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-calendar-check"></i> 저장 + 면접통보 예약 (D-1 16:00 자동발송)'; }
    }
}

// ========================================
// 일괄 선택 및 일괄 이메일 알림
// ========================================
function toggleCheckAll(el) {
    document.querySelectorAll('.app-row-check').forEach(cb => { cb.checked = el.checked; });
    updateBulkBar();
}

function updateBulkBar() {
    const checked = document.querySelectorAll('.app-row-check:checked');
    const bar = document.getElementById('bulkActionBar');
    const cnt = document.getElementById('bulkSelCount');
    const checkAll = document.getElementById('checkAll');
    const total = document.querySelectorAll('.app-row-check').length;
    if (!bar) return;
    if (checked.length > 0) {
        bar.style.display = 'flex';
        if (cnt) cnt.textContent = checked.length + '명 선택됨';
    } else {
        bar.style.display = 'none';
    }
    if (checkAll) checkAll.indeterminate = (checked.length > 0 && checked.length < total);
    if (checkAll && checked.length === total && total > 0) checkAll.checked = true;
    if (checkAll && checked.length === 0) checkAll.checked = false;
}

function clearBulkSelection() {
    document.querySelectorAll('.app-row-check').forEach(cb => { cb.checked = false; });
    const checkAll = document.getElementById('checkAll');
    if (checkAll) { checkAll.checked = false; checkAll.indeterminate = false; }
    updateBulkBar();
}

async function bulkSendEmail() {
    const checked = Array.from(document.querySelectorAll('.app-row-check:checked'));
    if (checked.length === 0) { alert('선택된 지원자가 없습니다.'); return; }

    const msg = prompt(
        checked.length + '명에게 이메일을 발송합니다.\n\n발송할 메시지를 입력하세요\n(비워두면 현재 상태 안내 메일이 발송됩니다):',
        ''
    );
    if (msg === null) return; // 취소

    if (!confirm(checked.length + '명에게 이메일을 발송하시겠습니까?')) return;

    const ids = checked.map(cb => cb.dataset.id);
    let successCount = 0, failCount = 0;

    for (const id of ids) {
        const app = allApplications.find(a => a.id === id);
        if (!app || !app.email) { failCount++; continue; }
        try {
            const sendNotification = firebase.functions().httpsCallable('sendStatusChangeNotification');
            await sendNotification({
                applicationId: id,
                managementNumber: app.managementNumber || app.management_number || '',
                name: app.name || '',
                email: app.email || '',
                phone: app.phone || '',
                newStatus: app.status || 'pending',
                memo: msg || ''
            });
            successCount++;
        } catch(e) {
            console.warn('발송 실패:', app.email, e.message);
            failCount++;
        }
    }

    alert(`이메일 발송 완료\n성공: ${successCount}건, 실패: ${failCount}건`);
    clearBulkSelection();
}

function onStatusSelectChange(sel) {
    const panel = document.getElementById('interviewPanel');
    if (!panel) return;
    if (sel.value === 'interview_scheduled') {
        panel.style.display = 'block';
        panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
}

async function applyStatusChange(id) {
    const sel = document.getElementById('statusChangeSelect');
    if (!sel || !sel.value) { alert('변경할 상태를 선택해주세요.'); return; }

    // 면접 통보 → 면접 패널에서 직접 저장하도록 안내
    if (sel.value === 'interview_scheduled') {
        const panel = document.getElementById('interviewPanel');
        if (panel) panel.style.display = 'block';
        alert('면접 일시·장소·안내사항을 입력한 후\n[저장 + 면접통보 예약] 버튼을 눌러주세요.');
        return;
    }

    await updateStatus(id, sel.value);
}

async function updateStatus(id, newStatus) {
    const STATUS_NAMES = {
        pending: '대기 중', reviewing: '검토 중',
        receipt_confirmed: 'JOB FAIR 접수확인',
        interview_scheduled: '면접 통보', interviewed: '면접 완료',
        approved: '승인', rejected: '거부', withdrawn: '지원 취소'
    };
    if (!confirm(`이 지원서를 [${STATUS_NAMES[newStatus] || newStatus}] 상태로 변경하시겠습니까?`)) {
        return;
    }

    try {
        if (!db) {
            throw new Error('Firestore not initialized');
        }

        const app = allApplications.find(item => item.id === id) || {};
        const updatePayload = {
            status: newStatus,
            reviewed_at: new Date().toISOString(),
            reviewed_by: getReviewerName()
        };

        if (newStatus === 'approved') {
            const recruiter = promptForRequiredText('유치자 성명', app.recruiter);
            if (recruiter === null) return;
            const recruiterPhone = promptForRequiredText('유치자 전화번호', app.recruiter_phone);
            if (recruiterPhone === null) return;
            const branch = promptForRequiredText('유치자 소속(지점명)', app.branch);
            if (branch === null) return;
            updatePayload.recruiter = recruiter;
            updatePayload.recruiter_phone = recruiterPhone;
            updatePayload.branch = branch;
        }

        await db.collection('applications').doc(id).update(updatePayload);
        logAdminAction('update_status', id, { from: app.status, to: newStatus });

        // 상태변경 통보 Cloud Function 호출
        try {
            if (typeof firebase !== 'undefined' && firebase.apps.length > 0) {
                const sendNotification = firebase.functions().httpsCallable('sendStatusChangeNotification');
                await sendNotification({
                    applicationId: id,
                    managementNumber: app.managementNumber || app.management_number || '',
                    name: app.name || '',
                    email: app.email || '',
                    phone: app.phone || '',
                    newStatus,
                    memo: '',
                    applicationType: app.application_type || '',
                    preferredRegion: app.job_fair_location || ''
                });
            }
        } catch (notifErr) {
            console.warn('통보 전송 실패 (상태 업데이트는 완료됨):', notifErr.message);
        }

        alert('상태가 업데이트되었습니다.');
        closeModal();
        loadApplications();

    } catch (error) {
        console.error('Error updating status:', error);
        alert('상태 업데이트에 실패했습니다.\n' + error.message);
    }
}

// ========================================
// 9. 유틸리티 함수
// ========================================
function formatDate(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR');
}

function formatDateTime(dateString) {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR');
}

function normalizeApplicationType(type) {
    const raw = (type || '').trim();
    if (!raw) return 'general';
    if (raw === 'direct') return 'general';
    if (raw === 'referral-jobfair') return 'referral_jobfair';
    return raw;
}

function getApplicationTypeKey(app) {
    const candidate =
        app.application_type ||
        app.application_type_legacy ||
        app.applicationInfo?.type ||
        app.applicationInfo?.typeLegacy ||
        'general';
    return normalizeApplicationType(candidate);
}

function hasJobfairType(type) {
    const normalized = normalizeApplicationType(type);
    return normalized === 'jobfair' || normalized === 'referral_jobfair';
}

function hasReferralType(type) {
    const normalized = normalizeApplicationType(type);
    return normalized === 'referral' || normalized === 'referral_jobfair';
}

function getTypeText(type) {
    const normalized = normalizeApplicationType(type);
    const types = {
        'general': '1. 일반지원',
        'referral': '2. 추천인지원',
        'jobfair': '3. Job Fair 지원',
        'referral_jobfair': '4. 추천인 Job Fair지원'
    };
    return types[normalized] || normalized;
}

function getTypeBadge(type) {
    const normalized = normalizeApplicationType(type);
    const badges = {
        'general': '<span style="background: #e8f5e9; color: #2e7d32; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">1. 일반지원</span>',
        'referral': '<span style="background: #fff3e0; color: #ef6c00; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">2. 추천인지원</span>',
        'jobfair': '<span style="background: #e3f2fd; color: #1565c0; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">3. Job Fair 지원</span>',
        'referral_jobfair': '<span style="background: #ede7f6; color: #6a1b9a; padding: 0.3rem 0.8rem; border-radius: 20px; font-size: 0.85rem; font-weight: 600;">4. 추천인 Job Fair지원</span>'
    };
    return badges[normalized] || normalized;
}

function getStatusBadge(status) {
    const badges = {
        'pending': '<span class="status-badge status-pending">대기 중</span>',
        'reviewing': '<span class="status-badge status-reviewing">검토 중</span>',
        'receipt_confirmed': '<span class="status-badge" style="background:#e8f5e9;color:#1b5e20;border:1px solid #a5d6a7;">✅ JOB FAIR 접수확인</span>',
        'interview_scheduled': '<span class="status-badge" style="background:#e3f2fd;color:#0d47a1;border:1px solid #90caf9;">📅 면접 통보</span>',
        'interviewed': '<span class="status-badge status-interviewed">면접 완료</span>',
        'approved': '<span class="status-badge status-approved">승인됨</span>',
        'rejected': '<span class="status-badge status-rejected">거부됨</span>',
        'withdrawn': '<span class="status-badge" style="background:#f5f5f5;color:#757575;">지원 취소</span>'
    };
    return badges[status] || status;
}

function getChannelBadge(app) {
    var ch = app.submission_channel || 'online';
    var map = {
        online: ['channel-online', '🌐 온라인'],
        email:  ['channel-email',  '📧 이메일'],
        fax:    ['channel-fax',    '📠 팩스'],
        visit:  ['channel-visit',  '🏢 내방']
    };
    var info = map[ch] || map.online;
    return '<span class="channel-badge ' + info[0] + '">' + info[1] + '</span>';
}

// ========================================
// 차트 관련 함수
// ========================================

let dailyChartInstance = null;
let trackChartInstance = null;
let regionChartInstance = null;
let ageChartInstance = null;

// 차트 초기화
function initializeCharts() {
    console.log('Initializing charts...');

    // 기존 차트 파괴
    if (dailyChartInstance) dailyChartInstance.destroy();
    if (trackChartInstance) trackChartInstance.destroy();
    if (regionChartInstance) regionChartInstance.destroy();
    if (ageChartInstance) ageChartInstance.destroy();

    // 데이터 집계 (필터된 데이터 사용)
    const dataSource = filteredApplications.length > 0 ? filteredApplications : allApplications;
    const dailyData = aggregateDailyData(dataSource);
    const trackData = aggregateTrackData(dataSource);
    const regionData = aggregateRegionData(dataSource);
    const ageData = aggregateAgeData(dataSource);

    // 차트 렌더링
    renderDailyChart(dailyData);
    renderTrackChart(trackData);
    renderRegionChart(regionData);
    renderAgeChart(ageData);
}

// 일별 데이터 집계 (최근 30일)
function aggregateDailyData(applications = allApplications) {
    const dailyCount = {};
    const today = new Date();

    // 최근 30일 초기화
    for (let i = 29; i >= 0; i--) {
        const date = new Date(today);
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().split('T')[0];
        dailyCount[dateStr] = 0;
    }

    // 지원자 데이터 집계
    applications.forEach(app => {
        const submittedRaw = getSubmissionDateRaw(app);
        if (!submittedRaw) return;
        const submittedDate = new Date(submittedRaw);
        if (Number.isNaN(submittedDate.getTime())) return;
        const dateStr = submittedDate.toISOString().split('T')[0];
        if (dailyCount.hasOwnProperty(dateStr)) {
            dailyCount[dateStr]++;
        }
    });

    return {
        labels: Object.keys(dailyCount).map(date => {
            const d = new Date(date);
            return `${d.getMonth() + 1}/${d.getDate()}`;
        }),
        data: Object.values(dailyCount)
    };
}

// 트랙별 데이터 집계
function aggregateTrackData(applications = allApplications) {
    const trackCount = {
        'general': 0,
        'referral': 0,
        'jobfair': 0,
        'referral_jobfair': 0
    };

    applications.forEach(app => {
        const track = getApplicationTypeKey(app);
        if (trackCount.hasOwnProperty(track)) {
            trackCount[track]++;
        }
    });

    return {
        labels: ['1. 일반지원', '2. 추천인지원', '3. Job Fair 지원', '4. 추천인 Job Fair지원'],
        data: [trackCount.general, trackCount.referral, trackCount.jobfair, trackCount.referral_jobfair],
        colors: ['#2e7d32', '#ef6c00', '#1565c0', '#6a1b9a']
    };
}

// 지역별 데이터 집계 (상위 10개)
function aggregateRegionData(applications = allApplications) {
    const regionCount = {};

    applications.forEach(app => {
        if (app.address) {
            // 주소에서 시/도 추출
            const parts = app.address.split(' ');
            const region = parts[0] || '기타';
            regionCount[region] = (regionCount[region] || 0) + 1;
        }
    });

    // 상위 10개 지역 정렬
    const sorted = Object.entries(regionCount)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

    return {
        labels: sorted.map(item => item[0]),
        data: sorted.map(item => item[1])
    };
}

// 연령대별 데이터 집계
function aggregateAgeData(applications = allApplications) {
    const ageGroups = {
        '20대': 0,
        '30대': 0,
        '40대': 0,
        '50대': 0,
        '60대 이상': 0
    };

    applications.forEach(app => {
        if (app.birth_date) {
            const birthYear = new Date(app.birth_date).getFullYear();
            const age = new Date().getFullYear() - birthYear;

            if (age >= 20 && age < 30) ageGroups['20대']++;
            else if (age >= 30 && age < 40) ageGroups['30대']++;
            else if (age >= 40 && age < 50) ageGroups['40대']++;
            else if (age >= 50 && age < 60) ageGroups['50대']++;
            else if (age >= 60) ageGroups['60대 이상']++;
        }
    });

    return {
        labels: Object.keys(ageGroups),
        data: Object.values(ageGroups)
    };
}

// 일별 지원자 수 차트 렌더링 (Line Chart)
function renderDailyChart(data) {
    const ctx = document.getElementById('dailyChart');
    if (!ctx) return;

    dailyChartInstance = new Chart(ctx, {
        type: 'line',
        data: {
            labels: data.labels,
            datasets: [{
                label: '지원자 수',
                data: data.data,
                borderColor: '#034EA2',
                backgroundColor: 'rgba(3, 78, 162, 0.1)',
                borderWidth: 3,
                fill: true,
                tension: 0.4,
                pointRadius: 4,
                pointBackgroundColor: '#034EA2',
                pointBorderColor: '#ffffff',
                pointBorderWidth: 2,
                pointHoverRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'top',
                    labels: {
                        font: {
                            size: 12,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    callbacks: {
                        label: function (context) {
                            return `지원자: ${context.parsed.y}명`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10,
                            family: "'Noto Sans KR', sans-serif"
                        },
                        maxRotation: 45,
                        minRotation: 45
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 트랙별 분포 차트 렌더링 (Doughnut Chart)
function renderTrackChart(data) {
    const ctx = document.getElementById('trackChart');
    if (!ctx) return;

    trackChartInstance = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: data.labels,
            datasets: [{
                data: data.data,
                backgroundColor: data.colors,
                borderWidth: 2,
                borderColor: '#ffffff'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: true,
                    position: 'bottom',
                    labels: {
                        padding: 15,
                        font: {
                            size: 12,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    }
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    callbacks: {
                        label: function (context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentage = ((context.parsed / total) * 100).toFixed(1);
                            return `${context.label}: ${context.parsed}명 (${percentage}%)`;
                        }
                    }
                }
            }
        }
    });
}

// 지역별 분포 차트 렌더링 (Bar Chart)
function renderRegionChart(data) {
    const ctx = document.getElementById('regionChart');
    if (!ctx) return;

    regionChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: '지원자 수',
                data: data.data,
                backgroundColor: '#1D74C6',
                borderColor: '#034EA2',
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    callbacks: {
                        label: function (context) {
                            return `지원자: ${context.parsed.y}명`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}

// 연령대별 분포 차트 렌더링 (Bar Chart)
function renderAgeChart(data) {
    const ctx = document.getElementById('ageChart');
    if (!ctx) return;

    ageChartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: data.labels,
            datasets: [{
                label: '지원자 수',
                data: data.data,
                backgroundColor: [
                    '#FF6B35',
                    '#F7931E',
                    '#FDC830',
                    '#4ECDC4',
                    '#45B7D1'
                ],
                borderWidth: 1,
                borderRadius: 6
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    padding: 12,
                    titleFont: {
                        size: 13,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    bodyFont: {
                        size: 12,
                        family: "'Noto Sans KR', sans-serif"
                    },
                    callbacks: {
                        label: function (context) {
                            return `지원자: ${context.parsed.y}명`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        stepSize: 1,
                        font: {
                            size: 11,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        color: 'rgba(0, 0, 0, 0.05)'
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 11,
                            family: "'Noto Sans KR', sans-serif"
                        }
                    },
                    grid: {
                        display: false
                    }
                }
            }
        }
    });
}


// ========================================
// 수신거부 현황 실시간 관리
// ========================================

const OPTOUT_CHANNEL_META = {
    sms:   { label: '문자(SMS)',  icon: 'fas fa-sms',      activeColor: '#2E7D32' },
    email: { label: '이메일',     icon: 'fas fa-envelope',  activeColor: '#2E7D32' },
    kakao: { label: '카카오톡',   icon: 'fas fa-comment',   activeColor: '#2E7D32' }
};

function renderOptOutChannels(optoutChannels) {
    const grid = document.getElementById('optout-channels-grid');
    if (!grid) return;
    const appId = currentApplication ? currentApplication.id : '';

    grid.style.cssText = 'display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:10px;';
    grid.innerHTML = Object.entries(OPTOUT_CHANNEL_META).map(([ch, meta]) => {
        const data = (optoutChannels || {})[ch] || {};
        const isOptOut = data.status === 'optout';

        const statusBadge = isOptOut
            ? '<span style="display:inline-block;background:#FFEBEE;color:#C62828;font-size:0.75rem;padding:2px 8px;border-radius:10px;font-weight:700;"><i class="fas fa-ban" style="margin-right:3px;"></i>\uAC70\uBD80\uB428</span>'
            : '<span style="display:inline-block;background:#E8F5E9;color:#2E7D32;font-size:0.75rem;padding:2px 8px;border-radius:10px;font-weight:700;"><i class="fas fa-check-circle" style="margin-right:3px;"></i>\uC218\uC2E0\uC911</span>';

        let timeInfo = '';
        if (isOptOut && data.opted_out_at) {
            timeInfo = '<div style="font-size:0.7rem;color:#999;margin-top:4px;">' + new Date(data.opted_out_at).toLocaleString('ko-KR') + '</div>';
            if (data.ref_num && data.ref_num !== 'admin-manual') {
                timeInfo += '<div style="font-size:0.68rem;color:#bbb;">' + data.ref_num + '</div>';
            }
        }

        let sourceLabel = '';
        if (isOptOut && data.source) {
            const srcText = data.source === 'admin_manual' ? '\uAD00\uB9AC\uC790 \uCC98\uB9AC'
                          : data.source === 'admin_restore' ? '\uAD00\uB9AC\uC790 \uBCF5\uAD6C'
                          : '\uC6F9 \uC2E0\uCCAD';
            sourceLabel = '<div style="font-size:0.68rem;color:#aaa;margin-top:2px;">' + srcText + '</div>';
        }

        const toggleBtn = isOptOut
            ? '<button onclick="toggleOptOut(\'' + appId + '\',\'' + ch + '\',\'active\')" style="margin-top:8px;width:100%;padding:5px 0;font-size:0.78rem;background:#E3F2FD;color:#01579B;border:1px solid #90CAF9;border-radius:6px;cursor:pointer;font-weight:600;"><i class="fas fa-redo-alt"></i> \uC218\uC2E0 \uBCF5\uAD6C</button>'
            : '<button onclick="toggleOptOut(\'' + appId + '\',\'' + ch + '\',\'optout\')" style="margin-top:8px;width:100%;padding:5px 0;font-size:0.78rem;background:#FFEBEE;color:#C62828;border:1px solid #FFCDD2;border-radius:6px;cursor:pointer;font-weight:600;"><i class="fas fa-ban"></i> \uAC70\uBD80 \uCC98\uB9AC</button>';

        const borderColor = isOptOut ? '#FFCDD2' : '#C8E6C9';
        const bgColor = isOptOut ? '#FFF5F5' : '#F9FFF9';
        const iconColor = isOptOut ? '#C62828' : '#2E7D32';

        return '<div style="border:1.5px solid ' + borderColor + ';border-radius:10px;padding:12px 10px;background:' + bgColor + ';text-align:center;transition:all 0.2s;">'
            + '<div style="font-size:1.4rem;color:' + iconColor + ';margin-bottom:5px;"><i class="' + meta.icon + '"></i></div>'
            + '<div style="font-size:0.85rem;font-weight:700;color:#333;margin-bottom:6px;">' + meta.label + '</div>'
            + statusBadge + timeInfo + sourceLabel + toggleBtn
            + '</div>';
    }).join('');
}

function renderOptOutHistory(requests) {
    const el = document.getElementById('optout-history-list');
    if (!el) return;
    if (!requests || requests.length === 0) {
        el.innerHTML = '<p style="font-size:0.8rem;color:#ccc;text-align:center;padding:4px 0;border-top:1px solid #eee;margin-top:4px;">\uC218\uC2E0\uAC70\uBD80 \uC811\uC218 \uC774\uB825 \uC5C6\uC74C</p>';
        return;
    }
    const typeLabels = { sms: '\uBB38\uC790', kakao: '\uCE74\uCE74\uC624\uD1A1', email: '\uC774\uBA54\uC77C' };
    let html = '<div style="font-size:0.8rem;font-weight:700;color:#888;margin-bottom:6px;border-top:1px solid #eee;padding-top:8px;"><i class="fas fa-history" style="margin-right:4px;"></i>\uC218\uC2E0\uAC70\uBD80 \uC811\uC218 \uC774\uB825 (\uCD5C\uADFC 10\uAC74)</div>';
    requests.forEach(function(r) {
        const types = (r.opt_out_types || []).map(function(t){ return typeLabels[t] || t; }).join(', ');
        const at = r.rejected_at ? new Date(r.rejected_at).toLocaleString('ko-KR') : '-';
        const statusBadge = r.status === 'processed'
            ? '<span style="background:#E8F5E9;color:#2E7D32;font-size:0.7rem;padding:1px 6px;border-radius:8px;font-weight:700;white-space:nowrap;">\uCC98\uB9AC\uC644\uB8CC</span>'
            : '<span style="background:#FFF3E0;color:#E65100;font-size:0.7rem;padding:1px 6px;border-radius:8px;font-weight:700;white-space:nowrap;">\uCC98\uB9AC\uB300\uAE30</span>';
        html += '<div style="border:1px solid #e5e7eb;border-radius:6px;padding:8px 10px;margin-bottom:6px;font-size:0.8rem;display:flex;justify-content:space-between;align-items:flex-start;gap:8px;">'
              + '<div><span style="font-weight:700;color:#333;">' + (r.ref_num || '-') + '</span>'
              + '<span style="margin-left:6px;color:#555;">' + types + '</span>'
              + '<div style="color:#999;margin-top:2px;">' + at + '</div></div>'
              + '<div>' + statusBadge + '</div></div>';
    });
    el.innerHTML = html;
}

function initOptOutSection(app) {
    if (window._optOutUnsubscribe) {
        window._optOutUnsubscribe();
        window._optOutUnsubscribe = null;
    }

    renderOptOutChannels((app && app.optout_channels) || {});
    renderOptOutHistory([]);

    if (!app || !app.phone || !db) return;

    // 1) 지원자 doc 실시간 구독 → optout_channels 변경 즉시 반영
    var appUnsub = db.collection('applications').doc(app.id)
        .onSnapshot(function(snap) {
            if (!snap.exists) return;
            var data = snap.data();
            var idx = allApplications.findIndex(function(a){ return a.id === app.id; });
            if (idx !== -1) allApplications[idx] = Object.assign({ id: snap.id }, data);
            renderOptOutChannels(data.optout_channels || {});
        }, function(err){ console.warn('[optout] app \uB9AC\uC2A4\uB108 \uC624\uB958:', err); });

    // 2) optOutRequests 이력 실시간 구독
    var histUnsub = function(){};
    try {
        var unsub = db.collection('optOutRequests')
            .where('phone', '==', app.phone)
            .orderBy('created_at', 'desc')
            .limit(10)
            .onSnapshot(function(snap) {
                renderOptOutHistory(snap.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); }));
            }, function() {
                // orderBy 인덱스 없으면 단순 where 조회
                db.collection('optOutRequests').where('phone', '==', app.phone).get()
                    .then(function(s) {
                        renderOptOutHistory(
                            s.docs.map(function(d){ return Object.assign({ id: d.id }, d.data()); })
                                .sort(function(a,b){ return (b.created_at||'').localeCompare(a.created_at||''); })
                        );
                    }).catch(function(){});
            });
        histUnsub = unsub;
    } catch(e) { /* ignore */ }

    window._optOutUnsubscribe = function(){ appUnsub(); histUnsub(); };
}

async function toggleOptOut(appId, channel, newStatus) {
    if (!appId || !channel) return;
    var labelMap = { sms: '\uBB38\uC790(SMS)', email: '\uC774\uBA54\uC77C', kakao: '\uCE74\uCE74\uC624\uD1A1' };
    var actionLabel = newStatus === 'optout' ? '\uAC70\uBD80 \uCC98\uB9AC' : '\uC218\uC2E0 \uBCF5\uAD6C';
    if (!confirm('[' + (labelMap[channel] || channel) + '] \uCC44\uB110\uC744 ' + actionLabel + '\uD558\uC2DC\uACA0\uC2B5\uB2C8\uAE4C?')) return;

    var btn = event && event.currentTarget;
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> \uCC98\uB9AC \uC911...'; }

    try {
        if (newStatus === 'active') {
            var fn = firebase.functions().httpsCallable('restoreOptOutChannel');
            await fn({ applicationId: appId, channel: channel });
        } else {
            var fn2 = firebase.functions().httpsCallable('manualOptOutChannel');
            await fn2({ applicationId: appId, channels: [channel], note: '\uAD00\uB9AC\uC790 \uC218\uB3D9 \uCC98\uB9AC' });
        }
        // onSnapshot이 UI 자동 갱신
    } catch(err) {
        console.error('[toggleOptOut] \uC624\uB958:', err);
        alert('\uCC98\uB9AC \uC911 \uC624\uB958\uAC00 \uBC1C\uC0DD\uD588\uC2B5\uB2C8\uB2E4.\n' + err.message);
        if (btn) { btn.disabled = false; btn.innerHTML = actionLabel; }
    }
}


// ========================================
// 주민등록번호 전체 표시 토글 (관리자 전용)
// ========================================

function toggleRrn(appId) {
    var app = allApplications.find(function(a){ return a.id === appId; });
    if (!app || !app.rrn) return;

    var display = document.getElementById('rrn-display-' + appId);
    var btn = document.getElementById('rrn-btn-' + appId);
    if (!display || !btn) return;

    var isHidden = display.innerHTML.indexOf('*') !== -1;
    if (isHidden) {
        var front = app.rrn.slice(0, 6);
        var back  = app.rrn.slice(6);
        display.innerHTML = front + '-' + back;
        display.style.cssText = 'font-family:monospace;letter-spacing:0.1em;color:#C62828;background:#FFF5F5;padding:2px 10px;border-radius:6px;border:1px solid #FFCDD2;';
        btn.innerHTML = '<i class="fas fa-eye-slash"></i> \uc228\uae30\uae30';
        btn.style.background = '#FFEBEE';
        btn.style.color = '#C62828';
        btn.style.borderColor = '#FFCDD2';

        // 30\ucd08 \ud6c4 \uc790\ub3d9 \ub9c8\uc2a4\ud0b9
        clearTimeout(window._rrnTimer);
        window._rrnTimer = setTimeout(function() {
            if (document.getElementById('rrn-display-' + appId)) {
                hideRrn(appId, app.rrn);
            }
        }, 30000);
    } else {
        hideRrn(appId, app.rrn);
    }
}

// ========================================
// CSV 내보내기
// ========================================
function exportCSV() {
    const apps = filteredApplications.length > 0 ? filteredApplications : allApplications;
    if (!apps || apps.length === 0) {
        alert('내보낼 지원자 데이터가 없습니다.');
        return;
    }

    const STATUS_LABELS = {
        pending: '대기 중', reviewing: '검토 중',
        receipt_confirmed: 'JOB FAIR 접수확인',
        interview_scheduled: '면접 통보', interviewed: '면접 완료',
        approved: '승인됨', rejected: '거부됨', withdrawn: '지원 취소'
    };
    const TYPE_LABELS = {
        general: '일반지원', referral: '추천인지원',
        jobfair: 'Job Fair', referral_jobfair: '추천인 Job Fair', '1': '일반지원',
        '2': '추천인지원', '3': 'Job Fair', '4': '추천인 Job Fair'
    };

    const CHANNEL_CSV = { online: '온라인', email: '이메일접수', fax: '팩스접수', visit: '직접내방' };

    const headers = [
        '관리번호', '접수채널', '지원일시', '지원구분', '상태', '성명', '연락처', '이메일',
        '성별', '생년월일', '주소', '학력', '경력', '추천인', '추천인연락처',
        '채용설명회', '브랜치', '리크루터', '면접일시', '메모'
    ];

    function esc(v) {
        if (v == null) return '';
        var s = String(v).replace(/"/g, '""');
        if (s.includes(',') || s.includes('"') || s.includes('\n')) return '"' + s + '"';
        return s;
    }

    function fmtDate(ts) {
        if (!ts) return '';
        var d;
        if (ts && typeof ts.toDate === 'function') d = ts.toDate();
        else if (ts && ts.seconds) d = new Date(ts.seconds * 1000);
        else d = new Date(ts);
        if (isNaN(d)) return String(ts);
        return d.getFullYear() + '-' +
            String(d.getMonth() + 1).padStart(2, '0') + '-' +
            String(d.getDate()).padStart(2, '0') + ' ' +
            String(d.getHours()).padStart(2, '0') + ':' +
            String(d.getMinutes()).padStart(2, '0');
    }

    const rows = apps.map(a => [
        esc(a.management_number || a.managementNumber || ''),
        esc(CHANNEL_CSV[a.submission_channel || 'online'] || a.submission_channel || '온라인'),
        esc(fmtDate(a.submitted_at || a.submittedAt || a.created_at)),
        esc(TYPE_LABELS[a.application_type] || a.application_type || ''),
        esc(STATUS_LABELS[a.status] || a.status || '대기 중'),
        esc(a.name || ''),
        esc(a.phone || ''),
        esc(a.email || ''),
        esc(a.gender === 'male' ? '남' : a.gender === 'female' ? '여' : a.gender || ''),
        esc(a.birth_date || ''),
        esc([a.address, a.address_detail].filter(Boolean).join(' ')),
        esc(a.education || ''),
        esc(a.career || ''),
        esc(a.referrer_name || ''),
        esc(a.referrer_phone || ''),
        esc(a.jobfair_event || a.jobfair || ''),
        esc(a.branch || ''),
        esc(a.recruiter || ''),
        esc(fmtDate(a.interview_date || a.interviewDate || '')),
        esc(a.admin_memo || a.memo || '')
    ].join(','));

    const csvContent = '\uFEFF' + headers.join(',') + '\n' + rows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const now = new Date();
    const stamp = now.getFullYear() + String(now.getMonth()+1).padStart(2,'0') + String(now.getDate()).padStart(2,'0');
    a.href = url;
    a.download = 'GFC_지원자목록_' + stamp + '.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

function hideRrn(appId, rrn) {
    var display = document.getElementById('rrn-display-' + appId);
    var btn = document.getElementById('rrn-btn-' + appId);
    if (!display || !btn) return;
    display.innerHTML = rrn.slice(0, 6) + '-<span style="color:#999;">*******</span>';
    display.style.cssText = 'font-family:monospace;letter-spacing:0.1em;';
    btn.innerHTML = '<i class="fas fa-eye"></i> \uc804\uccb4 \ubcf4\uae30';
    btn.style.background = '#FFF8E1';
    btn.style.color = '#E65100';
    btn.style.borderColor = '#FFE082';
    clearTimeout(window._rrnTimer);
}

// ========================================
// 오프라인 지원서 등록 모달
// ========================================
var _offlineBase64 = '';
var _offlineMime = 'image/jpeg';
var _offlineScanMode = 'image'; // 'image' | 'text'

function openOfflineModal() {
    var modal = document.getElementById('offlineModal');
    if (!modal) return;
    // 현재 관리자 이메일 기록
    var adminEmail = (window._adminUser && window._adminUser.email) || '';
    var regBy = document.getElementById('off-registered-by');
    if (regBy) regBy.value = adminEmail;
    // 기본 지원일시: 현재
    var dtEl = document.getElementById('off-submitted-at');
    if (dtEl) {
        var now = new Date();
        now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
        dtEl.value = now.toISOString().slice(0, 16);
    }
    resetOfflineForm();
    modal.classList.add('active');
}

function closeOfflineModal() {
    var modal = document.getElementById('offlineModal');
    if (modal) modal.classList.remove('active');
    _offlineBase64 = '';
}

function switchOfflineTab(tab, btn) {
    document.querySelectorAll('.offline-tab-panel').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.offline-tabs .offline-tab-btn').forEach(b => b.classList.remove('active'));
    var panel = document.getElementById('off-tab-' + tab);
    if (panel) panel.classList.add('active');
    if (btn) btn.classList.add('active');
}

function switchScanMode(mode, btn) {
    _offlineScanMode = mode;
    document.getElementById('scan-mode-image').style.display = mode === 'image' ? 'block' : 'none';
    document.getElementById('scan-mode-text').style.display = mode === 'text' ? 'block' : 'none';
    // 탭 버튼 하이라이트 (scan 탭 내부 탭)
    var scanTab = document.getElementById('off-tab-scan');
    if (scanTab) {
        scanTab.querySelectorAll('.offline-tab-btn').forEach(b => b.classList.remove('active'));
        if (btn) btn.classList.add('active');
    }
}

function handleOfflineDrop(e) {
    e.preventDefault();
    var dropZone = document.getElementById('offDropZone');
    if (dropZone) dropZone.classList.remove('dragover');
    var files = e.dataTransfer && e.dataTransfer.files;
    if (files && files.length > 0) processOfflineFile(files[0]);
}

function handleOfflineFile(input) {
    if (input.files && input.files[0]) processOfflineFile(input.files[0]);
}

function processOfflineFile(file) {
    if (!file) return;
    _offlineMime = file.type || 'image/jpeg';
    var preview = document.getElementById('offImgPreview');
    var reader = new FileReader();
    reader.onload = function(e) {
        var result = e.target.result;
        // base64만 추출
        _offlineBase64 = result.split(',')[1] || '';
        if (preview && file.type.startsWith('image/')) {
            preview.src = result;
            preview.style.display = 'block';
        } else if (preview) {
            preview.style.display = 'none';
        }
        // 드롭존 텍스트 업데이트
        var dz = document.getElementById('offDropZone');
        if (dz) {
            dz.innerHTML = '<i class="fas fa-check-circle" style="color:#27ae60;"></i><div style="color:#27ae60; font-weight:600;">' + file.name + ' 로드 완료</div><small style="color:#aaa;">' + (file.size/1024).toFixed(0) + 'KB</small>';
        }
    };
    reader.readAsDataURL(file);
}

async function runOfflineScan() {
    var statusEl = document.getElementById('offScanStatus');
    var btn = document.getElementById('offScanBtn');
    var hasImage = _offlineScanMode === 'image' && _offlineBase64;
    var rawText = _offlineScanMode === 'text' ? (document.getElementById('offRawText') || {}).value : '';
    if (!hasImage && !rawText) {
        alert(_offlineScanMode === 'image' ? '이미지를 먼저 업로드하세요.' : '텍스트를 먼저 입력하세요.');
        return;
    }
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 인식 중...'; }
    if (statusEl) statusEl.textContent = 'AI가 지원서를 분석하는 중...';
    try {
        var scanFn = firebase.functions().httpsCallable('scanPaperApplication');
        var payload = {};
        if (hasImage) { payload.imageBase64 = _offlineBase64; payload.mimeType = _offlineMime; }
        else { payload.rawText = rawText; }
        var result = await scanFn(payload);
        if (result.data && result.data.success && result.data.data) {
            fillOfflineForm(result.data.data);
            if (statusEl) statusEl.innerHTML = '<span style="color:#27ae60;"><i class="fas fa-check-circle"></i> 인식 완료 — 내용을 확인하세요</span>';
        } else {
            if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;">인식 결과 없음</span>';
        }
    } catch(e) {
        console.error(e);
        if (statusEl) statusEl.innerHTML = '<span style="color:#e74c3c;"><i class="fas fa-exclamation-circle"></i> 오류: ' + e.message + '</span>';
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-robot"></i> AI 자동 인식'; }
    }
}

function fillOfflineForm(data) {
    var map = {
        'off-name': data.name, 'off-phone': data.phone, 'off-email': data.email,
        'off-birth-date': data.birth_date, 'off-home-phone': data.home_phone,
        'off-postal': data.postal_code, 'off-address': data.address,
        'off-address-detail': data.address_detail, 'off-career': data.career,
        'off-motivation': data.motivation, 'off-referrer-name': data.referrer_name,
        'off-referrer-phone': data.referrer_phone, 'off-branch': data.branch,
        'off-recruiter': data.recruiter, 'off-notes': data.notes
    };
    Object.keys(map).forEach(id => {
        var el = document.getElementById(id);
        if (el && map[id]) el.value = map[id];
    });
    // 셀렉트
    var selects = {
        'off-gender': data.gender, 'off-marital': data.marital_status,
        'off-app-type': data.application_type, 'off-education': data.education
    };
    Object.keys(selects).forEach(id => {
        var el = document.getElementById(id);
        if (el && selects[id]) el.value = selects[id];
    });
}

function resetOfflineForm() {
    ['off-name','off-phone','off-email','off-birth-date','off-home-phone',
     'off-postal','off-address','off-address-detail','off-career','off-motivation',
     'off-referrer-name','off-referrer-phone','off-branch','off-recruiter','off-notes'].forEach(id => {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    ['off-gender','off-marital','off-education'].forEach(id => {
        var el = document.getElementById(id);
        if (el) el.value = '';
    });
    var appType = document.getElementById('off-app-type');
    if (appType) appType.value = 'general';
    _offlineBase64 = '';
    var preview = document.getElementById('offImgPreview');
    if (preview) { preview.src = ''; preview.style.display = 'none'; }
    var dz = document.getElementById('offDropZone');
    if (dz) dz.innerHTML = '<i class="fas fa-cloud-upload-alt"></i><div>이미지를 클릭하거나 드래그하여 업로드</div><small style="color:#aaa;">JPG, PNG, PDF (최대 10MB)</small>';
    var status = document.getElementById('offScanStatus');
    if (status) status.textContent = '';
}

async function submitOfflineApplication(skipDup) {
    var name = (document.getElementById('off-name') || {}).value || '';
    var phone = (document.getElementById('off-phone') || {}).value || '';
    var channel = (document.getElementById('off-channel') || {}).value || '';
    var submittedAt = (document.getElementById('off-submitted-at') || {}).value || '';
    if (!name.trim()) { alert('성명은 필수입니다.'); return; }
    if (!phone.trim()) { alert('휴대폰 번호는 필수입니다.'); return; }
    if (!channel) { alert('접수 채널을 선택하세요.'); return; }
    if (!submittedAt) { alert('지원 일시를 입력하세요.'); return; }

    var btn = document.getElementById('offSubmitBtn');
    var skipBtn = document.getElementById('offSkipDupBtn');
    if (btn) { btn.disabled = true; btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 등록 중...'; }
    if (skipBtn) skipBtn.disabled = true;

    try {
        var appData = {
            name: name,
            phone: (document.getElementById('off-phone') || {}).value || '',
            email: (document.getElementById('off-email') || {}).value || '',
            birth_date: (document.getElementById('off-birth-date') || {}).value || '',
            gender: (document.getElementById('off-gender') || {}).value || '',
            marital_status: (document.getElementById('off-marital') || {}).value || '',
            home_phone: (document.getElementById('off-home-phone') || {}).value || '',
            postal_code: (document.getElementById('off-postal') || {}).value || '',
            address: (document.getElementById('off-address') || {}).value || '',
            address_detail: (document.getElementById('off-address-detail') || {}).value || '',
            education: (document.getElementById('off-education') || {}).value || '',
            career: (document.getElementById('off-career') || {}).value || '',
            motivation: (document.getElementById('off-motivation') || {}).value || '',
            referrer_name: (document.getElementById('off-referrer-name') || {}).value || '',
            referrer_phone: (document.getElementById('off-referrer-phone') || {}).value || '',
            branch: (document.getElementById('off-branch') || {}).value || '',
            recruiter: (document.getElementById('off-recruiter') || {}).value || '',
            notes: (document.getElementById('off-notes') || {}).value || '',
            application_type: (document.getElementById('off-app-type') || {}).value || 'general'
        };

        var offlineSubmittedAt = new Date(submittedAt).toISOString();

        var registerFn = firebase.functions().httpsCallable('registerOfflineApplication');
        var result = await registerFn({
            applicationData: appData,
            submissionChannel: channel,
            offlineSubmittedAt: offlineSubmittedAt,
            skipDuplicateCheck: !!skipDup
        });

        if (result.data && result.data.success) {
            var mgmt = result.data.managementNumber || '';
            alert('✅ 오프라인 지원서가 등록되었습니다.\n관리번호: ' + mgmt);
            closeOfflineModal();
            loadApplications();
        }
    } catch(e) {
        console.error(e);
        if (e.code === 'already-exists') {
            var doSkip = confirm('⚠️ 중복 지원자 감지\n\n' + e.message + '\n\n[중복 무시 후 등록] 버튼을 클릭하면 강제 등록됩니다.\n취소하려면 [확인]을 누르세요.');
            if (!doSkip) { /* 취소 */ }
        } else {
            alert('등록 실패: ' + e.message);
        }
    } finally {
        if (btn) { btn.disabled = false; btn.innerHTML = '<i class="fas fa-save"></i> 저장 등록'; }
        if (skipBtn) skipBtn.disabled = false;
    }
}

// ═══════════════════════════════════════════════════
// 첨부파일 인라인 미리보기
// ═══════════════════════════════════════════════════
function renderAttachmentSection(app) {
    var attachments = app.attachments;
    if (!Array.isArray(attachments) || attachments.length === 0) return;

    var existing = document.getElementById('attachment-section');
    if (existing) existing.remove();

    var items = attachments.map(function(f) {
        var url = f.url || f.downloadURL || '';
        var name = f.name || f.fileName || '파일';
        var mime = f.type || f.mimeType || '';
        var previewHtml = '';
        if (mime.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp)$/i.test(name)) {
            previewHtml = '<img src="' + escapeHtml(url) + '" alt="' + escapeHtml(name) + '" style="max-width:100%;max-height:300px;border-radius:6px;margin-top:8px;display:block;" loading="lazy">';
        } else if (mime === 'application/pdf' || /\.pdf$/i.test(name)) {
            previewHtml = '<iframe src="' + escapeHtml(url) + '" style="width:100%;height:360px;border:1px solid #e5e7eb;border-radius:6px;margin-top:8px;" title="' + escapeHtml(name) + '"></iframe>';
        }
        return '<div style="border:1px solid #e5e7eb;border-radius:8px;padding:10px 14px;margin-bottom:8px">' +
            '<div style="display:flex;justify-content:space-between;align-items:center">' +
            '<span style="font-size:0.85rem;font-weight:600"><i class="fas fa-paperclip" style="color:#6b7280;margin-right:6px"></i>' + escapeHtml(name) + '</span>' +
            '<a href="' + escapeHtml(url) + '" target="_blank" style="font-size:0.78rem;color:#2563eb"><i class="fas fa-external-link-alt"></i> 새 탭</a>' +
            '</div>' + previewHtml + '</div>';
    }).join('');

    var section = document.createElement('div');
    section.id = 'attachment-section';
    section.className = 'detail-section';
    section.innerHTML = '<h3 class="detail-section-title"><i class="fas fa-paperclip"></i> 첨부파일 (' + attachments.length + ')</h3>' + items;

    var modalBody = document.getElementById('modal-body');
    if (modalBody) modalBody.appendChild(section);
}

// ═══════════════════════════════════════════════════
// 내부 메모 / 태그 섹션
// ═══════════════════════════════════════════════════
var ADMIN_TAGS = ['유망', '보류', '재연락', '특이사항', '우수인재'];

function renderMemoTagSection(app) {
    var existing = document.getElementById('memo-tag-section');
    if (existing) existing.remove();

    var currentTags = Array.isArray(app.tags) ? app.tags : [];
    var memoLog = Array.isArray(app.memo_log) ? app.memo_log : [];
    var latestMemo = app.latest_memo || '';

    var tagBtns = ADMIN_TAGS.map(function(t) {
        var active = currentTags.includes(t);
        return '<button class="tag-btn' + (active ? ' tag-active' : '') + '" onclick="toggleTag(\'' + app.id + '\',\'' + t + '\',this)">' + t + '</button>';
    }).join('');

    var memoItems = memoLog.slice(-5).reverse().map(function(m) {
        return '<div style="font-size:0.8rem;border-left:3px solid #e5e7eb;padding:4px 8px;margin-bottom:4px;color:#555">' +
            '<span style="color:#9ca3af;font-size:0.75rem">' + (m.at || '').substring(0,16).replace('T',' ') + ' ' + (m.by || '') + '</span>' +
            (m.tags && m.tags.length ? '<span style="margin:0 6px;color:#7c3aed">[' + m.tags.join(', ') + ']</span>' : '') +
            '<div>' + escapeHtml(m.memo || '') + '</div></div>';
    }).join('');

    var section = document.createElement('div');
    section.id = 'memo-tag-section';
    section.className = 'detail-section';
    section.innerHTML =
        '<h3 class="detail-section-title"><i class="fas fa-tag"></i> 내부 메모 / 태그</h3>' +
        '<div style="margin-bottom:10px"><div style="font-size:0.8rem;color:#555;margin-bottom:5px">태그</div>' +
        '<div class="tag-list">' + tagBtns + '</div></div>' +
        '<div><div style="font-size:0.8rem;color:#555;margin-bottom:4px">메모 추가</div>' +
        '<textarea id="memoInput-' + app.id + '" placeholder="내부 메모를 입력하세요 (지원자에게 보이지 않음)" style="width:100%;border:1px solid #d1d5db;border-radius:6px;padding:7px 10px;font-size:0.84rem;resize:vertical;min-height:56px"></textarea>' +
        '<button class="btn btn-primary" style="margin-top:6px;font-size:0.82rem;padding:0.35rem 0.85rem" onclick="saveMemo(\'' + app.id + '\')">' +
        '<i class="fas fa-save"></i> 메모 저장</button></div>' +
        (memoLog.length > 0 ? '<div style="margin-top:12px"><div style="font-size:0.8rem;color:#555;margin-bottom:5px">이전 메모 (최근 5건)</div>' + memoItems + '</div>' : '');

    var modalBody = document.getElementById('modal-body');
    if (modalBody) modalBody.appendChild(section);
}

function toggleTag(appId, tag, btn) {
    var app = allApplications.find(function(a) { return a.id === appId; });
    if (!app) return;
    var tags = Array.isArray(app.tags) ? app.tags.slice() : [];
    var idx = tags.indexOf(tag);
    if (idx >= 0) tags.splice(idx, 1); else tags.push(tag);
    app.tags = tags;
    btn.classList.toggle('tag-active');
    var fn = firebase.functions().httpsCallable('addApplicationMemo');
    fn({ applicationId: appId, memo: '', tags: tags })
        .catch(function(e) { console.warn('[toggleTag]', e.message); });
}

async function saveMemo(appId) {
    var input = document.getElementById('memoInput-' + appId);
    var memo = (input ? input.value : '').trim();
    if (!memo) { alert('메모 내용을 입력해주세요.'); return; }
    try {
        var app = allApplications.find(function(a) { return a.id === appId; }) || {};
        var tags = Array.isArray(app.tags) ? app.tags : [];
        var fn = firebase.functions().httpsCallable('addApplicationMemo');
        await fn({ applicationId: appId, memo: memo, tags: tags });
        if (input) input.value = '';
        // memo_log에 추가 (로컬 반영)
        if (!Array.isArray(app.memo_log)) app.memo_log = [];
        app.memo_log.push({ memo: memo, tags: tags, by: 'admin', at: new Date().toISOString() });
        app.latest_memo = memo;
        renderMemoTagSection(app);
        alert('메모가 저장되었습니다.');
    } catch(e) {
        alert('저장 실패: ' + e.message);
    }
}

// ═══════════════════════════════════════════════════
// 관리자 접근 로그 뷰어
// ═══════════════════════════════════════════════════
async function openAdminLogModal() {
    document.getElementById('adminLogModal').classList.add('active');
    var body = document.getElementById('adminLogBody');
    body.innerHTML = '<div style="text-align:center;color:#999;padding:2rem"><i class="fas fa-spinner fa-spin"></i> 로딩 중...</div>';

    try {
        var dbRef = db || firebase.firestore();
        var snap = await dbRef.collection('admin_logs').orderBy('timestamp', 'desc').limit(200).get();

        if (snap.empty) {
            body.innerHTML = '<p style="text-align:center;color:#999;padding:2rem">기록 없음</p>';
            return;
        }

        var ACTION_LABELS = {
            view_detail: '상세 열람',
            update_status: '상태 변경',
            add_memo: '메모/태그 저장',
            set_deadline: '마감일 설정'
        };

        var rows = snap.docs.map(function(d) {
            var l = d.data();
            return '<tr>' +
                '<td>' + (l.timestamp || '').substring(0,19).replace('T',' ') + '</td>' +
                '<td>' + escapeHtml(l.admin_email || l.admin_uid || '') + '</td>' +
                '<td>' + (ACTION_LABELS[l.action] || l.action || '') + '</td>' +
                '<td>' + escapeHtml(l.target_id ? l.target_id.substring(0,12) + '…' : '') + '</td>' +
                '<td style="color:#555;font-size:0.78rem">' + escapeHtml(l.name || l.from ? ('→ ' + (l.to || '')) : '') + '</td>' +
                '</tr>';
        }).join('');

        body.innerHTML = '<table class="log-table"><thead><tr>' +
            '<th>일시</th><th>관리자</th><th>작업</th><th>대상 ID</th><th>비고</th>' +
            '</tr></thead><tbody>' + rows + '</tbody></table>';
    } catch(e) {
        body.innerHTML = '<p style="color:#d32f2f;padding:1rem">로드 실패: ' + e.message + '</p>';
    }
}

// ═══════════════════════════════════════════════════
// 채용 마감일 설정
// ═══════════════════════════════════════════════════
async function openDeadlineModal() {
    document.getElementById('deadlineModal').classList.add('active');
    var infoDiv = document.getElementById('currentDeadlineInfo');
    if (infoDiv) infoDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> 현재 설정 로딩 중...';
    try {
        var fn = firebase.functions().httpsCallable('getRecruitmentDeadline');
        var res = await fn({});
        var d = res.data || {};
        if (d.deadline) {
            var dl = new Date(d.deadline);
            document.getElementById('deadlineInput').value = d.deadline.substring(0, 16);
            document.getElementById('deadlineEnabled').checked = d.enabled !== false;
            if (d.message) document.getElementById('deadlineMsgInput').value = d.message;
            if (infoDiv) infoDiv.innerHTML = '현재 설정: <strong>' + dl.toLocaleString('ko-KR') + '</strong> · ' +
                (d.enabled ? '<span style="color:#16a34a">활성화 중</span>' : '<span style="color:#dc2626">비활성</span>') +
                (d.isExpired ? ' · <strong style="color:#dc2626">마감됨</strong>' : '');
        } else {
            if (infoDiv) infoDiv.innerHTML = '현재 마감일 미설정 상태입니다.';
        }
    } catch(e) {
        if (infoDiv) infoDiv.innerHTML = '로드 실패: ' + e.message;
    }
}

async function saveDeadline() {
    var deadlineVal = document.getElementById('deadlineInput').value;
    var msg = (document.getElementById('deadlineMsgInput').value || '').trim();
    var enabled = document.getElementById('deadlineEnabled').checked;
    if (!deadlineVal) { alert('마감 일시를 입력해주세요.'); return; }
    try {
        var fn = firebase.functions().httpsCallable('setRecruitmentDeadline');
        await fn({ deadline: new Date(deadlineVal).toISOString(), enabled, message: msg || '채용이 마감되었습니다.' });
        alert('마감일이 저장되었습니다.');
        document.getElementById('deadlineModal').classList.remove('active');
        logAdminAction('set_deadline', 'config/recruitment', { deadline: deadlineVal });
    } catch(e) {
        alert('저장 실패: ' + e.message);
    }
}

// ============================================================
// 통보 발송 이력 섹션 렌더링
// ============================================================
async function renderNotificationHistory(appId) {
    const containerId = 'notifHistSection';
    let container = document.getElementById(containerId);
    if (!container) {
        // 모달 바닥에 동적 삽입
        const detailBody = document.querySelector('#detailModal .modal-body') || document.querySelector('#detailModal');
        if (!detailBody) return;
        container = document.createElement('div');
        container.id = containerId;
        container.style.cssText = 'margin-top:1.5rem; border-top:2px solid #e5e7eb; padding-top:1rem;';
        detailBody.appendChild(container);
    }

    container.innerHTML = '<h3 class="detail-section-title"><i class="fas fa-paper-plane"></i> 통보 발송 이력 <span style="font-size:0.75rem;color:#999;font-weight:400;">(모든 상태변경 포함)</span></h3>'
        + '<div id="notifHistList" style="font-size:0.82rem;color:#666;padding:0.5rem 0;">로딩 중...</div>';

    try {
        const snap = await db.collection('notification_history')
            .where('application_id', '==', appId)
            .orderBy('notification_datetime', 'desc')
            .limit(50)
            .get();

        if (snap.empty) {
            document.getElementById('notifHistList').innerHTML = '<p style="color:#aaa;text-align:center;padding:0.5rem;">발송 이력 없음</p>';
            return;
        }

        const METHOD_ICONS = { email: '📧', sms: '📱', kakao: '💬', system: '🔧' };
        const rows = snap.docs.map(doc => {
            const d = doc.data();
            const sentAt = d.notification_datetime
                ? (d.notification_datetime.toDate ? d.notification_datetime.toDate().toLocaleString('ko-KR') : d.notification_datetime)
                : (d.submission_datetime || '-');
            const icon = METHOD_ICONS[d.notification_method] || '📨';
            const sentBadge = d.sent
                ? '<span style="background:#e8f5e9;color:#1b5e20;padding:2px 7px;border-radius:10px;font-size:0.78rem;">✓ 성공</span>'
                : '<span style="background:#ffebee;color:#b71c1c;padding:2px 7px;border-radius:10px;font-size:0.78rem;">✗ 실패</span>';
            const failParts = [];
            if (d.error_code) failParts.push('[' + d.error_code + ']');
            if (d.error_detail) failParts.push(d.error_detail);
            else if (d.error) failParts.push(d.error);
            if (d.fallback_sent === true) failParts.push('SMS fallback success');
            else if (d.fallback_of && d.fallback_sent === false) {
                failParts.push('SMS fallback failed');
                if (d.fallback_error_code) failParts.push('[' + d.fallback_error_code + ']');
                if (d.fallback_error) failParts.push(d.fallback_error);
            }
            const errMsg = (!d.sent && failParts.length > 0)
                ? `<span style="color:#e53e3e;font-size:0.78rem;margin-left:6px;">${escapeHtml(failParts.join(' | '))}</span>`
                : '';
            const memo = d.memo ? `<div style="color:#777;font-size:0.77rem;margin-top:2px;padding-left:4px;">${escapeHtml(d.memo)}</div>` : '';
            return `<div style="display:flex;flex-wrap:wrap;align-items:center;gap:0.4rem;padding:0.4rem 0.5rem;border-bottom:1px solid #f0f0f0;">
                <span style="min-width:22px;">${icon}</span>
                <span style="font-weight:600;min-width:55px;">${escapeHtml(d.notification_method || '-')}</span>
                <span style="color:#555;min-width:70px;">${escapeHtml(d.notification_status || '-')}</span>
                <span style="color:#777;min-width:120px;">${escapeHtml(d.recipient_contact || d.recipient_name || '-')}</span>
                ${sentBadge}${errMsg}
                ${(d.sent && d.fallback_of === 'kakao') ? '<span style="color:#1b5e20;font-size:0.78rem;margin-left:6px;">SMS fallback</span>' : ''}
                <span style="color:#aaa;font-size:0.78rem;margin-left:auto;">${sentAt}</span>
                ${memo}
            </div>`;
        }).join('');

        document.getElementById('notifHistList').innerHTML = rows;
    } catch(e) {
        document.getElementById('notifHistList').innerHTML = '<p style="color:#e53e3e;font-size:0.82rem;">이력 로드 실패: ' + e.message + '</p>';
        console.warn('notification_history 조회 실패:', e.message);
    }
}
