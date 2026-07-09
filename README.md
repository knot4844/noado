# 🚀 AutoAdSense: 구글 애드센스 수익화 블로그 자동화 시스템

이 프로젝트는 정적 블로그 템플릿(**Astro**)과 AI 검색엔진 최적화 글쓰기 도구(**Gemini API**)를 결합하여, 키워드 입력 한 번으로 글 작성부터 구글 애드센스 광고 최적화 레이아웃 배치, 그리고 서버 배포까지 전 과정을 자동화한 시스템입니다.

---

## 📂 프로젝트 구조

* `publish.js`: 키워드를 분석하여 AI로 글을 작성하고, 자체 SEO 테스트를 거쳐 배포하는 자동화 스크립트.
* `src/content/config.ts`: 마크다운 본문의 메타데이터 구조 정의 및 무결성 검증.
* `src/layouts/BaseLayout.astro`: 애드센스 자동 광고, 라이트/다크 모드, 공통 CSS 변수가 내장된 기본 레이아웃.
* `src/layouts/BlogPostLayout.astro`: 글 본문용 레이아웃 (H2 소제목, 표, 본문 중간/하단 광고 배너, 고단가 CTR 유도 버튼 스타일 포함).
* `src/pages/index.astro`: 최신 글 목록을 보여주는 프리미엄 그리드형 홈페이지 (카테고리 필터링 포함).
* `src/pages/privacy.astro` / `terms.astro`: **애드센스 승인 필수 요소**인 개인정보처리방침 및 이용약관 페이지.

---

## ⚙️ 초기 설정 및 환경 변수 (.env)

`apps/autoadsense/` 디렉토리에 `.env` 파일을 생성하거나, 시스템 루트의 `.env` 파일에 아래 변수들을 설정해 주세요.

```env
# Google Gemini API Key (구글 AI 스튜디오 무료 발급)
GEMINI_API_KEY=AIzaSy...

# Google AdSense Publisher ID (애드센스 승인 후 발급받는 고유 ID)
# 승인 전이거나 데모 테스트 시에는 비워두거나 ca-pub-XXXXXXXXXXXXX로 둡니다.
PUBLIC_ADSENSE_ID=ca-pub-XXXXXXXXXXXXX

# 블로그 실서비스 도메인 주소 (구글 Sitemap 및 RSS 피드 생성에 사용)
SITE_URL=https://your-domain.com

# 글 작성 완료 시 자동으로 Git Commit & Push 실행 여부 (true / false)
AUTO_DEPLOY=false
```

---

## 💻 로컬 사용 방법

### 1. 의존성 패키지 설치
`apps/autoadsense/` 경로에서 터미널을 열고 의존성을 설치합니다.
```bash
npm install
```

### 2. 로컬 개발 서버 실행
배포 전 블로그가 컴퓨터에서 어떻게 작동하는지 실시간으로 확인합니다.
```bash
npm run dev
```
브라우저를 열고 `http://localhost:4321`에 접속하면 프리미엄 디자인의 블로그 홈과 글 목록을 볼 수 있습니다.

### 3. AI 자동 글쓰기 스크립트 실행
원하는 키워드와 카테고리를 입력하여 포스팅을 자동 생성합니다.
```bash
# 사용 예시
node publish.js --keyword="2026년 청년도약계좌 신청기간" --category="금융재테크"
```

* **자가 진단(Self-Grading) 루프**: 스크립트가 글을 작성한 후 [키워드 매칭, 글자수 1200자 이상, 소제목 구조화, 애드센스 영역 삽입, CTR 버튼 유무]를 자체 평가하여 **80점 이상**이 될 때까지 피드백을 주며 최대 3회 재작성합니다.
* **데모 모드**: `GEMINI_API_KEY`가 없거나 올바르지 않은 경우 자동으로 고품질 모의 글을 생성(Dry-run)하여 전체 파이프라인을 테스트할 수 있도록 지원합니다.

### 4. 빌드 확인
정적 파일 컴파일 및 sitemap.xml, rss.xml이 올바르게 빌드되는지 테스트합니다.
```bash
npm run build
```

---

## 🌐 100% 무료 무중단 자동 배포 가이드 (Cloudflare Pages)

이 블로그는 데이터베이스가 없는 정적 사이트이므로, 전 세계에서 가장 빠르고 무료 대역폭이 무제한인 **Cloudflare Pages**에 배포하는 것이 가장 유리합니다.

### Step 1. GitHub 저장소 생성 및 푸시
1. 본인의 GitHub에 새 비공개(Private) 또는 공개(Public) 저장소를 생성합니다.
2. 로컬 코드를 해당 저장소에 커밋하고 푸시합니다.

### Step 2. Cloudflare Pages 연동
1. [Cloudflare 대시보드](https://dash.cloudflare.com/)에 로그인합니다.
2. **Worker 및 Pages** -> **만들기** -> **Pages** -> **Git에 연결**을 선택합니다.
3. 생성한 GitHub 저장소를 선택합니다.

### Step 3. 빌드 설정 구성
* **프레임워크 프리셋**: `Astro`
* **빌드 명령**: `npm run build`
* **출력 디렉터리**: `dist`
* **노드 버전(선택사항)**: 환경 변수에 `NODE_VERSION`을 `22` 이상으로 추가해 줍니다.

### Step 4. 환경 변수 등록
대시보드의 **설정** -> **환경 변수** 메뉴에서 아래 값을 추가합니다.
* `PUBLIC_ADSENSE_ID`: 본인의 구글 애드센스 ID (`ca-pub-xxxx`)
* `SITE_URL`: 본인의 개인 도메인 주소

### Step 5. 저장 및 배포
배포 버튼을 누르면 약 1분 후 고유 웹 주소(예: `https://xxx.pages.dev`)가 발급되며 사이트 배포가 완료됩니다!

---

## 🔄 완전 자동화 파이프라인 활성화 방법 (CI/CD)

글 작성 명령 단 한 번으로 웹 사이트에 즉시 반영되게 하려면:

1. `.env` 파일에서 `AUTO_DEPLOY=true`로 수정합니다.
2. 터미널에서 글을 발행합니다:
   ```bash
   node publish.js --keyword="2026년 근로장려금 신청방법" --category="정부지원금"
   ```
3. 스크립트가 글을 작성하고 자체 평가를 통과하면 바로 GitHub으로 푸시합니다.
4. GitHub에 푸시된 변경사항을 Cloudflare Pages가 감지하여 **자동으로 새 글이 추가된 블로그를 빌드 및 실시간 배포**합니다. (약 30초 소요)
