const { onRequest } = require('firebase-functions/v2/https');
const { defineSecret } = require('firebase-functions/params');
const admin = require('firebase-admin');

admin.initializeApp();

const ADMIN_PASSWORD = defineSecret('BLO_ADMIN_PASSWORD');
const GITHUB_PAT     = defineSecret('BLO_GITHUB_PAT');

const GITHUB_OWNER = 'jbebakPark';
const GITHUB_REPO  = 'blo-seminar-2026';
const FILE_PATH    = 'data/current-seminar.json';
const API_BASE     = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/contents/${FILE_PATH}`;

exports.updateSeminar = onRequest(
  {
    secrets: [ADMIN_PASSWORD, GITHUB_PAT],
    cors: true,
    region: 'asia-northeast3',
  },
  async (req, res) => {
    if (req.method !== 'POST') {
      return res.status(405).json({ error: 'Method not allowed' });
    }

    const { password, seminarData } = req.body || {};

    if (!password || password !== ADMIN_PASSWORD.value()) {
      return res.status(401).json({ error: '비밀번호가 올바르지 않습니다.' });
    }

    if (!seminarData || typeof seminarData !== 'object') {
      return res.status(400).json({ error: '세미나 데이터가 없습니다.' });
    }

    const pat = GITHUB_PAT.value();
    const headers = {
      Authorization: `token ${pat}`,
      Accept: 'application/vnd.github.v3+json',
      'Content-Type': 'application/json',
      'User-Agent': 'BLO-Admin/1.0',
    };

    // 현재 파일 SHA 조회
    const getRes = await fetch(API_BASE, { headers });
    if (!getRes.ok) {
      const err = await getRes.json();
      return res.status(502).json({ error: `GitHub 파일 조회 실패: ${err.message}` });
    }
    const fileInfo = await getRes.json();

    // 파일 업데이트
    const newContent   = JSON.stringify(seminarData, null, 2);
    const contentB64   = Buffer.from(newContent, 'utf-8').toString('base64');
    const commitMsg    = `feat: ${seminarData.monthKor || ''} 세미나 데이터 업데이트 (관리자 페이지)`;

    const putRes = await fetch(API_BASE, {
      method: 'PUT',
      headers,
      body: JSON.stringify({ message: commitMsg, content: contentB64, sha: fileInfo.sha }),
    });

    const putResult = await putRes.json();
    if (!putRes.ok) {
      return res.status(502).json({ error: `GitHub 커밋 실패: ${putResult.message}` });
    }

    res.json({
      ok: true,
      commit: putResult.commit?.sha?.substring(0, 7),
      message: `${seminarData.monthKor} 데이터 저장 완료. GitHub Actions가 빌드·배포를 자동 처리합니다. (약 2-3분 소요)`,
    });
  }
);
