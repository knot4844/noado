import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');

// 허용된 카테고리 목록
const ALLOWED_CATEGORIES = [
  "기초·국민연금",
  "건강·의료",
  "일자리·취업",
  "복지·주거",
  "생활·돌봄",
  "생활 지원금" // 기존 포스트에서 사용 중인 경우 허용
];

// 공식 출처 도메인 키워드
const OFFICIAL_SOURCES = [
  "mohw.go.kr",
  "nps.or.kr",
  "gov.kr",
  "bokjiro.go.kr",
  "nhis.or.kr",
  "hira.or.kr",
  "work.go.kr"
];

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
      let value = line.slice(colonIdx + 1).trim();
      
      // 따옴표 제거 및 배열 파싱
      if (value.startsWith('[') && value.endsWith(']')) {
        try {
          // 간이 배열 파싱: [a, b, c] -> ["a", "b", "c"]
          value = value.slice(1, -1).split(',').map(item => item.trim().replace(/["']/g, ''));
        } catch (e) {
          value = [];
        }
      } else {
        value = value.replace(/["']/g, '');
      }
      frontmatter[key] = value;
    }
  });
  
  return { frontmatter, body };
}

/**
 * 기사 품질 자동 검사 함수
 */
function checkQuality(filename, content, allSlugs) {
  const { frontmatter, body } = parseMarkdown(content);
  const slug = getSlug(filename);
  
  let score = 0;
  const passed = [];
  const warnings = [];
  const errors = [];

  // ==========================================
  // 1. Frontmatter 검사 (30점)
  // ==========================================
  
  // Title 검사 (10점)
  const title = frontmatter.title || "";
  if (!title) {
    errors.push("Frontmatter: title이 존재하지 않습니다.");
  } else {
    // 2026년 포함 여부
    const hasYear = title.includes("2026년") || title.includes("2026");
    const hasDoubleYear = /2026년?\s*2026년?/.test(title);
    
    if (title.length >= 10 && title.length <= 65) {
      score += 4;
      passed.push(`Title: 적절한 제목 길이 (${title.length}자)`);
    } else {
      warnings.push(`Title: 제목 길이가 권장 범위를 벗어남 (현재 ${title.length}자, 권장 10~65자)`);
    }

    if (hasYear && !hasDoubleYear) {
      score += 6;
      passed.push("Title: '2026년' 연도 표기 정상");
    } else if (hasDoubleYear) {
      errors.push("Title: '2026년' 연도가 중복 표기되었습니다.");
    } else {
      warnings.push("Title: '2026년' 연도가 누락되었습니다.");
    }
  }

  // Description 검사 (5점)
  const desc = frontmatter.description || "";
  if (!desc) {
    errors.push("Frontmatter: description이 존재하지 않습니다.");
  } else {
    if (desc.length >= 80 && desc.length <= 170) {
      score += 5;
      passed.push(`Description: 적절한 메타 설명 길이 (${desc.length}자)`);
    } else {
      warnings.push(`Description: 메타 설명 길이가 권장 범위를 벗어남 (현재 ${desc.length}자, 권장 80~170자)`);
      score += 2;
    }
  }

  // Category 검사 (5점)
  const category = frontmatter.category || "";
  if (!category) {
    errors.push("Frontmatter: category가 존재하지 않습니다.");
  } else {
    if (ALLOWED_CATEGORIES.includes(category)) {
      score += 5;
      passed.push(`Category: 허용된 카테고리 (${category})`);
    } else {
      errors.push(`Category: 정의되지 않은 카테고리 사용됨 (${category})`);
    }
  }

  // Keywords 검사 (5점)
  const keywords = frontmatter.keywords || [];
  if (!keywords || keywords.length === 0) {
    errors.push("Frontmatter: keywords가 존재하지 않거나 빈 배열입니다.");
  } else {
    if (keywords.length >= 3) {
      score += 5;
      passed.push(`Keywords: 키워드 갯수 충분 (${keywords.length}개)`);
    } else {
      warnings.push(`Keywords: 키워드 개수가 부족함 (현재 ${keywords.length}개, 권장 3개 이상)`);
      score += 3;
    }
  }

  // 대표 이미지 파일 검사 (5점)
  const heroImage = frontmatter.heroImage || "";
  if (!heroImage) {
    // 본문 상단에 직접 삽입된 이미지 태그 검색
    const mdImgMatch = body.match(/!\[.*?\]\((.*?)\)/);
    const htmlImgMatch = body.match(/<img.*?src=["'](.*?)["']/);
    const resolvedHero = heroImage || (mdImgMatch ? mdImgMatch[1] : (htmlImgMatch ? htmlImgMatch[1] : ""));
    
    if (resolvedHero) {
      warnings.push(`HeroImage: Frontmatter에 heroImage 속성이 누락되었으나 본문에 이미지가 감지됨 (${resolvedHero})`);
      score += 3;
    } else {
      errors.push("HeroImage: 대표 이미지가 Frontmatter 및 본문 상단에 존재하지 않습니다.");
    }
  } else {
    // /public 생략 후 파일 존재 여부 확인
    const relativeImagePath = heroImage.replace(/^\/images/, 'images');
    const fullImagePath = path.join(__dirname, '..', 'public', relativeImagePath);
    if (fs.existsSync(fullImagePath)) {
      score += 5;
      passed.push(`HeroImage: 이미지 파일 확인 완료 (${heroImage})`);
    } else {
      errors.push(`HeroImage: 지정된 이미지 파일이 public 폴더에 존재하지 않습니다 (${heroImage})`);
    }
  }

  // ==========================================
  // 2. 가독성 및 UI/UX 구조화 검사 (25점)
  // ==========================================
  
  // 조건 요약 비교 표 (10점)
  const hasTable = body.includes('|') && body.split('\n').some(line => line.trim().startsWith('|') && line.includes('---'));
  if (hasTable) {
    score += 10;
    passed.push("가독성: 조건 요약 비교 표(Table) 포함");
  } else {
    warnings.push("가독성: 조건 요약 비교 표가 누락되었습니다.");
  }

  // 세부 목록 사용 (5점)
  const hasList = body.split('\n').some(line => line.trim().startsWith('*') || line.trim().startsWith('-') || /^\d+\./.test(line.trim()));
  if (hasList) {
    score += 5;
    passed.push("가독성: 세부 목록(List) 사용 확인");
  } else {
    warnings.push("가독성: 목록 구조(*, -, 1.)가 보이지 않습니다.");
  }

  // 본문 15초 요약 동영상 연동 여부 (10점)
  const hasVideoSection = body.includes('class="post-video-section"') && body.includes('<video');
  if (hasVideoSection) {
    score += 10;
    passed.push("가독성: 15초 요약 동영상 컴포넌트 탑재");
  } else {
    warnings.push("가독성: 15초 요약 동영상 영역이 없습니다.");
  }

  // ==========================================
  // 3. 애드센스 및 CTA 최적화 (20점)
  // ==========================================
  
  // 광고 배치 갯수 검사 (10점)
  const adCount = (body.match(/class="adsense-container/g) || []).length;
  if (adCount >= 2) {
    score += 10;
    passed.push(`수익화: 광고 컨테이너 충분히 배치됨 (개수: ${adCount})`);
  } else if (adCount === 1) {
    score += 5;
    warnings.push("수익화: 광고 컨테이너가 1개만 배치되어 있습니다 (2개 이상 권장)");
  } else {
    errors.push("수익화: 광고 컨테이너(class=\"adsense-container\")가 누락되었습니다.");
  }

  // 프리미엄 CTA 버튼 검사 (10점)
  const hasCta = body.includes('class="ctr-button"');
  const isPremiumCta = hasCta && !body.includes('바로가기"');
  
  if (isPremiumCta) {
    score += 10;
    passed.push("수익화: 행동 촉구형 프리미엄 CTA 버튼 구성 완료");
  } else if (hasCta) {
    score += 5;
    warnings.push("수익화: 단순 바로가기형 CTA 버튼이 적용되어 있습니다 (클릭 유도 문구 강화 권장)");
  } else {
    errors.push("수익화: 행동 촉구형 CTA 버튼(class=\"ctr-button\")이 누락되었습니다.");
  }

  // ==========================================
  // 4. E-E-A-T 및 신뢰성 / 링크 검사 (25점)
  // ==========================================
  
  // FAQ 구성 여부 (5점)
  const hasFaq = body.toLowerCase().includes('faq') || body.includes('자주 묻는 질문') || body.includes('자주 묻는 질문(faq)');
  if (hasFaq) {
    score += 5;
    passed.push("신뢰성: FAQ(자주 묻는 질문) 구성 확인");
  } else {
    warnings.push("신뢰성: FAQ(자주 묻는 질문) 세션이 누락되었습니다.");
  }

  // 면책 고지 안내 박스 (10점)
  const hasDisclaimer = body.includes('class="post-disclaimer"') || body.includes('post-disclaimer') || body.includes('면책') || body.includes('안내사항');
  if (hasDisclaimer) {
    score += 10;
    passed.push("신뢰성: 면책 고지 및 정보 출처 안내사항 포함");
  } else {
    errors.push("신뢰성: 공식 면책 고지 안내 상자(class=\"post-disclaimer\")가 누락되었습니다.");
  }

  // 공식 출처 도메인 링크 확인 (5점)
  const hasOfficialSource = OFFICIAL_SOURCES.some(source => body.includes(source));
  if (hasOfficialSource) {
    score += 5;
    passed.push("신뢰성: 정부/공식 기관 출처 도메인 언급 확인");
  } else {
    warnings.push("신뢰성: 공신력 있는 공식 도메인 출처(gov.kr 등) 언급이 보이지 않습니다.");
  }

  // 내부 링크 개수 및 유효성 (5점)
  const linkMatches = body.match(/\[.*?\]\(\/posts\/(.*?)\)/g) || [];
  let validLinkCount = 0;
  let brokenLinks = [];
  
  linkMatches.forEach(linkStr => {
    const slugMatch = linkStr.match(/\[.*?\]\(\/posts\/(.*?)\)/);
    if (slugMatch && slugMatch[1]) {
      const targetSlug = decodeURIComponent(slugMatch[1]).split('#')[0];
      if (allSlugs.includes(targetSlug) || allSlugs.includes(targetSlug + '.md')) {
        validLinkCount++;
      } else {
        brokenLinks.push(targetSlug);
      }
    }
  });

  if (brokenLinks.length > 0) {
    errors.push(`내부링크: 깨진 내부 링크가 존재합니다 (${brokenLinks.join(', ')})`);
  }

  if (validLinkCount >= 3) {
    score += 5;
    passed.push(`내부링크: 유효한 내부 링크 충분 (${validLinkCount}개)`);
  } else if (validLinkCount > 0) {
    score += 2;
    warnings.push(`내부링크: 내부 링크 개수 부족 (현재 ${validLinkCount}개, 권장 3개 이상)`);
  } else {
    warnings.push("내부링크: 유효한 내부 링크가 전혀 존재하지 않습니다.");
  }

  // 등급 산정
  let grade = "D";
  if (score >= 90 && errors.length === 0) grade = "A";
  else if (score >= 75 && errors.length <= 2) grade = "B";
  else if (score >= 60) grade = "C";

  return {
    filename,
    score,
    grade,
    passed,
    warnings,
    errors
  };
}

/**
 * 메인 실행 함수
 */
async function main() {
  console.log("🔍 [노아도 품질 자동검사] 포스트 디렉토리 스캔을 시작합니다...");
  
  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 포스트 디렉토리가 존재하지 않습니다:", postsDir);
    process.exit(1);
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const allSlugs = files.map(getSlug);
  
  console.log(`📄 스캔 대상 포스트 수: ${files.length}개\n`);
  
  const results = [];
  let totalScore = 0;
  const gradeCounts = { A: 0, B: 0, C: 0, D: 0 };

  files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const result = checkQuality(file, content, allSlugs);
    results.push(result);
    
    totalScore += result.score;
    gradeCounts[result.grade]++;
  });

  // 결과 정렬: 점수 낮은 순 (우선 수정 필요 대상)
  results.sort((a, b) => a.score - b.score);

  console.log("==================================================");
  console.log("📊 [품질 자동검사 통계]");
  console.log(`- 전체 기사 수: ${files.length}개`);
  console.log(`- 평균 품질 점수: ${(totalScore / files.length).toFixed(1)}점`);
  console.log(`- 등급 분포: A등급 ${gradeCounts.A}개, B등급 ${gradeCounts.B}개, C등급 ${gradeCounts.C}개, D등급 ${gradeCounts.D}개`);
  console.log("==================================================\n");

  console.log("🚨 [우선 조치 필요 기사 TOP 10] (점수 낮은 순)");
  results.slice(0, 10).forEach((res, i) => {
    console.log(`${i + 1}. [${res.grade}등급 - ${res.score}점] ${res.filename}`);
    if (res.errors.length > 0) {
      console.log(`   ❌ 오류 (${res.errors.length}개):`);
      res.errors.forEach(e => console.log(`      - ${e}`));
    }
    if (res.warnings.length > 0) {
      console.log(`   ⚠️ 주의 (${res.warnings.length}개):`);
      res.warnings.slice(0, 3).forEach(w => console.log(`      - ${w}`));
      if (res.warnings.length > 3) console.log(`      - 외 ${res.warnings.length - 3}개의 주의 사항이 더 있습니다.`);
    }
    console.log();
  });

  // 분석 결과 JSON 파일로 저장 (개선 루프 스크립트에서 참조할 수 있도록)
  const reportPath = path.join(__dirname, '..', 'scratch', 'qa_report.json');
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2), 'utf-8');
  console.log(`💾 전체 상세 리포트가 저장되었습니다: ${reportPath}`);
}

main().catch(console.error);
