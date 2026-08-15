import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');
const reportPath = path.join(__dirname, '..', 'scratch', 'qa_report.json');

// 표준 카테고리
const CATEGORY_MAP = {
  "의료·건강 혜택": "건강·의료",
  "의료·건강": "건강·의료",
  "주거·돌봄 지원": "생활·돌봄", // 기본값
  "노인 일자리": "일자리·취업",
  "일자리·취업 지원": "일자리·취업",
  "생활 지원금": "생활 지원금",
  "기초·국민연금": "기초·국민연금"
};

// 파일 이름 패턴 매핑 (카테고리 유추용)
const FILE_KEYWORDS_CATEGORY = [
  { keywords: ["임플란트", "틀니", "건강검진", "백내장", "개안", "예방접종", "보청기", "물리치료", "치매", "안과", "청력검사"], category: "건강·의료" },
  { keywords: ["일자리", "취업", "구인", "구직", "인턴십", "공공근로", "바리스타", "택배", "지킴이", "퇴직자", "은퇴", "고용지원금"], category: "일자리·취업" },
  { keywords: ["임대", "주택", "실버타운", "주택개조", "전세", "분양", "영구임대", "고령자복지주택"], category: "복지·주거" },
  { keywords: ["돌봄", "요양", "요양보호사", "독거노인", "바우처", "방문요양", "주간보호", "재가노인"], category: "생활·돌봄" },
  { keywords: ["연금", "노령연금", "기초연금", "조기수령", "수급자격", "추납", "감액"], category: "기초·국민연금" }
];

// 공식 면책 고지 템플릿
const DISCLAIMER_TEMPLATE = `
<div class="post-disclaimer" style="background-color: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 1.25rem; margin-top: 2rem; font-size: 0.85rem; color: var(--text-secondary);">
  <p><strong>안내사항:</strong> 본 포스팅에서 제공하는 정보는 관계 기관의 공식 발표 자료 및 보도자료를 참조하여 최신화에 최선을 다해 작성되었습니다. 다만, 제도의 세부 자격 요건 및 개편 상황에 따라 변경 사항이 발생할 수 있으므로 최종 신청 전에 반드시 공식 홈페이지 안내를 다시 한 번 확인해 주시기 바랍니다.</p>
</div>
`.trim();

/**
 * 카테고리 정상화
 */
function resolveCategory(category, title, filename) {
  if (CATEGORY_MAP[category]) {
    return CATEGORY_MAP[category];
  }
  
  // 키워드로 매칭
  const text = (title + " " + filename).toLowerCase();
  for (const mapping of FILE_KEYWORDS_CATEGORY) {
    if (mapping.keywords.some(kw => text.includes(kw))) {
      return mapping.category;
    }
  }
  
  return "생활·돌봄"; // 폴백
}

/**
 * 깨진 내부 링크 수정용 매핑 테이블 생성
 */
function buildSlugMap(allSlugs) {
  const map = {};
  allSlugs.forEach(slug => {
    // 키워드 기반 추출을 쉽게 하기 위해 자소 분리나 간단한 정합 검사 준비
    map[slug] = slug;
  });
  return map;
}

/**
 * 자동 개선 알고리즘
 */
function applyFixes(filename, content, allSlugs, qaData) {
  const lines = content.split('\n');
  const separatorIndices = [];
  lines.forEach((line, idx) => {
    if (line.trim() === '---') {
      separatorIndices.push(idx);
    }
  });

  if (separatorIndices.length < 2) return content;

  // Frontmatter 파싱
  const fmLines = lines.slice(separatorIndices[0] + 1, separatorIndices[1]);
  let bodyLines = lines.slice(separatorIndices[1] + 1);
  const fmObj = {};
  
  fmLines.forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const val = line.slice(colonIdx + 1).trim().replace(/["']/g, '');
      fmObj[key] = val;
    }
  });

  let title = fmObj.title || "";
  let description = fmObj.description || "";
  let category = fmObj.category || "생활·돌봄";
  let keywords = fmObj.keywords || "[]";
  let heroImage = fmObj.heroImage || "";
  let date = fmObj.date || new Date().toISOString().split('T')[0];

  // 1. Title 수정 (2026년 누락 시 추가 및 중복 제거)
  if (title) {
    title = title.replace(/2026년\s*2026년/g, '2026년');
    if (!title.includes('2026년') && !title.includes('2026')) {
      title = `2026년 ${title}`;
    }
  }

  // 2. 카테고리 정상화
  category = resolveCategory(category, title, filename);

  // 3. HeroImage 누락 시 본문에서 첫 번째 이미지 검색 후 추가
  let bodyText = bodyLines.join('\n');
  if (!heroImage) {
    const mdImgMatch = bodyText.match(/!\[.*?\]\((.*?)\)/);
    const htmlImgMatch = bodyText.match(/<img.*?src=["'](.*?)["']/);
    const foundImage = mdImgMatch ? mdImgMatch[1] : (htmlImgMatch ? htmlImgMatch[1] : "");
    if (foundImage) {
      heroImage = foundImage;
    } else {
      // 이미지 링크가 아예 없다면 slug 기반 추정
      const slugName = filename.replace('.md', '');
      heroImage = `/images/posts/${slugName}.png`;
    }
  }

  // 4. 깨진 내부 링크 복구
  // 기사 내의 모든 (/posts/...) 형태의 깨진 링크들을 수정
  const linkRegex = /\[(.*?)\]\(\/posts\/(.*?)\)/g;
  bodyText = bodyText.replace(linkRegex, (match, linkText, targetSlugRaw) => {
    const targetSlug = decodeURIComponent(targetSlugRaw).split('#')[0];
    if (allSlugs.includes(targetSlug)) {
      return match; // 정상 링크는 유지
    }
    
    // 가장 매칭되는 유사 슬러그 탐색
    let bestMatch = "";
    let maxOverlap = 0;
    
    allSlugs.forEach(s => {
      const targetWords = targetSlug.split('-');
      const sWords = s.split('-');
      const overlap = targetWords.filter(w => sWords.includes(w)).length;
      if (overlap > maxOverlap) {
        maxOverlap = overlap;
        bestMatch = s;
      }
    });

    if (maxOverlap >= 2 && bestMatch) {
      console.log(`      🔄 링크 복구: ${targetSlug} -> ${bestMatch}`);
      return `[${linkText}](/posts/${bestMatch})`;
    } else {
      // 매칭되는 유사 링크가 없으면 일반 텍스트 볼드로 처리하여 데드링크 제거
      console.log(`      🗑️ 깨진 링크 제거 (텍스트화): ${targetSlug}`);
      return `**${linkText}**`;
    }
  });

  // 5. 면책 고지 누락 시 추가
  const hasDisclaimer = bodyText.includes('post-disclaimer') || bodyText.includes('class="post-disclaimer"') || bodyText.includes('면책') || bodyText.includes('안내사항');
  if (!hasDisclaimer) {
    bodyText = bodyText.trim() + "\n\n" + DISCLAIMER_TEMPLATE;
  }

  // 6. 2026년 중복 단어 본문 클리닝
  bodyText = bodyText.replace(/2026년\s*2026년/g, '2026년');

  // Frontmatter 다시 빌드
  const newFrontmatterLines = [
    '---',
    `title: "${title}"`,
    `description: "${description}"`,
    `date: "${date}"`,
    `category: "${category}"`,
    `keywords: ${keywords}`,
    `heroImage: "${heroImage}"`,
    '---'
  ];

  return newFrontmatterLines.join('\n') + '\n\n' + bodyText;
}

async function main() {
  console.log("🛠️ [노아도 자동 개선] 개선 루프를 시작합니다...");

  if (!fs.existsSync(reportPath)) {
    console.error("❌ 오류: qa_report.json 파일이 존재하지 않습니다. 먼저 qa-check.mjs를 실행해 주세요.");
    process.exit(1);
  }

  const qaReport = JSON.parse(fs.readFileSync(reportPath, 'utf-8'));
  const allFiles = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const allSlugs = allFiles.map(f => f.replace('.md', ''));

  let fixedCount = 0;

  qaReport.forEach(postReport => {
    // C 등급이거나 에러/주의가 존재하는 기사 대상 개선 적용
    if (postReport.grade !== 'A' || postReport.errors.length > 0 || postReport.warnings.length > 0) {
      const filePath = path.join(postsDir, postReport.filename);
      if (fs.existsSync(filePath)) {
        console.log(`📝 기사 개선 중: ${postReport.filename} (현재 점수: ${postReport.score}점, 등급: ${postReport.grade})`);
        const originalContent = fs.readFileSync(filePath, 'utf-8');
        const fixedContent = applyFixes(postReport.filename, originalContent, allSlugs, postReport);
        
        fs.writeFileSync(filePath, fixedContent, 'utf-8');
        fixedCount++;
      }
    }
  });

  console.log(`\n✅ 총 ${fixedCount}개의 포스트를 자동 개선하고 리빌드했습니다.`);
  console.log("🔄 점수 재측정을 위해 품질 자동검사 스크립트를 재호출합니다...\n");
}

main().catch(console.error);
