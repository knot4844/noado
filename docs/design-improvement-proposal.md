# 노아도(NOADO) 블로그 디자인 미학(Aesthetics) 개선 기획서

> **"사용자가 첫눈에 감탄하는 프리미엄 미학을 구축하라."**  
> — 노아도 디자인 고도화 제안

---

## 1. 디자인 개선 방향 (Design Concept)

노아도 블로그의 주 사용자인 **만 60세~80세 시니어**와 **보호자 가구** 모두에게 깊은 신뢰감과 심미적 만족감을 제공하는 **"따뜻한 프리미엄 실버 미학"**을 지향합니다.

```
[지향점]
1. 시각적 대비 (High Contrast) 👉 노안과 시력 약화를 감안한 WCAG AA 규격의 철저한 대비 확보
2. 따뜻하고 편안한 테마 (Warm & Trust) 👉 살구색 그라데이션, 부드러운 네이비 블루의 하모니
3. 마이크로 인터랙션 (Micro-Interactions) 👉 호버 시 카드 들림 효과, 부드러운 트랜지션
4. 글래스모피즘 (Glassmorphic Elements) 👉 네비게이션과 모달 영역에 세련된 반투명 블러 효과 적용
```

---

## 2. 디자인 및 에셋 제작에 유용한 툴 (Tools to Use)

### 2.1 시각적 설계 및 프로토타이핑
1. **Figma (피그마)**
   - **용도**: 블로그 레이아웃 설계 및 UI 컴포넌트(버튼, 카드, 계산기) 배치 시각화.
   - **장점**: 무료 플랜 제공, 풍부한 플러그인(UI Kit) 지원.
2. **Coolors (coolors.co)**
   - **용도**: 6:3:1 법칙(배경 60%, 주조색 30%, 강조색 10%)에 맞는 따뜻한 톤의 컬러 팔레트 추출 및 대비 검증.

### 2.2 고품질 그래픽 에셋 생성
1. **Antigravity `generate_image` / Midjourney**
   - **용도**: 블로그의 메인 비주얼, 카테고리 대표 일러스트 에셋 생성.
   - **추천 프롬프트 스타일**: `"Warm and cozy flat vector illustration, pastel colors, soft gradients, clean modern style, senior friendly UI illustration"`
2. **Fontshare / Google Fonts**
   - **용도**: 폰트 선택. 가독성이 극대화된 현대적 고딕 폰트 적용.
   - **추천 폰트**: 타이틀용 **Pretendard (Semibold/Bold)**, 본문용 **Noto Sans KR (Line-height 1.8)**.

---

## 3. 구체적인 디자인 개선 제안 (3대 핵심 요소)

### ① 글래스모피즘 기반의 프리미엄 헤더 & 네비게이션
헤더 영역에 부드러운 블러가 적용된 글래스모피즘 효과를 주어, 스크롤 시 본문 콘텐츠와 겹치지 않고 세련된 느낌을 제공합니다.

```css
.site-header {
  position: sticky;
  top: 0;
  background: rgba(254, 252, 248, 0.8); /* 아이보리 바탕 반투명 */
  backdrop-filter: blur(12px);          /* 부드러운 뒷배경 블러 */
  -webkit-backdrop-filter: blur(12px);
  border-bottom: 1px solid rgba(232, 228, 222, 0.5);
  z-index: 100;
}
```

### ② 카드 UI 호버 애니메이션 및 소프트 섀도우
각 정책 기사 카드가 단순 테두리 형태에서 마우스를 올렸을 때 부드럽게 위로 뜨며 그림자가 깊어지는 인터랙션을 추가합니다.

```css
.post-card {
  transition: transform 0.3s cubic-bezier(0.25, 0.8, 0.25, 1), 
              box-shadow 0.3s cubic-bezier(0.25, 0.8, 0.25, 1);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.02);
}

.post-card:hover {
  transform: translateY(-4px); /* 위로 4px 들림 */
  box-shadow: 0 12px 24px rgba(255, 140, 66, 0.1); /* 강조색 그림자 */
  border-color: var(--color-primary-light);
}
```

### ③ 시니어 시력 보호를 위한 '다크 모드' 토글 스위치
밤시간대 눈부심을 줄이기 위해 부드러운 차콜색(#1e1e1e)과 옅은 모래색 글씨의 다크 모드 스위치를 네비게이션 바 우측 상단에 장착합니다.

---

## 4. 디자인 이식 실전 가이드 (How to Apply)

1. **디자인 시스템 동기화**:
   - `design.md`에 설정된 CSS 변수(`--color-primary`, `--text-base` 등)를 Astro 프로젝트의 글로벌 스타일시트(`src/styles/global.css` 또는 `BlogPostLayout.astro` 스타일 태그)에 이식합니다.
2. **에셋 생성**:
   - `generate_image` 툴을 통해 각 카테고리(국민연금, 건강의료 등)에 부합하는 일러스트 썸네일을 5개 생성하여 배치합니다.
3. **Astro 컴포넌트 마크업 수정**:
   - `MultiWelfareCalculator.astro` 및 `BlogPostLayout.astro`에 부드러운 그라데이션 배경(`linear-gradient`)과 둥근 모서리(`border-radius: 16px`) 설정을 적용합니다.
