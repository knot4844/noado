import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Load environment variables
dotenv.config();
// Fallback to root .env if key is not found
if (!process.env.GEMINI_API_KEY) {
  dotenv.config({ path: path.join(__dirname, '../../.env') });
}

// Check for Gemini API key and determine mode
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const isDryRun = process.argv.includes('--dry-run') || !GEMINI_API_KEY || !GEMINI_API_KEY.startsWith('AIza');

// Initialize Gemini API (only if not in dry-run mode)
let genAI = null;
if (!isDryRun) {
  genAI = new GoogleGenerativeAI(GEMINI_API_KEY);
}

// Helper to parse arguments
function getArgs() {
  const args = {};
  process.argv.slice(2).forEach(val => {
    if (val.startsWith('--')) {
      const [key, value] = val.substring(2).split('=');
      args[key] = value;
    }
  });
  return args;
}

const args = getArgs();
const keyword = args.keyword;
const category = args.category || "생활정보";

if (!keyword) {
  console.log("💡 사용법: node publish.js --keyword=\"키워드\" [--category=\"카테고리\"]");
  console.log("예: node publish.js --keyword=\"2026년 근로장려금 신청\" --category=\"정부지원금\"");
  process.exit(0);
}

// URL/Slug friendly string generator
function getSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

function generateMockArticle(targetKeyword, targetCategory) {
  const today = new Date().toISOString().split('T')[0];
  return `---
title: "2026년 ${targetKeyword} 신청 방법 및 자격 조건 총정리"
description: "2026년 ${targetKeyword}의 지원 자격 요건, 혜택 내용, 신청 일정 및 홈택스/정부24 모바일 간편 신청 방법을 알기 쉽게 설명해 드립니다."
date: "${today}"
category: "${targetCategory}"
keywords: ["${targetKeyword}", "정부지원금", "생활정보", "신청방법"]
---

안녕하세요! 오늘은 많은 분들이 관심을 가지고 기다리시던 **2026년 ${targetKeyword}**에 대해 자세히 알아보겠습니다. 

본 제도는 최근 경제적 상황을 반영하여 지원 한도와 대상이 대폭 변경되었습니다. 내가 조건에 부합하는지, 받을 수 있는 혜택은 무엇인지 아래 상세 내용을 통해 확인해 보시기 바랍니다.

<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

## 1. 2026년 ${targetKeyword} 지원 대상 및 자격 요건

지원 대상은 기본적으로 연령, 소득 및 재산 요건에 의해 결정됩니다.

### 주요 자격 요건
* **연령 기준**: 만 19세 이상 ~ 만 34세 이하 대한민국 국민 (가구 구성에 따라 일부 다름)
* **소득 기준**: 기준 중위소득 150% 이하 가구원
* **재산 기준**: 가구원 전체 합산 재산 가액 2억 4,000만 원 미만

| 지원 구분 | 대상 요건 | 지원 한도액 |
| :--- | :--- | :--- |
| **일반형 지원** | 중위소득 100% 이하 | **월 최대 35만 원** |
| **우대형 지원** | 중위소득 60% 이하 | **월 최대 55만 원** |

---

## 2. 신청 기간 및 방법 안내

신청은 온라인 및 모바일 비대면 창구를 통해 간편하게 진행할 수 있어 대기 시간 없이 즉시 접수가 가능합니다.

* **신청 기간**: 2026년 8월 1일부터 8월 31일까지 (한 달간)
* **신청 방법**: 정부24 홈페이지 또는 국세청 손택스 앱 접속 후 신청서 제출

아래의 버튼을 클릭하시면 공식 신청 페이지로 즉시 연결되어, 자격 확인 및 온라인 접수를 원스톱으로 마칠 수 있습니다.

<div class="ctr-btn-container"><a href="https://www.gov.kr" target="_blank" rel="noopener noreferrer" class="ctr-button">공식 신청 페이지 바로가기</a></div>

<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

## 3. 자주 묻는 질문 (FAQ)

### Q1. 현재 재직 중이 아니어도 신청할 수 있나요?
아닙니다. 근로소득 또는 사업소득 증빙이 가능해야 신청이 가능한 경우가 많으므로 정확한 개별 가이드라인 확인이 필요합니다.

### Q2. 다른 정부 지원금과 동시에 받을 수 있나요?
성격이 중복되는 일부 자금의 경우 중복 수령이 불가능할 수 있으므로, 신청 전 주관 부처 콜센터를 통해 사전 확인을 받아보시는 것이 안전합니다.

### Q3. 심사 결과 통보는 언제쯤 오나요?
접수가 완료된 시점으로부터 통상적으로 약 4주일의 서류 심사 기간을 거쳐, 기재하신 모바일 연락처로 결과 통보가 발송됩니다.

추가적인 상세 질의 사항은 통합 콜센터(전화번호: 120)를 통해 실시간 안내를 받으실 수 있습니다. 오늘의 유용한 정보가 도움이 되셨기를 바라며, 준비된 혜택을 빠짐없이 누려보시기 바랍니다. 감사합니다!
`;
}

/**
 * 1단계: AI를 활용한 SEO 글쓰기 생성
 */
async function generateArticle(targetKeyword, targetCategory, feedback = null) {
  if (isDryRun) {
    console.log(`💡 [데모/드라이런] API 키가 미등록 상태이거나 데모 모드입니다. 고품질 SEO 모의 본문을 자체 생성합니다.`);
    return generateMockArticle(targetKeyword, targetCategory);
  }

  // Use gemini-1.5-pro for high quality structure, fallback to flash if needed
  const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";
  const model = genAI.getGenerativeModel({ model: modelName });
  
  const today = new Date().toISOString().split('T')[0];
  
  let prompt = `
당신은 한국 최고의 구글 애드센스 수익형 블로그 전문 필진이자 SEO(검색엔진 최적화) 전문가입니다.
목표 키워드인 "${targetKeyword}"에 대한 매력적이고 유용하며 상세한 정보성 블로그 글을 작성해 주세요.

[글 작성 지침]
1. 형식: 반드시 마크다운(Markdown) 형식으로 작성해야 하며, 맨 위에는 아래 형식의 YAML Frontmatter를 포함해야 합니다.
---
title: "[키워드가 포함된 클릭을 유도하는 제목]"
description: "[검색 결과에 노출될 120자 내외의 글 요약 설명]"
date: "${today}"
category: "${targetCategory}"
keywords: ["${targetKeyword}", "[연관 키워드 1]", "[연관 키워드 2]", "[연관 키워드 3]"]
---

2. 제목 구조: 소제목을 H2(##), H3(###) 등으로 논리적인 구조를 갖추어 작성하세요. H2 소제목은 최소 3개 이상이어야 합니다.
3. 소득 기준이나 지원 조건 등 금액/대상이 있는 경우 반드시 마크다운 표(Table) 형식을 활용해 한눈에 들어오게 정리하세요.
4. 구글 애드센스 광고 효율을 극대화하기 위해 본문 중간과 본문 하단에 반드시 아래 HTML 광고 컨테이너 코드를 삽입하세요.
광고 컨테이너:
<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

5. 본문 내용 중 사람들이 실제로 신청이나 조회를 위해 이동해야 하는 부분에는 반드시 아래 형식의 고단가 CTR 유도 버튼을 삽입하세요. (예: 신청 홈페이지 바로가기)
버튼 코드 예시 (링크와 텍스트는 키워드에 맞게 수정):
<div class="ctr-btn-container"><a href="[공식 신청 웹사이트 주소 또는 안내 페이지]" target="_blank" rel="noopener noreferrer" class="ctr-button">[버튼 텍스트 바로가기]</a></div>

6. 글자 수: 본문(Frontmatter 제외)은 한글 기준 최소 1,500자 이상의 매우 풍부하고 가치 있는 정보로 채우세요. 단순히 정보를 나열하지 말고, 자격 요건, 신청 기한, 필요 서류, 모바일 신청 방법 등을 매우 상세하고 친절하게 설명해야 구글 애드센스 승인을 통과할 수 있습니다.
7. 글의 마지막에는 항상 자주 묻는 질문(FAQ) 3가지를 정리해 주세요.
  `;

  if (feedback) {
    prompt += `\n\n⚠️ 중요: 이전 작성물에 대해 다음과 같은 피드백이 발생했습니다. 이 사항을 반드시 개선하여 다시 작성해 주세요:\n${feedback}`;
  }

  console.log(`🤖 Gemini API 호출 중 (${modelName})...`);
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text();
}

/**
 * 2단계: 생성된 글의 SEO 품질 자동 평가 (Self-Grading)
 */
function evaluateSEO(articleText, targetKeyword) {
  let score = 0;
  const reports = [];

  // Remove markdown block backticks if AI wrapped the output in ```markdown ... ```
  let cleanText = articleText.replace(/^```markdown\n/, '').replace(/```$/, '').trim();

  // 1. Frontmatter 검사
  const hasFrontmatter = cleanText.startsWith('---') && cleanText.indexOf('---', 3) > 3;
  if (hasFrontmatter) {
    score += 15;
    reports.push("✅ Frontmatter 형식이 올바르게 작성되었습니다. (+15)");
  } else {
    reports.push("❌ Frontmatter가 누락되었거나 형식이 맞지 않습니다.");
  }

  // 2. 제목에 키워드 포함 여부
  const titleMatch = cleanText.match(/title:\s*["']?(.*?)["']?\n/);
  if (titleMatch && titleMatch[1].includes(targetKeyword)) {
    score += 20;
    reports.push(`✅ 제목에 키워드 "${targetKeyword}"가 포함되어 있습니다. (+20)`);
  } else {
    reports.push(`❌ 제목에 키워드 "${targetKeyword}"가 포함되어 있지 않습니다.`);
  }

  // 3. 글자 수 검사 (공백 제외 한글 글자수 대략 측정)
  const bodyContent = cleanText.split('---').slice(2).join('---');
  const charCount = bodyContent.replace(/\s/g, '').length;
  if (charCount >= 1200) {
    score += 20;
    reports.push(`✅ 본문 글자 수(공백 제외)가 ${charCount}자로 충분합니다. (기준 1200자 이상) (+20)`);
  } else {
    reports.push(`❌ 본문 글자 수가 ${charCount}자로 부족합니다. (최소 1200자 필요)`);
  }

  // 4. 소제목 H2 개수 검사
  const h2Count = (bodyContent.match(/^##\s/gm) || []).length;
  if (h2Count >= 3) {
    score += 15;
    reports.push(`✅ H2 소제목이 ${h2Count}개 배치되어 구조가 탄탄합니다. (+15)`);
  } else {
    reports.push(`❌ H2 소제목이 ${h2Count}개로 부족합니다. (최소 3개 이상 권장)`);
  }

  // 5. 애드센스 광고 컨테이너 포함 여부
  const adCount = (bodyContent.match(/class="adsense-container/g) || []).length;
  if (adCount >= 1) {
    score += 15;
    reports.push(`✅ 애드센스 광고 컨테이너가 ${adCount}개 삽입되었습니다. (+15)`);
  } else {
    reports.push("❌ 본문 내 애드센스 광고 영역(adsense-container)이 누락되었습니다.");
  }

  // 6. CTR 버튼 포함 여부
  const hasButton = bodyContent.includes('class="ctr-button"');
  if (hasButton) {
    score += 15;
    reports.push("✅ 클릭률(CTR) 유도 버튼이 삽입되었습니다. (+15)");
  } else {
    reports.push("❌ 클릭률(CTR) 유도 버튼(ctr-button)이 누락되었습니다.");
  }

  return { score, reports, cleanText };
}

/**
 * 메인 실행 엔진 (루프 & 피드백)
 */
async function main() {
  console.log(`\n📝 키워드 "${keyword}"에 대한 구글 애드센스 최적화 블로그 자동 글쓰기를 시작합니다.`);
  
  let currentArticle = "";
  let feedback = null;
  let attempts = 0;
  const maxAttempts = 3;
  let finalResult = null;

  // 피드백 루프: 80점 이상이 될 때까지 최대 3회 재작성
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n🔄 [시도 ${attempts}/${maxAttempts}] 글 생성 및 SEO 진단 중...`);
    
    currentArticle = await generateArticle(keyword, category, feedback);
    const evaluation = evaluateSEO(currentArticle, keyword);
    
    console.log(`\n📊 SEO 자가 진단 결과 (점수: ${evaluation.score}/100)`);
    evaluation.reports.forEach(report => console.log(report));

    if (evaluation.score >= 80) {
      console.log(`\n🎉 통과! SEO 평가 점수가 ${evaluation.score}점으로 기준값(80점) 이상입니다.`);
      finalResult = evaluation.cleanText;
      break;
    } else {
      console.log(`\n⚠️ 경고: 점수가 ${evaluation.score}점으로 기준치(80점) 미달입니다. AI에게 피드백을 전달하여 재작성합니다.`);
      feedback = evaluation.reports.filter(r => r.startsWith('❌')).join('\n');
    }
  }

  if (!finalResult) {
    console.log("\n⚠️ 최대 재작성 횟수를 초과했습니다. 가장 최근 버전으로 저장을 진행합니다.");
    finalResult = currentArticle.replace(/^```markdown\n/, '').replace(/```$/, '').trim();
  }

  // 3단계: 파일 저장
  const postTitle = finalResult.match(/title:\s*["']?(.*?)["']?\n/)?.[1] || keyword;
  const slug = getSlug(postTitle);
  const targetDir = path.join(__dirname, 'src', 'content', 'posts');
  
  if (!fs.existsSync(targetDir)) {
    fs.mkdirSync(targetDir, { recursive: true });
  }

  const filePath = path.join(targetDir, `${slug}.md`);
  fs.writeFileSync(filePath, finalResult, 'utf-8');
  console.log(`\n💾 글 저장 완료: ${filePath}`);

  // 4단계: 배포 자동화 (Git Push)
  if (process.env.AUTO_DEPLOY === 'true') {
    try {
      console.log("\n📦 자동 배포를 위해 Git Commit & Push 진행 중...");
      execSync('git add .', { cwd: path.join(__dirname, '../../') });
      execSync(`git commit -m "auto: publish post - ${postTitle}"`, { cwd: path.join(__dirname, '../../') });
      execSync('git push', { cwd: path.join(__dirname, '../../') });
      console.log("🚀 Git Push 완료! Cloudflare Pages 또는 Vercel이 즉시 빌드 및 배포를 진행합니다.");
    } catch (gitErr) {
      console.error("❌ Git 자동화 오류 (아직 git에 등록되지 않았거나 변경 사항이 없을 수 있습니다):", gitErr.message);
    }
  } else {
    console.log("\n💡 로컬 파일 생성 완료 (AUTO_DEPLOY가 비활성화 상태이므로 수동으로 커밋하거나 테스트해 보세요).");
  }
}

main().catch(err => {
  console.error("❌ 오류 발생:", err);
});
