import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');

// 헬퍼: 파일명 슬러그화
function getSlug(filename) {
  return filename.replace('.md', '');
}

/**
 * 마크다운 파일 파싱 (Frontmatter & Body 분리)
 */
function parseMarkdown(content) {
  const parts = content.split('---');
  if (parts.length < 3) {
    return { frontmatter: {}, body: content };
  }
  const rawFrontmatter = parts[1];
  const body = parts.slice(2).join('---').trim();
  
  const frontmatter = {};
  rawFrontmatter.split('\n').forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx !== -1) {
      const key = line.slice(0, colonIdx).trim();
      const value = line.slice(colonIdx + 1).trim().replace(/["']/g, '');
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, body, rawFrontmatter };
}

/**
 * 키워드 오버랩 강도에 근거한 상호 기사 연관도 산출
 */
function calculateRelatedness(postA, postB) {
  if (postA.slug === postB.slug) return 0;
  
  // 카테고리가 일치하면 높은 기본 점수 부여
  let score = (postA.category === postB.category) ? 10 : 0;
  
  const wordsA = postA.title.split(/[\s:,\(\)\[\]]/).filter(w => w.length > 1);
  const wordsB = postB.title.split(/[\s:,\(\)\[\]]/).filter(w => w.length > 1);
  
  const overlap = wordsA.filter(w => wordsB.includes(w)).length;
  score += overlap * 5; // 중복 단어당 가중치
  
  return score;
}

async function main() {
  console.log("🔗 [시리즈 기사 상호 연결 구조 최적화]를 시작합니다...");

  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 포스트 폴더가 없습니다.");
    return;
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const posts = [];

  // 1. 모든 기사 메타데이터 로드
  files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body, rawFrontmatter } = parseMarkdown(content);
    posts.push({
      file,
      slug: getSlug(file),
      title: frontmatter.title || "",
      category: frontmatter.category || "",
      body,
      rawFrontmatter,
      content
    });
  });

  console.log(`📂 총 ${posts.length}개의 포스트 간 연관관계를 분석합니다.`);

  let updatedCount = 0;

  // 2. 기사별 추천 리스트 생성 및 본문 반영
  posts.forEach(targetPost => {
    // 모든 기사와의 연관도 점수 계산
    const scoredList = posts
      .map(p => ({
        slug: p.slug,
        title: p.title,
        score: calculateRelatedness(targetPost, p)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3); // 상위 3개 선별

    if (scoredList.length === 0) return;

    // "연관 정책 안내 시리즈" 위젯 HTML 템플릿 생성
    let seriesHtml = `
\n\n<div class="series-nav-container" style="background: #F8F9FA; border: 1px solid #E9ECEF; border-radius: 16px; padding: 1.5rem; margin: 2.5rem 0;">
  <h4 style="margin-top: 0; color: var(--color-secondary-dark); font-size: 1.15rem; font-weight: bold; border-left: 4px solid var(--color-primary); padding-left: 10px;">💡 함께 읽으면 혜택이 2배가 되는 연관 정책 가이드</h4>
  <ul style="list-style: none; padding-left: 0; margin-bottom: 0;">
`.trim();

    scoredList.forEach(item => {
      seriesHtml += `\n    <li style="margin-bottom: 12px; font-size: 0.95rem;"><a href="/posts/${item.slug}" style="color: var(--color-text); text-decoration: none; font-weight: 500; display: block; padding: 6px 12px; background: white; border-radius: 8px; border: 1px solid #ECECEC; transition: all 0.2s;" onmouseover="this.style.borderColor='var(--color-primary)'; this.style.background='#FFFBF5';" onmouseout="this.style.borderColor='#ECECEC'; this.style.background='white';">👉 ${item.title}</a></li>`;
    });

    seriesHtml += `\n  </ul>\n</div>`;

    // 기존에 심겨있던 시리즈 위젯 영역 제거 후 재생성 (중복 삽입 방지)
    let finalBody = targetPost.body;
    if (finalBody.includes('class="series-nav-container"')) {
      // 기존에 삽입되었던 컨테이너 정규식으로 안전하게 절개
      const startIdx = finalBody.indexOf('<div class="series-nav-container"');
      const endIdx = finalBody.indexOf('</div>', startIdx + 30) + 6;
      if (startIdx !== -1 && endIdx !== -1) {
        finalBody = finalBody.slice(0, startIdx) + finalBody.slice(endIdx);
      }
    }

    // 본문 하단 면책조항 상자 바로 위에 배치
    if (finalBody.includes('class="post-disclaimer"')) {
      finalBody = finalBody.replace(
        `<div class="post-disclaimer"`,
        `${seriesHtml}\n\n<div class="post-disclaimer"`
      );
    } else {
      finalBody = finalBody.trim() + "\n\n" + seriesHtml;
    }

    const finalContent = `---
${targetPost.rawFrontmatter.trim()}
---

${finalBody.trim()}
`;

    const filePath = path.join(postsDir, targetPost.file);
    fs.writeFileSync(filePath, finalContent, 'utf-8');
    updatedCount++;
  });

  console.log(`\n✅ 총 ${updatedCount}개 기사에 상호 연결 시리즈 카드 위젯을 최적화하여 갱신했습니다!`);
}

main().catch(console.error);
