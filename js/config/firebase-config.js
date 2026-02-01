// Firebase 설정 파일
// 실제 사용시 Firebase 콘솔에서 발급받은 설정으로 교체하세요

const firebaseConfig = {
    apiKey: "YOUR_API_KEY",
    authDomain: "YOUR_PROJECT_ID.firebaseapp.com",
    databaseURL: "https://YOUR_PROJECT_ID.firebaseio.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT_ID.appspot.com",
    messagingSenderId: "YOUR_MESSAGING_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Firebase 초기화
let app, db, auth;

function initFirebase() {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.database();
        auth = firebase.auth();
        return true;
    }
    return false;
}

// Firestore 사용 (권장)
function initFirestore() {
    if (typeof firebase !== 'undefined') {
        app = firebase.initializeApp(firebaseConfig);
        db = firebase.firestore();
        auth = firebase.auth();
        return true;
    }
    return false;
}

// 실시간 카운터 업데이트
async function updateCounter(seminarId, action = 'increment') {
    const counterRef = db.collection('counters').doc(seminarId);
    
    try {
        await db.runTransaction(async (transaction) => {
            const doc = await transaction.get(counterRef);
            const newCount = (doc.exists ? doc.data().count : 0) + (action === 'increment' ? 1 : -1);
            transaction.set(counterRef, { count: Math.max(0, newCount), lastUpdated: firebase.firestore.FieldValue.serverTimestamp() });
        });
        return true;
    } catch (error) {
        console.error('카운터 업데이트 실패:', error);
        return false;
    }
}

// 실시간 카운터 조회
function watchCounter(seminarId, callback) {
    return db.collection('counters').doc(seminarId).onSnapshot((doc) => {
        if (doc.exists) {
            callback(doc.data().count || 0);
        } else {
            callback(0);
        }
    });
}

// 세미나 데이터 저장
async function saveSeminarData(seminarId, data) {
    try {
        await db.collection('seminars').doc(seminarId).set(data);
        return true;
    } catch (error) {
        console.error('데이터 저장 실패:', error);
        return false;
    }
}

// 세미나 데이터 조회
async function getSeminarData(seminarId) {
    try {
        const doc = await db.collection('seminars').doc(seminarId).get();
        return doc.exists ? doc.data() : null;
    } catch (error) {
        console.error('데이터 조회 실패:', error);
        return null;
    }
}

// 전체 세미나 목록 조회
async function getAllSeminars() {
    try {
        const snapshot = await db.collection('seminars').orderBy('date', 'desc').get();
        return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    } catch (error) {
        console.error('세미나 목록 조회 실패:', error);
        return [];
    }
}

// 이메일 알림 요청 저장
async function saveEmailRequest(seminarId, email, name) {
    try {
        await db.collection('emailRequests').add({
            seminarId,
            email,
            name,
            createdAt: firebase.firestore.FieldValue.serverTimestamp(),
            sent: false
        });
        return true;
    } catch (error) {
        console.error('이메일 요청 저장 실패:', error);
        return false;
    }
}

// 관리자 인증
async function adminSignIn(email, password) {
    try {
        await auth.signInWithEmailAndPassword(email, password);
        return true;
    } catch (error) {
        console.error('로그인 실패:', error);
        return false;
    }
}

// 로그아웃
function adminSignOut() {
    return auth.signOut();
}

// 인증 상태 확인
function onAuthStateChanged(callback) {
    return auth.onAuthStateChanged(callback);
}
