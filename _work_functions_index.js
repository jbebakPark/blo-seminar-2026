const functions = require('firebase-functions/v1');
const admin = require('firebase-admin');
const nodemailer = require('nodemailer');
const axios = require('axios');
const crypto = require('crypto');
const { SolapiMessageService } = require('solapi');

admin.initializeApp();

// Secret Manager 값은 runWith({ secrets: ALL_SECRET_NAMES }) 선언 후 process.env 로 자동 주입됨
const ALL_SECRET_NAMES = [
    'EMAIL_USER', 'EMAIL_PASSWORD',
    'KAKAO_API_KEY', 'KAKAO_SENDER_KEY',
    'ADMIN_EMAIL', 'ADMIN_PHONE',
    'SOLAPI_API_KEY', 'SOLAPI_API_SECRET', 'SOLAPI_SENDER_PHONE',
    'ANTHROPIC_API_KEY'
];

// Param 래퍼 (process.env 기반)
const EMAIL_USER_PARAM = { value: () => process.env.EMAIL_USER || '' };
const EMAIL_PASSWORD_PARAM = { value: () => process.env.EMAIL_PASSWORD || '' };
const KAKAO_API_KEY_PARAM = { value: () => process.env.KAKAO_API_KEY || '' };
const KAKAO_SENDER_KEY_PARAM = { value: () => process.env.KAKAO_SENDER_KEY || '' };
const ADMIN_EMAIL_PARAM = { value: () => process.env.ADMIN_EMAIL || '' };
const ADMIN_PHONE_PARAM = { value: () => process.env.ADMIN_PHONE || '' };
const SOLAPI_API_KEY_PARAM = { value: () => process.env.SOLAPI_API_KEY || '' };
const SOLAPI_API_SECRET_PARAM = { value: () => process.env.SOLAPI_API_SECRET || '' };
const SOLAPI_SENDER_PHONE_PARAM = { value: () => process.env.SOLAPI_SENDER_PHONE || '' };
const TURNSTILE_SECRET_PARAM = { value: () => process.env.TURNSTILE_SECRET || '__UNSET__' };
const PORTONE_IMP_KEY_PARAM = { value: () => process.env.PORTONE_IMP_KEY || '__UNSET__' };
const PORTONE_IMP_SECRET_PARAM = { value: () => process.env.PORTONE_IMP_SECRET || '__UNSET__' };
const APPLICANT_NUMBER_TIMEZONE = 'Asia/Seoul';
const APPLICANT_NUMBER_COUNTER_COLLECTION = 'application_number_counters';
const ALL_SECRETS = ALL_SECRET_NAMES; // alias for runWith compatibility

// 이메일 전송 설정
function readParam(param, envName, defaultValue = '') {
    const isUnsetValue = (value) => {
        const normalized = String(value ?? '').trim();
        return !normalized || normalized === '__UNSET__' || normalized === 'CHANGEME';
    };

    try {
        const value = param.value();
        if (!isUnsetValue(value)) {
            return String(value).trim();
        }
    } catch (error) {
        // Ignore and use process.env fallback.
    }

    const envValue = process.env[envName];
    if (!isUnsetValue(envValue)) {
        return String(envValue).trim();
    }

    return defaultValue;
}

let cachedTransporter = null;
let cachedTransporterKey = '';

function getEmailFromAddress() {
    return readParam(EMAIL_USER_PARAM, 'EMAIL_USER', '');
}

function getTransporter() {
    const user = readParam(EMAIL_USER_PARAM, 'EMAIL_USER', '');
    const pass = readParam(EMAIL_PASSWORD_PARAM, 'EMAIL_PASSWORD', '');
    if (!user || !pass) {
        return null;
    }

    const nextKey = `${user}:${pass}`;
    if (cachedTransporter && cachedTransporterKey === nextKey) {
        return cachedTransporter;
    }

    cachedTransporter = nodemailer.createTransport({
        service: 'gmail',
        auth: { user, pass }
    });
    cachedTransporterKey = nextKey;
    return cachedTransporter;
}

async function sendEmail(mailOptions) {
    const transporter = getTransporter();
    if (!transporter) {
        console.warn('Email not sent because EMAIL_USER/EMAIL_PASSWORD are not configured.');
        return null;
    }

    return transporter.sendMail(mailOptions);
}

/**
 * 통보 이력 저장
 */
async function saveNotificationHistory(data) {
    try {
        return await admin.firestore().collection('notification_history').add({
            application_id: data.application_id || '',
            management_number: data.management_number || '',
            applicant_name: data.applicant_name || '',
            recipient_type: data.recipient_type || '',
            recipient_name: data.recipient_name || '',
            recipient_contact: data.recipient_contact || '',
            notification_method: data.notification_method || 'email',
            notification_status: data.notification_status || '접수',
            submission_datetime: data.submission_datetime || '',
            notification_datetime: admin.firestore.FieldValue.serverTimestamp(),
            sent: data.sent === true,
            error: data.error || '',
            error_code: data.error_code || '',
            error_detail: data.error_detail || '',
            fallback_of: data.fallback_of || '',
            fallback_sent: data.fallback_sent === true,
            fallback_error: data.fallback_error || '',
            fallback_error_code: data.fallback_error_code || '',
            memo: data.memo || ''
        });
    } catch (err) {
        console.error('saveNotificationHistory ??:', err);
        return null;
    }
}

function makeSendOutcome(meta, defaultError, defaultCode) {
    const sent = !!(meta && meta.sent === true);
    if (sent) {
        return {
            sent: true,
            error: '',
            error_code: '',
            error_detail: ''
        };
    }

    const error = (meta && meta.error) ? String(meta.error) : defaultError;
    const errorCode = (meta && meta.error_code) ? String(meta.error_code) : (defaultCode || 'SEND_FAILED');
    const errorDetail = (meta && meta.error_detail) ? String(meta.error_detail) : error;

    return {
        sent: false,
        error,
        error_code: errorCode,
        error_detail: errorDetail
    };
}

function getPersonalInfo(application = {}) {
    const personalInfo = application.personalInfo || {};
    return {
        name: personalInfo.name || application.name || '지원자',
        phone: personalInfo.phone || application.phone || '',
        email: personalInfo.email || application.email || ''
    };
}

function getApplicationType(application = {}) {
    return (
        application?.applicationInfo?.type ||
        application?.application_type ||
        application?.applicationType ||
        'direct'
    );
}

function getApplicationTypeLabel(type) {
    if (type === 'jobfair') return '채용설명회';
    if (type === 'referral_jobfair') return '채용설명회(추천인)';
    if (type === 'referral') return '추천인 경로';
    if (type === 'general' || type === 'direct') return '직접 지원';
    return type || '미확인';
}

function toDateObject(value) {
    if (!value) return null;
    if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
    if (value?.toDate instanceof Function) {
        const converted = value.toDate();
        if (converted instanceof Date && !Number.isNaN(converted.getTime())) {
            return converted;
        }
    }
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function getDateTimeParts(date, timeZone = APPLICANT_NUMBER_TIMEZONE) {
    const safeDate = toDateObject(date) || new Date();
    const formatter = new Intl.DateTimeFormat('en-CA', {
        timeZone,
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false
    });
    const partMap = {};
    for (const part of formatter.formatToParts(safeDate)) {
        if (part.type !== 'literal') {
            partMap[part.type] = part.value;
        }
    }
    return {
        year: partMap.year || '0000',
        month: partMap.month || '01',
        day: partMap.day || '01',
        hour: partMap.hour || '00',
        minute: partMap.minute || '00',
        second: partMap.second || '00'
    };
}

function formatDateTimeFromParts(parts = {}) {
    const year = String(parts.year || '0000');
    const month = String(parts.month || '01').padStart(2, '0');
    const day = String(parts.day || '01').padStart(2, '0');
    const hour = String(parts.hour || '00').padStart(2, '0');
    const minute = String(parts.minute || '00').padStart(2, '0');
    const second = String(parts.second || '00').padStart(2, '0');
    return `${year}-${month}-${day} ${hour}:${minute}:${second}`;
}

function resolveApplicantNumberType(application = {}) {
    const normalizedType = normalizeSecureApplicationType(
        application.application_type ||
        application.applicationType ||
        application.applicationInfo?.type ||
        application.application_type_legacy ||
        application.applicationInfo?.typeLegacy
    );
    const hasReferrer = toSafeBoolean(application.has_referrer) ||
        Boolean(toSafeString(application.referrer_name, 120)) ||
        Boolean(toSafeString(application.referrer_phone, 50)) ||
        Boolean(toSafeString(application.referrer_branch, 120));

    if (normalizedType === 'jobfair' || normalizedType === 'referral_jobfair') {
        if (normalizedType === 'referral_jobfair' || hasReferrer) {
            return { code: '2', label: '채용설명회+추천자있음' };
        }
        return { code: '1', label: '채용설명회+추천자없음' };
    }

    if (normalizedType === 'referral') {
        return { code: '3', label: '추천인경로지원' };
    }

    if (normalizedType === 'general' && !hasReferrer) {
        return { code: '4', label: '직접지원(추천인없음)' };
    }

    if (hasReferrer) {
        return { code: '3', label: '추천인경로지원' };
    }

    return { code: '4', label: '직접지원(추천인없음)' };
}

function getSubmissionDateForNumbering(application = {}) {
    const candidates = [
        application.submission_datetime,
        application.submitted_at,
        application.applied_at,
        application.submittedAt,
        application.createdAt,
        application.created_at
    ];

    for (const candidate of candidates) {
        const parsed = toDateObject(candidate);
        if (parsed) {
            return parsed;
        }
    }
    return new Date();
}

/**
 * 지원서 제출 시 실시간 알림 전송
 */
exports.onApplicationSubmit = functions
    .runWith({ secrets: ALL_SECRETS })
    .firestore
    .document('applications/{applicationId}')
    .onCreate(async (snap, context) => {
        const application = snap.data();
        const applicationId = context.params.applicationId;

        try {
            // 1. 관리번호 생성 및 업데이트
            const submissionDate = getSubmissionDateForNumbering(application);
            const submissionDateIso = submissionDate.toISOString();
            const submissionParts = getDateTimeParts(submissionDate);
            const submissionDateTime = formatDateTimeFromParts(submissionParts);
            const nameVal = toSafeString(application.name, 120).trim();

            const numberInfo = await generateManagementNumber(application);
            const managementNumber = numberInfo.managementNumber;

            // ★ birth_date 자동 보완: birth_year/month/day가 있고 birth_date가 없으면 조합
            const existingBirthDate = toSafeString(application.birth_date, 30).trim();
            let computedBirthDate = existingBirthDate;
            if (!computedBirthDate) {
                const y = toSafeString(application.birth_year, 4).trim();
                const m = toSafeString(application.birth_month, 2).trim().padStart(2, '0');
                const d = toSafeString(application.birth_day, 2).trim().padStart(2, '0');
                if (y) {
                    computedBirthDate = y
                        + (m !== '00' ? '-' + m : '')
                        + (d !== '00' ? '-' + d : '');
                }
            }

            const updatePayload = {
                managementNumber,
                management_number: managementNumber,
                management_number_year: numberInfo.year,
                management_number_month: numberInfo.month,
                management_number_type_code: numberInfo.typeCode,
                management_number_type_label: numberInfo.typeLabel,
                management_number_sequence: numberInfo.sequence,
                management_number_generated_at: numberInfo.generatedAtIso,
                submission_datetime: submissionDateIso,
                submission_datetime_kst: submissionDateTime,
                submission_year: submissionParts.year,
                submission_month: submissionParts.month,
                submission_day: submissionParts.day,
                submission_hour: submissionParts.hour,
                submission_minute: submissionParts.minute,
                submission_second: submissionParts.second
            };

            // ★ 이름 빈값 플래그 (관리자가 확인할 수 있도록)
            if (!nameVal) {
                updatePayload.name_missing = true;
                console.warn(`⚠️ [${managementNumber}] 이름이 비어 있는 지원서 접수됨. ApplicationId: ${applicationId}`);
            }

            // ★ birth_date 자동 보완
            if (computedBirthDate && !existingBirthDate) {
                updatePayload.birth_date = computedBirthDate;
                console.log(`✅ birth_date 자동 보완: ${computedBirthDate}`);
            }

            await snap.ref.update(updatePayload);

            // 2. 관리자에게 알림 전송
            await sendAdminNotification(application, managementNumber, applicationId, submissionDateIso);

            // 3. 지원자에게 확인 알림 전송
            await sendApplicantConfirmation(application, managementNumber, applicationId, submissionDateIso);

            // 4. 추천자에게 알림 전송 (추천자 있는 경우)
            await sendReferrerNotification(application, managementNumber, applicationId, submissionDateIso);

            console.log(`지원서 접수 완료: ${managementNumber}`);
            return { success: true, managementNumber };
        } catch (error) {
            console.error('알림 전송 오류:', error);
            return { success: false, error: error.message };
        }
    });

/**
 * 관리번호 생성
 */
async function generateManagementNumber(application = {}) {
    const db = admin.firestore();
    const submissionDate = getSubmissionDateForNumbering(application);
    const dateParts = getDateTimeParts(submissionDate);
    const numberType = resolveApplicantNumberType(application);
    const counterId = `${dateParts.year}-${numberType.code}-${dateParts.month}`;
    const counterRef = db.collection(APPLICANT_NUMBER_COUNTER_COLLECTION).doc(counterId);

    const nextSequence = await db.runTransaction(async (tx) => {
        const counterSnap = await tx.get(counterRef);
        const current = counterSnap.exists ? toSafeInteger(counterSnap.data().lastSequence, 0) : 0;
        const next = current + 1;

        tx.set(counterRef, {
            year: dateParts.year,
            month: dateParts.month,
            type_code: numberType.code,
            type_label: numberType.label,
            lastSequence: next,
            updatedAt: admin.firestore.FieldValue.serverTimestamp()
        }, { merge: true });

        return next;
    });

    const sequence = String(nextSequence).padStart(4, '0');
    const managementNumber = `GFC-${dateParts.year}${numberType.code}${dateParts.month}-${sequence}`;

    return {
        managementNumber,
        year: dateParts.year,
        month: dateParts.month,
        typeCode: numberType.code,
        typeLabel: numberType.label,
        sequence,
        generatedAtIso: new Date().toISOString()
    };
}

/**
 * 관리자에게 알림 전송
 */
async function sendAdminNotification(application, managementNumber, applicationId, submissionDateIso) {
    const adminEmail = toSafeString(readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', ''), 200);
    const adminPhone = toSafeString(readParam(ADMIN_PHONE_PARAM, 'ADMIN_PHONE', ''), 50);
    const personalInfo = getPersonalInfo(application);
    const applicationType = getApplicationType(application);
    const applicationTypeLabel = getApplicationTypeLabel(applicationType);
    const baseHistory = {
        application_id: applicationId || '',
        management_number: managementNumber,
        applicant_name: personalInfo.name,
        recipient_type: 'admin',
        recipient_name: '관리자',
        notification_status: '접수',
        submission_datetime: submissionDateIso || new Date().toISOString()
    };

    // 이메일 전송
    const emailOptions = {
        from: getEmailFromAddress(),
        to: adminEmail,
        subject: `[GFC 지원] 새로운 지원자 접수 - ${personalInfo.name}`,
        html: `
            <h2>새로운 GFC 지원자가 접수되었습니다</h2>
            <hr>
            <p><strong>관리번호:</strong> ${managementNumber}</p>
            <p><strong>이름:</strong> ${personalInfo.name}</p>
            <p><strong>연락처:</strong> ${personalInfo.phone}</p>
            <p><strong>이메일:</strong> ${personalInfo.email}</p>
            <p><strong>지원 구분:</strong> ${applicationTypeLabel}</p>
            <p><strong>접수 일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            <hr>
            <p><a href="https://samsung-gfc.web.app/admin/applications.html">관리자 대시보드에서 확인하기</a></p>
        `
    };

    let emailSent = false;
    let emailError = '';
    if (adminEmail) {
        try {
            await sendEmail(emailOptions);
            emailSent = true;
        } catch (err) {
            emailError = err.message;
        }
    } else {
        emailError = '관리자 이메일 미설정';
    }
    await saveNotificationHistory({
        ...baseHistory,
        recipient_contact: adminEmail || '미설정',
        notification_method: 'email',
        sent: emailSent,
        error: emailError
    });

    // 카카오톡 알림톡 전송
    const kakaoResult = await sendKakaoNotification(adminPhone, {
        templateCode: 'ADMIN_NEW_APPLICATION',
        variables: {
            managementNumber,
            name: personalInfo.name,
            phone: personalInfo.phone,
            type: applicationTypeLabel
        }
    }, { withMeta: true });
    if (adminPhone) {
        await saveNotificationHistory({
            ...baseHistory,
            recipient_contact: adminPhone,
            notification_method: 'kakao',
            ...makeSendOutcome(kakaoResult, 'Kakao notification failed or not configured', 'KAKAO_SEND_FAILED')
        });
    }

    // SMS 전송 (Solapi - 개인도 가입 가능, 9원/건)
    if (adminPhone) {
        const smsText = `[삼성생명GFC] 새 지원서 접수\n관리번호: ${managementNumber}\n지원자: ${personalInfo.name}\n연락처: ${personalInfo.phone}\n구분: ${applicationTypeLabel}`;
        const smsResult = await sendSmsNotification(adminPhone, smsText, { withMeta: true });
        await saveNotificationHistory({
            ...baseHistory,
            recipient_contact: adminPhone,
            notification_method: 'sms',
            ...makeSendOutcome(smsResult, 'SMS send failed or not configured', 'SMS_SEND_FAILED')
        });
    }
}

/**
 * 지원자에게 확인 알림 전송
 */
async function sendApplicantConfirmation(application, managementNumber, applicationId, submissionDateIso) {
    const personalInfo = getPersonalInfo(application);
    const applicationType = getApplicationType(application);
    const typeText = getApplicationTypeLabel(applicationType);
    const baseHistory = {
        application_id: applicationId || '',
        management_number: managementNumber,
        applicant_name: personalInfo.name,
        recipient_type: 'applicant',
        recipient_name: personalInfo.name,
        notification_status: '접수',
        submission_datetime: submissionDateIso || new Date().toISOString()
    };

    // 이메일 전송
    const emailOptions = {
        from: getEmailFromAddress(),
        to: personalInfo.email,
        subject: `[삼성생명 GFC] 지원서 접수 완료 - ${personalInfo.name}님`,
        html: `
            <h2>${personalInfo.name}님, 지원서가 정상적으로 접수되었습니다</h2>
            <hr>
            <p><strong>관리번호:</strong> ${managementNumber}</p>
            <p><strong>접수 일시:</strong> ${new Date().toLocaleString('ko-KR')}</p>
            <p><strong>지원 구분:</strong> ${typeText}</p>
            <hr>
            <p>빠른 시일 내에 검토 후 연락드리겠습니다.</p>
            <p>감사합니다.</p>
            <br>
            <p><strong>삼성생명 GFC 채용팀</strong></p>
            <hr style="margin-top:24px;border:none;border-top:1px solid #eee;">
            <p style="font-size:12px;color:#999;margin-top:12px;">
                📌 본 메일의 수신을 원치 않으시는 경우 아래 링크에서 수신거부를 신청해 주시면 즉시 처리해 드립니다.<br>
                👉 <a href="https://samsung-gfc.web.app/opt-out.html" style="color:#034EA2;">https://samsung-gfc.web.app/opt-out.html</a>
            </p>
        `
    };

    let emailSent = false;
    let emailError = '';
    try {
        await sendEmail(emailOptions);
        emailSent = true;
    } catch (err) {
        emailError = err.message;
    }
    await saveNotificationHistory({
        ...baseHistory,
        recipient_contact: personalInfo.email || '미설정',
        notification_method: 'email',
        sent: emailSent,
        error: emailError
    });

    // 카카오톡 알림톡 전송
    const kakaoResult = await sendKakaoNotification(personalInfo.phone, {
        templateCode: 'APPLICANT_CONFIRMATION',
        variables: {
            name: personalInfo.name,
            managementNumber,
            date: new Date().toLocaleString('ko-KR'),
            type: typeText,
            optOutUrl: 'https://samsung-gfc.web.app/opt-out.html'
        }
    }, { withMeta: true });
    if (personalInfo.phone) {
        await saveNotificationHistory({
            ...baseHistory,
            recipient_contact: personalInfo.phone,
            notification_method: 'kakao',
            ...makeSendOutcome(kakaoResult, 'Kakao notification failed or not configured', 'KAKAO_SEND_FAILED')
        });
    }

    // SMS 전송 (Solapi - 개인도 가입 가능, 9원/건)
    if (personalInfo.phone) {
        // 정보성 메시지 - 광고 표기/080 수신거부 불필요 (채용 안내는 정보성)
        const smsText = `[삼성생명GFC] 지원서 접수완료\n관리번호: ${managementNumber}\n구분: ${typeText}\n검토 후 연락드리겠습니다.`;
        const smsResult = await sendSmsNotification(personalInfo.phone, smsText, { withMeta: true });
        await saveNotificationHistory({
            ...baseHistory,
            recipient_contact: personalInfo.phone,
            notification_method: 'sms',
            ...makeSendOutcome(smsResult, 'SMS send failed or not configured', 'SMS_SEND_FAILED')
        });
    }
}

/**
 * 추천자에게 알림 전송
 */
async function sendReferrerNotification(application, managementNumber, applicationId, submissionDateIso) {
    const referrerName = toSafeString(application.referrer_name, 120);
    const referrerPhone = toSafeString(application.referrer_phone, 50);
    if (!referrerName || !referrerPhone) return; // 추천자 없으면 스킵

    const personalInfo = getPersonalInfo(application);
    const applicationType = getApplicationType(application);
    const typeText = getApplicationTypeLabel(applicationType);
    const baseHistory = {
        application_id: applicationId || '',
        management_number: managementNumber,
        applicant_name: personalInfo.name,
        recipient_type: 'referrer',
        recipient_name: referrerName,
        recipient_contact: referrerPhone,
        notification_method: 'kakao',
        notification_status: '접수',
        submission_datetime: submissionDateIso || new Date().toISOString()
    };

    // 카카오톡 전송 시도 (미설정 시 sent=false 이력만 저장)
    const kakaoResult = await sendKakaoNotification(referrerPhone, {
        templateCode: 'REFERRER_NOTIFICATION',
        variables: {
            referrerName,
            name: personalInfo.name,
            managementNumber,
            date: new Date().toLocaleString('ko-KR'),
            type: typeText,
            optOutUrl: 'https://samsung-gfc.web.app/opt-out.html'
        }
    }, { withMeta: true });
    await saveNotificationHistory({
        ...baseHistory,
        ...makeSendOutcome(kakaoResult, 'Kakao notification failed or not configured', 'KAKAO_SEND_FAILED')
    });

    // SMS 전송 (추천자)
    // 정보성 메시지 - 추천자 알림
    const refSmsText = `[삼성생명GFC] 추천 지원 알림\n추천하신 ${personalInfo.name}님이 지원하셨습니다.\n관리번호: ${managementNumber}`;
    const refSmsResult = await sendSmsNotification(referrerPhone, refSmsText, { withMeta: true });
    await saveNotificationHistory({
        application_id: applicationId || '',
        management_number: managementNumber,
        applicant_name: personalInfo.name,
        recipient_type: 'referrer',
        recipient_name: referrerName,
        recipient_contact: referrerPhone,
        notification_method: 'sms',
        notification_status: '\uC811\uC218',
        submission_datetime: submissionDateIso || new Date().toISOString(),
        ...makeSendOutcome(refSmsResult, 'SMS send failed or not configured', 'SMS_SEND_FAILED')
    });
}

/**
 * 상태 변경 시 알림 전송
 */
exports.sendStatusChangeNotification = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        const { applicationId, managementNumber, name, email, phone, newStatus, memo,
                applicationType, preferredRegion } = data;

        const statusText = {
            'pending': '접수 대기',
            'reviewing': '검토 중',
            'review': '검토 중',
            'receipt_confirmed': 'JOB FAIR 접수확인',
            'interview_scheduled': '면접 통보',
            'interviewed': '면접 완료',
            'approved': '합격',
            'rejected': '불합격',
            'withdrawn': '지원 취소'
        };
        const statusLabel = {
            'pending': '접수',
            'reviewing': '검토중',
            'review': '검토중',
            'receipt_confirmed': '접수확인',
            'interview_scheduled': '면접통보',
            'interviewed': '면접완료',
            'approved': '승인',
            'rejected': '거절',
            'withdrawn': '취소'
        };

        // ── JOB FAIR 접수확인 특수 처리 ──────────────────────────
        const isJobFair = ['jobfair', 'referral_jobfair'].includes(applicationType);
        if (newStatus === 'receipt_confirmed' && isJobFair) {
            const db = admin.firestore();
            // 이번 달 활성화된 jobFairEvents 조회
            const now = new Date();
            const kstNow = new Date(now.getTime() + 9 * 60 * 60 * 1000);
            const monthStart = kstNow.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
            const monthEnd   = kstNow.toISOString().slice(0, 7) + '-31'; // YYYY-MM-31 (충분히 큰 값)

            let events = [];
            try {
                const snap = await db.collection('jobFairEvents')
                    .where('enabled', '==', true)
                    .where('date', '>=', monthStart)
                    .where('date', '<=', monthEnd)
                    .orderBy('date', 'asc')
                    .get();
                snap.forEach(doc => events.push(doc.data()));
            } catch(e) {
                // 인덱스 미생성 시 전체 조회 후 필터
                try {
                    const snap2 = await db.collection('jobFairEvents').where('enabled', '==', true).get();
                    snap2.forEach(doc => {
                        const d = doc.data();
                        if (d.date >= monthStart && d.date <= monthEnd) events.push(d);
                    });
                    events.sort((a, b) => (a.date || '').localeCompare(b.date || ''));
                } catch(e2) { console.warn('jobFairEvents 조회 실패:', e2.message); }
            }

            // 희망 지역 매칭 (없으면 전체 표시)
            const regionEvents = preferredRegion
                ? events.filter(ev => (ev.location || '').includes(preferredRegion.split('/')[0]) || preferredRegion === '온라인')
                : events;
            const displayEvents = regionEvents.length > 0 ? regionEvents : events;

            // 이벤트 테이블 HTML
            const eventRowsHtml = displayEvents.length > 0
                ? displayEvents.map(ev => {
                    const timeRange = [ev.startTime, ev.endTime].filter(Boolean).join(' ~ ');
                    return `<tr>
                        <td style="padding:8px 12px; border:1px solid #dde;">${ev.date || '-'}</td>
                        <td style="padding:8px 12px; border:1px solid #dde;">${timeRange || '-'}</td>
                        <td style="padding:8px 12px; border:1px solid #dde;">${ev.location || '-'}</td>
                        <td style="padding:8px 12px; border:1px solid #dde; color:#555;">${ev.note || ''}</td>
                    </tr>`;
                }).join('')
                : `<tr><td colspan="4" style="padding:10px; text-align:center; color:#999;">이번 달 일정을 확인 중입니다. 별도 안내 예정입니다.</td></tr>`;

            // 이벤트 SMS 텍스트
            const eventSmsList = displayEvents.length > 0
                ? displayEvents.map(ev => {
                    const timeRange = [ev.startTime, ev.endTime].filter(Boolean).join('~');
                    return `• ${ev.date} ${timeRange ? timeRange + ' ' : ''}/ ${ev.location || '-'}`;
                }).join('\n')
                : '일정 확정 후 별도 안내';

            const baseHist = {
                application_id: applicationId || '',
                management_number: managementNumber || '',
                applicant_name: name || '',
                notification_status: '접수확인',
                submission_datetime: new Date().toISOString()
            };

            // 지원자 이메일
            let emailSent = false, emailErr = '';
            if (email) {
                const html = `
                <div style="font-family:sans-serif; max-width:600px; margin:0 auto;">
                <h2 style="color:#1428A0;">✅ ${name}님, JOB FAIR 접수가 확인되었습니다</h2>
                <hr>
                <p>안녕하세요, <strong>${name}</strong>님!<br>
                삼성생명 GFC JOB FAIR 접수가 정상적으로 확인되었습니다.</p>
                ${preferredRegion ? `<p>📍 희망 지역: <strong>${preferredRegion}</strong></p>` : ''}
                <h3 style="color:#1428A0; margin-top:1.5rem;">📅 이번 달 JOB FAIR 일정</h3>
                <table style="border-collapse:collapse; width:100%; font-size:14px; margin-top:0.5rem;">
                    <thead>
                        <tr style="background:#1428A0; color:#fff;">
                            <th style="padding:8px 12px; text-align:left;">날짜</th>
                            <th style="padding:8px 12px; text-align:left;">시간</th>
                            <th style="padding:8px 12px; text-align:left;">장소</th>
                            <th style="padding:8px 12px; text-align:left;">비고</th>
                        </tr>
                    </thead>
                    <tbody>${eventRowsHtml}</tbody>
                </table>
                <hr style="margin-top:1.5rem;">
                <p>일정 및 장소는 변경될 수 있으며, 변경 시 별도로 안내드립니다.<br>
                문의사항은 채용 담당자에게 연락해 주시기 바랍니다.</p>
                <p>감사합니다. <strong>삼성생명 GFC 채용팀</strong></p>
                <hr style="margin-top:24px; border:none; border-top:1px solid #eee;">
                <p style="font-size:12px; color:#999;">
                    📌 수신거부: <a href="https://samsung-gfc.web.app/opt-out.html" style="color:#034EA2;">https://samsung-gfc.web.app/opt-out.html</a>
                </p>
                </div>`;
                try {
                    await sendEmail({ from: getEmailFromAddress(), to: email,
                        subject: `[삼성생명 GFC] JOB FAIR 접수 확인 - ${name}님`,  html });
                    emailSent = true;
                } catch(e) { emailErr = e.message; }
                await saveNotificationHistory({ ...baseHist, recipient_type: 'applicant',
                    recipient_name: name || '', recipient_contact: email,
                    notification_method: 'email', sent: emailSent, error: emailErr });
            }

            // 지원자 SMS
            let smsSent = false, smsErr = '';
            if (phone) {
                const smsText = `[삼성생명GFC] ${name}님, JOB FAIR 접수가 확인되었습니다.${preferredRegion ? '\n📍 희망지역: ' + preferredRegion : ''}\n\n📅 이번 달 일정\n${eventSmsList}\n\n일정 변경 시 별도 안내드립니다.`;
                const smsResult = await sendSmsNotification(phone, smsText);
                smsSent = smsResult !== null;
                if (!smsSent) smsErr = 'SMS 실패';
                await saveNotificationHistory({ ...baseHist, recipient_type: 'applicant',
                    recipient_name: name || '', recipient_contact: phone,
                    notification_method: 'sms', sent: smsSent, error: smsErr });
            }

            // 관리자 확인 이메일
            const adminEmail = toSafeString(readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', ''), 200);
            if (adminEmail) {
                try {
                    await sendEmail({ from: getEmailFromAddress(), to: adminEmail,
                        subject: `[GFC JOB FAIR 접수확인] ${name}님`,
                        html: `<p><strong>${name}</strong>님 JOB FAIR 접수 확인 통보 완료</p>
                        <p>희망지역: ${preferredRegion || '-'} | 이메일:${emailSent?'✅':'❌'} SMS:${smsSent?'✅':'❌'}</p>
                        <p><a href="https://samsung-gfc.web.app/admin/applications.html">관리자 대시보드</a></p>` });
                } catch(e) {}
            }
            return { success: true, emailSent, smsSent };
        }
        // ────────────────────────────────────────────────────────
        const notifStatus = statusLabel[newStatus] || '검토중';
        const baseHistory = {
            application_id: applicationId || '',
            management_number: managementNumber || '',
            applicant_name: name || '',
            notification_status: notifStatus,
            submission_datetime: new Date().toISOString()
        };

        // 지원자에게 이메일 전송
        const emailOptions = {
            from: getEmailFromAddress(),
            to: email,
            subject: `[삼성생명 GFC] 지원 상태 변경 안내 - ${name}님`,
            html: `
            <h2>${name}님의 지원 상태가 변경되었습니다</h2>
            <hr>
            <p><strong>변경된 상태:</strong> ${statusText[newStatus]}</p>
            ${memo ? `<p><strong>안내사항:</strong> ${memo}</p>` : ''}
            <hr>
            <p>추가 문의사항이 있으시면 연락 주시기 바랍니다.</p>
            <p>감사합니다.</p>
            <br>
            <p><strong>삼성생명 GFC 채용팀</strong></p>
            <hr style="margin-top:24px;border:none;border-top:1px solid #eee;">
            <p style="font-size:12px;color:#999;margin-top:12px;">
                📌 본 메일의 수신을 원치 않으시는 경우 아래 링크에서 수신거부를 신청해 주시면 즉시 처리해 드립니다.<br>
                👉 <a href="https://samsung-gfc.web.app/opt-out.html" style="color:#034EA2;">https://samsung-gfc.web.app/opt-out.html</a>
            </p>
        `
        };

        let emailSent = false;
        let emailError = '';
        try {
            await sendEmail(emailOptions);
            emailSent = true;
        } catch (err) {
            emailError = err.message;
        }
        await saveNotificationHistory({
            ...baseHistory,
            recipient_type: 'applicant',
            recipient_name: name || '',
            recipient_contact: email || '',
            notification_method: 'email',
            sent: emailSent,
            error: emailError
        });

        // 카카오톡 알림톡 전송
        const kakaoResult = await sendKakaoNotification(phone, {
            templateCode: 'STATUS_CHANGE',
            variables: {
                name,
                status: statusText[newStatus],
                memo: memo || 'none',
                optOutUrl: 'https://samsung-gfc.web.app/opt-out.html'
            }
        }, { withMeta: true });
        let kakaoHistoryRef = null;
        if (phone) {
            kakaoHistoryRef = await saveNotificationHistory({
                ...baseHistory,
                recipient_type: 'applicant',
                recipient_name: name || '',
                recipient_contact: phone || '',
                notification_method: 'kakao',
                ...makeSendOutcome(kakaoResult, 'Kakao notification failed or not configured', 'KAKAO_SEND_FAILED')
            });
        }

        // ????? SMS ???
        if (phone) {
            // ?????????? - ??????? ???????
            const statusSmsText = `[Samsung GFC] Status Update\n${name} application changed to [${statusText[newStatus]}].${memo ? '\nMemo: ' + memo : ''}`;
            const smsSentResult = await sendSmsNotification(phone, statusSmsText, { withMeta: true });
            const smsOutcome = makeSendOutcome(smsSentResult, 'SMS send failed or not configured', 'SMS_SEND_FAILED');
            const isFallback = !(kakaoResult && kakaoResult.sent === true);

            await saveNotificationHistory({
                ...baseHistory,
                recipient_type: 'applicant',
                recipient_name: name || '',
                recipient_contact: phone || '',
                notification_method: 'sms',
                fallback_of: isFallback ? 'kakao' : '',
                memo: isFallback ? 'Kakao failed, SMS fallback sent' : '',
                ...smsOutcome
            });

            if (isFallback && kakaoHistoryRef) {
                await kakaoHistoryRef.set({
                    fallback_sent: smsOutcome.sent === true,
                    fallback_error: smsOutcome.sent ? '' : (smsOutcome.error || ''),
                    fallback_error_code: smsOutcome.sent ? '' : (smsOutcome.error_code || '')
                }, { merge: true });
            }
        }

        // 관리자에게도 상태변경 알림
        const adminEmail = toSafeString(readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', ''), 200);
        if (adminEmail) {
            let adminEmailSent = false;
            let adminEmailError = '';
            try {
                await sendEmail({
                    from: getEmailFromAddress(),
                    to: adminEmail,
                    subject: `[GFC 상태변경] ${name}님 - ${statusText[newStatus]}`,
                    html: `<p><strong>${name}</strong>님의 상태가 <strong>${statusText[newStatus]}</strong>으로 변경되었습니다.</p>
                       ${memo ? `<p>사유: ${memo}</p>` : ''}
                       <p><a href="https://samsung-gfc.web.app/admin/applications.html">관리자 대시보드</a></p>`
                });
                adminEmailSent = true;
            } catch (err) {
                adminEmailError = err.message;
            }
            await saveNotificationHistory({
                ...baseHistory,
                recipient_type: 'admin',
                recipient_name: '관리자',
                recipient_contact: adminEmail,
                notification_method: 'email',
                sent: adminEmailSent,
                error: adminEmailError
            });
        }

        return { success: true };
    });

/**
 * 카카오 알림톡 전송 (Solapi SDK 경유)
 * - Solapi 계정에 카카오 채널(pfId)과 알림톡 템플릿(templateId)이 사전 등록되어야 합니다.
 * - KAKAO_API_KEY: Solapi pfId (카카오 채널 ID)
 * - KAKAO_SENDER_KEY: Solapi 알림톡 templateId (또는 templateCode)
 */
/**
 * 수신거부 여부 확인 유틸리티
 * - optOutRequests 컬렉션에서 해당 전화번호 + 채널의 수신거부 여부를 조회
 * @param {string} phone - 전화번호 (형식 무관)
 * @param {string} channel - 'kakao' | 'sms' | 'email'
 * @returns {Promise<boolean>} true면 수신거부 상태
 */
async function isOptedOut(phone, channel) {
    try {
        if (!phone || !channel) return false;
        const db = admin.firestore();
        const raw = phone.replace(/\D/g, '');
        const formatted = raw.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');

        // 형식이 다를 수 있으므로 두 가지 형식 동시 조회
        const [snap1, snap2] = await Promise.all([
            db.collection('optOutRequests')
                .where('phone', '==', formatted)
                .where('opt_out_types', 'array-contains', channel)
                .limit(1)
                .get(),
            db.collection('optOutRequests')
                .where('phone', '==', raw)
                .where('opt_out_types', 'array-contains', channel)
                .limit(1)
                .get()
        ]);

        const found = !snap1.empty || !snap2.empty;
        if (found) {
            console.log(`[isOptedOut] 수신거부 확인됨 - phone: ${formatted}, channel: ${channel}`);
        }
        return found;
    } catch (err) {
        console.error('[isOptedOut] 조회 오류 (발송 계속 진행):', err?.message || err);
        return false; // 조회 오류 시 안전하게 발송 허용
    }
}

async function sendKakaoNotification(phone, { templateCode, variables } = {}, options = {}) {
    const withMeta = options && options.withMeta === true;
    const fail = (error_code, error, error_detail = '') => {
        if (!withMeta) return null;
        return { sent: false, error_code, error, error_detail: error_detail || error };
    };

    try {
        const pfId = toSafeString(readParam(KAKAO_API_KEY_PARAM, 'KAKAO_API_KEY', ''), 400);
        const templateId = toSafeString(readParam(KAKAO_SENDER_KEY_PARAM, 'KAKAO_SENDER_KEY', ''), 200);
        const solapiApiKey = toSafeString(readParam(SOLAPI_API_KEY_PARAM, 'SOLAPI_API_KEY', ''), 100);
        const solapiApiSecret = toSafeString(readParam(SOLAPI_API_SECRET_PARAM, 'SOLAPI_API_SECRET', ''), 100);
        const senderPhone = normalizePhoneNumber(readParam(SOLAPI_SENDER_PHONE_PARAM, 'SOLAPI_SENDER_PHONE', ''));
        const receiver = normalizePhoneNumber(phone);

        if (!pfId || !templateId) {
            console.warn('Kakao not sent: KAKAO_API_KEY(pfId)/KAKAO_SENDER_KEY(templateId) missing');
            return fail('KAKAO_CONFIG_MISSING', 'Kakao notification not configured', 'KAKAO_API_KEY or KAKAO_SENDER_KEY is missing.');
        }
        if (!solapiApiKey || !solapiApiSecret) {
            console.warn('Kakao not sent: SOLAPI_API_KEY/SOLAPI_API_SECRET missing');
            return fail('SOLAPI_CONFIG_MISSING', 'Solapi API not configured', 'SOLAPI_API_KEY or SOLAPI_API_SECRET is missing.');
        }
        if (!receiver || receiver.length < 9) {
            console.warn('Kakao not sent: invalid receiver number');
            return fail('INVALID_RECEIVER', 'Invalid receiver number', 'Please check receiver phone format.');
        }

        const optedOut = await isOptedOut(receiver, 'kakao');
        if (optedOut) {
            console.log('[sendKakaoNotification] opted-out receiver skipped: ' + receiver);
            return fail('KAKAO_OPT_OUT', 'Kakao opted-out receiver', 'Receiver is opted out for Kakao messages.');
        }

        const formattedVariables = {};
        if (variables && typeof variables === 'object') {
            for (const [k, v] of Object.entries(variables)) {
                formattedVariables['#{' + k + '}'] = String(v ?? '');
            }
        }

        const messageService = getSolapiMessageService(solapiApiKey, solapiApiSecret);
        const result = await messageService.sendOne({
            to: receiver,
            from: senderPhone || receiver,
            kakaoOptions: { pfId, templateId, variables: formattedVariables }
        });

        console.log('Kakao send success:', receiver, 'groupId:', result?.groupId || '');
        if (!withMeta) return result;
        return { sent: true, error_code: '', error: '', error_detail: '', result };
    } catch (error) {
        const msg = error?.message || String(error || 'unknown error');
        console.error('Kakao send failed:', error?.name || '', msg);
        return fail('KAKAO_SEND_ERROR', 'Kakao send failed', msg);
    }
}

// Solapi ??????????? ??? (??? API ???????- ??? SDK ???)
let _solapiServiceInstance = null;
let _solapiServiceCacheKey = '';

function getSolapiMessageService(apiKey, apiSecret) {
    const cacheKey = `${apiKey}:${apiSecret}`;
    if (_solapiServiceInstance && _solapiServiceCacheKey === cacheKey) {
        return _solapiServiceInstance;
    }
    _solapiServiceInstance = new SolapiMessageService(apiKey, apiSecret);
    _solapiServiceCacheKey = cacheKey;
    return _solapiServiceInstance;
}

/**
 * Solapi SMS/LMS 전송 (공식 Node.js SDK v5.5.4+ 사용)
 * - 단문(SMS): 영문 90바이트 이하 / 한글 45자 이하 → 9원/건
 * - 장문(LMS): 90바이트 초과 → 30원/건
 * SDK가 텍스트 길이에 따라 자동 타입 결정 (type 미지정 시)
 * 참조: https://developers.solapi.com/sdk-list/Node.js/send-message
 */
async function sendSmsNotification(phone, text, options = {}) {
    const withMeta = options && options.withMeta === true;
    const fail = (error_code, error, error_detail = '') => {
        if (!withMeta) return null;
        return { sent: false, error_code, error, error_detail: error_detail || error };
    };

    try {
        const apiKey = toSafeString(readParam(SOLAPI_API_KEY_PARAM, 'SOLAPI_API_KEY', ''), 100);
        const apiSecret = toSafeString(readParam(SOLAPI_API_SECRET_PARAM, 'SOLAPI_API_SECRET', ''), 100);
        const senderPhone = normalizePhoneNumber(readParam(SOLAPI_SENDER_PHONE_PARAM, 'SOLAPI_SENDER_PHONE', ''));
        const normalizedReceiver = normalizePhoneNumber(phone);

        if (!apiKey || !apiSecret) {
            console.warn('SMS not sent: SOLAPI_API_KEY/SOLAPI_API_SECRET missing');
            return fail('SOLAPI_CONFIG_MISSING', 'SMS API not configured', 'SOLAPI_API_KEY or SOLAPI_API_SECRET is missing.');
        }
        if (!senderPhone) {
            console.warn('SMS not sent: SOLAPI_SENDER_PHONE missing');
            return fail('SMS_SENDER_MISSING', 'SMS sender phone missing', 'SOLAPI_SENDER_PHONE is missing.');
        }
        if (!normalizedReceiver || normalizedReceiver.length < 9) {
            console.warn('SMS not sent: invalid receiver number');
            return fail('INVALID_RECEIVER', 'Invalid receiver number', 'Please check receiver phone format.');
        }

        const optedOut = await isOptedOut(normalizedReceiver, 'sms');
        if (optedOut) {
            console.log('[sendSmsNotification] opted-out receiver skipped: ' + normalizedReceiver);
            return fail('SMS_OPT_OUT', 'SMS opted-out receiver', 'Receiver is opted out for SMS.');
        }

        const messageService = getSolapiMessageService(apiKey, apiSecret);
        const result = await messageService.sendOne({
            to: normalizedReceiver,
            from: senderPhone,
            text: toSafeString(text, 2000)
        });

        const resultGroupId = result?.groupId || '';
        console.log('SMS send success:', normalizedReceiver, 'groupId:', resultGroupId);
        if (!withMeta) return result;
        return { sent: true, error_code: '', error: '', error_detail: '', result };
    } catch (err) {
        const msg = err?.message || String(err || 'unknown error');
        console.error('SMS send failed:', err?.name || '', msg);
        return fail('SMS_SEND_ERROR', 'SMS send failed', msg);
    }
}

/**
 * 일괄 알림 전송 (관리자용)
 */
exports.sendBulkNotifications = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        // 관리자 권한 확인
        if (!context.auth || !context.auth.token.admin) {
            throw new functions.https.HttpsError('permission-denied', '관리자 권한이 필요합니다.');
        }

        const { applicationIds, message, type } = data;
        const db = admin.firestore();

        const results = [];

        for (const appId of applicationIds) {
            try {
                const doc = await db.collection('applications').doc(appId).get();
                const application = doc.data();
                const personalInfo = getPersonalInfo(application);

                if (type === 'email') {
                    await sendEmail({
                        from: getEmailFromAddress(),
                        to: personalInfo.email,
                        subject: '[삼성생명 GFC] 안내',
                        html: message
                    });
                } else if (type === 'kakao') {
                    await sendKakaoNotification(personalInfo.phone, {
                        templateCode: 'BULK_MESSAGE',
                        variables: { message }
                    });
                }

                results.push({ id: appId, success: true });
            } catch (error) {
                results.push({ id: appId, success: false, error: error.message });
            }
        }

        return { results };
    });

/**
 * JOB 설명회 참석 신청 시 알림 전송
 */
exports.sendJobFairNotification = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        const { managementNumber, name, phone, eventInfo } = data;

        // 참석자에게 카카오톡 알림 전송
        await sendKakaoNotification(phone, {
            templateCode: 'JOB_FAIR_CONFIRMATION',
            variables: {
                name,
                managementNumber,
                eventDate: eventInfo.date,
                eventTime: eventInfo.time,
                eventLocation: eventInfo.location
            }
        });

        // 관리자에게도 알림
        const adminPhone = toSafeString(readParam(ADMIN_PHONE_PARAM, 'ADMIN_PHONE', ''), 50);
        await sendKakaoNotification(adminPhone, {
            templateCode: 'ADMIN_JOB_FAIR_REGISTRATION',
            variables: {
                name,
                phone,
                managementNumber,
                eventDate: eventInfo.date
            }
        });

        return { success: true };
    });

async function fetchPortoneAccessToken() {
    const impKey = toSafeString(readParam(PORTONE_IMP_KEY_PARAM, 'PORTONE_IMP_KEY', ''), 200);
    const impSecret = toSafeString(readParam(PORTONE_IMP_SECRET_PARAM, 'PORTONE_IMP_SECRET', ''), 200);

    if (!impKey || !impSecret) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'PASS verification is not configured on server.'
        );
    }

    const tokenResponse = await axios.post(
        'https://api.iamport.kr/users/getToken',
        {
            imp_key: impKey,
            imp_secret: impSecret
        },
        {
            timeout: 10000
        }
    );

    const accessToken = toSafeString(tokenResponse?.data?.response?.access_token, 400);
    if (!accessToken) {
        throw new functions.https.HttpsError('internal', 'Failed to obtain PASS verification access token.');
    }
    return accessToken;
}

async function fetchPortoneCertification(accessToken, impUid) {
    const response = await axios.get(
        `https://api.iamport.kr/certifications/${encodeURIComponent(impUid)}`,
        {
            headers: {
                Authorization: accessToken
            },
            timeout: 10000
        }
    );
    return response?.data?.response || {};
}

function normalizeIdentityProfile(certification = {}, impUid) {
    const birthRaw = toSafeString(certification.birth || certification.birthday, 30).replace(/\D/g, '');
    const normalizedBirth = birthRaw.length >= 8 ? birthRaw.slice(0, 8) : birthRaw;
    const genderRaw = toSafeString(certification.gender, 20).toLowerCase();
    const isMale = ['male', 'm', '1'].includes(genderRaw);
    const isFemale = ['female', 'f', '2'].includes(genderRaw);

    return {
        verified: true,
        provider: 'portone_pass',
        impUid: toSafeString(certification.imp_uid || impUid, 120),
        merchantUid: toSafeString(certification.merchant_uid, 120),
        name: toSafeString(certification.name, 120),
        phone: toSafeString(certification.phone, 50),
        birth: normalizedBirth,
        gender: isMale ? 'male' : (isFemale ? 'female' : genderRaw),
        carrier: toSafeString(certification.carrier, 40),
        uniqueKey: toSafeString(certification.unique_key, 200),
        verifiedAt: new Date().toISOString()
    };
}

exports.verifyIdentityCertification = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
    const impUid = toSafeString(data?.impUid, 120);
    if (!impUid) {
        throw new functions.https.HttpsError('invalid-argument', 'Missing PASS verification id.');
    }

    try {
        const accessToken = await fetchPortoneAccessToken();
        const certification = await fetchPortoneCertification(accessToken, impUid);
        const certified = certification?.certified === true || certification?.certified === 'true';
        if (!certified) {
            throw new functions.https.HttpsError('permission-denied', 'PASS verification failed.');
        }

        const profile = normalizeIdentityProfile(certification, impUid);
        if (!profile.impUid) {
            throw new functions.https.HttpsError('permission-denied', 'PASS verification failed.');
        }

        return profile;
    } catch (error) {
        if (error instanceof functions.https.HttpsError) {
            throw error;
        }
        console.error('verifyIdentityCertification error:', error?.response?.data || error);
        throw new functions.https.HttpsError('internal', 'Failed to verify PASS certification.');
    }
});

const ALLOWED_APPLICATION_TYPES = new Set(['general', 'referral', 'jobfair', 'referral_jobfair', 'direct']);

function normalizeSecureApplicationType(type) {
    const raw = String(type || '').trim();
    if (raw === 'direct') return 'general';
    if (raw === 'referral-jobfair') return 'referral_jobfair';
    if (ALLOWED_APPLICATION_TYPES.has(raw)) return raw;
    return 'general';
}

function toSafeString(value, maxLength = 2000) {
    if (value === undefined || value === null) return '';
    return String(value).trim().slice(0, maxLength);
}

function normalizePhoneNumber(value) {
    const stripped = toSafeString(value, 50).replace(/[\s\-().]/g, '');
    // 국제번호 +82 또는 0082 접두사 제거 후 국내 010/02/... 형태로 변환
    if (stripped.startsWith('+82')) {
        // +82 제거 후 숫자만 추출, 앞에 0 추가
        return '0' + stripped.slice(3).replace(/\D/g, '');
    }
    if (stripped.startsWith('0082')) {
        return '0' + stripped.slice(4).replace(/\D/g, '');
    }
    // 숫자만 추출
    return stripped.replace(/\D/g, '');
}

function toSafeBoolean(value) {
    return value === true || value === 'true' || value === 'on' || value === 1 || value === '1';
}

function toSafeInteger(value, defaultValue = 0) {
    const parsed = parseInt(String(value ?? ''), 10);
    return Number.isFinite(parsed) ? parsed : defaultValue;
}

function getClientIp(context) {
    const forwardedFor = context.rawRequest?.headers?.['x-forwarded-for'];
    if (typeof forwardedFor === 'string' && forwardedFor.trim()) {
        return forwardedFor.split(',')[0].trim();
    }
    return context.rawRequest?.ip || 'unknown';
}

async function verifyTurnstileToken(token, ip) {
    const turnstileSecret = toSafeString(readParam(TURNSTILE_SECRET_PARAM, 'TURNSTILE_SECRET', ''), 300);

    if (!turnstileSecret) {
        throw new functions.https.HttpsError(
            'failed-precondition',
            'Turnstile secret is not configured on server.'
        );
    }

    const body = new URLSearchParams({
        secret: turnstileSecret,
        response: token,
        remoteip: ip
    });

    const response = await axios.post(
        'https://challenges.cloudflare.com/turnstile/v0/siteverify',
        body.toString(),
        { headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, timeout: 8000 }
    );

    const result = response.data || {};
    if (result.success !== true) {
        throw new functions.https.HttpsError('permission-denied', 'Human verification failed.');
    }
}

async function enforceSubmissionRateLimit(ipHash) {
    const db = admin.firestore();
    const guardRef = db.collection('submission_rate_limits').doc(ipHash);

    await db.runTransaction(async (tx) => {
        const snap = await tx.get(guardRef);
        const now = Date.now();
        const lastSubmittedAt = snap.exists ? (snap.data().lastSubmittedAtMs || 0) : 0;
        const elapsed = now - lastSubmittedAt;

        if (elapsed < 15000) {
            throw new functions.https.HttpsError(
                'resource-exhausted',
                'Too many submission attempts. Please wait and try again.'
            );
        }

        tx.set(
            guardRef,
            {
                lastSubmittedAtMs: now,
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            },
            { merge: true }
        );
    });
}

function buildValidatedApplicationPayload(rawPayload = {}) {
    const applicationType = normalizeSecureApplicationType(rawPayload.application_type);
    const hasReferrer = toSafeBoolean(rawPayload.has_referrer) ||
        applicationType === 'referral' ||
        applicationType === 'referral_jobfair';

    const email = toSafeString(rawPayload.email, 200);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', 'Invalid email address.');
    }

    const address = toSafeString(rawPayload.address, 300);
    if (!address) {
        throw new functions.https.HttpsError('invalid-argument', 'Address is required.');
    }

    if (!toSafeBoolean(rawPayload.email_identity_confirmed)) {
        throw new functions.https.HttpsError('invalid-argument', 'Email identity check is required.');
    }

    const identityVerified = toSafeBoolean(rawPayload.identity_verified);
    const identityProvider = toSafeString(rawPayload.identity_provider, 80) || 'portone_pass';
    const identityImpUid = toSafeString(rawPayload.identity_verification_imp_uid, 120);
    const identityVerifiedAt = toSafeString(rawPayload.identity_verified_at, 80) || new Date().toISOString();
    const identityProfileName = toSafeString(rawPayload.identity_profile_name, 120);
    const identityProfilePhone = toSafeString(rawPayload.identity_profile_phone, 50);
    const identityProfileBirth = toSafeString(rawPayload.identity_profile_birth, 30);
    const identityProfileGender = toSafeString(rawPayload.identity_profile_gender, 20);

    if (!identityVerified || !identityImpUid) {
        throw new functions.https.HttpsError('invalid-argument', 'PASS identity verification is required.');
    }

    if (!toSafeBoolean(rawPayload.consent_collection) ||
        !toSafeBoolean(rawPayload.consent_third_party) ||
        !toSafeBoolean(rawPayload.consent_credit_inquiry)) {
        throw new functions.https.HttpsError('invalid-argument', 'Required consent is missing.');
    }

    const referrerName = toSafeString(rawPayload.referrer_name, 120);
    const referrerPhone = toSafeString(rawPayload.referrer_phone, 50);
    const referrerBranch = toSafeString(rawPayload.referrer_branch, 120);
    const applicantName = toSafeString(rawPayload.name, 120);
    const applicantPhone = toSafeString(rawPayload.phone, 50);
    const applicantGender = toSafeString(rawPayload.gender, 20);
    const applicantBirthDate = toSafeString(rawPayload.birth_date, 30);

    // ── 서버사이드 필수 항목 검증: 지원 유형 무관 필수 ──
    if (!applicantName) {
        throw new functions.https.HttpsError('invalid-argument', '성명은 필수 입력 항목입니다.');
    }
    if (!applicantPhone) {
        throw new functions.https.HttpsError('invalid-argument', '연락처(휴대폰)는 필수 입력 항목입니다.');
    }
    if (!applicantGender) {
        throw new functions.https.HttpsError('invalid-argument', '성별은 필수 입력 항목입니다.');
    }
    if (!applicantBirthDate) {
        throw new functions.https.HttpsError('invalid-argument', '생년월일은 필수 입력 항목입니다.');
    }

    if (hasReferrer && (!referrerName || !referrerPhone || !referrerBranch)) {
        throw new functions.https.HttpsError('invalid-argument', 'Referrer information is required.');
    }

    if (applicationType === 'jobfair' && !hasReferrer) {
        if (!applicantName || !applicantPhone || !applicantGender || !applicantBirthDate) {
            throw new functions.https.HttpsError(
                'invalid-argument',
                'For Job Fair applications without a referrer, name, mobile phone, gender, birth date, and email are required.'
            );
        }
    }

    const now = new Date();
    const submittedAtIso = now.toISOString();
    const submissionParts = getDateTimeParts(now);
    const submissionDateTime = formatDateTimeFromParts(submissionParts);
    const numberType = resolveApplicantNumberType({
        application_type: applicationType,
        has_referrer: hasReferrer,
        referrer_name: referrerName,
        referrer_phone: referrerPhone,
        referrer_branch: referrerBranch
    });
    const applicationTypeCodeMap = {
        general: '1',
        referral: '2',
        jobfair: '3',
        referral_jobfair: '4'
    };
    const applicationTypeLabelMap = {
        general: '일반지원',
        referral: '추천인지원',
        jobfair: 'Job Fair 지원',
        referral_jobfair: '추천인 Job Fair지원'
    };

    const payload = {
        applied_at: submittedAtIso,
        submitted_at: submittedAtIso,
        updated_at: submittedAtIso,
        submission_datetime: submittedAtIso,
        submission_datetime_kst: submissionDateTime,
        submission_year: submissionParts.year,
        submission_month: submissionParts.month,
        submission_day: submissionParts.day,
        submission_hour: submissionParts.hour,
        submission_minute: submissionParts.minute,
        submission_second: submissionParts.second,
        createdAt: now,
        submittedAt: now,
        status: 'pending',

        application_type: applicationType,
        application_type_legacy: applicationType === 'general' ? 'direct' : applicationType,
        application_category_code: applicationTypeCodeMap[applicationType] || '1',
        application_category_label: applicationTypeLabelMap[applicationType] || '일반지원',
        applicant_number_type_code: numberType.code,
        applicant_number_type_label: numberType.label,
        has_referrer: hasReferrer,

        branch: '',
        recruiter: '',

        name: applicantName,
        birth_date: applicantBirthDate,
        gender: applicantGender,
        marital_status: toSafeString(rawPayload.marital_status, 20),
        phone: applicantPhone,
        home_phone: toSafeString(rawPayload.home_phone, 50),
        email: email,
        email_identity_confirmed: true,
        identity_verified: true,
        identity_provider: identityProvider,
        identity_verification_imp_uid: identityImpUid,
        identity_verified_at: identityVerifiedAt,
        identity_profile_name: identityProfileName,
        identity_profile_phone: identityProfilePhone,
        identity_profile_birth: identityProfileBirth,
        identity_profile_gender: identityProfileGender,
        postal_code: toSafeString(rawPayload.postal_code, 10),
        address: address,
        address_detail: toSafeString(rawPayload.address_detail, 300),
        financial_delinquency: toSafeString(rawPayload.financial_delinquency, 20),

        education_level: toSafeString(rawPayload.education_level, 50),
        education_school: toSafeString(rawPayload.education_school, 120),
        education_major: toSafeString(rawPayload.education_major, 120),
        education_status: toSafeString(rawPayload.education_status, 50),

        insurance_experience: toSafeString(rawPayload.insurance_experience, 20),
        insurance_company: toSafeString(rawPayload.insurance_company, 120),
        insurance_period: toSafeString(rawPayload.insurance_period, 80),
        insurance_salary: toSafeString(rawPayload.insurance_salary, 30),
        career_summary: toSafeString(rawPayload.career_summary, 5000),
        career_years: toSafeInteger(rawPayload.career_years, 0),
        certificates: toSafeString(rawPayload.certificates, 1000),

        motivation: toSafeString(rawPayload.motivation, 5000),
        strengths: toSafeString(rawPayload.strengths, 5000),

        job_fair_date: toSafeString(rawPayload.job_fair_date, 50),
        job_fair_location: toSafeString(rawPayload.job_fair_location, 100),
        referrer_name: hasReferrer ? referrerName : '',
        referrer_phone: hasReferrer ? referrerPhone : '',
        referrer_branch: hasReferrer ? referrerBranch : '',

        consent_collection: true,
        consent_third_party: true,
        consent_credit_inquiry: true,
        consent_marketing: toSafeBoolean(rawPayload.consent_marketing),

        notes: toSafeString(rawPayload.notes || '온라인 지원서 접수', 1000),
        status_history: Array.isArray(rawPayload.status_history) && rawPayload.status_history.length > 0
            ? rawPayload.status_history.slice(0, 10)
            : [{
                date: now.toLocaleString('ko-KR', { hour12: false }),
                status: 'pending',
                note: '온라인 지원서 접수 완료',
                updatedBy: '시스템 자동'
            }],

        personalInfo: {
            name: toSafeString(rawPayload.personalInfo?.name || rawPayload.name, 120),
            phone: toSafeString(rawPayload.personalInfo?.phone || rawPayload.phone, 50),
            email: toSafeString(rawPayload.personalInfo?.email || rawPayload.email, 200),
            emailIdentityConfirmed: true,
            identityVerified: true,
            identityProvider: identityProvider,
            identityVerifiedAt: identityVerifiedAt,
            gender: toSafeString(rawPayload.personalInfo?.gender || rawPayload.gender, 20),
            birthDate: toSafeString(rawPayload.personalInfo?.birthDate || rawPayload.birth_date, 30),
            maritalStatus: toSafeString(rawPayload.personalInfo?.maritalStatus || rawPayload.marital_status, 20),
            postalCode: toSafeString(rawPayload.personalInfo?.postalCode || rawPayload.postal_code, 10),
            address: toSafeString(rawPayload.personalInfo?.address || rawPayload.address, 300),
            addressDetail: toSafeString(rawPayload.personalInfo?.addressDetail || rawPayload.address_detail, 300)
        },
        applicationInfo: {
            type: applicationType,
            typeLegacy: applicationType === 'general' ? 'direct' : applicationType,
            categoryCode: applicationTypeCodeMap[applicationType] || '1',
            categoryLabel: applicationTypeLabelMap[applicationType] || '일반지원',
            branch: '',
            recruiter: '',
            submittedVia: 'online'
        },

        human_verification_passed: true,
        anti_bot_guard: {
            turnstile_verified: true,
            turnstile_verified_at: submittedAtIso
        }
    };

    if (applicationType === 'jobfair' || applicationType === 'referral_jobfair') {
        payload.jobFairInfo = {
            date: payload.job_fair_date,
            location: payload.job_fair_location,
            attendanceConfirmed: false
        };
    }

    if (hasReferrer) {
        payload.referralInfo = {
            name: payload.referrer_name,
            phone: payload.referrer_phone,
            branch: payload.referrer_branch
        };
    }

    return payload;
}

exports.submitApplicationSecure = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        const applicationDataRaw = data?.applicationData || {};
        const turnstileToken = toSafeString(data?.turnstileToken, 4000);
        const antiBotMeta = data?.antiBotMeta || {};

        if (!turnstileToken) {
            throw new functions.https.HttpsError('invalid-argument', 'Missing human verification token.');
        }

        const clientIp = getClientIp(context);
        const ipHash = crypto.createHash('sha256').update(clientIp).digest('hex');

        await enforceSubmissionRateLimit(ipHash);
        // Turnstile 미사용 시 수학 문제로 대체 (MATH_ONLY_BYPASS)
        if (turnstileToken !== 'MATH_ONLY_BYPASS') {
            await verifyTurnstileToken(turnstileToken, clientIp);
        }

        const payload = buildValidatedApplicationPayload(applicationDataRaw);
        payload.anti_bot_guard = {
            ...(payload.anti_bot_guard || {}),
            ip_hash: ipHash,
            dwell_ms: toSafeInteger(antiBotMeta.dwellMs, 0),
            interaction_count: toSafeInteger(antiBotMeta.interactionCount, 0)
        };

        // ── 중복 지원 방지 ──────────────────────────────────────
        // 동일 전화번호 또는 이메일로 접수된 지원서가 있으면 차단
        // 단, status가 'withdrawn'(취소)인 경우는 재지원 허용
        const db = admin.firestore();
        const phone = toSafeString(payload.phone, 30).replace(/\D/g, '');
        const email = toSafeString(payload.email, 200).toLowerCase();

        const [phoneSnap, emailSnap] = await Promise.all([
            phone
                ? db.collection('applications')
                    .where('phone_digits', '==', phone)
                    .where('status', '!=', 'withdrawn')
                    .limit(1).get()
                : Promise.resolve({ empty: true }),
            email
                ? db.collection('applications')
                    .where('email_lower', '==', email)
                    .where('status', '!=', 'withdrawn')
                    .limit(1).get()
                : Promise.resolve({ empty: true })
        ]);

        if (!phoneSnap.empty) {
            throw new functions.https.HttpsError(
                'already-exists',
                '이미 동일한 연락처로 접수된 지원서가 있습니다. 중복 지원은 불가합니다.\n문의: jb2park@gmail.com'
            );
        }
        if (!emailSnap.empty) {
            throw new functions.https.HttpsError(
                'already-exists',
                '이미 동일한 이메일로 접수된 지원서가 있습니다. 중복 지원은 불가합니다.\n문의: jb2park@gmail.com'
            );
        }

        // 검색용 정규화 필드 추가
        payload.phone_digits = phone;
        payload.email_lower = email;
        // ────────────────────────────────────────────────────────

        const docRef = await db.collection('applications').add(payload);
        return {
            success: true,
            applicationId: docRef.id
        };
    });

/**
 * 이메일 인증 코드 발송
 * - 6자리 랜덤 코드 생성 후 Firestore email_verifications에 저장 (5분 TTL)
 * - nodemailer로 이메일 발송
 */
exports.sendEmailVerificationCode = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
    const email = toSafeString(data?.email, 200).toLowerCase();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 이메일 주소입니다.');
    }

    const db = admin.firestore();
    // Firestore 문서 ID로 사용할 수 있도록 이메일 인코딩
    const emailKey = Buffer.from(email).toString('base64').replace(/[/+=]/g, '_');
    const docRef = db.collection('email_verifications').doc(emailKey);

    // 재발송 제한: 60초에 1번
    const existing = await docRef.get();
    if (existing.exists) {
        const sentAt = existing.data().sentAt?.toDate?.() || new Date(0);
        if ((Date.now() - sentAt.getTime()) < 60000) {
            throw new functions.https.HttpsError('resource-exhausted', '1분 후에 다시 시도해주세요.');
        }
    }

    // 6자리 코드 생성
    const code = String(Math.floor(100000 + Math.random() * 900000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5분 후 만료

    await docRef.set({
        code,
        email,
        sentAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        verified: false,
        attempts: 0
    });

    const mailOptions = {
        from: getEmailFromAddress(),
        to: email,
        subject: '[삼성생명 GFC] 이메일 인증 코드',
        html: `
            <div style="font-family:'Noto Sans KR',sans-serif; max-width:480px; margin:0 auto; padding:40px 32px; background:#fff; border:1px solid #e0e0e0; border-radius:8px;">
                <div style="text-align:center; margin-bottom:24px;">
                    <img src="https://samsung-gfc.web.app/images/logo.png" alt="삼성생명 GFC" style="height:40px;" onerror="this.style.display='none'">
                </div>
                <h2 style="color:#1428A0; font-size:1.3rem; margin-bottom:8px; text-align:center;">이메일 인증</h2>
                <p style="color:#555; margin-bottom:24px; text-align:center; font-size:0.95rem;">삼성생명 GFC 지원서 제출을 위한 이메일 인증 코드입니다.</p>
                <div style="background:#F4F7FD; border-radius:8px; padding:28px; text-align:center; margin-bottom:24px; border:1px solid #D0D8F0;">
                    <p style="color:#888; font-size:0.85rem; margin-bottom:8px;">인증 코드</p>
                    <span style="font-size:2.8rem; font-weight:700; letter-spacing:0.6rem; color:#1428A0;">${code}</span>
                </div>
                <p style="color:#888; font-size:0.9rem; text-align:center;">이 코드는 <strong>5분간</strong> 유효합니다.</p>
                <p style="color:#aaa; font-size:0.85rem; margin-top:8px; text-align:center;">본인이 요청하지 않은 경우 이 메일을 무시하세요.</p>
                <hr style="margin:24px 0; border:none; border-top:1px solid #e0e0e0;">
                <p style="color:#bbb; font-size:0.8rem; text-align:center;">삼성생명 GFC 채용팀</p>
            </div>
        `
    };

    let sent = false;
    try {
        await sendEmail(mailOptions);
        sent = true;
    } catch (err) {
        console.error('인증 코드 이메일 발송 오류:', err);
        throw new functions.https.HttpsError('internal', '이메일 발송에 실패했습니다. 잠시 후 다시 시도해주세요.');
    }

    console.log(`이메일 인증 코드 발송: ${email}, sent=${sent}`);
    return { success: true, message: '인증 코드가 발송되었습니다.' };
});

/**
 * 이메일 인증 코드 확인
 */
exports.verifyEmailCode = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
    const email = toSafeString(data?.email, 200).toLowerCase();
    const code = toSafeString(data?.code, 10).replace(/\s/g, '');

    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 이메일 주소입니다.');
    }
    if (!code || code.length !== 6 || !/^\d{6}$/.test(code)) {
        throw new functions.https.HttpsError('invalid-argument', '6자리 숫자 인증 코드를 입력해주세요.');
    }

    const db = admin.firestore();
    const emailKey = Buffer.from(email).toString('base64').replace(/[/+=]/g, '_');
    const docRef = db.collection('email_verifications').doc(emailKey);
    const snap = await docRef.get();

    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', '인증 코드를 먼저 발송해주세요.');
    }

    const docData = snap.data();

    if ((docData.attempts || 0) >= 5) {
        throw new functions.https.HttpsError('resource-exhausted', '인증 시도 횟수를 초과했습니다. 코드를 다시 발송해주세요.');
    }

    const expiresAt = docData.expiresAt?.toDate?.() || new Date(0);
    if (Date.now() > expiresAt.getTime()) {
        throw new functions.https.HttpsError('deadline-exceeded', '인증 코드가 만료되었습니다. 다시 발송해주세요.');
    }

    if (docData.code !== code) {
        await docRef.update({ attempts: admin.firestore.FieldValue.increment(1) });
        const remaining = 4 - (docData.attempts || 0);
        throw new functions.https.HttpsError('invalid-argument', `인증 코드가 올바르지 않습니다. (남은 시도: ${remaining}회)`);
    }

    await docRef.update({
        verified: true,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp()
    });

    console.log(`이메일 인증 완료: ${email}`);
    return { success: true, message: '이메일 인증이 완료되었습니다.' };
});

// ============================================================
// 채용설명회 행사 자료 AI 자동 인식 (Claude Vision)
// ============================================================
const ANTHROPIC_API_KEY_PARAM = { value: () => process.env.ANTHROPIC_API_KEY || '__UNSET__' };

exports.extractEventInfo = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        // 관리자(로그인된 사용자)만 호출 가능
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
        }

        const { imageBase64, mimeType } = data;
        if (!imageBase64) {
            throw new functions.https.HttpsError('invalid-argument', '이미지 데이터가 없습니다.');
        }

        const apiKey = readParam(ANTHROPIC_API_KEY_PARAM, 'ANTHROPIC_API_KEY', '');
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'ANTHROPIC_API_KEY가 설정되지 않았습니다.');
        }

        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });

        const imageMime = mimeType || 'image/jpeg';
        const prompt = `이 이미지는 채용설명회(Job Fair) 행사 포스터 또는 안내 자료입니다.
다음 정보를 추출해서 JSON 형식으로만 반환해주세요 (마크다운 없이 순수 JSON만):

{
  "title": "행사명 (없으면 null)",
  "date": "날짜 YYYY-MM-DD 형식 (없으면 null)",
  "startTime": "시작 시간 HH:MM 24시간 형식 (없으면 null)",
  "endTime": "종료 시간 HH:MM 24시간 형식 (없으면 null)",
  "location": "장소 건물명 포함 전체 주소 (없으면 null)",
  "note": "참고사항 간단 요약 (없으면 null)"
}

추출 규칙:
- 날짜: 예) "2026년 3월 15일" → "2026-03-15"
- 시간: 예) "오후 2시" → "14:00", "오전 10시 30분" → "10:30"
- 장소: 건물명, 층, 홀 등 구체적으로
- JSON 외 다른 텍스트 절대 포함 금지`;

        try {
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 512,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageMime,
                                data: imageBase64
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
            });

            const raw = response.content[0].text.trim();
            console.log('Claude 응답 원문:', raw);

            // JSON 파싱
            let parsed;
            try {
                // ```json ... ``` 블록 제거 후 파싱 시도
                const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                parsed = JSON.parse(jsonStr);
            } catch (parseErr) {
                // JSON 블록 추출 시도
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) {
                    parsed = JSON.parse(match[0]);
                } else {
                    throw new Error('JSON 파싱 실패: ' + raw);
                }
            }

            console.log('추출된 이벤트 정보:', parsed);
            return { success: true, data: parsed };
        } catch (err) {
            console.error('AI 분석 오류:', err.message);
            throw new functions.https.HttpsError('internal', 'AI 분석 실패: ' + err.message);
        }
    });

// ============================================================
// GTC 교육 일정 AI 자동 인식 (Claude Vision)
// ============================================================
exports.extractGtcSchedule = functions
    .runWith({ timeoutSeconds: 60, memory: '512MB', secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', '로그인이 필요합니다.');
        }

        const { imageBase64, mimeType } = data;
        if (!imageBase64) {
            throw new functions.https.HttpsError('invalid-argument', '이미지 데이터가 없습니다.');
        }

        const apiKey = readParam(ANTHROPIC_API_KEY_PARAM, 'ANTHROPIC_API_KEY', '');
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'ANTHROPIC_API_KEY가 설정되지 않았습니다.');
        }

        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });

        const imageMime = mimeType || 'image/jpeg';
        const prompt = `이 이미지는 GFC(기업금융전문가) 교육 일정표(GTC 교육 안내) 자료입니다.
교육 과정 정보를 추출해서 다음 JSON 형식으로만 반환해주세요 (마크다운 없이 순수 JSON만):

{
  "yearMonth": "교육년월 YYYY-MM 형식 (없으면 null)",
  "phases": [
    {
      "phase": "과정명 (예: GTC 입문과정, GTC 0 사전교육, GTC 합숙과정)",
      "dates": "기간 원문 표기 (예: 3/3(화)~11(수))",
      "startDate": "시작일 YYYY-MM-DD (없으면 null)",
      "endDate": "종료일 YYYY-MM-DD (없으면 null)",
      "location": "장소 (없으면 null)",
      "time": "시간 (예: 09:00~17:30, 없으면 null)",
      "content": "교육 내용 요약 (없으면 null)",
      "note": "참고사항 (없으면 null)"
    }
  ]
}

추출 규칙:
- phases 배열에 각 교육 과정(입문→사전→합숙 순)을 하나씩 담아주세요
- 날짜: "3월 3일" → "2026-03-03" (연도는 yearMonth에서 추론)
- JSON 외 다른 텍스트 절대 포함 금지`;

        try {
            const response = await client.messages.create({
                model: 'claude-haiku-4-5-20251001',
                max_tokens: 1024,
                messages: [{
                    role: 'user',
                    content: [
                        {
                            type: 'image',
                            source: {
                                type: 'base64',
                                media_type: imageMime,
                                data: imageBase64
                            }
                        },
                        { type: 'text', text: prompt }
                    ]
                }]
            });

            const raw = response.content[0].text.trim();
            console.log('GTC Claude 응답 원문:', raw);

            let parsed;
            try {
                const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                parsed = JSON.parse(jsonStr);
            } catch (parseErr) {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) {
                    parsed = JSON.parse(match[0]);
                } else {
                    throw new Error('JSON 파싱 실패: ' + raw);
                }
            }

            console.log('추출된 GTC 일정:', parsed);
            return { success: true, data: parsed };
        } catch (err) {
            console.error('GTC AI 분석 오류:', err.message);
            throw new functions.https.HttpsError('internal', 'AI 분석 실패: ' + err.message);
        }
    });

// ============================================================
// 관리자 지원서 필드 수정 + 수정 이력(edit_log) 기록
// ============================================================
exports.updateApplicationField = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');
    }

    const { applicationId, changes } = data;

    if (!applicationId || !Array.isArray(changes) || changes.length === 0) {
        throw new functions.https.HttpsError('invalid-argument', 'applicationId와 changes 배열이 필요합니다.');
    }

    const db = admin.firestore();
    const docRef = db.collection('applications').doc(applicationId);

    // 문서 존재 확인
    const snap = await docRef.get();
    if (!snap.exists) {
        throw new functions.https.HttpsError('not-found', '해당 지원서를 찾을 수 없습니다.');
    }

    const adminEmail = context.auth.token.email || context.auth.uid;

    // 수정 이력 엔트리
    const logEntry = {
        timestamp: new Date().toISOString(),
        updatedBy: adminEmail,
        source: 'admin',
        changes: changes.map(c => ({
            field: c.field || '',
            label: c.label || c.field || '',
            before: c.before !== undefined ? String(c.before) : '',
            after: c.after !== undefined ? String(c.after) : ''
        }))
    };

    // 변경 필드 업데이트 페이로드
    const updatePayload = {};
    changes.forEach(c => {
        if (c.field) updatePayload[c.field] = c.after !== undefined ? c.after : '';
    });
    updatePayload['edit_log'] = admin.firestore.FieldValue.arrayUnion(logEntry);
    updatePayload['updated_at'] = admin.firestore.FieldValue.serverTimestamp();
    updatePayload['reviewed_by'] = adminEmail;

    await docRef.update(updatePayload);

    console.log(`[updateApplicationField] ${applicationId} 수정 by ${adminEmail}:`, changes.map(c => c.field).join(', '));
    return { success: true };
});

// ─────────────────────────────────────────────────────────────
// 수신거부 요청 → 지원자 문서 자동 동기화
// optOutRequests 컬렉션에 문서 생성/수정 시 발동
// ─────────────────────────────────────────────────────────────
exports.syncOptOutToApplicant = functions.firestore
    .document('optOutRequests/{docId}')
    .onWrite(async (change, context) => {
        const after = change.after.exists ? change.after.data() : null;
        if (!after) return null;

        const rawPhone = (after.phone || '').replace(/\D/g, '');
        const types = Array.isArray(after.opt_out_types) ? after.opt_out_types : [];
        if (!rawPhone || types.length === 0) return null;

        const db = admin.firestore();
        const now = new Date().toISOString();
        const optedOutAt = after.rejected_at || after.created_at || now;
        const refNum = after.ref_num || context.params.docId;

        // 전화번호 형식이 다를 수 있으므로 두 가지 형식으로 조회
        const formatted = rawPhone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
        const [snapFormatted, snapRaw] = await Promise.all([
            db.collection('applications').where('phone', '==', formatted).get(),
            db.collection('applications').where('phone', '==', rawPhone).get()
        ]);

        // 중복 제거 (같은 doc이 두 쿼리에 겹칠 수 있음)
        const docsMap = new Map();
        [...snapFormatted.docs, ...snapRaw.docs].forEach(d => docsMap.set(d.id, d));
        if (docsMap.size === 0) {
            console.log(`[syncOptOut] 일치하는 지원자 없음 - phone: ${after.phone}`);
            return null;
        }

        const channelKeyMap = { sms: 'sms', kakao: 'kakao', email: 'email' };
        const batch = db.batch();

        docsMap.forEach(doc => {
            const updateData = {};
            types.forEach(type => {
                const ch = channelKeyMap[type];
                if (ch) {
                    updateData[`optout_channels.${ch}`] = {
                        status: 'optout',
                        opted_out_at: optedOutAt,
                        ref_num: refNum,
                        updated_at: now,
                        source: after.source || 'web'
                    };
                }
            });
            if (Object.keys(updateData).length > 0) {
                batch.update(doc.ref, updateData);
            }
        });

        await batch.commit();
        console.log(`[syncOptOut] ${docsMap.size}명 지원자 수신거부 동기화 완료 - phone: ${after.phone}, types: ${types.join(',')}`);
        return null;
    });

// 수신거부 복구 (관리자가 optout → active로 복원) - HTTPS callable
exports.restoreOptOutChannel = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '관리자 로그인 필요');

        const { applicationId, channel } = data;
        if (!applicationId || !channel) throw new functions.https.HttpsError('invalid-argument', '필수 파라미터 누락');
        if (!['sms', 'kakao', 'email'].includes(channel)) throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 채널');

        const db = admin.firestore();
        const now = new Date().toISOString();
        await db.collection('applications').doc(applicationId).update({
            [`optout_channels.${channel}`]: {
                status: 'active',
                opted_out_at: null,
                ref_num: null,
                updated_at: now,
                source: 'admin_restore'
            }
        });

        console.log(`[restoreOptOut] ${applicationId} - ${channel} 수신 복구 by ${context.auth.token.email}`);
        return { success: true };
    });

// 수신거부 수동 등록 (관리자) - HTTPS callable
exports.manualOptOutChannel = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '관리자 로그인 필요');

        const { applicationId, channels, note } = data;
        if (!applicationId || !Array.isArray(channels) || channels.length === 0)
            throw new functions.https.HttpsError('invalid-argument', '필수 파라미터 누락');

        const db = admin.firestore();
        const now = new Date().toISOString();
        const updateData = {};
        channels.forEach(ch => {
            if (['sms', 'kakao', 'email'].includes(ch)) {
                updateData[`optout_channels.${ch}`] = {
                    status: 'optout',
                    opted_out_at: now,
                    ref_num: 'admin-manual',
                    updated_at: now,
                    source: 'admin_manual',
                    note: note || ''
                };
            }
        });

        await db.collection('applications').doc(applicationId).update(updateData);
        console.log(`[manualOptOut] ${applicationId} - ${channels.join(',')} 수동 거부 by ${context.auth.token.email}`);
        return { success: true };
    });

exports.backfillMissingNumbers = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', 'Admin only');

        const db = admin.firestore();
        const snapshot = await db.collection('applications').get();
        let count = 0;

        for (const doc of snapshot.docs) {
            const app = doc.data();
            if (!app.management_number || app.management_number === '-') {
                try {
                    const numberInfo = await generateManagementNumber(app);
                    const mgmtNum = numberInfo.managementNumber;

                    const submissionDate = getSubmissionDateForNumbering(app);
                    const submissionParts = getDateTimeParts(submissionDate);

                    await doc.ref.update({
                        management_number: mgmtNum,
                        management_number_year: numberInfo.year,
                        management_number_month: numberInfo.month,
                        management_number_type_code: numberInfo.typeCode,
                        management_number_type_label: numberInfo.typeLabel,
                        management_number_sequence: numberInfo.sequence,
                        management_number_generated_at: numberInfo.generatedAtIso,
                        submission_year: submissionParts.year,
                        submission_month: submissionParts.month,
                        submission_day: submissionParts.day,
                        submission_hour: submissionParts.hour,
                        submission_minute: submissionParts.minute,
                        submission_second: submissionParts.second
                    });

                    console.log(`복구 완료: ${doc.id} -> ${mgmtNum}`);
                    count++;
                } catch (e) {
                    console.error("복구 실패:", doc.id, e);
                }
            }
        }
        return { success: true, count };
    });

// ============================================================
// Solapi 수신거부 웹훅 수신 (카카오 알림톡 / 문자 SMS)
// POST https://asia-northeast3-samsung-gfc.cloudfunctions.net/solapiOptOutWebhook
// ============================================================
exports.solapiOptOutWebhook = functions
    .region('asia-northeast3')
    .runWith({ secrets: ['SOLAPI_API_KEY', 'SOLAPI_API_SECRET'] })
    .https.onRequest(async (req, res) => {
        // OPTIONS preflight (혹시 Solapi가 확인 요청 보낼 경우)
        if (req.method === 'OPTIONS') {
            res.set('Access-Control-Allow-Origin', '*');
            res.status(204).send('');
            return;
        }
        if (req.method !== 'POST') {
            res.status(405).json({ error: 'Method Not Allowed' });
            return;
        }

        // ── Solapi HMAC 서명 검증 ──────────────────────────────
        try {
            const apiKey    = process.env.SOLAPI_API_KEY || '';
            const apiSecret = process.env.SOLAPI_API_SECRET || '';
            const authHeader = req.headers['authorization'] || '';

            if (apiKey && apiSecret && authHeader.startsWith('HMAC-SHA256')) {
                // Authorization: HMAC-SHA256 apiKey=..., date=..., salt=..., signature=...
                const parts = {};
                authHeader.replace('HMAC-SHA256 ', '').split(', ').forEach(p => {
                    const [k, v] = p.split('=');
                    parts[k.trim()] = v ? v.trim() : '';
                });
                const expected = crypto
                    .createHmac('sha256', apiSecret)
                    .update(parts.date + parts.salt)
                    .digest('hex');
                if (parts.signature !== expected) {
                    console.warn('[solapiOptOutWebhook] HMAC 서명 불일치 - 요청 무시');
                    res.status(401).json({ error: 'Invalid signature' });
                    return;
                }
            } else if (apiKey && apiSecret) {
                // 서명 헤더 없으면 경고만 (초기 테스트 편의)
                console.warn('[solapiOptOutWebhook] Authorization 헤더 없음 - 서명 검증 생략');
            }
        } catch (sigErr) {
            console.error('[solapiOptOutWebhook] 서명 검증 오류:', sigErr);
        }

        // ── 페이로드 파싱 ──────────────────────────────────────
        const body = req.body || {};
        console.log('[solapiOptOutWebhook] 수신 페이로드:', JSON.stringify(body));

        // ── 채널 판별 ──────────────────────────────────────────
        // Solapi 수신거부 웹훅 payload 예시:
        //   카카오 채널차단: { type: "ATA" | "CTA" | "CTI", event: "block", to: "01012345678" }
        //   SMS 수신거부:    { type: "SMS" | "LMS" | "MMS", event: "unsubscribe", to: "01012345678" }
        //   카카오 친구차단: { event: "KAKAO_BLOCK", recipientNumber: "01012345678" }
        const msgType  = (body.type || body.messageType || '').toUpperCase();
        const eventType = (body.event || body.eventType || '').toUpperCase();

        const isKakao  = msgType === 'ATA' || msgType === 'CTA' || msgType === 'CTI'
                      || (body.channel || '').toLowerCase().includes('kakao')
                      || eventType === 'KAKAO_BLOCK'
                      || eventType === 'BLOCK';
        const channel  = isKakao ? 'kakao' : 'sms';

        // ── 이벤트 타입 검증 (수신거부/차단 관련만 처리) ──────
        const validEvents = ['UNSUBSCRIBE', 'BLOCK', 'KAKAO_BLOCK', 'OPT_OUT', 'OPTOUT', ''];
        if (eventType && !validEvents.includes(eventType)) {
            console.log(`[solapiOptOutWebhook] 수신거부 이외의 이벤트 무시: ${eventType}`);
            res.status(200).json({ ok: true, skipped: true, reason: 'non-optout event' });
            return;
        }

        // 전화번호 추출 (Solapi는 대부분 'to' 또는 'phone' 필드 사용)
        const rawPhone = (body.to || body.phone || body.recipientNumber || body.recipient || '').replace(/\D/g, '');
        if (!rawPhone || rawPhone.length < 9) {
            console.warn('[solapiOptOutWebhook] 전화번호 없음 - 저장 생략. body:', JSON.stringify(body));
            res.status(200).json({ ok: true, skipped: true, reason: 'no phone' });
            return;
        }

        const formattedPhone = rawPhone.replace(/^(\d{3})(\d{3,4})(\d{4})$/, '$1-$2-$3');
        const now = new Date();
        const pad = n => String(n).padStart(2, '0');
        const refNum = 'OO-' + now.getFullYear()
            + pad(now.getMonth() + 1)
            + pad(now.getDate())
            + '-' + Math.floor(Math.random() * 9000 + 1000);

        // ── Firestore 저장 ──────────────────────────────────────
        const db = admin.firestore();

        // 중복 체크: 동일 전화번호 + 동일 채널의 pending 요청이 있으면 생략
        const existing = await db.collection('optOutRequests')
            .where('phone', '==', formattedPhone)
            .where('opt_out_types', 'array-contains', channel)
            .where('status', '==', 'pending')
            .limit(1)
            .get();

        if (!existing.empty) {
            console.log(`[solapiOptOutWebhook] 이미 처리 중인 요청 존재 - phone: ${formattedPhone}, channel: ${channel}`);
            res.status(200).json({ ok: true, skipped: true, reason: 'duplicate' });
            return;
        }

        await db.collection('optOutRequests').add({
            ref_num:           refNum,
            name:              body.name || body.senderName || body.customerName || '',
            phone:             formattedPhone,
            email:             body.email || '',
            opt_out_types:     [channel],
            opt_out_type_labels: [channel === 'kakao' ? '카카오' : '문자'],
            rejected_at:       now.toISOString(),
            processed_at:      null,
            status:            'pending',
            note:              '',
            source:            'solapi_webhook',
            event_type:        eventType || msgType || 'unknown',
            raw_payload:       JSON.stringify(body).slice(0, 1000), // 원본 저장 (디버깅용)
            created_at:        now.toISOString()
        });

        console.log(`[solapiOptOutWebhook] 수신거부 저장 완료 - phone: ${formattedPhone}, channel: ${channel}, ref: ${refNum}`);
        res.status(200).json({ ok: true, ref_num: refNum });
    });

/**
 * 면접 일정 지정 및 안내 이메일 발송
 */
exports.scheduleInterview = functions
    .runWith({ secrets: ALL_SECRETS })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '인증 필요');

        const { applicationId, interviewDate, interviewLocation, interviewNote, name, email, phone, managementNumber } = data;
        if (!applicationId || !interviewDate) {
            throw new functions.https.HttpsError('invalid-argument', 'applicationId와 interviewDate가 필요합니다.');
        }

        const db = admin.firestore();
        const appRef = db.collection('applications').doc(applicationId);

        // 면접일 D-1 16:00 발송 예약 플래그 설정
        await appRef.update({
            interview_date: interviewDate,
            interview_location: interviewLocation || '',
            interview_note: interviewNote || '',
            interview_scheduled_at: new Date().toISOString(),
            interview_scheduled_by: context.auth.token.email || context.auth.uid,
            interview_notification_sent: false,   // D-1 16:00 자동발송 대기
            status: 'interview_scheduled'
        });

        // 면접일 포맷 (가독성)
        let interviewDateFormatted = interviewDate;
        try {
            const d = new Date(interviewDate);
            interviewDateFormatted = d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
        } catch(e) {}

        const baseHistory = {
            application_id: applicationId,
            management_number: managementNumber || '',
            applicant_name: name || '',
            notification_status: '면접통보',
            submission_datetime: new Date().toISOString()
        };

        // ① 지원자에게 이메일 즉시 발송
        let applicantEmailSent = false;
        let applicantEmailError = '';
        if (email) {
            const emailHtml = `
            <div style="font-family:sans-serif; max-width:600px; margin:0 auto;">
            <h2 style="color:#1428A0;">${name}님, 면접 일정을 안내드립니다</h2>
            <hr>
            <table style="border-collapse:collapse; width:100%; font-size:15px;">
                <tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; width:120px; border:1px solid #dde;">면접 일시</td>
                    <td style="padding:10px 14px; border:1px solid #dde;"><strong>${interviewDateFormatted}</strong></td></tr>
                ${interviewLocation ? `<tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; border:1px solid #dde;">면접 장소</td>
                    <td style="padding:10px 14px; border:1px solid #dde;">${interviewLocation}</td></tr>` : ''}
                ${interviewNote ? `<tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; border:1px solid #dde;">안내 사항</td>
                    <td style="padding:10px 14px; border:1px solid #dde;">${interviewNote}</td></tr>` : ''}
            </table>
            <hr>
            <p>면접 관련 문의사항은 채용 담당자에게 연락해 주시기 바랍니다.</p>
            <p>감사합니다.</p>
            <p><strong>삼성생명 GFC 채용팀</strong></p>
            <hr style="margin-top:24px; border:none; border-top:1px solid #eee;">
            <p style="font-size:12px; color:#999; margin-top:12px;">
                📌 수신거부: <a href="https://samsung-gfc.web.app/opt-out.html" style="color:#034EA2;">https://samsung-gfc.web.app/opt-out.html</a>
            </p>
            </div>`;
            try {
                await sendEmail({
                    from: getEmailFromAddress(),
                    to: email,
                    subject: `[삼성생명 GFC] 면접 일정 안내 - ${name}님`,
                    html: emailHtml
                });
                applicantEmailSent = true;
            } catch (err) {
                applicantEmailError = err.message;
                console.warn('지원자 면접안내 이메일 실패:', err.message);
            }
            await saveNotificationHistory({
                ...baseHistory,
                recipient_type: 'applicant',
                recipient_name: name || '',
                recipient_contact: email,
                notification_method: 'email',
                sent: applicantEmailSent,
                error: applicantEmailError
            });
        }

        // ② 지원자에게 SMS 즉시 발송
        let applicantSmsSent = false;
        let applicantSmsError = '';
        if (phone) {
            const smsText = `[삼성생명GFC] ${name}님 면접 일정 안내\n▶ 일시: ${interviewDateFormatted}\n▶ 장소: ${interviewLocation || '-'}${interviewNote ? '\n▶ 안내: ' + interviewNote : ''}`;
            const smsResult = await sendSmsNotification(phone, smsText);
            applicantSmsSent = smsResult !== null;
            if (!applicantSmsSent) applicantSmsError = 'SMS 전송 실패';
            await saveNotificationHistory({
                ...baseHistory,
                recipient_type: 'applicant',
                recipient_name: name || '',
                recipient_contact: phone,
                notification_method: 'sms',
                sent: applicantSmsSent,
                error: applicantSmsError
            });
        }

        // ③ 관리자에게 면접 일정 등록 확인 이메일
        const adminEmail = toSafeString(readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', ''), 200);
        if (adminEmail) {
            try {
                await sendEmail({
                    from: getEmailFromAddress(),
                    to: adminEmail,
                    subject: `[GFC 면접통보] ${name}님 발송완료 (이메일:${applicantEmailSent?'✓':'✗'} SMS:${applicantSmsSent?'✓':'✗'})`,
                    html: `<p><strong>${name}</strong>님에게 면접 일정을 통보했습니다.</p>
                    <ul>
                        <li><strong>면접 일시:</strong> ${interviewDateFormatted}</li>
                        <li><strong>면접 장소:</strong> ${interviewLocation || '-'}</li>
                        <li><strong>안내 사항:</strong> ${interviewNote || '-'}</li>
                        <li><strong>이메일 발송:</strong> ${applicantEmailSent ? '✅ 성공' : '❌ 실패 - ' + applicantEmailError}</li>
                        <li><strong>SMS 발송:</strong> ${applicantSmsSent ? '✅ 성공' : '❌ 실패 - ' + applicantSmsError}</li>
                    </ul>
                    <p>📌 D-1(면접 전날) 16:00에도 재안내 문자·이메일이 자동 발송됩니다.</p>
                    <p><a href="https://samsung-gfc.web.app/admin/applications.html">관리자 대시보드</a></p>`
                });
            } catch (err) {
                console.warn('관리자 면접등록 확인 이메일 실패:', err.message);
            }
        }

        return { success: true, emailSent: applicantEmailSent, smsSent: applicantSmsSent };
    });

// ============================================================
// 면접 D-1 16:00 자동 통보 (매일 16:00 KST 실행)
// ============================================================
exports.sendInterviewReminders = functions
    .runWith({ secrets: ALL_SECRETS })
    .pubsub.schedule('0 16 * * *')
    .timeZone('Asia/Seoul')
    .onRun(async () => {
        const db = admin.firestore();

        // 내일 날짜 범위 계산 (KST 기준)
        const now = new Date();
        const kstOffset = 9 * 60 * 60 * 1000;
        const kstNow = new Date(now.getTime() + kstOffset);
        const tomorrowKST = new Date(kstNow);
        tomorrowKST.setUTCDate(tomorrowKST.getUTCDate() + 1);
        const tomorrowDateStr = tomorrowKST.toISOString().slice(0, 10); // YYYY-MM-DD

        console.log('[sendInterviewReminders] 실행일:', kstNow.toISOString().slice(0, 10), '→ 대상 면접일:', tomorrowDateStr);

        // interview_notification_sent=false 인 interview_scheduled 지원자 조회
        const snapshot = await db.collection('applications')
            .where('status', '==', 'interview_scheduled')
            .where('interview_notification_sent', '==', false)
            .get();

        if (snapshot.empty) {
            console.log('[sendInterviewReminders] 발송 대상 없음');
            return null;
        }

        let sentCount = 0;
        for (const doc of snapshot.docs) {
            const app = doc.data();
            const interviewDate = app.interview_date || '';
            if (!interviewDate.startsWith(tomorrowDateStr)) continue; // 내일 면접만

            const { name, email, phone, interview_location: loc, interview_note: note } = app;
            const mgmtNum = app.managementNumber || app.management_number || '';
            const baseHistory = {
                application_id: doc.id,
                management_number: mgmtNum,
                applicant_name: name || '',
                notification_status: '면접리마인드',
                submission_datetime: new Date().toISOString()
            };

            // 면접일 포맷
            let interviewDateFormatted = interviewDate;
            try {
                const d = new Date(interviewDate);
                interviewDateFormatted = d.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' });
            } catch(e) {}

            // 리마인드 이메일 발송
            let emailSent = false;
            let emailError = '';
            if (email) {
                const emailHtml = `
                <div style="font-family:sans-serif; max-width:600px; margin:0 auto;">
                <div style="background:#fff3cd; border:1px solid #ffc107; border-radius:8px; padding:10px 16px; margin-bottom:16px;">
                    <strong>⏰ 면접 리마인드</strong> — 내일 면접이 예정되어 있습니다.
                </div>
                <h2 style="color:#1428A0;">${name}님, 내일 면접 일정을 다시 안내드립니다</h2>
                <hr>
                <table style="border-collapse:collapse; width:100%; font-size:15px;">
                    <tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; width:120px; border:1px solid #dde;">면접 일시</td>
                        <td style="padding:10px 14px; border:1px solid #dde;"><strong>${interviewDateFormatted}</strong></td></tr>
                    ${loc ? `<tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; border:1px solid #dde;">면접 장소</td>
                        <td style="padding:10px 14px; border:1px solid #dde;">${loc}</td></tr>` : ''}
                    ${note ? `<tr><td style="padding:10px 14px; background:#f5f7ff; font-weight:600; border:1px solid #dde;">안내 사항</td>
                        <td style="padding:10px 14px; border:1px solid #dde;">${note}</td></tr>` : ''}
                </table>
                <hr>
                <p>본 메일은 면접 전날 자동 발송되는 리마인드 메일입니다.</p>
                <p>면접 관련 문의사항은 채용 담당자에게 연락해 주시기 바랍니다.</p>
                <p>감사합니다. <strong>삼성생명 GFC 채용팀</strong></p>
                <hr style="margin-top:24px; border:none; border-top:1px solid #eee;">
                <p style="font-size:12px; color:#999; margin-top:12px;">
                    📌 수신거부: <a href="https://samsung-gfc.web.app/opt-out.html" style="color:#034EA2;">https://samsung-gfc.web.app/opt-out.html</a>
                </p>
                </div>`;
                try {
                    await sendEmail({
                        from: getEmailFromAddress(),
                        to: email,
                        subject: `[삼성생명 GFC] ⏰ [리마인드] 내일 면접 일정 - ${name}님`,
                        html: emailHtml
                    });
                    emailSent = true;
                } catch (err) {
                    emailError = err.message;
                    console.error('[sendInterviewReminders] 이메일 실패:', doc.id, err.message);
                }
                await saveNotificationHistory({
                    ...baseHistory,
                    recipient_type: 'applicant',
                    recipient_name: name || '',
                    recipient_contact: email || '',
                    notification_method: 'email',
                    sent: emailSent,
                    error: emailError
                });
            }

            // 리마인드 SMS 발송
            let smsSent = false;
            let smsError = '';
            if (phone) {
                const smsText = `[삼성생명GFC 리마인드] ${name}님, 내일 면접이 있습니다.\n▶ 일시: ${interviewDateFormatted}\n▶ 장소: ${loc || '-'}${note ? '\n▶ 안내: ' + note : ''}\n(본 문자는 면접 전날 자동 발송됩니다)`;
                const smsResult = await sendSmsNotification(phone, smsText);
                smsSent = smsResult !== null;
                if (!smsSent) smsError = 'SMS 전송 실패';
                await saveNotificationHistory({
                    ...baseHistory,
                    recipient_type: 'applicant',
                    recipient_name: name || '',
                    recipient_contact: phone || '',
                    notification_method: 'sms',
                    sent: smsSent,
                    error: smsError
                });
            }

            // 발송 완료 플래그 업데이트
            await db.collection('applications').doc(doc.id).update({
                interview_notification_sent: true,
                interview_notification_sent_at: new Date().toISOString(),
                interview_notification_email_sent: emailSent,
                interview_notification_sms_sent: smsSent
            });

            sentCount++;
            console.log(`[sendInterviewReminders] 발송 완료: ${doc.id} (${name}) 이메일:${emailSent} SMS:${smsSent}`);
        }

        console.log(`[sendInterviewReminders] 총 ${sentCount}건 처리`);
        return null;
    });

// ============================================================
// 오프라인(이메일/팩스/직접내방) 지원서 AI 스캔
// - 이미지 또는 텍스트를 받아 지원서 항목을 자동 추출
// ============================================================
exports.scanPaperApplication = functions
    .runWith({ timeoutSeconds: 90, memory: '512MB', secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');
        }

        const { imageBase64, mimeType, rawText } = data;
        if (!imageBase64 && !rawText) {
            throw new functions.https.HttpsError('invalid-argument', '이미지 또는 텍스트가 필요합니다.');
        }

        const apiKey = readParam(ANTHROPIC_API_KEY_PARAM, 'ANTHROPIC_API_KEY', '');
        if (!apiKey) {
            throw new functions.https.HttpsError('failed-precondition', 'ANTHROPIC_API_KEY가 설정되지 않았습니다.');
        }

        const Anthropic = require('@anthropic-ai/sdk');
        const client = new Anthropic({ apiKey });

        const extractionPrompt = `당신은 채용 지원서 OCR 전문가입니다. 아래 지원서에서 모든 정보를 추출하여 JSON으로 반환하세요.

추출 항목:
- name: 성명(이름)
- phone: 휴대폰 번호 (숫자와 하이픈만, 예: 010-1234-5678)
- home_phone: 일반전화
- email: 이메일 주소
- gender: 성별 (male/female)
- birth_date: 생년월일 (YYYY-MM-DD 형식)
- postal_code: 우편번호
- address: 주소
- address_detail: 상세주소
- education: 최종학력 (high_school/college_2year/college_4year/graduate/etc)
- career: 직전 직장/경력 내용
- motivation: 지원동기
- referrer_name: 추천인 이름
- referrer_phone: 추천인 연락처
- branch: 소속 지점
- recruiter: 유치자/담당자명
- application_type: 지원 구분 (general=일반/referral=추천인/jobfair=취업박람회/referral_jobfair=추천인+취업박람회)
- marital_status: 결혼여부 (single/married)
- notes: 특이사항이나 기타 메모

추출 불가 항목은 빈 문자열("")로 설정하세요.
반드시 유효한 JSON 객체만 반환하고 다른 텍스트는 절대 포함하지 마세요.`;

        try {
            let messageContent;
            if (imageBase64) {
                const imageMime = mimeType || 'image/jpeg';
                messageContent = [
                    {
                        type: 'image',
                        source: { type: 'base64', media_type: imageMime, data: imageBase64 }
                    },
                    { type: 'text', text: extractionPrompt }
                ];
            } else {
                messageContent = [{
                    type: 'text',
                    text: `다음 지원서 텍스트에서 정보를 추출하세요:\n\n${rawText}\n\n${extractionPrompt}`
                }];
            }

            const response = await client.messages.create({
                model: 'claude-sonnet-4-6',
                max_tokens: 1024,
                messages: [{ role: 'user', content: messageContent }]
            });

            const raw = response.content[0].text.trim();
            console.log('[scanPaperApplication] Claude 응답:', raw.slice(0, 300));

            let parsed;
            try {
                const jsonStr = raw.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim();
                parsed = JSON.parse(jsonStr);
            } catch (_) {
                const match = raw.match(/\{[\s\S]*\}/);
                if (match) parsed = JSON.parse(match[0]);
                else throw new Error('JSON 파싱 실패: ' + raw.slice(0, 200));
            }

            return { success: true, data: parsed };
        } catch (err) {
            console.error('[scanPaperApplication] 오류:', err.message);
            throw new functions.https.HttpsError('internal', 'AI 인식 실패: ' + err.message);
        }
    });

// ============================================================
// 오프라인 지원서 등록 (이메일/팩스/직접내방)
// - 관리자가 검토·수정한 데이터를 Firestore에 저장
// ============================================================
exports.registerOfflineApplication = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        if (!context.auth) {
            throw new functions.https.HttpsError('unauthenticated', '관리자 로그인이 필요합니다.');
        }

        const {
            applicationData,
            submissionChannel,
            offlineSubmittedAt,
            sourceImageUrl,
            skipDuplicateCheck
        } = data;

        if (!applicationData || !submissionChannel) {
            throw new functions.https.HttpsError('invalid-argument', 'applicationData와 submissionChannel이 필요합니다.');
        }

        const CHANNEL_LABELS = {
            email: '이메일 접수', fax: '팩스 접수', visit: '직접 내방'
        };
        if (!CHANNEL_LABELS[submissionChannel]) {
            throw new functions.https.HttpsError('invalid-argument', '유효하지 않은 submissionChannel입니다.');
        }

        const db = admin.firestore();
        const phone = (applicationData.phone || '').replace(/\D/g, '');
        const email = (applicationData.email || '').toLowerCase().trim();

        if (!skipDuplicateCheck && (phone || email)) {
            const checks = [];
            if (phone) checks.push(
                db.collection('applications').where('phone_digits', '==', phone).where('status', '!=', 'withdrawn').limit(1).get()
            );
            if (email) checks.push(
                db.collection('applications').where('email_lower', '==', email).where('status', '!=', 'withdrawn').limit(1).get()
            );
            const results = await Promise.all(checks);
            for (const snap of results) {
                if (!snap.empty) {
                    throw new functions.https.HttpsError(
                        'already-exists',
                        '이미 동일한 연락처/이메일로 접수된 지원서가 있습니다.\n중복 등록 시 [중복 무시 후 등록] 버튼을 사용하세요.'
                    );
                }
            }
        }

        const now = new Date().toISOString();
        const originalSubmittedAt = offlineSubmittedAt || now;

        const payload = {
            ...applicationData,
            submission_channel: submissionChannel,
            submission_channel_label: CHANNEL_LABELS[submissionChannel],
            submitted_at: originalSubmittedAt,
            applied_at: originalSubmittedAt,
            registered_at: now,
            registered_by: context.auth.token.email || context.auth.uid,
            status: applicationData.status || 'pending',
            phone_digits: phone,
            email_lower: email
        };

        if (sourceImageUrl) payload.source_image_url = sourceImageUrl;

        try {
            const numInfo = await generateManagementNumber({ ...payload, submitted_at: originalSubmittedAt });
            payload.management_number = numInfo.managementNumber;
            payload.managementNumber = numInfo.managementNumber;
        } catch (numErr) {
            console.warn('[registerOfflineApplication] 관리번호 생성 실패:', numErr.message);
        }

        const docRef = await db.collection('applications').add(payload);
        console.log(`[registerOfflineApplication] 등록 완료: ${docRef.id} channel=${submissionChannel}`);

        return { success: true, applicationId: docRef.id, managementNumber: payload.management_number || '' };
    });

// ─── ① 개인정보 파기 알림 (매일 오전 9시 KST) ───────────────────────────────
exports.checkPersonalDataExpiry = functions
    .runWith({ secrets: ALL_SECRET_NAMES, timeoutSeconds: 120, memory: '256MB' })
    .pubsub.schedule('0 0 * * *')   // 00:00 UTC = 09:00 KST
    .timeZone('UTC')
    .onRun(async () => {
        const db = admin.firestore();
        const now = new Date();

        // 6개월 기준일
        const sixMonthsAgo = new Date(now);
        sixMonthsAgo.setMonth(sixMonthsAgo.getMonth() - 6);

        // 파기 7일 전 사전 경고 기준일 (5개월 23일)
        const warnDate = new Date(sixMonthsAgo);
        warnDate.setDate(warnDate.getDate() + 7);

        const ACTIVE_STATUSES = ['hired', 'active'];

        // Firestore 쿼리: submitted_at <= sixMonthsAgo (문자열 ISO 비교)
        const snap = await db.collection('applications')
            .where('submitted_at', '<=', sixMonthsAgo.toISOString())
            .get();

        const toDestroy = [];
        const toWarn = [];

        snap.forEach(doc => {
            const d = doc.data();
            if (ACTIVE_STATUSES.includes(d.status)) return; // 재직자 제외

            const submittedAt = new Date(d.submitted_at);
            const diffMs = now - submittedAt;
            const diffDays = Math.floor(diffMs / 86400000);

            const item = {
                id: doc.id,
                name: d.name || '(이름없음)',
                phone: d.phone || '',
                email: d.email || '',
                status: d.status || 'unknown',
                management_number: d.management_number || d.managementNumber || '',
                submitted_at: d.submitted_at,
                diffDays
            };

            if (diffDays >= 180) {
                toDestroy.push(item);
            } else if (diffDays >= 173) {
                // 173~179일 = 파기까지 1~7일 남음
                toWarn.push({ ...item, daysLeft: 180 - diffDays });
            }
        });

        console.log(`[checkPersonalDataExpiry] 파기대상=${toDestroy.length}, 경고대상=${toWarn.length}`);

        if (toDestroy.length === 0 && toWarn.length === 0) return null;

        const adminEmail = readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', '');
        if (!adminEmail) {
            console.warn('[checkPersonalDataExpiry] ADMIN_EMAIL 미설정 — 이메일 발송 생략');
            return null;
        }

        // HTML 테이블 생성 헬퍼
        const makeTable = (rows, label) => {
            if (!rows.length) return '';
            const trs = rows.map(r => `
                <tr>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.management_number || r.id.substring(0,8)}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.name}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.phone}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.email}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.status}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${r.submitted_at ? r.submitted_at.substring(0,10) : ''}</td>
                    <td style="padding:6px 12px;border-bottom:1px solid #eee">${label === 'warn' ? (r.daysLeft + '일 후 파기') : (r.diffDays + '일 경과')}</td>
                </tr>`).join('');
            return `
            <h3 style="margin-top:24px;color:${label === 'warn' ? '#f59e0b' : '#ef4444'}">${label === 'warn' ? '⚠️ 파기 임박 (7일 이내)' : '🚨 즉시 파기 대상'} — ${rows.length}건</h3>
            <table style="border-collapse:collapse;width:100%;font-size:13px">
                <thead>
                    <tr style="background:#f3f4f6">
                        <th style="padding:8px 12px;text-align:left">관리번호</th>
                        <th style="padding:8px 12px;text-align:left">성명</th>
                        <th style="padding:8px 12px;text-align:left">연락처</th>
                        <th style="padding:8px 12px;text-align:left">이메일</th>
                        <th style="padding:8px 12px;text-align:left">상태</th>
                        <th style="padding:8px 12px;text-align:left">지원일</th>
                        <th style="padding:8px 12px;text-align:left">비고</th>
                    </tr>
                </thead>
                <tbody>${trs}</tbody>
            </table>`;
        };

        const todayStr = now.toLocaleDateString('ko-KR', { year: 'numeric', month: 'long', day: 'numeric' });
        const htmlBody = `
        <div style="font-family:sans-serif;max-width:900px;margin:0 auto;padding:24px">
            <h2 style="color:#1e3a5f;border-bottom:2px solid #1e3a5f;padding-bottom:8px">
                개인정보 파기 알림 — ${todayStr}
            </h2>
            <p style="color:#555">
                개인정보 보호법에 따라 지원일로부터 <strong>6개월</strong>이 경과한 지원서의 개인정보는 파기해야 합니다.<br>
                아래 목록을 확인하시고 <a href="https://samsung-gfc.web.app/admin/applications.html" style="color:#2563eb">관리자 페이지</a>에서 처리해 주세요.
            </p>
            ${makeTable(toDestroy, 'destroy')}
            ${makeTable(toWarn, 'warn')}
            <p style="margin-top:32px;font-size:12px;color:#999">
                이 메일은 삼성생명 GFC 채용 시스템에서 자동으로 발송되었습니다.<br>
                문의: ${adminEmail}
            </p>
        </div>`;

        const transporter = getTransporter();
        if (!transporter) {
            console.warn('[checkPersonalDataExpiry] 이메일 전송기 미설정');
            return null;
        }

        await transporter.sendMail({
            from: `"GFC 채용 시스템" <${getEmailFromAddress()}>`,
            to: adminEmail,
            subject: `[GFC 채용] 개인정보 파기 알림 — 파기대상 ${toDestroy.length}건 / 경고 ${toWarn.length}건 (${todayStr})`,
            html: htmlBody
        });

        console.log(`[checkPersonalDataExpiry] 알림 이메일 발송 완료 → ${adminEmail}`);
        return null;
    });

// ─── ② 면접 일정 확인/거절 (지원자 응답) ────────────────────────────────────
exports.respondToInterview = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        const { applicationId, response, reason } = data || {};
        // response: 'confirmed' | 'declined'

        if (!applicationId || !['confirmed', 'declined'].includes(response)) {
            throw new functions.https.HttpsError('invalid-argument', '잘못된 요청입니다.');
        }

        const db = admin.firestore();
        const docRef = db.collection('applications').doc(applicationId);
        const snap = await docRef.get();

        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', '지원서를 찾을 수 없습니다.');
        }

        const app = snap.data();

        // 면접 일정이 등록된 경우에만 응답 허용
        if (!app.interview_date) {
            throw new functions.https.HttpsError('failed-precondition', '면접 일정이 아직 등록되지 않았습니다.');
        }

        const now = new Date().toISOString();
        const updatePayload = {
            interview_response: response,
            interview_response_at: now,
            interview_response_reason: reason || ''
        };

        await docRef.update(updatePayload);
        console.log(`[respondToInterview] ${applicationId} → ${response}`);

        // 관리자 이메일 알림
        const adminEmail = readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', '');
        if (adminEmail) {
            const transporter = getTransporter();
            if (transporter) {
                const responseLabel = response === 'confirmed' ? '✅ 확정' : '❌ 거절';
                const reasonHtml = reason ? `<p><strong>사유:</strong> ${reason}</p>` : '';
                const htmlBody = `
                <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                    <h2 style="color:#1e3a5f">면접 일정 ${responseLabel}</h2>
                    <table style="border-collapse:collapse;width:100%;font-size:14px">
                        <tr><td style="padding:8px;color:#555;width:120px">지원자</td><td style="padding:8px"><strong>${app.name || ''}</strong></td></tr>
                        <tr><td style="padding:8px;color:#555">연락처</td><td style="padding:8px">${app.phone || ''}</td></tr>
                        <tr><td style="padding:8px;color:#555">이메일</td><td style="padding:8px">${app.email || ''}</td></tr>
                        <tr><td style="padding:8px;color:#555">관리번호</td><td style="padding:8px">${app.management_number || app.managementNumber || applicationId.substring(0,8)}</td></tr>
                        <tr><td style="padding:8px;color:#555">면접일시</td><td style="padding:8px">${app.interview_date || ''} ${app.interview_time || ''}</td></tr>
                        <tr><td style="padding:8px;color:#555">면접장소</td><td style="padding:8px">${app.interview_location || ''}</td></tr>
                        <tr><td style="padding:8px;color:#555">응답</td><td style="padding:8px"><strong style="color:${response === 'confirmed' ? '#16a34a' : '#dc2626'}">${responseLabel}</strong></td></tr>
                        <tr><td style="padding:8px;color:#555">응답일시</td><td style="padding:8px">${now.substring(0,19).replace('T',' ')}</td></tr>
                    </table>
                    ${reasonHtml}
                    <p style="margin-top:24px"><a href="https://samsung-gfc.web.app/admin/applications.html" style="color:#2563eb">관리자 페이지에서 확인하기</a></p>
                </div>`;

                await transporter.sendMail({
                    from: `"GFC 채용 시스템" <${getEmailFromAddress()}>`,
                    to: adminEmail,
                    subject: `[GFC 채용] 면접 ${responseLabel} — ${app.name || applicationId.substring(0,8)}`,
                    html: htmlBody
                }).catch(e => console.warn('[respondToInterview] 이메일 발송 실패:', e.message));
            }
        }

        return { success: true, response };
    });

// ─── 관리자 접근 로그 기록 (내부 헬퍼) ──────────────────────────────────────
async function writeAdminLog(db, context, action, targetId, extra = {}) {
    try {
        await db.collection('admin_logs').add({
            admin_uid: context.auth ? context.auth.uid : 'system',
            admin_email: context.auth ? (context.auth.token.email || context.auth.uid) : 'system',
            action,
            target_id: targetId || '',
            ...extra,
            timestamp: new Date().toISOString()
        });
    } catch (e) {
        console.warn('[writeAdminLog] 기록 실패:', e.message);
    }
}

// ─── 4. 지원 취소 (지원자 본인 실행) ────────────────────────────────────────
exports.withdrawApplication = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        const { applicationId, email, phone } = data || {};
        if (!applicationId || !email || !phone) {
            throw new functions.https.HttpsError('invalid-argument', '필수 정보가 누락되었습니다.');
        }

        const db = admin.firestore();
        const docRef = db.collection('applications').doc(applicationId);
        const snap = await docRef.get();

        if (!snap.exists) {
            throw new functions.https.HttpsError('not-found', '지원서를 찾을 수 없습니다.');
        }

        const app = snap.data();
        const normPhone = (p) => (p || '').replace(/\D/g, '');
        const inputPhone = normPhone(phone);
        const storedPhone = normPhone(app.phone || app.phone_digits || '');

        if (
            (app.email || '').toLowerCase() !== email.toLowerCase() ||
            !(storedPhone === inputPhone || storedPhone.endsWith(inputPhone.slice(-8)))
        ) {
            throw new functions.https.HttpsError('permission-denied', '이메일 또는 연락처가 일치하지 않습니다.');
        }

        if (['withdrawn', 'hired', 'approved'].includes(app.status)) {
            throw new functions.https.HttpsError('failed-precondition', `현재 상태(${app.status})에서는 취소할 수 없습니다.`);
        }

        const now = new Date().toISOString();
        await docRef.update({
            status: 'withdrawn',
            withdrawn_at: now,
            withdrawn_by: 'applicant'
        });

        // 관리자 이메일 알림
        const adminEmail = readParam(ADMIN_EMAIL_PARAM, 'ADMIN_EMAIL', '');
        if (adminEmail) {
            const transporter = getTransporter();
            if (transporter) {
                await transporter.sendMail({
                    from: `"GFC 채용 시스템" <${getEmailFromAddress()}>`,
                    to: adminEmail,
                    subject: `[GFC 채용] 지원 취소 알림 — ${app.name || applicationId.substring(0,8)}`,
                    html: `<div style="font-family:sans-serif;max-width:500px">
                        <h3 style="color:#b91c1c">지원 취소 접수</h3>
                        <p><strong>지원자:</strong> ${app.name || ''}  (${app.phone || ''})</p>
                        <p><strong>이메일:</strong> ${app.email || ''}</p>
                        <p><strong>관리번호:</strong> ${app.management_number || app.managementNumber || ''}</p>
                        <p><strong>취소 일시:</strong> ${now.substring(0,19).replace('T',' ')}</p>
                    </div>`
                }).catch(e => console.warn('[withdrawApplication] 이메일 발송 실패:', e.message));
            }
        }

        return { success: true };
    });

// ─── 7. 내부 메모 추가 (관리자 전용) ────────────────────────────────────────
exports.addApplicationMemo = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '인증 필요');

        const { applicationId, memo, tags } = data || {};
        if (!applicationId) throw new functions.https.HttpsError('invalid-argument', 'applicationId 필요');

        const db = admin.firestore();
        const docRef = db.collection('applications').doc(applicationId);
        const snap = await docRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', '지원서 없음');

        const now = new Date().toISOString();
        const entry = {
            memo: memo || '',
            tags: Array.isArray(tags) ? tags : [],
            by: context.auth.token.email || context.auth.uid,
            at: now
        };

        const update = {};
        if (memo) {
            update.memo_log = admin.firestore.FieldValue.arrayUnion(entry);
            update.latest_memo = memo;
        }
        if (Array.isArray(tags) && tags.length > 0) {
            update.tags = tags;
        }

        await docRef.update(update);
        await writeAdminLog(db, context, 'add_memo', applicationId, { memo: memo || '', tags: tags || [] });
        return { success: true, entry };
    });

// ─── 9. 면접 전날 리마인더 이메일 (매일 08:00 KST) ──────────────────────────
exports.sendInterviewReminders = functions
    .runWith({ secrets: ALL_SECRET_NAMES, timeoutSeconds: 120, memory: '256MB' })
    .pubsub.schedule('0 23 * * *')   // 23:00 UTC = 익일 08:00 KST
    .timeZone('UTC')
    .onRun(async () => {
        const db = admin.firestore();
        const transporter = getTransporter();
        if (!transporter) { console.warn('[sendInterviewReminders] 이메일 전송기 미설정'); return null; }

        // 내일 날짜 (YYYY-MM-DD)
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(0, 0, 0, 0);
        const tomorrowStr = tomorrow.toISOString().substring(0, 10);

        const snap = await db.collection('applications')
            .where('status', 'not-in', ['withdrawn', 'rejected'])
            .get();

        let sent = 0;
        const promises = [];
        snap.forEach(doc => {
            const app = doc.data();
            if (!app.interview_date || !app.email) return;
            const interviewDay = (app.interview_date || '').substring(0, 10);
            if (interviewDay !== tomorrowStr) return;
            if (app.interview_reminder_sent) return; // 중복 방지

            const html = `
            <div style="font-family:sans-serif;max-width:600px;margin:0 auto;padding:24px">
                <h2 style="color:#034EA2">면접 일정 리마인더</h2>
                <p><strong>${app.name || '지원자'}님</strong>, 내일 면접이 예정되어 있습니다.</p>
                <table style="border-collapse:collapse;width:100%;margin:16px 0;font-size:14px">
                    <tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left;width:120px">면접 일시</th>
                        <td style="padding:8px 12px"><strong>${app.interview_date || ''} ${app.interview_time || ''}</strong></td></tr>
                    <tr><th style="padding:8px 12px;text-align:left;background:#f9fafb">면접 장소</th>
                        <td style="padding:8px 12px">${app.interview_location || '추후 안내'}</td></tr>
                    ${app.interview_note ? `<tr style="background:#f3f4f6"><th style="padding:8px 12px;text-align:left">안내 사항</th>
                        <td style="padding:8px 12px">${app.interview_note}</td></tr>` : ''}
                </table>
                <p style="margin-top:16px">면접 일정 확인 및 응답은
                    <a href="https://samsung-gfc.web.app/mypage.html" style="color:#2563eb">마이페이지</a>에서 가능합니다.
                </p>
                <p style="font-size:12px;color:#999;margin-top:24px">삼성생명 GFC 채용팀 드림</p>
            </div>`;

            promises.push(
                transporter.sendMail({
                    from: `"삼성생명 GFC 채용팀" <${getEmailFromAddress()}>`,
                    to: app.email,
                    subject: `[GFC 채용] 내일 면접 일정 안내 — ${tomorrowStr}`,
                    html
                }).then(() => {
                    sent++;
                    return db.collection('applications').doc(doc.id).update({ interview_reminder_sent: true });
                }).catch(e => console.warn('[sendInterviewReminders] 발송 실패:', doc.id, e.message))
            );
        });

        await Promise.all(promises);
        console.log(`[sendInterviewReminders] 발송 완료: ${sent}건`);
        return null;
    });

// ─── 12. 채용 마감일 설정/조회 (관리자) ────────────────────────────────────
exports.setRecruitmentDeadline = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        if (!context.auth) throw new functions.https.HttpsError('unauthenticated', '인증 필요');

        const { deadline, enabled, message } = data || {};
        const db = admin.firestore();

        await db.collection('config').doc('recruitment').set({
            deadline: deadline || null,
            deadline_enabled: enabled !== false,
            deadline_message: message || '채용이 마감되었습니다.',
            updated_at: new Date().toISOString(),
            updated_by: context.auth.token.email || context.auth.uid
        }, { merge: true });

        await writeAdminLog(db, context, 'set_deadline', 'config/recruitment', { deadline, enabled });
        return { success: true };
    });

exports.getRecruitmentDeadline = functions
    .runWith({})
    .https.onCall(async () => {
        const db = admin.firestore();
        const snap = await db.collection('config').doc('recruitment').get();
        if (!snap.exists) return { deadline: null, enabled: false, message: '' };
        const d = snap.data();
        return {
            deadline: d.deadline || null,
            enabled: d.deadline_enabled !== false,
            message: d.deadline_message || '',
            isExpired: d.deadline ? new Date() > new Date(d.deadline) : false
        };
    });

// ─── 14. 지원서 수정 (제출 후 24시간 이내, 지원자 본인) ─────────────────────
exports.editApplication = functions
    .runWith({ secrets: ALL_SECRET_NAMES })
    .https.onCall(async (data, context) => {
        const { applicationId, email, phone, fields } = data || {};
        if (!applicationId || !email || !phone) {
            throw new functions.https.HttpsError('invalid-argument', '필수 정보가 누락되었습니다.');
        }

        // 수정 가능한 필드만 허용 (연락처, 이메일만)
        const ALLOWED_FIELDS = ['email', 'phone', 'address'];
        const safeFields = {};
        (Object.keys(fields || {})).forEach(k => {
            if (ALLOWED_FIELDS.includes(k) && fields[k] !== undefined) {
                safeFields[k] = String(fields[k]).trim();
            }
        });
        if (Object.keys(safeFields).length === 0) {
            throw new functions.https.HttpsError('invalid-argument', '수정할 항목이 없습니다.');
        }

        const db = admin.firestore();
        const docRef = db.collection('applications').doc(applicationId);
        const snap = await docRef.get();
        if (!snap.exists) throw new functions.https.HttpsError('not-found', '지원서를 찾을 수 없습니다.');

        const app = snap.data();
        const normPhone = (p) => (p || '').replace(/\D/g, '');

        // 본인 확인
        const emailMatch = (app.email || '').toLowerCase() === email.toLowerCase();
        const phoneMatch = normPhone(app.phone || app.phone_digits || '') === normPhone(phone) ||
            (app.phone_digits && app.phone_digits === normPhone(phone).slice(-8));
        if (!emailMatch || !phoneMatch) {
            throw new functions.https.HttpsError('permission-denied', '본인 확인에 실패했습니다.');
        }

        // 24시간 이내 확인
        const submittedAt = app.submitted_at
            ? (typeof app.submitted_at.toDate === 'function' ? app.submitted_at.toDate() : new Date(app.submitted_at))
            : null;
        if (!submittedAt || (Date.now() - submittedAt.getTime()) > 24 * 60 * 60 * 1000) {
            throw new functions.https.HttpsError('failed-precondition', '제출 후 24시간이 지나 수정할 수 없습니다.');
        }

        // 상태 제한 (rejected, withdrawn, hired는 수정 불가)
        if (['rejected', 'withdrawn', 'hired', 'approved'].includes(app.status)) {
            throw new functions.https.HttpsError('failed-precondition', '현재 상태에서는 수정할 수 없습니다.');
        }

        // 전화번호 관련 파생 필드 갱신
        if (safeFields.phone) {
            const digits = normPhone(safeFields.phone);
            safeFields.phone_digits = digits.slice(-8);
        }
        if (safeFields.email) {
            safeFields.email_lower = safeFields.email.toLowerCase();
        }

        safeFields.edited_at = new Date().toISOString();
        await docRef.update(safeFields);

        return { success: true, editedFields: Object.keys(safeFields) };
    });
