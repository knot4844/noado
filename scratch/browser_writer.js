import puppeteer from 'puppeteer';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export async function generateArticleWithBrowser(targetKeyword, targetCategory, feedback = null) {
  console.log(`🌐 [브라우저 자동화] 크롬 브라우저를 실행합니다...`);
  
  // Create a dedicated profile directory in scratch to save login cookies/session!
  const profileDir = path.join(__dirname, 'chrome-profile');
  if (!fs.existsSync(profileDir)) {
    fs.mkdirSync(profileDir, { recursive: true });
  }

  const browser = await puppeteer.launch({
    executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
    headless: false, // visible window
    defaultViewport: null,
    userDataDir: profileDir,
    args: [
      '--no-sandbox',
      '--disable-setuid-sandbox',
      '--window-size=1280,900'
    ]
  });

  const page = await browser.newPage();
  
  console.log(`🌐 구글 제미나이 웹페이지로 이동합니다: https://gemini.google.com/app`);
  await page.goto('https://gemini.google.com/app', { waitUntil: 'networkidle2' });

  // Check if logged in. Gemini input is contenteditable.
  let isLoggedIn = false;
  for (let i = 0; i < 30; i++) { // wait up to 300 seconds (5 mins) for user login
    const inputExists = await page.$('div[contenteditable="true"], textarea, [role="textbox"]');
    if (inputExists) {
      isLoggedIn = true;
      break;
    }
    console.log(`⚠️ 로그인이 감지되지 않았습니다. 브라우저 창에서 구글 로그인을 완료해 주십시오... (${i * 10}초 대기 중)`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  if (!isLoggedIn) {
    await browser.close();
    throw new Error("❌ 로그인 대기 시간 초과: 구글 계정 로그인이 완료되지 않았습니다.");
  }

  console.log(`✅ 제미나이 서비스 활성화 감지! 기사 작성을 요청합니다...`);

  const today = new Date().toISOString().split('T')[0];
  let prompt = `
당신은 한국 최고의 구글 애드센스 수익형 블로그 전문 필진이자 SEO(검색엔진 최적화) 전문가입니다.
목표 키워드인 "${targetKeyword}"에 대한 매력적이고 유용하며 상세한 정보성 블로그 글을 작성해 주세요.

[글 작성 지침]
1. 형식: 반드시 마크다운(Markdown) 형식으로 작성해야 하며, 맨 위에는 아래 형식의 YAML Frontmatter를 포함해야 합니다.
---
title: "[키워드가 포함된 클릭을 유도하는 제목]"
description: "[검색 결과에 노출될 120자 내외의 글 요약 설명]"
date: "${today}"
category: "${targetCategory}"
keywords: ["${targetKeyword}", "${targetKeyword} 신청", "${targetKeyword} 자격", "${targetKeyword} 혜택"]
---

2. 제목 구조: 소제목을 H2(##), H3(###) 등으로 논리적인 구조를 갖추어 작성하세요. H2 소제목은 최소 3개 이상이어야 합니다.
3. 소득 기준이나 지원 조건 등 금액/대상이 있는 경우 반드시 마크다운 표(Table) 형식을 활용해 한눈에 들어오게 정리하세요.
4. 구글 애드센스 광고 효율을 극대화하기 위해 본문 중간과 본문 하단에 반드시 아래 HTML 광고 컨테이너 코드를 삽입하세요.
광고 컨테이너:
<div class="adsense-container body-ad"><div class="adsense-label">광고</div><!-- 본문 광고 영역 --></div>

5. 본문 내용 중 사람들이 실제로 신청이나 조회를 위해 이동해야 하는 부분에는 반드시 아래 형식의 고단가 CTR 유도 버튼을 삽입하세요.
버튼 코드 예시:
<div class="ctr-btn-container"><a href="https://www.bokjiro.go.kr" target="_blank" rel="noopener noreferrer" class="ctr-button">공식 홈페이지 바로가기</a></div>

6. 글자 수: 본문(Frontmatter 제외)은 한글 기준 최소 1,500자 이상의 매우 풍부하고 가치 있는 정보로 채우세요. 단순히 정보를 나열하지 말고, 자격 요건, 신청 기한, 필요 서류, 모바일 신청 방법 등을 매우 상세하고 친절하게 설명해야 구글 애드센스 승인을 통과할 수 있습니다.
7. 글의 마지막에는 항상 자주 묻는 질문(FAQ) 3가지를 정리해 주세요.
8. 대상 독자층 및 집필 톤앤매너: 본 블로그의 핵심 독자층은 '50대에서 70대의 어르신 및 중장년층'입니다. 따라서 반드시 매우 정중하고 신뢰감을 주는 존댓말 격식체(하십시오체: '~하십시오', '~해 드립니다', '~하기 마련입니다' 등)를 일관되게 적용하여 글을 집필해야 합니다. 또한 어르신들의 시력과 이해도를 돕기 위해 복잡한 관공서 전문 행정 용어는 자상하게 풀어서 풀이하고, 단계별 모바일/온라인 스마트폰 대리 신청법이나 근처 행정복지센터를 직접 방문하는 오프라인 신청 절차 및 준비물 서류 목록을 번호 매기기로 큼직하고 일목요연하게 강조하여 서술해 주십시오.

답변은 마크다운 코드 블록 형식(\`\`\`markdown ... \`\`\`)으로 묶어서 가독성 있게 리턴해 주세요.
`;

  if (feedback) {
    prompt += `\n\n⚠️ 중요: 이전 작성물에 대해 다음과 같은 피드백이 발생했습니다. 이 사항을 반드시 개선하여 다시 작성해 주세요:\n${feedback}`;
  }

  // Type the prompt into the editor
  const textarea = await page.$('div[contenteditable="true"], textarea, [role="textbox"]');
  await textarea.focus();
  
  await page.evaluate((el, text) => {
    el.innerHTML = '';
    const p = document.createElement('p');
    p.textContent = text;
    el.appendChild(p);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  }, textarea, prompt);

  console.log(`📤 프롬프트 입력 완료! 2초 후 전송 버튼 클릭...`);
  await new Promise(resolve => setTimeout(resolve, 2000));

  const sendButton = await page.$('button[aria-label="Send message"], button[aria-label="전송"], button.send-button');
  if (sendButton) {
    await sendButton.click();
  } else {
    await page.keyboard.press('Enter');
  }

  console.log(`⏳ AI 집필이 진행 중입니다... (답변 완료 대기...)`);

  // Loop-wait for completion (polling stop button visibility)
  let isDone = false;
  for (let i = 0; i < 45; i++) { // wait up to 90 seconds
    await new Promise(resolve => setTimeout(resolve, 2000));
    const stopBtn = await page.$('button[aria-label="Stop generation"], button[aria-label="답변 생성 중단"]');
    if (!stopBtn) {
      const isSendActive = await page.evaluate(() => {
        const btn = document.querySelector('button[aria-label="Send message"], button[aria-label="전송"]');
        return btn && !btn.disabled;
      });
      if (isSendActive) {
        isDone = true;
        break;
      }
    }
  }

  if (!isDone) {
    console.log(`⚠️ 답변 완료 감지가 지연되어 10초간 최종 버퍼 대기를 실행합니다...`);
    await new Promise(resolve => setTimeout(resolve, 10000));
  }

  console.log(`📥 답변 완료! 생성된 텍스트 데이터를 스크래핑합니다...`);

  // Extract content from last message card
  const articleContent = await page.evaluate(() => {
    const cardElms = document.querySelectorAll('message-content, .message-content, .model-response');
    if (cardElms.length === 0) return null;
    const lastCard = cardElms[cardElms.length - 1];
    return lastCard.innerText;
  });

  if (!articleContent) {
    await browser.close();
    throw new Error("❌ AI 답변 추출 실패: 제미나이 답변 노드를 찾지 못했습니다.");
  }

  console.log(`🎉 성공적으로 글 작성을 마쳤습니다! (총 ${articleContent.length}자 추출 완료)`);
  
  await browser.close();
  return articleContent;
}
