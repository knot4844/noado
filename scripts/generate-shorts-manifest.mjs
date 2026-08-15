import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { renderPromoVideo } from '../render_video.js'; // 기존 render_video.js 모듈 재사용

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');
const manifestPath = path.join(__dirname, '..', 'scratch', 'shorts_manifest.json');

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
  
  return { frontmatter, body };
}

/**
 * 본문 마크다운에서 숏츠용 3대 하이라이트 문장 지능형 추출
 */
function extractHighlights(body, title) {
  const highlights = [];
  const lines = body.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // 1. 볼드 표기(**) 중 유용한 핵심 요약 문구 수집
  const boldRegex = /\*\*(.*?)\*\*/g;
  let match;
  while ((match = boldRegex.exec(body)) !== null) {
    const candidate = match[1].replace(/<[^>]*>/g, '').trim();
    // 금액(원)이나 연령(세) 혹은 자격 요건 성격의 핵심 정보만 취함
    if (candidate.length >= 8 && candidate.length <= 25 && !highlights.includes(candidate)) {
      if (candidate.includes('원') || candidate.includes('세') || candidate.includes('기준') || candidate.includes('신청')) {
        highlights.push(candidate);
      }
    }
  }

  // 2. 만약 볼드 텍스트가 부족하다면 요약 테이블에서 텍스트 축약
  if (highlights.length < 3) {
    const tableLines = lines.filter(l => l.startsWith('|') && !l.includes('---') && !l.includes('가구'));
    tableLines.forEach(line => {
      const cols = line.split('|').map(c => c.trim()).filter(c => c.length > 0);
      if (cols.length >= 2) {
        const key = cols[0].replace(/\*\*/g, '');
        const val = cols[1].replace(/\*\*/g, '');
        const combined = `${key}: ${val}`;
        if (combined.length <= 25 && !highlights.includes(combined)) {
          highlights.push(combined);
        }
      }
    });
  }

  // 3. 여전히 부족하면 기사 제목의 핵심어와 기본 복지 서비스 문구 폴백 처리
  const cleanTitle = title.replace(/2026년/g, '').replace(/신청방법/g, '').replace(/및 자격 요건/g, '').trim().substring(0, 16);
  
  if (highlights.length < 1) highlights.push(`${cleanTitle} 지원`);
  if (highlights.length < 2) highlights.push("2026년 정부 공식 발표 기준");
  if (highlights.length < 3) highlights.push("노아도 정보광장에서 상세조회");

  return highlights.slice(0, 3);
}

async function main() {
  console.log("🎬 [숏츠 동영상 매니페스트 및 파이프라인 자동화]를 구동합니다...");

  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 기사 디렉토리를 찾을 수 없습니다.");
    return;
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const manifest = {};

  files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter, body } = parseMarkdown(content);
    
    const slug = getSlug(file);
    const title = frontmatter.title || "";
    const highlights = extractHighlights(body, title);

    manifest[slug] = {
      title: title.split(':')[0], // 제목이 너무 길면 첫 콜론 기준 자름
      slug,
      highlights,
      videoPath: `/videos/${slug}.mp4`
    };
  });

  // 매니페스트 저장
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf-8');
  console.log(`💾 숏츠 비디오 파이프라인 매니페스트가 저장되었습니다: ${manifestPath}`);
  console.log(`총 ${Object.keys(manifest).length}개 비디오 메타데이터 인제스트 완료.`);

  // 시연을 위해 상위 1개 대상 비디오 자동 빌드 트리거 (Remotion)
  // 단, Remotion 빌드 툴(FFmpeg 등) 미설치 환경을 대비해 프로세스가 깨지지 않게 안전한 호출 보장
  const demoSlug = "2026년-기초연금-재산-기준과-수급자격";
  if (manifest[demoSlug]) {
    console.log(`\n📺 [빌드 검증] 대표 포스트 '${demoSlug}' 숏츠 동영상 생성을 가동합니다...`);
    const demo = manifest[demoSlug];
    const result = renderPromoVideo(demo.slug, demo.title, demo.highlights);
    if (result) {
      console.log(`🎉 숏츠 데모 비디오 렌더링에 성공했습니다! (${result})`);
    } else {
      console.log("ℹ️ Remotion 렌더러 동작이 실패했거나 라이브러리(Remotion CLI) 미완비 환경입니다. 매니페스트 생성을 완료로 처리합니다.");
    }
  }
}

main().catch(console.error);
