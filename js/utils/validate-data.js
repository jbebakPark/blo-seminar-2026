#!/usr/bin/env node

/**
 * BLO 세미나 데이터 검증 스크립트
 * 
 * 기능:
 * - JSON 파일 문법 검증
 * - 필수 필드 존재 확인
 * - 데이터 타입 검증
 * - 날짜 형식 검증
 */

const fs = require('fs');
const path = require('path');

// 색상 코드 (터미널 출력용)
const colors = {
  reset: '\x1b[0m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
};

// 검증 결과
let hasError = false;
let warningCount = 0;
let successCount = 0;

console.log(`${colors.cyan}╔════════════════════════════════════════╗${colors.reset}`);
console.log(`${colors.cyan}║  📊 BLO 세미나 데이터 검증 시작      ║${colors.reset}`);
console.log(`${colors.cyan}╚════════════════════════════════════════╝${colors.reset}\n`);

// 데이터 폴더 경로
const dataDir = path.join(__dirname, '..', 'data');

// data 폴더 존재 확인
if (!fs.existsSync(dataDir)) {
  console.error(`${colors.red}❌ data 폴더가 존재하지 않습니다: ${dataDir}${colors.reset}`);
  process.exit(1);
}

/**
 * 날짜 형식 검증 (YYYY-MM-DD)
 */
function isValidDate(dateString) {
  const regex = /^\d{4}-\d{2}-\d{2}$/;
  if (!regex.test(dateString)) return false;
  
  const date = new Date(dateString);
  return date instanceof Date && !isNaN(date);
}

/**
 * 이메일 형식 검증
 */
function isValidEmail(email) {
  const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return regex.test(email);
}

/**
 * 전화번호 형식 검증
 */
function isValidPhone(phone) {
  const regex = /^\d{2,3}-\d{3,4}-\d{4}$/;
  return regex.test(phone);
}

/**
 * 세미나 데이터 검증 (data-YYYY-MM.json)
 */
function validateSeminarData(filename, data) {
  console.log(`\n${colors.blue}📄 ${filename}${colors.reset}`);
  
  let errors = [];
  let warnings = [];
  
  // 1. 기본 구조 검증
  if (!data.month) {
    errors.push('month 필드 누락');
  } else if (!/^\d{4}-\d{2}$/.test(data.month)) {
    errors.push('month 형식 오류 (YYYY-MM 형식이어야 함)');
  }
  
  if (!data.date) {
    errors.push('date 필드 누락');
  } else if (!isValidDate(data.date)) {
    errors.push(`date 형식 오류: ${data.date} (YYYY-MM-DD 형식이어야 함)`);
  }
  
  // 2. 세미나 정보 검증
  if (!data.seminar) {
    errors.push('seminar 객체 누락');
  } else {
    const seminar = data.seminar;
    
    if (!seminar.title || seminar.title.trim() === '') {
      errors.push('세미나 제목 누락');
    }
    
    if (!seminar.date) {
      warnings.push('세미나 날짜 누락');
    }
    
    if (!seminar.time) {
      warnings.push('세미나 시간 누락');
    }
    
    // 강사 정보 검증
    if (!seminar.speaker) {
      errors.push('강사 정보 누락');
    } else {
      if (!seminar.speaker.name || seminar.speaker.name.trim() === '') {
        errors.push('강사 이름 누락');
      }
      
      if (!seminar.speaker.title) {
        warnings.push('강사 직함 누락');
      }
      
      if (!seminar.speaker.credentials || !Array.isArray(seminar.speaker.credentials)) {
        warnings.push('강사 이력 누락 또는 배열이 아님');
      } else if (seminar.speaker.credentials.length === 0) {
        warnings.push('강사 이력이 비어있음');
      }
    }
  }
  
  // 3. 신청 정보 검증
  if (!data.registration) {
    warnings.push('registration 객체 누락');
  } else {
    if (!data.registration.offline) {
      warnings.push('오프라인 신청 정보 누락');
    } else {
      if (!data.registration.offline.deadline) {
        warnings.push('오프라인 신청 마감일 누락');
      }
      if (!data.registration.offline.method) {
        warnings.push('오프라인 신청 방법 누락');
      }
    }
    
    if (!data.registration.online) {
      warnings.push('온라인 신청 정보 누락');
    } else {
      if (!data.registration.online.website) {
        warnings.push('온라인 신청 웹사이트 누락');
      }
    }
  }
  
  // 4. 연락처 정보 검증
  if (!data.contact) {
    warnings.push('contact 객체 누락');
  } else {
    if (!data.contact.name) {
      warnings.push('담당자 이름 누락');
    }
    
    if (!data.contact.phone) {
      warnings.push('전화번호 누락');
    } else if (!isValidPhone(data.contact.phone)) {
      warnings.push(`전화번호 형식 오류: ${data.contact.phone} (000-0000-0000 형식 권장)`);
    }
  }
  
  // 5. 혜택 정보 검증
  if (!data.benefits || !Array.isArray(data.benefits)) {
    warnings.push('benefits 배열 누락');
  } else if (data.benefits.length === 0) {
    warnings.push('혜택 정보가 비어있음');
  }
  
  // 결과 출력
  if (errors.length > 0) {
    console.log(`${colors.red}❌ 오류 (${errors.length}개):${colors.reset}`);
    errors.forEach(err => console.log(`   ${colors.red}• ${err}${colors.reset}`));
    hasError = true;
  }
  
  if (warnings.length > 0) {
    console.log(`${colors.yellow}⚠️  경고 (${warnings.length}개):${colors.reset}`);
    warnings.forEach(warn => console.log(`   ${colors.yellow}• ${warn}${colors.reset}`));
    warningCount += warnings.length;
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✅ 검증 통과${colors.reset}`);
    successCount++;
  }
}

/**
 * 연간 일정 데이터 검증 (schedule-YYYY.json)
 */
function validateScheduleData(filename, data) {
  console.log(`\n${colors.blue}📅 ${filename}${colors.reset}`);
  
  let errors = [];
  let warnings = [];
  
  // 1. 기본 구조 검증
  if (!data.year) {
    errors.push('year 필드 누락');
  } else if (typeof data.year !== 'number') {
    errors.push('year는 숫자여야 함');
  }
  
  if (!data.quarters || !Array.isArray(data.quarters)) {
    errors.push('quarters 배열 누락');
  } else {
    if (data.quarters.length !== 4) {
      warnings.push(`분기가 ${data.quarters.length}개입니다 (4개 권장)`);
    }
    
    // 각 분기 검증
    data.quarters.forEach((quarter, index) => {
      if (!quarter.quarter) {
        errors.push(`${index + 1}번째 분기의 quarter 필드 누락`);
      }
      
      if (!quarter.title) {
        warnings.push(`${index + 1}번째 분기의 제목 누락`);
      }
      
      if (!quarter.sessions || !Array.isArray(quarter.sessions)) {
        errors.push(`${index + 1}번째 분기의 sessions 배열 누락`);
      } else {
        // 각 세션 검증
        quarter.sessions.forEach((session, sessionIndex) => {
          if (!session.date) {
            errors.push(`${index + 1}분기 ${sessionIndex + 1}번째 세션의 날짜 누락`);
          } else if (!isValidDate(session.date)) {
            errors.push(`${index + 1}분기 ${sessionIndex + 1}번째 세션의 날짜 형식 오류: ${session.date}`);
          }
          
          if (!session.title) {
            errors.push(`${index + 1}분기 ${sessionIndex + 1}번째 세션의 제목 누락`);
          }
          
          if (!session.status) {
            warnings.push(`${index + 1}분기 ${sessionIndex + 1}번째 세션의 상태 누락`);
          } else if (!['completed', 'current', 'upcoming'].includes(session.status)) {
            warnings.push(`${index + 1}분기 ${sessionIndex + 1}번째 세션의 상태가 올바르지 않음: ${session.status}`);
          }
        });
      }
    });
  }
  
  // 결과 출력
  if (errors.length > 0) {
    console.log(`${colors.red}❌ 오류 (${errors.length}개):${colors.reset}`);
    errors.forEach(err => console.log(`   ${colors.red}• ${err}${colors.reset}`));
    hasError = true;
  }
  
  if (warnings.length > 0) {
    console.log(`${colors.yellow}⚠️  경고 (${warnings.length}개):${colors.reset}`);
    warnings.forEach(warn => console.log(`   ${colors.yellow}• ${warn}${colors.reset}`));
    warningCount += warnings.length;
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log(`${colors.green}✅ 검증 통과${colors.reset}`);
    successCount++;
  }
}

/**
 * 메인 검증 로직
 */
try {
  const files = fs.readdirSync(dataDir);
  const jsonFiles = files.filter(f => f.endsWith('.json'));
  
  if (jsonFiles.length === 0) {
    console.log(`${colors.yellow}⚠️  data 폴더에 JSON 파일이 없습니다.${colors.reset}`);
    process.exit(0);
  }
  
  console.log(`📂 검증할 파일 (${jsonFiles.length}개):\n   ${jsonFiles.join(', ')}\n`);
  
  jsonFiles.forEach(file => {
    const filePath = path.join(dataDir, file);
    
    try {
      // JSON 파일 읽기 및 파싱
      const content = fs.readFileSync(filePath, 'utf8');
      const data = JSON.parse(content);
      
      // 파일 타입별 검증
      if (file.startsWith('data-')) {
        validateSeminarData(file, data);
      } else if (file.startsWith('schedule-')) {
        validateScheduleData(file, data);
      } else {
        console.log(`${colors.blue}📄 ${file}${colors.reset}`);
        console.log(`${colors.yellow}⚠️  알 수 없는 파일 형식 (검증 스킵)${colors.reset}`);
      }
      
    } catch (parseError) {
      console.log(`\n${colors.blue}📄 ${file}${colors.reset}`);
      console.log(`${colors.red}❌ JSON 파싱 오류:${colors.reset}`);
      console.log(`   ${colors.red}${parseError.message}${colors.reset}`);
      hasError = true;
    }
  });
  
  // 최종 결과
  console.log(`\n${colors.cyan}════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.cyan}📊 검증 결과 요약${colors.reset}`);
  console.log(`${colors.cyan}════════════════════════════════════════${colors.reset}`);
  console.log(`${colors.green}✅ 성공: ${successCount}개${colors.reset}`);
  console.log(`${colors.yellow}⚠️  경고: ${warningCount}개${colors.reset}`);
  console.log(`${colors.red}❌ 오류: ${hasError ? '있음' : '없음'}${colors.reset}\n`);
  
  if (hasError) {
    console.log(`${colors.red}❌ 검증 실패! 위의 오류를 수정해주세요.${colors.reset}\n`);
    process.exit(1);
  } else {
    console.log(`${colors.green}✅ 모든 데이터 검증 완료!${colors.reset}\n`);
    process.exit(0);
  }
  
} catch (error) {
  console.error(`${colors.red}❌ 검증 중 오류 발생:${colors.reset}`);
  console.error(`   ${colors.red}${error.message}${colors.reset}\n`);
  process.exit(1);
}
