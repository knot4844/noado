import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export function renderPromoVideo(slug, title, highlights) {
  try {
    const outputDir = path.join(__dirname, 'public', 'videos');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const outputPath = path.join(outputDir, `${slug}.mp4`);
    console.log(`🎬 Remotion 비디오 렌더링 시작: ${outputPath}`);

    // Ensure highlights has exactly 3 elements
    const filledHighlights = [...highlights];
    while (filledHighlights.length < 3) {
      filledHighlights.push("노아도 정보광장");
    }

    const propsObj = {
      title,
      highlights: filledHighlights.slice(0, 3)
    };

    // Serialize props to JSON
    const propsJson = JSON.stringify(propsObj);

    // Call Remotion CLI to render
    const command = `npx remotion render video/video.js Promo "${outputPath}" --props='${propsJson}' --yes`;
    console.log(`💻 실행 명령어: ${command}`);
    
    execSync(command, { stdio: 'inherit', cwd: __dirname });
    console.log(`✅ 비디오 렌더링 성공! 파일: ${outputPath}`);
    return `${slug}.mp4`;
  } catch (err) {
    console.error(`❌ 비디오 렌더링 실패:`, err.message);
    return null;
  }
}

// CLI execution support
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const args = {};
  process.argv.slice(2).forEach(val => {
    if (val.startsWith('--')) {
      const parts = val.substring(2).split('=');
      const key = parts[0];
      const value = parts.slice(1).join('=');
      args[key] = value;
    }
  });

  const slug = args.slug || "test-promo";
  const title = args.title || "테스트 비디오 타이틀";
  const highlights = args.highlights ? args.highlights.split(',') : [
    "테스트 내용 1 - 2026년 최신 기준",
    "테스트 내용 2 - 모바일 간편 신청",
    "테스트 내용 3 - 노아도 정보광장"
  ];

  renderPromoVideo(slug, title, highlights);
}
