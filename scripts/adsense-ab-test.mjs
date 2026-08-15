import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const layoutPath = path.join(__dirname, '..', 'src', 'layouts', 'BlogPostLayout.astro');
const reportPath = path.join(__dirname, '..', 'scratch', 'ab_test_report.json');

// 모의(Mock) 구글 애널리틱스(GA4) 광고 수익률 성과 데이터
// A군: 상하단 배너 집중형 / B군: 본문 중간 자연스러운 인피드 멀티 삽입형
const MOCK_GA4_REVENUE_DATA = {
  experimentName: "AdSense Placement AB Test 2026",
  variations: {
    A: {
      description: "상단 1개 + 하단 1개 (기본형)",
      pageViews: 12500,
      adClicks: 320,
      ctr: 2.56,
      rpm: 3840, // 1000회 노출당 수익(KRW)
      estimatedRevenue: 48000
    },
    B: {
      description: "상단 1개 + 본문 중간 2개 + 하단 1개 (멀티 인피드형)",
      pageViews: 13100,
      adClicks: 512,
      ctr: 3.91,
      rpm: 5865,
      estimatedRevenue: 76831
    }
  }
};

/**
 * A/B 테스트 분석 및 최적화 결정 알고리즘
 */
function analyzeABTestResults() {
  console.log("📊 [애드센스 A/B 테스트 성과 분석을 구동합니다]");
  
  const data = MOCK_GA4_REVENUE_DATA;
  const varA = data.variations.A;
  const varB = data.variations.B;

  console.log(`\n[대안 A] - ${varA.description}`);
  console.log(`   └─ CTR: ${varA.ctr}%, 예상 수익: ${varA.estimatedRevenue.toLocaleString()}원, RPM: ${varA.rpm}원`);
  console.log(`[대안 B] - ${varB.description}`);
  console.log(`   └─ CTR: ${varB.ctr}%, 예상 수익: ${varB.estimatedRevenue.toLocaleString()}원, RPM: ${varB.rpm}원`);

  let winner = "A";
  let winnerData = varA;
  let improvementRate = 0;

  if (varB.rpm > varA.rpm) {
    winner = "B";
    winnerData = varB;
    improvementRate = ((varB.rpm - varA.rpm) / varA.rpm) * 100;
  }

  console.log(`\n🏆 [분석 완료] 우승 대안: 대안 ${winner} (B군)`);
  console.log(`   └─ 대안 A 대비 수익률(RPM) 개선도: +${improvementRate.toFixed(2)}%`);

  // 분석 리포트 저장
  const report = {
    analyzedAt: new Date().toISOString(),
    winner,
    winnerMetrics: winnerData,
    improvementRate: `${improvementRate.toFixed(2)}%`,
    rawMetrics: data
  };

  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2), 'utf-8');
  console.log(`💾 A/B 테스트 리포트 저장됨: ${reportPath}`);

  return winner;
}

/**
 * 분석 결과를 사이트 레이아웃에 직접 적용
 */
function applyWinningVariationToLayout(winner) {
  console.log(`\n⚙️ 우승 배치(대안 ${winner})를 블로그 레이아웃(BlogPostLayout.astro)의 기본 구성으로 상시 갱신합니다.`);

  if (!fs.existsSync(layoutPath)) {
    console.error("❌ 레이아웃 파일을 찾을 수 없습니다:", layoutPath);
    return;
  }

  let layoutContent = fs.readFileSync(layoutPath, 'utf-8');

  // 만약 대안 B가 이겼을 경우, 본문 중간 광고 배치를 활성화하기 위해
  // 마크다운 랜더러 본문 가로채기(Astro slot 전처리) 또는 미들웨어 단의 추가 광고 삽입 기능을 레이아웃에 적용
  // 본문 콘텐츠 내부의 특정 p 태그나 문단 단락을 기점으로 광고를 추가 주입하는 JS 구현
  if (winner === 'B') {
    // 이미 B의 본문 내 중간 광고 주입 스크립트가 layout에 심겨있는지 검토
    if (!layoutContent.includes('// B-Test Ad Insertion')) {
      // client script 부분에 본문 문단 사이 광고 동적 주입 스크립트 주입
      const searchTarget = `</article>`;
      const adInjectionCode = `
    <!-- B-Test Ad Insertion: 본문 중간 광고 동적 삽입 -->
    <script is:inline>
      document.addEventListener('DOMContentLoaded', () => {
        const postContent = document.querySelector('.post-content');
        if (postContent) {
          const paragraphs = postContent.querySelectorAll('p, h2, h3, table');
          if (paragraphs.length >= 6) {
            // 두 번째 및 네 번째 주요 단락 뒤에 본문 인피드 광고 생성 주입
            const insertAd = (targetIndex, adSlotId) => {
              const adContainer = document.createElement('div');
              adContainer.className = 'adsense-container body-ad';
              adContainer.innerHTML = \`
                <div class="adsense-label">광고</div>
                <ins class="adsbygoogle"
                     style="display:block; text-align:center;"
                     data-ad-layout="in-article"
                     data-ad-format="fluid"
                     data-ad-client="ca-pub-XXXXXXXXXXXXX"
                     data-ad-slot="\${adSlotId}"></ins>
              \`;
              paragraphs[targetIndex].parentNode.insertBefore(adContainer, paragraphs[targetIndex].nextSibling);
              try {
                (adsbygoogle = window.adsbygoogle || []).push({});
              } catch(e) {}
            };
            
            // 본문 중간 2개소에 광고 동적 주입
            if (paragraphs.length > 3) insertAd(2, "9876543210");
            if (paragraphs.length > 7) insertAd(6, "8765432109");
          }
        }
      });
    </script>
      `.trim();

      layoutContent = layoutContent.replace(searchTarget, `${adInjectionCode}\n  ${searchTarget}`);
      fs.writeFileSync(layoutPath, layoutContent, 'utf-8');
      console.log("   └─ [성공] 본문 중간 광고 동적 삽입 스크립트를 BlogPostLayout.astro에 안전하게 주입했습니다.");
    } else {
      console.log("   └─ [확인] 본문 중간 광고 스크립트가 이미 레이아웃에 주입되어 있습니다.");
    }
  } else {
    console.log("   └─ [알림] 대안 A(기본형)가 선택되어 레이아웃 구성을 기본값으로 유지합니다.");
  }
}

async function main() {
  const winner = analyzeABTestResults();
  applyWinningVariationToLayout(winner);
}

main().catch(console.error);
