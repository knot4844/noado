import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const postsDir = path.join(__dirname, '..', 'src', 'content', 'posts');
const newsletterPath = path.join(__dirname, '..', 'scratch', 'weekly_newsletter.html');

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
 * 시니어 친화적 HTML 뉴스레터 템플릿 생성기
 */
function buildNewsletterHtml(featuredPosts) {
  let itemsHtml = "";

  featuredPosts.forEach(post => {
    const postUrl = `https://noado.kr/posts/${post.slug}`;
    itemsHtml += `
      <!-- 기사 카드 시작 -->
      <div class="post-card" style="background-color: #ffffff; border: 1px solid #eae5de; border-radius: 16px; padding: 24px; margin-bottom: 24px; box-shadow: 0 4px 12px rgba(0,0,0,0.02);">
        <span class="post-category" style="display: inline-block; background-color: #4a6fa5; color: #ffffff; padding: 4px 12px; border-radius: 20px; font-size: 14px; font-weight: bold; margin-bottom: 12px;">${post.category}</span>
        <h3 class="post-title" style="margin-top: 0; margin-bottom: 12px; font-size: 22px; color: #2d2d2d; font-weight: bold; line-height: 1.4;">${post.title}</h3>
        <p class="post-desc" style="font-size: 17px; color: #5a5a5a; line-height: 1.7; margin-bottom: 20px;">${post.description}</p>
        <div style="text-align: center;">
          <a href="${postUrl}" class="post-link" style="display: inline-block; background-color: #ff8c42; color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 12px; font-size: 18px; font-weight: bold; min-height: 48px; box-shadow: 0 4px 8px rgba(255, 140, 66, 0.2);">👉 10초 만에 상세 정보 읽기</a>
        </div>
      </div>
      <!-- 기사 카드 끝 -->
    `.trim();
  });

  return `
<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>노아도 주간 복지 정책 요약</title>
  <style>
    body {
      margin: 0;
      padding: 0;
      background-color: #fefcf8;
      font-family: 'Apple SD Gothic Neo', 'Pretendard', sans-serif;
      -webkit-text-size-adjust: 100%;
    }
    @media only screen and (max-width: 600px) {
      .container {
        width: 100% !important;
        padding: 10px !important;
      }
      .post-title {
        font-size: 20px !important;
      }
      .post-desc {
        font-size: 16px !important;
      }
    }
  </style>
</head>
<body>
  <table border="0" cellpadding="0" cellspacing="0" width="100%" style="background-color: #fefcf8; padding: 20px 0;">
    <tr>
      <td align="center">
        <table border="0" cellpadding="0" cellspacing="0" width="600" class="container" style="background-color: #fefcf8; border-collapse: collapse;">
          
          <!-- 헤더 영역 -->
          <tr>
            <td align="center" style="background-color: #ff8c42; padding: 40px 20px; border-radius: 20px 20px 0 0;">
              <span style="font-size: 16px; color: #ffffff; font-weight: bold; letter-spacing: 2px;">시니어를 위한 정책 정보 포털</span>
              <h1 style="margin: 10px 0 0 0; color: #ffffff; font-size: 32px; font-weight: 900;">노아도 알짜정책 주간 요약</h1>
              <p style="margin: 8px 0 0 0; color: #ffffff; font-size: 16px;">어르신들께 유용한 복지 혜택과 정부지원금 소식을 엄선했습니다.</p>
            </td>
          </tr>

          <!-- 본문 소개말 -->
          <tr>
            <td style="padding: 30px 20px; background-color: #ffffff; border-left: 1px solid #eae5de; border-right: 1px solid #eae5de;">
              <p style="font-size: 18px; line-height: 1.8; color: #2d2d2d; margin: 0;">
                안녕하세요, 어르신 및 보호자 가족 여러분! <strong>노아도 정보광장</strong>입니다.<br><br>
                정부와 지자체에서 매달 다양한 복지 혜택을 쏟아내고 있지만, 본인이 직접 신청하지 않아 혜택을 놓치시는 어르신들이 무척 많습니다. 
                이번 주 노아도에서 선정한 <strong>시니어 핵심 복지 혜택 5가지</strong>를 전해드리니 꼭 혜택을 확인해 보세요.
              </p>
            </td>
          </tr>

          <!-- 기사 리스트 영역 -->
          <tr>
            <td style="padding: 0 20px; background-color: #ffffff; border-left: 1px solid #eae5de; border-right: 1px solid #eae5de;">
              ${itemsHtml}
            </td>
          </tr>

          <!-- 푸터 영역 -->
          <tr>
            <td align="center" style="background-color: #4a6fa5; padding: 30px 20px; border-radius: 0 0 20px 20px; color: #ffffff;">
              <p style="margin: 0; font-size: 15px; line-height: 1.6;">
                본 주간 요약은 어르신들이 정보를 놓쳐 손해를 보지 않도록 무료로 발송되는 유용한 알림 서비스입니다.<br>
                문의 사항이나 의견이 있으시면 언제든지 답장을 보내주세요.
              </p>
              <div style="margin-top: 20px; border-top: 1px solid rgba(255,255,255,0.2); padding-top: 20px; font-size: 13px; color: #d0d7de;">
                <strong>노아도 정보광장</strong> | 문의: <a href="mailto:knot4844@gmail.com" style="color: #ffffff;">knot4844@gmail.com</a> | 수신거부는 답장으로 '거부'라 적어주세요.
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `.trim();
}

async function main() {
  console.log("📨 [시니어 주간 알짜뉴스레터 자동 빌드]를 시작합니다...");

  if (!fs.existsSync(postsDir)) {
    console.error("❌ 오류: 기사 경로가 올바르지 않습니다.");
    return;
  }

  const files = fs.readdirSync(postsDir).filter(f => f.endsWith('.md') && f !== 'hello-world.md');
  const posts = [];

  files.forEach(file => {
    const filePath = path.join(postsDir, file);
    const content = fs.readFileSync(filePath, 'utf-8');
    const { frontmatter } = parseMarkdown(content);
    
    posts.push({
      slug: getSlug(file),
      title: frontmatter.title || "",
      description: frontmatter.description || "",
      category: frontmatter.category || "생활 지원금",
      date: frontmatter.date || ""
    });
  });

  // 최신 순으로 정렬 후 상위 5대 핵심 기사 추천 리스트 선별
  posts.sort((a, b) => new Date(b.date) - new Date(a.date));
  const featured = posts.slice(0, 5);

  console.log(`📰 최신 발행된 5대 핵심 복지 정책을 선별했습니다.`);
  featured.forEach((p, idx) => {
    console.log(`   ${idx + 1}. [${p.category}] ${p.title} (${p.date})`);
  });

  const html = buildNewsletterHtml(featured);
  fs.writeFileSync(newsletterPath, html, 'utf-8');

  console.log(`\n🎉 [성공] 주간 이메일 뉴스레터 HTML 템플릿 작성이 완료되었습니다: ${newsletterPath}`);
}

main().catch(console.error);
