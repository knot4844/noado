import { GoogleGenerativeAI } from '@google/generative-ai';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';
import dotenv from 'dotenv';
import { YoutubeTranscript } from '@danielxceron/youtube-transcript';
import { renderPromoVideo } from './render_video.js';

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
      const parts = val.substring(2).split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      args[key] = value;
    }
  });
  return args;
}

const args = getArgs();
const youtubeUrl = args.youtube;
const category = args.category || "생활정보";
let keyword = args.keyword;

if (!keyword && !youtubeUrl) {
  console.log("💡 사용법: node publish.js [--keyword=\"키워드\"] [--youtube=\"유튜브URL\"] [--category=\"카테고리\"]");
  console.log("예: node publish.js --keyword=\"2026년 근로장려금\" --youtube=\"https://www.youtube.com/watch?v=...\"");
  process.exit(0);
}

// Fetch YouTube transcript helper
async function fetchYoutubeTranscript(url) {
  // Extract Video ID
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const match = url.match(regExp);
  const videoId = (match && match[2].length === 11) ? match[2] : null;

  if (videoId) {
    const cachePath = path.join(__dirname, 'public', 'transcripts', `${videoId}.txt`);
    if (fs.existsSync(cachePath)) {
      console.log(`💾 로컬 자막 캐시 발견: ${cachePath}`);
      return fs.readFileSync(cachePath, 'utf-8');
    }
  }

  try {
    console.log(`📡 유튜브 자막 추출 중: ${url}`);
    try {
      const transcript = await YoutubeTranscript.fetchTranscript(url, { lang: 'ko' });
      return transcript.map(t => t.text).join(' ');
    } catch (koErr) {
      console.log(`⚠️ 한국어 자막 추출 실패(또는 없음), 기본 자막으로 재시도...`);
      const transcript = await YoutubeTranscript.fetchTranscript(url);
      return transcript.map(t => t.text).join(' ');
    }
  } catch (err) {
    console.error(`❌ 유튜브 자막 추출 실패:`, err.message);
    return null;
  }
}

// Extract keyword from transcript using Gemini
async function extractKeywordFromTranscript(transcript) {
  if (isDryRun) return "유튜브 자동화 정보";
  try {
    const modelName = process.env.GEMINI_MODEL || "gemini-1.5-pro";
    const model = genAI.getGenerativeModel({ model: modelName });
    const prompt = `다음 유튜브 자막 대본을 읽고, 이 영상을 블로그 글로 작성할 때 가장 알맞은 1개의 네이버/구글 검색용 핵심 목표 키워드(예: "2026년 국민연금 조기수령")만 뽑아서 출력해 주세요. 다른 수식어나 설명 없이 오직 핵심 키워드 단어/문구만 한 줄로 출력해야 합니다.\n\n대본:\n${transcript.substring(0, 3000)}`;
    const result = await model.generateContent(prompt);
    return (await result.response).text().trim().replace(/['"]/g, '');
  } catch (err) {
    return "유튜브 자동화 정보";
  }
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
title: "2026년 기초연금 수급자격 및 어르신 신청 방법 완벽 가이드"
description: "2026년 새로워지는 기초연금의 만 65세 이상 자격 요건, 소득인정액 기준, 모바일 간편 신청 및 동주민센터 방문 신청 방법을 알기 쉽게 정리해 드립니다."
date: "${today}"
category: "${targetCategory}"
keywords: ["기초연금", "어르신복지", "정부지원금", "노령연금"]
---

안녕하세요! 오늘은 어르신들의 든든한 노후 동반자가 되어드리는 **2026년 기초연금 수급자격**에 대해 자세히 설명해 드리겠습니다. 

본 제도는 만 65세 이상 어르신 중 소득 수준이 하위 70% 이하이신 분들을 대상으로 노후 소득을 지원하기 위해 마련된 정부 복지 사업입니다. 올해 변경된 기준액을 면밀히 확인하시어 혜택을 빠짐없이 챙겨 보시기 바랍니다.

<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

## 1. 2026년 기초연금 수급자격 및 소득 기준 요건

기초연금은 국적, 연령, 그리고 가구의 월 소득인정액을 기준으로 최종 결정됩니다. 아래의 기준을 꼼꼼하게 대조해 보십시오.

### 핵심 자격 기준 요약
* **연령 기준**: 만 65세 이상 대한민국 국적을 소지하고 국내에 거주하시는 어르신
* **소득 조건**: 가구별 월 소득인정액이 선정기준액 이하인 분
* **선정기준액**: 단독가구 월 213만 원 이하, 부부가구 월 340만 원 이하

| 가구 구분 | 선정 기준액 (월 소득인정액) | 최대 지원 금액 (월 수령액) |
| :--- | :--- | :--- |
| **단독 가구** | 213만 원 이하 | **월 최대 334,810원** |
| **부부 가구** | 340만 원 이하 | **월 최대 535,690원** |

---

## 2. 모바일 신청 및 행정복지센터 방문 신청 절차

신청은 본인 또는 대리인이 직접 동주민센터(행정복지센터)에 방문하시거나 스마트폰 및 컴퓨터를 활용해 간편하게 접수하실 수 있습니다.

* **준비 서류**: 신분증, 통장 사본, 배우자의 금융정보제공동의서
* **방문 신청**: 주소지 관할 행정복지센터 또는 국민연금공단 지사 방문
* **온라인 신청**: 복지로 홈페이지 또는 스마트폰 복지로 앱 접속 후 본인인증 신청

아래의 버튼을 누르시면 기초연금 공식 신청 및 조회 페이지로 바로 연결됩니다. 클릭하셔서 대상 여부를 손쉽게 확인해 보시기 바랍니다.

<div class="ctr-btn-container"><a href="https://www.bokjiro.go.kr" target="_blank" rel="noopener noreferrer" class="ctr-button">기초연금 수급자격 확인 및 신청 바로가기</a></div>

<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

## 3. 자주 묻는 질문 (FAQ)

### Q1. 국민연금을 받고 있어도 기초연금 신청이 가능한가요?
예, 가능하십니다. 다만 수령하고 계시는 국민연금 액수에 따라 기초연금이 일부 감액될 수 있으므로, 상세 감액 비율은 사전 확인 절차를 거치시는 것을 권장해 드립니다.

### Q2. 부부 중 한 사람만 만 65세 이상인 경우 신청은 어떻게 합니까?
만 65세 이상이 되신 어르신 본인 한 분만 단독으로 신청을 하시면 됩니다. 단, 소득인정액 합산은 부부가구 기준(월 340만 원 이하)으로 심사가 진행됩니다.

### Q3. 거주하고 있는 주택의 가격도 재산에 포함됩니까?
예, 주택 가격 등 일반재산과 금융재산 모두 소득으로 환산하여 소득인정액에 반영됩니다. 다만 거주하시는 지역(대도시, 중소도시, 농어촌)별로 기본재산 공제액이 차등 적용되므로 주소지 기준 공제 혜택을 반드시 적용받으십시오.

상세 문의 사항이 있으신 어르신께서는 보건복지부 콜센터(전화번호: 129) 또는 국민연금공단(전화번호: 1355)으로 전화하시면 친절한 상담원 연결이 가능하십니다. 알찬 혜택을 놓치지 마시고 꼭 신청하셔서 보장받으시길 바랍니다. 감사합니다!
`;
}

/**
 * 1단계: AI를 활용한 SEO 글쓰기 생성
 */
async function generateArticle(targetKeyword, targetCategory, feedback = null, youtubeTranscript = "") {
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
8. 대상 독자층 및 집필 톤앤매너: 본 블로그의 핵심 독자층은 '50대에서 70대의 어르신 및 중장년층'입니다. 따라서 반드시 매우 정중하고 신뢰감을 주는 존댓말 격식체(하십시오체: '~하십시오', '~해 드립니다', '~하기 마련입니다' 등)를 일관되게 적용하여 글을 집필해야 합니다. 또한 어르신들의 시력과 이해도를 돕기 위해 복잡한 관공서 전문 행정 용어는 자상하게 풀어서 풀이하고, 단계별 모바일/온라인 스마트폰 대리 신청법이나 근처 행정복지센터를 직접 방문하는 오프라인 신청 절차 및 준비물 서류 목록을 번호 매기기로 큼직하고 일목요연하게 강조하여 서술해 주십시오.
  `;

  if (youtubeTranscript) {
    prompt += `\n\n[참고 데이터 - 유튜브 영상 자막 스크립트]\n다음은 해당 주제에 대한 유튜브 영상의 실제 대본 자막입니다. 이 자막의 최신 정보(수치, 자격 요건, 절차 등)를 정확하게 활용하여 풍부하고 전문적인 글을 구성해 주세요. 자막 속 실제 정보에 기반해야 하며 거짓 정보(환각)를 작성해서는 안 됩니다:\n\n${youtubeTranscript}`;
  }

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
  let youtubeTranscript = "";
  if (youtubeUrl) {
    youtubeTranscript = await fetchYoutubeTranscript(youtubeUrl);
    if (!youtubeTranscript) {
      console.log("⚠️ 유튜브 자막 추출에 실패하여 일반 웹 검색 및 AI 생성 모드로 전환합니다.");
    } else if (!keyword) {
      console.log("🤖 유튜브 자막 분석 결과로부터 블로그 목표 키워드를 자동 추출하는 중...");
      keyword = await extractKeywordFromTranscript(youtubeTranscript);
      console.log(`🎯 추출된 자동 목표 키워드: "${keyword}"`);
    }
  }

  console.log(`\n📝 키워드 "${keyword}"에 대한 구글 애드센스 최적화 블로그 자동 글쓰기를 시작합니다.`);
  
  let currentArticle = "";
  let feedback = null;
  let attempts = 0;
  const maxAttempts = 3;
  let finalResult = null;

  // 피드백 루프: 90점 이상이 될 때까지 최대 3회 재작성
  while (attempts < maxAttempts) {
    attempts++;
    console.log(`\n🔄 [시도 ${attempts}/${maxAttempts}] 글 생성 및 SEO 진단 중...`);
    
    currentArticle = await generateArticle(keyword, category, feedback, youtubeTranscript);
    const evaluation = evaluateSEO(currentArticle, keyword);
    
    console.log(`\n📊 SEO 자가 진단 결과 (점수: ${evaluation.score}/100)`);
    evaluation.reports.forEach(report => console.log(report));

    if (evaluation.score >= 90) {
      console.log(`\n🎉 통과! SEO 평가 점수가 ${evaluation.score}점으로 기준값(90점) 이상입니다.`);
      finalResult = evaluation.cleanText;
      break;
    } else {
      console.log(`\n⚠️ 경고: 점수가 ${evaluation.score}점으로 기준치(90점) 미달입니다. AI에게 피드백을 전달하여 재작성합니다.`);
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

  // Extract top 3 bullet highlights from the post body for Remotion video props
  const bulletRegex = /^\s*[\-\*]\s+(.+)$/gm;
  const highlights = [];
  let bulletMatch;
  while ((bulletMatch = bulletRegex.exec(finalResult)) !== null && highlights.length < 3) {
    const cleanBullet = bulletMatch[1].replace(/\*\*/g, '').replace(/`/g, '').trim();
    if (cleanBullet.length > 5 && cleanBullet.length < 55) {
      highlights.push(cleanBullet);
    }
  }
  // Fill fallbacks if list items are empty
  while (highlights.length < 3) {
    if (highlights.length === 0) highlights.push("실시간 정부 고시 조건 완벽 정리");
    else if (highlights.length === 1) highlights.push("온라인/모바일 간편 신청 방법 안내");
    else highlights.push("노아도 알짜정책 포털에서 상세 확인");
  }

  console.log("\n🎬 기사 요약 기반 15초 숏츠 홍보 영상(Remotion MP4) 인코딩을 시작합니다...");
  renderPromoVideo(slug, postTitle, highlights);

  // 4단계: 배포 자동화 (Git Push)
  if (process.env.AUTO_DEPLOY === 'true') {
    try {
      console.log("\n📦 자동 배포를 위해 Git Commit & Push 진행 중...");
      execSync('git add .', { cwd: __dirname });
      execSync(`git commit -m "auto: publish post - ${postTitle}"`, { cwd: __dirname });
      execSync('git push', { cwd: __dirname });
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
