import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const samplePostPath = path.join(__dirname, '..', 'src', 'content', 'posts', '2026년-기초연금-재산-기준과-수급자격.md');

// [...slug].astro 에서 발췌한 parseFAQs 로직
function parseFAQs(markdownText) {
  const faqs = [];
  const lines = markdownText.split('\n');
  let currentQuestion = null;
  let currentAnswerParts = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    // Q1, Q2, 질문 1. 등 매칭
    const qMatch = line.match(/^(?:###\s+)?(?:Q|질문)\s*(\d+)[\.\s:]+\s*(.*)$/i) || 
                   line.match(/^\*\*(?:Q|질문)\s*(\d+)[\.\s:]+\s*(.*?)\*\*$/i);
    
    if (qMatch) {
      if (currentQuestion) {
        faqs.push({
          question: currentQuestion,
          answer: currentAnswerParts.join('\n').trim()
        });
      }
      currentQuestion = qMatch[2].replace(/\*\*$/, '').trim();
      currentAnswerParts = [];
    } else if (currentQuestion !== null) {
      if (line.startsWith('##') || line.startsWith('---') || line.includes('class="post-disclaimer"') || line.includes('adsense-container')) {
        faqs.push({
          question: currentQuestion,
          answer: currentAnswerParts.join('\n').trim()
        });
        currentQuestion = null;
        currentAnswerParts = [];
      } else {
        currentAnswerParts.push(lines[i]);
      }
    }
  }

  if (currentQuestion) {
    faqs.push({
      question: currentQuestion,
      answer: currentAnswerParts.join('\n').trim()
    });
  }

  return faqs.filter(f => f.question && f.answer);
}

// JSON-LD 조립 검증
function generateFaqJsonLd(faqs) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "mainEntity": faqs.map(faq => ({
      "@type": "Question",
      "name": faq.question,
      "acceptedAnswer": {
        "@type": "Answer",
        "text": faq.answer.replace(/<[^>]*>/g, '').replace(/\*\*|__/g, '')
      }
    }))
  };
}

async function main() {
  console.log("🧪 [FAQ 스키마 검증 테스트]를 시작합니다...");

  if (!fs.existsSync(samplePostPath)) {
    console.error(`❌ 샘플 포스트가 존재하지 않습니다: ${samplePostPath}`);
    process.exit(1);
  }

  const content = fs.readFileSync(samplePostPath, 'utf-8');
  
  // Frontmatter 제외하고 본문 파싱
  const parts = content.split('---');
  const body = parts.slice(2).join('---');

  console.log(`📄 포스트 본문 크기: ${body.length} 자`);

  const faqs = parseFAQs(body);
  console.log(`🔍 추출된 FAQ 개수: ${faqs.length} 개`);

  if (faqs.length === 0) {
    console.error("❌ 오류: 본문에서 추출된 FAQ 질문/답변 쌍이 없습니다. 파서 정규식을 확인해 주세요.");
    process.exit(1);
  }

  faqs.forEach((faq, index) => {
    console.log(`\n--- FAQ #${index + 1} ---`);
    console.log(`[Q]: ${faq.question}`);
    console.log(`[A]: ${faq.answer}`);
  });

  const jsonLd = generateFaqJsonLd(faqs);
  console.log("\n📦 생성된 FAQ JSON-LD 스키마:");
  console.log(JSON.stringify(jsonLd, null, 2));

  console.log("\n✅ [검증 성공] FAQ 파싱 및 JSON-LD 생성 과정에 문법 오류 및 Null 포인터가 없습니다!");
}

main().catch(console.error);
