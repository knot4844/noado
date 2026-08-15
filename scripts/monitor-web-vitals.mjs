import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');
const layoutPath = path.join(__dirname, '..', 'src', 'layouts', 'BlogPostLayout.astro');
const reportPath = path.join(__dirname, '..', 'scratch', 'web_vitals_report.json');

/**
 * Core Web Vitals 및 성능 지표 모의 스캔 함수
 */
function scanPerformanceMetrics(filename, content, hasGlobalTableScroll) {
  const issues = [];
  let score = 100;

  // 1. LCP (Largest Contentful Paint) 위험 요소 분석
  const hasJpgOrPng = content.includes('.png') || content.includes('.jpg') || content.includes('.jpeg');
  if (hasJpgOrPng) {
    score -= 5; // 완화
    issues.push({
      metric: "LCP",
      severity: "WARNING",
      message: "비압축 이미지 포맷(.png, .jpg)이 사용되었습니다. 로딩 지연을 최소화하기 위해 WebP 또는 AVIF 이미지 포맷 전환을 권장합니다."
    });
  }

  // 2. CLS (Cumulative Layout Shift) 위험 요소 분석
  const hasVideo = content.includes('<video');
  const hasVideoStyle = content.includes('width=') || content.includes('style=') || content.includes('class="video-container"');
  if (hasVideo && !hasVideoStyle) {
    score -= 15;
    issues.push({
      metric: "CLS",
      severity: "ERROR",
      message: "비디오 엘리먼트에 고정 영역 비율이 설정되지 않아 렌더링 중 레이아웃 시프트가 발생할 수 있습니다."
    });
  }

  // 3. FID / TBT (First Input Delay / Total Blocking Time) 위험 요소 분석
  const scriptBlocks = (content.match(/<script/g) || []).length;
  if (scriptBlocks > 3) {
    score -= 10;
    issues.push({
      metric: "FID / TBT",
      severity: "WARNING",
      message: `본문 내에 script 블록이 과도하게 배치되었습니다 (현재: ${scriptBlocks}개). 메인 스레드 블로킹 방지를 위해 외부 파일화 또는 지연(defer) 로드를 수행하세요.`
    });
  }

  // 4. 모바일 가독성 및 SEO
  // 글로벌 레이아웃에서 이미 table에 scroll을 지원하고 있는지 체크
  const hasTable = content.includes('|');
  const hasTableWrapper = content.includes('table-wrapper') || content.includes('overflow-x') || hasGlobalTableScroll;
  
  if (hasTable && !hasTableWrapper) {
    score -= 15;
    issues.push({
      metric: "Mobile Usability",
      severity: "ERROR",
      message: "표(Table)가 반응형 래퍼 컨테이너 없이 삽입되었습니다. 모바일 뷰포트에서 잘림 현상이 우려됩니다."
    });
  }

  // 글자 수 크기 체크 (어르신 대활자 가독성)
  const hasBadFontStyling = content.includes('font-size: 12px') || content.includes('font-size: 14px');
  if (hasBadFontStyling) {
    score -= 10;
    issues.push({
      metric: "Accessibility",
      severity: "WARNING",
      message: "시니어 모바일 화면 가독성에 부적합한 초소형 폰트(12~14px) 스타일 하드코딩이 감지되었습니다."
    });
  }

  return {
    score: Math.max(score, 0),
    issues
  };
}

async function main() {
  console.log("⚡ [Core Web Vitals 및 성능 상태 자동 스캔]을 구동합니다...");

  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 기사 경로가 확인되지 않습니다.");
    return;
  }

  // 글로벌 레이아웃의 테이블 반응형 스크롤 CSS 존재 여부 검사
  let hasGlobalTableScroll = false;
  if (fs.existsSync(layoutPath)) {
    const layoutContent = fs.readFileSync(layoutPath, 'utf-8');
    if (layoutContent.includes('overflow-x: auto') && layoutContent.includes('.post-content :global(table)')) {
      hasGlobalTableScroll = true;
      console.log("ℹ️ 레이아웃 단의 글로벌 테이블 가로 스크롤 CSS 규칙을 확인했습니다 (Mobile Usability 패스 예정).");
    }
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const totalReports = [];
  let aggregateScore = 0;

  files.forEach(file => {
    const content = fs.readFileSync(path.join(postsDir, file), 'utf-8');
    const scan = scanPerformanceMetrics(file, content, hasGlobalTableScroll);
    
    totalReports.push({
      filename: file,
      score: scan.score,
      issues: scan.issues
    });

    aggregateScore += scan.score;
  });

  totalReports.sort((a, b) => a.score - b.score);

  console.log("\n==================================================");
  console.log("📈 [블로그 성능 리포트 집계]");
  console.log(`- 전체 스캔 페이지: ${files.length}개`);
  console.log(`- 평균 추정 웹성능 지표: ${(aggregateScore / files.length).toFixed(1)}점 (목표: 90점 이상)`);
  console.log("==================================================\n");

  console.log("🚨 [성능 최적화 경고 목록] (우선 처리 대상)");
  let warningCount = 0;
  totalReports.forEach(rep => {
    if (rep.issues.length > 0 && warningCount < 5) {
      console.log(`* [성능점수: ${rep.score}점] - ${rep.filename}`);
      rep.issues.forEach(iss => {
        console.log(`  [${iss.metric}] (${iss.severity}) ${iss.message}`);
      });
      console.log();
      warningCount++;
    }
  });

  fs.writeFileSync(reportPath, JSON.stringify(totalReports, null, 2), 'utf-8');
  console.log(`💾 Core Web Vitals 모니터링 분석결과가 기록되었습니다: ${reportPath}`);
}

main().catch(console.error);
