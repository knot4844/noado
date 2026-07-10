import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

async function runBatch() {
  const keywordsPath = path.join(__dirname, 'scratch', 'keywords_100.json');
  if (!fs.existsSync(keywordsPath)) {
    console.error("❌ 키워드 파일(keywords_100.json)이 아직 준비되지 않았습니다. 서브에이전트 조사를 대기합니다.");
    return;
  }

  // Load keywords list
  const rawData = fs.readFileSync(keywordsPath, 'utf8');
  const keywords = JSON.parse(rawData);
  console.log(`📊 로드된 시니어 복지 키워드: 총 ${keywords.length}개`);

  const postsDir = path.join(__dirname, 'src', 'content', 'posts');
  if (!fs.existsSync(postsDir)) {
    fs.mkdirSync(postsDir, { recursive: true });
  }
  
  // Scan already written posts to skip duplicate runs
  const writtenFiles = fs.readdirSync(postsDir);
  
  // Enforce AUTO_DEPLOY=true in the process environment so publish.js automatically pushes to Git!
  process.env.AUTO_DEPLOY = 'true';

  let count = 0;
  for (const item of keywords) {
    const keyword = item.keyword.trim();
    const rawCategory = item.category.trim();
    
    // Map legacy categories to new 5 premium senior categories
    let category = "생활 지원금";
    if (rawCategory === '국가연금') category = '기초·국민연금';
    else if (rawCategory === '의료혜택') category = '의료·건강 혜택';
    else if (rawCategory === '노인일자리') category = '노인 일자리';
    else if (rawCategory === '주거돌봄') category = '주거·돌봄 지원';
    else if (rawCategory === '정부지원금') category = '생활 지원금';

    // Normalize keyword to check filename duplicates (Always NFC and shortened)
    let cleanSlugKeyword = keyword
      .normalize('NFC')
      .toLowerCase()
      .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');

    const filenameAbbrMap = {
      '2026년-국민취업지원제도-신청방법-및-1유형-2유형-자격조건-총정리': '2026년-국민취업지원제도-가이드',
      '2026년-근로장려금-기한-후-신청-방법-및-자격-조건-감액-비율-확인': '2026년-근로장려금-기한후신청',
      '2026년-기초연금-수급자격-및-어르신-신청-방법-완벽-가이드': '2026년-기초연금-수급자격-가이드',
      '2026년-노인-난방비-지원-신청-자격부터-금액까지-100-혜택받는-방법': '2026년-노인-난방비-지원안내',
      '2026년-소상공인-정책자금-신청방법-및-조건-저금리-융자-지원': '2026년-소상공인-정책자금-신청',
      '2026년-숨은-휴면예금-조회-및-즉시-환급-받는-방법-서민금융진흥원': '2026년-숨은-휴면예금-조회',
      '2026년-실업급여-신청방법-및-자격-요건-고용보험-구직급여-총정리': '2026년-실업급여-신청가이드',
      '2026년-에너지바우처-신청기간-및-자격요건-전기-가스-요금-지원': '2026년-에너지바우처-신청요건',
      '2026년-유튜브-자동화-정보-신청-방법-및-자격-조건-총정리': '2026년-유튜브-자동화-신청',
      '2026년-자녀장려금-자격-신청방법-및-지원-대상-조건-요약': '2026년-자녀장려금-신청요약',
      '2026년-주택청약-1순위-조건-및-지역별-예치금-완벽-가이드': '2026년-주택청약-1순위-가이드',
      '2026년-청년-월세-특별지원-신청방법-및-자격-요건-월-20만원-지원': '2026년-청년-월세-지원가이드',
      '2026년-청년도약계좌-자격-조건-및-가입-혜택-총정리-금리-최고-60': '2026년-청년도약계좌-가이드',
      '60세-이상-정부지원금-놓치면-손해-보는-4가지-핵심-혜택-및-신청-방법-총정리': '60세-이상-정부지원금-혜택',
      '65세-이상-혜택-총정리-놓치면-손해-보는-2026년-최신-복지-혜택과-신청-방법': '65세-이상-혜택-총정리',
      '70세-이상-정부지원금-2026년-최신-혜택-총정리-자격-조건부터-모바일-신청-방법까지': '70세-이상-정부지원금-신청',
      '고령자-고용지원금-신청-자격-요건-및-혜택-총정리-모바일-신청-법적-근거-모의': '고령자-고용지원금-신청가이드',
      '고령자-운전면허-반납-혜택-총정리-자격-요건부터-10만-원-지원금-및-대리-신청-ᄇ': '고령자-운전면허-반납혜택',
      '공무원연금-기초연금-중복-수령-가능할까-자격-조건과-2026년-최신-기준-완벽-총': '공무원연금-기초연금-중복수령',
      '공무원연금-기초연금-중복-수령-가능할까-자격-조건부터-신청-방법까지-총정': '공무원연금-기초연금-중복신청',
      '국민연금-납부액-조회-방법-및-예상-수령액-확인-모바일방문-신청-완벽-정': '국민연금-납부액-조회방법',
      '국민연금-예상수령액-계산기-및-스마트폰-조회-신청-방법-총정리-2026년-최신-기ᄌ': '국민연금-예상수령액-조회',
      '국민연금-추납-제도-신청-방법-총정리-자격-요건부터-예상-수령액-시뮬레이션': '국민연금-추납제도-신청가이드',
      '기초생활수급자-노인-혜택-2026년-최신-정리-자격-요건부터-모바일-신청-방법까지-초': '기초수급자-노인혜택-총정리',
      '기초연금-소득인정액-계산법-총정리-내-재산으로-얼마-받나-2026년-최신-자격-혜택': '기초연금-소득인정액-계산법',
      '기초연금-신청서류-준비-완벽-가이드-서류-목록-자격-조건-및-온라인방문-신청': '기초연금-신청서류-준비가이드',
      '노령연금-기초연금-차이-완벽-정리-자격-요건부터-중복-수령-여부까지-한눈에-확': '노령연금-기초연금-차이비교',
      '노인-바우처-카드-신청-자격부터-혜택까지-한눈에-보기-시니어-복지-혜택-놓치지-마십ᄉ': '노인-바우처-카드-신청혜택',
      '노인-통신비-할인-신청-방법-가이드-자격-요건부터-스마트폰-신청까지-완벽-정ᄅ': '노인-통신비-할인-신청가이드',
      '농촌-고령층-지원금-신청-자격과-혜택-최대-금액-받는-방법-및-모의-계산-총저': '농촌-고령층-지원금-혜택',
      '만-65세-혜택-기초연금-자격-조건부터-신청-방법까지-총정리-놓치면-손해보는-매ᄋ': '만-65세-기초연금-신청자격',
      '지자체-장수수당-신청-자격-및-금액-총정리-부모님을-위한-매달-받는-효도-지원ᄀ': '지자체-장수수당-신청자격',
      '퇴직자-정부지원금-종류-완벽-정리-2026년-최신-자격-조건부터-모바일-신청-방법까': '퇴직자-정부지원금-종류',
      '국민연금-납부액-조회-방법-및-예상-수령액-확인하기-모바일pc-간편-신청': '국민연금-납부액-모바일조회',
      '국민연금-수령나이-조회-및-신청-방법-총정리-내가-받을-금액과-시기는': '국민연금-수령나이-신청방법',
      '국민연금-조기수령-불이익-4가지와-손해-안-보는-신청-자격-조건-총정리': '국민연금-조기수령-불이익정리',
      '기초연금-감액-조건-완벽-정리-내가-받는-금액이-줄어드는-진짜-이유': '기초연금-감액조건-이유정리',
      '기초연금-모의계산-방법-및-자격-조건-5분-만에-예상-수령액-확인하는-법': '기초연금-모의계산-수령액확인',
      '기초연금-재산-기준-및-자격-조건-총정리-내-재산으로-얼마까지-받을-수-있을까': '기초연금-재산기준-자격조건',
      '노령연금-수급자격-및-신청방법-놓치면-손해-보는-2026년-최신-기준-총정리': '노령연금-수급자격-신청총정리',
      '노령연금-중도-해지-수령-가능한가요-자격-요건부터-대체-방안까지-완벽-정리': '노령연금-중도해지-수령가능여부',
      '노인-긴급지원금-자격-조건-및-신청-방법-총정리-2026년-최신-가이드': '노인-긴급지원금-자격신청',
      '만-65세-혜택-기초연금-자격요건부터-신청방법까지-완벽-정리-가이드': '만-65세-기초연금-자격가이드',
      '부부-기초연금-감액-기준과-2026년-수령액-계산법-총정리': '부부-기초연금-감액기준',
      '사학연금-기초연금-수급자격-완벽-정리-퇴직-교직원도-33만-원-받을-수-있을까': '사학연금-기초연금-수급자격',
      '시니어-정부보조금-조회-신청-방법-및-숨은-지원금-혜택-총정리': '시니어-정부보조금-조회신청',
      '어르신-교통카드-발급처-신청-자격-및-혜택-완벽-정리-2026년-최신': '어르신-교통카드-신청혜택',
      '조기노령연금-수령-조건-및-손해-보지-않는-신청-방법-완벽-정리': '조기노령연금-수령조건-신청',
      '차상위계층-노인-혜택-완벽-정리-자격-요건부터-월-최대-지원금-신청-방법까지': '차상위계층-노인-혜택정리'
    };

    if (filenameAbbrMap[cleanSlugKeyword]) {
      cleanSlugKeyword = filenameAbbrMap[cleanSlugKeyword];
    } else if (cleanSlugKeyword.length > 25) {
      cleanSlugKeyword = cleanSlugKeyword.substring(0, 22);
    }
    
    const isDuplicate = writtenFiles.some(file => {
      const fileNFC = file.normalize('NFC');
      return fileNFC === (cleanSlugKeyword + '.md') || fileNFC.includes(cleanSlugKeyword);
    });

    if (isDuplicate) {
      console.log(`⏩ 중복 스킵: "${keyword}" 키워드는 이미 작성된 기사가 있습니다.`);
      continue;
    }

    console.log(`\n=========================================`);
    console.log(`🚀 [기사 자동 발행 ${++count}] 키워드: "${keyword}" | 카테고리: "${category}"`);
    console.log(`=========================================`);

    try {
      // Run publish.js with the target keyword and category
      const command = `node publish.js --keyword="${keyword}" --category="${category}"`;
      execSync(command, { stdio: 'inherit', cwd: __dirname });
      
      console.log(`✅ 성공적으로 발행 완료 및 푸시되었습니다!`);
      
      // Respectful delay of 15 seconds to avoid Gemini API rate limits (RPM)
      console.log("⏱️ API 속도 제한 방지를 위해 15초간 대기합니다...");
      await new Promise(resolve => setTimeout(resolve, 15000));
    } catch (err) {
      console.error(`❌ "${keyword}" 발행 중 오류 발생:`, err.message);
      // Short delay on error before retrying next one
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }

  console.log(`\n🎉 모든 키워드 배치 발행이 최종 완료되었습니다! 총 ${count}개 발행.`);
}

runBatch().catch(console.error);
