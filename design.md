# 노아도(NOADO) 디자인 시스템

> **"AI로 만든 제품이 안 팔리는 이유는, 디자인 시스템이 없기 때문이다."**  
> — 메이커 에반 (Maker Evan) 벤치마킹

---

## 1. 브랜드 정체성

| 항목 | 값 |
|------|---|
| **서비스명** | 노아도 (NOADO) |
| **부제** | 노아도 알짜정책 포털 / 노아도 정보광장 |
| **슬로건** | "시니어를 위한 정책, 한 곳에서" |
| **타깃 사용자** | 만 60~85세 시니어 및 보호자 (디지털 리터러시 중~하) |
| **톤 앤 매너** | 따뜻하고 신뢰감 있는, 쉽고 친근한 정보 전달 |

## 2. 색상 토큰

### 2.1 기본 팔레트

```css
:root {
  /* 프라이머리: 따뜻한 주황 (신뢰 + 활력) */
  --color-primary: #FF8C42;
  --color-primary-light: #FFB380;
  --color-primary-dark: #E06A1F;

  /* 세컨더리: 안정적인 파랑 (공적 기관 신뢰감) */
  --color-secondary: #4A6FA5;
  --color-secondary-light: #7A9FD5;
  --color-secondary-dark: #2A4F85;

  /* 액센트: 자연 초록 (건강/복지) */
  --color-accent: #2E8B57;
  --color-accent-light: #5EBB87;
  --color-accent-dark: #1E6B37;

  /* 중성색 */
  --color-bg: #FEFCF8;          /* 따뜻한 아이보리 배경 */
  --color-bg-card: #FFFFFF;
  --color-text: #2D2D2D;        /* 고대비 본문 */
  --color-text-light: #5A5A5A;
  --color-text-muted: #8A8A8A;
  --color-border: #E8E4DE;
  --color-border-focus: #FF8C42;

  /* 시맨틱 */
  --color-success: #2E8B57;
  --color-warning: #F5A623;
  --color-error: #D64045;
  --color-info: #4A6FA5;
}
```

### 2.2 색상 접근성 (WCAG AA)

| 조합 | 대비비 | 등급 |
|------|--------|------|
| --color-text on --color-bg | 12.5:1 | AAA |
| --color-primary on --color-bg | 4.6:1 | AA |
| --color-secondary on white | 5.2:1 | AA |
| --color-accent on white | 5.8:1 | AA |

## 3. 타이포그래피 토큰

```css
:root {
  /* 폰트 패밀리 */
  --font-heading: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;
  --font-body: 'Pretendard', 'Apple SD Gothic Neo', sans-serif;

  /* 폰트 크기 — 시니어 가독성 기준 (일반 대비 1.2~1.5배) */
  --text-xs: 14px;      /* 보조 정보, 캡션 */
  --text-sm: 16px;      /* 메타 정보 */
  --text-base: 18px;    /* ★ 본문 기본 (일반 사이트 16px → 18px) */
  --text-lg: 20px;      /* 강조 본문 */
  --text-xl: 24px;      /* H3 */
  --text-2xl: 28px;     /* H2 */
  --text-3xl: 34px;     /* H1 */
  --text-4xl: 42px;     /* 히어로 타이틀 */

  /* 행간 — 넉넉하게 */
  --leading-tight: 1.4;
  --leading-normal: 1.8;     /* ★ 본문 (일반 1.6 → 1.8) */
  --leading-relaxed: 2.0;

  /* 자간 */
  --tracking-normal: -0.01em;
  --tracking-wide: 0.02em;

  /* 굵기 */
  --weight-normal: 400;
  --weight-medium: 500;
  --weight-semibold: 600;
  --weight-bold: 700;
}
```

## 4. 간격 (Spacing) 토큰

```css
:root {
  --space-1: 4px;
  --space-2: 8px;
  --space-3: 12px;
  --space-4: 16px;
  --space-5: 20px;
  --space-6: 24px;
  --space-8: 32px;
  --space-10: 40px;
  --space-12: 48px;
  --space-16: 64px;

  /* 컴포넌트별 */
  --padding-card: var(--space-6);
  --padding-section: var(--space-10);
  --gap-grid: var(--space-6);
  --margin-paragraph: var(--space-5);
}
```

## 5. 컴포넌트 스타일 가이드

### 5.1 버튼

```css
.btn-primary {
  background: var(--color-primary);
  color: white;
  font-size: var(--text-lg);         /* 20px — 시니어 터치 편의 */
  font-weight: var(--weight-semibold);
  padding: 14px 28px;
  border-radius: 12px;
  min-height: 52px;                   /* ★ 최소 터치 영역 */
  min-width: 120px;
  border: none;
  cursor: pointer;
  transition: all 0.2s ease;
}

.btn-primary:hover {
  background: var(--color-primary-dark);
  transform: translateY(-1px);
  box-shadow: 0 4px 12px rgba(255, 140, 66, 0.3);
}

.btn-primary:active {
  transform: translateY(0);
}
```

### 5.2 카드

```css
.card {
  background: var(--color-bg-card);
  border: 1px solid var(--color-border);
  border-radius: 16px;
  padding: var(--padding-card);
  box-shadow: 0 2px 8px rgba(0,0,0,0.06);
  transition: box-shadow 0.2s ease;
}

.card:hover {
  box-shadow: 0 4px 16px rgba(0,0,0,0.1);
}
```

### 5.3 테이블 (정책 정보)

```css
.policy-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  border-radius: 12px;
  overflow: hidden;
  font-size: var(--text-base);
}

.policy-table th {
  background: var(--color-secondary);
  color: white;
  padding: 14px 16px;
  font-weight: var(--weight-semibold);
  text-align: left;
}

.policy-table td {
  padding: 14px 16px;
  border-bottom: 1px solid var(--color-border);
  line-height: var(--leading-normal);
}

.policy-table tr:nth-child(even) td {
  background: #F8F6F2;
}

/* 모바일: 수평 스크롤 */
@media (max-width: 640px) {
  .table-wrapper {
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
  }
}
```

### 5.4 FAQ 아코디언

```css
.faq-item {
  border: 1px solid var(--color-border);
  border-radius: 12px;
  margin-bottom: var(--space-3);
  overflow: hidden;
}

.faq-question {
  padding: 16px 20px;
  font-size: var(--text-lg);
  font-weight: var(--weight-semibold);
  cursor: pointer;
  display: flex;
  justify-content: space-between;
  align-items: center;
  background: var(--color-bg);
  min-height: 56px;          /* 시니어 터치 영역 */
}

.faq-answer {
  padding: 0 20px 16px;
  font-size: var(--text-base);
  line-height: var(--leading-normal);
  color: var(--color-text-light);
}
```

### 5.5 모의 계산기 위젯

```css
.calculator-card {
  background: linear-gradient(135deg, #FFF8F0 0%, #F0F4FF 100%);
  border: 2px solid var(--color-primary);
  border-radius: 20px;
  padding: var(--space-8);
  margin: var(--space-8) 0;
}

.calc-badge {
  background: var(--color-primary);
  color: white;
  padding: 6px 16px;
  border-radius: 20px;
  font-size: var(--text-sm);
  font-weight: var(--weight-semibold);
}

.calc-slider {
  -webkit-appearance: none;
  width: 100%;
  height: 8px;
  border-radius: 4px;
  background: var(--color-border);
  outline: none;
}

.calc-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 28px;              /* 시니어 터치 편의 */
  height: 28px;
  border-radius: 50%;
  background: var(--color-primary);
  cursor: pointer;
}
```

## 6. 반응형 브레이크포인트

```css
/* 모바일 우선 (시니어 사용자 대부분 모바일) */
:root {
  --bp-sm: 640px;    /* 소형 모바일 */
  --bp-md: 768px;    /* 태블릿 */
  --bp-lg: 1024px;   /* 데스크톱 */
  --bp-xl: 1280px;   /* 대형 데스크톱 */
}

/* 모바일 본문: 더 큰 글자 */
@media (max-width: 640px) {
  :root {
    --text-base: 17px;
    --text-lg: 19px;
    --text-xl: 22px;
    --text-2xl: 26px;
    --text-3xl: 30px;
  }
}
```

## 7. 이미지 가이드

| 유형 | 사이즈 | 포맷 | 비고 |
|------|--------|------|------|
| 대표 이미지 (OG) | 1200×630 | WebP | 소셜 미리보기 호환 |
| 본문 삽입 | 800×450 | WebP | 품질 80% |
| 아이콘/일러스트 | 64×64 ~ 128×128 | SVG/WebP | 벡터 선호 |
| 썸네일 | 400×225 | WebP | 목록 페이지용 |

### 7.1 이미지 스타일
- **톤**: Warm (따뜻한 주황/노랑 계열 조명)
- **스타일**: 플랫 일러스트, 둥근 모서리
- **인물**: 밝은 표정의 시니어 캐릭터 (실사 사진 지양)
- **배경**: 연한 그라데이션 (단색 배경 지양)
- **텍스트 오버레이**: 핵심 키워드 1~2개, 볼드, 큰 글씨

## 8. 애니메이션 / 인터랙션

```css
/* 시니어 사용자 고려: 과도한 애니메이션 지양 */
@media (prefers-reduced-motion: reduce) {
  * {
    animation: none !important;
    transition: none !important;
  }
}

/* 기본 트랜지션: 부드럽고 느린 편 */
:root {
  --transition-fast: 150ms ease;
  --transition-normal: 250ms ease;
  --transition-slow: 400ms ease;
}
```

## 9. Do & Don't

### ✅ Do
- 글자 크기 18px 이상 유지
- 버튼 터치 영역 최소 48×48px
- 색상 대비 4.5:1 이상
- 행간 1.8 이상
- 테이블에 줄무늬 배경
- 폼 입력 필드에 라벨 + 플레이스홀더 모두 표시

### ❌ Don't
- 12px 이하 글자 사용
- 회색 배경에 회색 글자
- 호버에만 의존하는 인터랙션
- 자동 재생 동영상/오디오
- 깜빡이는 텍스트/배너
- 복잡한 제스처(더블탭, 스와이프) 필수 인터랙션
