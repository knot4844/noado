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

    // Normalize keyword to check filename duplicates
    const cleanSlugKeyword = keyword
      .toLowerCase()
      .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s-]/g, '')
      .trim()
      .replace(/\s+/g, '-');
    
    const isDuplicate = writtenFiles.some(file => file.includes(cleanSlugKeyword));
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
