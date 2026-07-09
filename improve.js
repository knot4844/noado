import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, 'src', 'content', 'posts');

function getSlug(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9ㄱ-ㅎㅏ-ㅣ가-힣\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-');
}

/**
 * 1. 블로그 글 평가 함수 (기준표 기준)
 */
function gradePost(frontmatter, body, keyword) {
  let score = 0;
  const reports = [];

  // 1. SEO & 제목 매칭 (30점)
  const title = frontmatter.title || "";
  const hasKeywordInTitle = title.includes(keyword);
  if (hasKeywordInTitle) {
    score += 15;
    reports.push("✅ 제목 내 키워드 포함 (+15)");
  } else {
    reports.push("❌ 제목 내 키워드 누락");
  }

  // 중복 접두어 검사 (예: 2026년 2026년...)
  const hasDoubleYear = /2026년?\s*2026년?/.test(title);
  if (!hasDoubleYear && title.startsWith("2026년")) {
    score += 15;
    reports.push("✅ 제목 연도 표기 정상 (+15)");
  } else {
    reports.push("❌ 제목 연도 중복 또는 누락");
  }

  // 2. 가독성 및 정보 제공 (25점)
  const hasTable = body.includes('|');
  if (hasTable) {
    score += 15;
    reports.push("✅ 조건 요약 비교 표(Table) 포함 (+15)");
  } else {
    reports.push("❌ 조건 요약 비교 표 누락");
  }

  const hasList = body.includes('*') || body.includes('-');
  if (hasList) {
    score += 10;
    reports.push("✅ 세부 목록(List) 사용 (+10)");
  } else {
    reports.push("❌ 세부 목록 누락");
  }

  // 3. 애드센스 및 CTR 최적화 (25점)
  const adCount = (body.match(/class="adsense-container/g) || []).length;
  if (adCount >= 2) {
    score += 15;
    reports.push(`✅ 광고 배치 적정성 (광고수: ${adCount}) (+15)`);
  } else {
    reports.push(`❌ 광고 배치 부족 (광고수: ${adCount})`);
  }

  const hasCta = body.includes('class="ctr-button"');
  const isPremiumCta = hasCta && !body.includes('바로가기"'); // "바로가기"만 있는 심심한 버튼 탈피
  if (isPremiumCta) {
    score += 10;
    reports.push("✅ 행동 촉구형(Premium CTA) 버튼 구성 (+10)");
  } else if (hasCta) {
    score += 5;
    reports.push("⚠️ 단순 버튼 구성 (개선 필요) (+5)");
  } else {
    reports.push("❌ 행동 촉구형 버튼 누락");
  }

  // 4. E-E-A-T 및 신뢰성 (20점)
  const hasFaq = body.includes('FAQ') || body.includes('자주 묻는 질문');
  if (hasFaq) {
    score += 10;
    reports.push("✅ 검색 최적화 FAQ 구성 (+10)");
  } else {
    reports.push("❌ FAQ 구성 누락");
  }

  const hasDisclaimer = body.includes('disclaimer') || body.includes('안내사항') || body.includes('면책');
  if (hasDisclaimer) {
    score += 10;
    reports.push("✅ 면책 고지 및 정보 출처 명시 (+10)");
  } else {
    reports.push("❌ 면책 고지 누락");
  }

  return { score, reports };
}

/**
 * 2. 블로그 글 내용 자동 개선 (Improvement)
 */
function improvePost(fileContent, keyword, category) {
  // Frontmatter와 본문 분리
  const parts = fileContent.split('---');
  if (parts.length < 3) return fileContent;

  const rawFrontmatter = parts[1];
  let body = parts.slice(2).join('---').trim();

  // 1. Frontmatter 개선 (제목 중복 연도 제거 및 설명 보완)
  let title = rawFrontmatter.match(/title:\s*["']?(.*?)["']?\n/)?.[1] || "";
  let description = rawFrontmatter.match(/description:\s*["']?(.*?)["']?\n/)?.[1] || "";

  // 2026년 중복 제거
  const cleanKeyword = keyword.replace(/^2026년?\s*/, '').trim();
  title = `2026년 ${cleanKeyword} 신청 방법 및 자격 조건 총정리`;
  description = `2026년 ${cleanKeyword}의 지원 자격 요건, 혜택 내용, 신청 일정 및 공식 자격 조회 방법을 알기 쉽게 정리해 드립니다.`;

  const updatedFrontmatter = `
title: "${title}"
description: "${description}"
date: "${new Date().toISOString().split('T')[0]}"
category: "${category}"
keywords: ["${cleanKeyword}", "정부지원금", "생활정보", "신청방법"]
`;

  // 2. 본문 개선 (CTA 문구 강화, 면책 박스 삽입)
  // 버튼 텍스트를 단순 "공식 신청 페이지 바로가기"에서 고클릭율 문구로 업그레이드
  const oldBtnRegex = /class="ctr-button">(.*?)<\/a>/g;
  if (body.match(oldBtnRegex)) {
    body = body.replace(oldBtnRegex, `class="ctr-button">${cleanKeyword} 공식 자격 조회 및 즉시 신청하기</a>`);
  }

  // 본문 하단에 공식 경고/면책 문구 삽입 (만약 없다면)
  if (!body.includes('post-disclaimer') && !body.includes('안내사항')) {
    body += `\n\n<div class="post-disclaimer" style="background-color: rgba(245, 158, 11, 0.05); border: 1px solid rgba(245, 158, 11, 0.2); border-radius: 12px; padding: 1.25rem; margin-top: 2rem; font-size: 0.85rem; color: var(--text-secondary);">
  <p><strong>안내사항:</strong> 본 포스팅에서 제공하는 정보는 관계 기관의 공식 발표 자료 및 보도자료를 참조하여 최신화에 최선을 다해 작성되었습니다. 다만, 제도 개편 상황에 따라 변경 사항이 발생할 수 있으므로 최종 신청 전에 반드시 공식 홈페이지 안내를 다시 한 번 확인해 주시기 바랍니다.</p>
</div>`;
  }

  // 중복되는 연도 단어 본문 보정
  body = body.replace(/2026년\s*2026년/g, '2026년');

  return `---${updatedFrontmatter}--- \n\n${body}`;
}

async function main() {
  console.log("🔍 블로그 글 전수 검사 및 자동 SEO 개선 작업을 시작합니다...\n");

  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 포스트 디렉토리가 존재하지 않습니다.");
    return;
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md'));
  console.log(`총 ${files.length}개의 마크다운 글을 발견했습니다.\n`);

  for (const file of files) {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');

    // 키워드 및 카테고리 추출
    const categoryMatch = content.match(/category:\s*["']?(.*?)["']?\n/);
    const category = categoryMatch ? categoryMatch[1] : "생활정보";
    
    // 파일명에서 키워드 유추
    let inferredKeyword = file
      .replace('.md', '')
      .replace(/-/g, ' ')
      .replace(/2026년/g, '')
      .replace(/신청 방법 및 자격 조건 총정리/g, '')
      .replace(/신청방법/g, '')
      .replace(/조건/g, '')
      .replace(/조회/g, '')
      .trim();

    if (file === 'hello-world.md') inferredKeyword = "근로장려금";
    if (!inferredKeyword) inferredKeyword = "정부지원금";

    // 1. 개선 전 평가
    const parts = content.split('---');
    let rawFrontmatter = {};
    if (parts.length >= 3) {
      parts[1].split('\n').forEach(line => {
        const [k, ...v] = line.split(':');
        if (k && v.length) {
          rawFrontmatter[k.trim()] = v.join(':').replace(/["']/g, '').trim();
        }
      });
    }
    const beforeEval = gradePost(rawFrontmatter, parts.slice(2).join('---'), inferredKeyword);

    // 2. 자동 개선
    const improvedContent = improvePost(content, inferredKeyword, category);

    // 개선 후 평가
    const newParts = improvedContent.split('---');
    let newFrontmatter = {};
    newParts[1].split('\n').forEach(line => {
      const [k, ...v] = line.split(':');
      if (k && v.length) {
        newFrontmatter[k.trim()] = v.join(':').replace(/["']/g, '').trim();
      }
    });
    const afterEval = gradePost(newFrontmatter, newParts.slice(2).join('---'), inferredKeyword);

    // 파일 저장 처리 (중복 2026년 등 슬러그 청소)
    const newTitle = newFrontmatter.title || inferredKeyword;
    const newSlug = getSlug(newTitle);
    const newFilePath = path.join(postsDir, `${newSlug}.md`);

    console.log(`📄 파일: ${file}`);
    console.log(`   - 추정 키워드: "${inferredKeyword}"`);
    console.log(`   - 개선 전 SEO 점수: ${beforeEval.score}점`);
    console.log(`   - 개선 후 SEO 점수: ${afterEval.score}점`);

    // 만약 기존 파일명이 바뀐 슬러그와 다르다면 이전 파일 삭제
    if (filePath !== newFilePath) {
      console.log(`   - 🔄 슬러그 정리: ${file} -> ${newSlug}.md`);
      fs.unlinkSync(filePath);
    }
    
    fs.writeFileSync(newFilePath, improvedContent, 'utf-8');
    console.log("   - [완료] 파일 개선 및 갱신 성공\n");
  }

  console.log("🎉 모든 글의 SEO 개선 및 레이아웃 규격 보정이 완료되었습니다!");
}

main().catch(console.error);
