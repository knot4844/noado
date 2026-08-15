# AGENTS.md — 노아도(NOADO) 블로그

## 프로젝트 개요
- **서비스명:** 노아도 (NOADO) 알짜정책 포털
- **스택:** Astro (정적 사이트) + Vanilla CSS + Vercel
- **콘텐츠:** 시니어(65세+) 대상 한국 복지·연금·건강·일자리 정책 기사
- **수익:** Google AdSense

## 핵심 규칙

### 콘텐츠
- 경어체(~합니다) 통일
- 금액·기준은 공식 출처 필수 (mohw.go.kr, nps.or.kr, gov.kr 등)
- 사용자 대상: 만 60~85세 시니어 및 보호자 → 쉬운 한국어, 큰 글자
- 브랜딩: "노아도" 사용, "AutoAdSense" 사용 금지
- 문의 메일: knot4844@gmail.com

### 디자인
- `design.md` 참조: 시니어 접근성 우선 디자인 시스템
- 본문 최소 18px, 버튼 터치 최소 48×48px
- WCAG AA 색상 대비 준수

### SEO
- `.agents/skills/seo-optimizer/SKILL.md` 참조
- 모든 기사에 FAQ JSON-LD 스키마 포함
- 내부 링크 최소 3개

### 스킬
- 콘텐츠 작성: `.agents/skills/content-writer/SKILL.md`
- SEO 최적화: `.agents/skills/seo-optimizer/SKILL.md`

## 명령어
- 개발 서버: `npm run dev`
- 빌드: `npm run build`
- 기사 배치 발행: `node batch_publish.js`
- 기사 개선: `node improve.js`
