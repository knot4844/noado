'use client'

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

/* ─── 타입 ─── */
interface Star {
  id: number; x: number; y: number; size: number; opacity: number
  vx: number; vy: number; life: number; maxLife: number; hue: number
}
interface BgStar { x: number; y: number; r: number; opacity: number; speed: number; phase: number }

export default function LandingPage() {
  const router       = useRouter()
  const canvasRef    = useRef<HTMLCanvasElement>(null)
  const bgCanvasRef  = useRef<HTMLCanvasElement>(null)
  const starsRef     = useRef<Star[]>([])
  const frameRef     = useRef<number>(0)
  const bgFrameRef   = useRef<number>(0)
  const bgStarsRef   = useRef<BgStar[]>([])
  const idRef        = useRef(0)
  const containerRef  = useRef<HTMLDivElement>(null)
  const [scrollY, setScrollY]       = useState(0)
  const [showStats, setShowStats]   = useState(false)
  const [showFeatures, setShowFeatures] = useState(false)
  const [showSteps, setShowSteps]   = useState(false)
  const [showPricing, setShowPricing] = useState(false)
  const [visible, setVisible]       = useState(false)
  const [checking, setChecking]     = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  /* 로그인 체크 — 리다이렉트 하지 않고 상태만 기록 */
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user) setIsLoggedIn(true)
      setChecking(false)
      setTimeout(() => setVisible(true), 80)
    })
  }, [])

  /* 배경 별 */
  useEffect(() => {
    const canvas = bgCanvasRef.current
    if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize()
    window.addEventListener('resize', resize)
    bgStarsRef.current = Array.from({ length: 180 }, () => ({
      x: Math.random() * window.innerWidth, y: Math.random() * window.innerHeight,
      r: Math.random() * 1.4 + 0.3, opacity: Math.random() * 0.55 + 0.08,
      speed: Math.random() * 0.5 + 0.1, phase: Math.random() * Math.PI * 2,
    }))
    let t = 0
    const draw = () => {
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height); t += 0.008
      bgStarsRef.current.forEach(s => {
        const pulse = Math.sin(t * s.speed + s.phase) * 0.35 + 0.65
        ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(168,218,220,${s.opacity * pulse})`; ctx.fill()
      })
      bgFrameRef.current = requestAnimationFrame(draw)
    }
    draw()
    return () => { cancelAnimationFrame(bgFrameRef.current); window.removeEventListener('resize', resize) }
  }, [])

  /* 마우스 파티클 */
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return
    const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight }
    resize(); window.addEventListener('resize', resize)
    const onMove = (e: MouseEvent) => {
      const count = Math.floor(Math.random() * 2) + 2
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2, speed = Math.random() * 1.6 + 0.4
        starsRef.current.push({
          id: idRef.current++,
          x: e.clientX + (Math.random() - 0.5) * 12, y: e.clientY + (Math.random() - 0.5) * 12,
          size: Math.random() * 3.5 + 0.8, opacity: 1,
          vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed - 0.6,
          life: 0, maxLife: Math.random() * 45 + 25,
          hue: Math.random() < 0.55 ? 182 : Math.random() < 0.5 ? 210 : 45,
        })
      }
      if (starsRef.current.length > 220) starsRef.current = starsRef.current.slice(-220)
    }
    window.addEventListener('mousemove', onMove)
    const animate = () => {
      const ctx = canvas.getContext('2d'); if (!ctx) return
      ctx.clearRect(0, 0, canvas.width, canvas.height)
      starsRef.current = starsRef.current.filter(s => s.life < s.maxLife)
      starsRef.current.forEach(s => {
        s.life++; s.x += s.vx; s.y += s.vy; s.vy += 0.06; s.vx *= 0.97
        const p = s.life / s.maxLife, alpha = (1 - p) * s.opacity, sz = s.size * (1 - p * 0.4)
        ctx.save(); ctx.translate(s.x, s.y); ctx.rotate(s.life * 0.12); ctx.globalAlpha = alpha
        if (sz > 1.5) {
          ctx.fillStyle = `hsl(${s.hue},80%,76%)`
          ctx.shadowBlur = 10; ctx.shadowColor = `hsl(${s.hue},80%,76%)`
          drawStar4(ctx, 0, 0, sz * 0.38, sz)
        } else {
          ctx.fillStyle = `hsl(${s.hue},80%,80%)`
          ctx.beginPath(); ctx.arc(0, 0, sz, 0, Math.PI * 2); ctx.fill()
        }
        ctx.restore()
      })
      frameRef.current = requestAnimationFrame(animate)
    }
    animate()
    return () => {
      cancelAnimationFrame(frameRef.current)
      window.removeEventListener('mousemove', onMove); window.removeEventListener('resize', resize)
    }
  }, [])

  /* 스크롤 — checking 끝난 후 containerRef가 DOM에 존재할 때 등록 */
  useEffect(() => {
    if (checking) return
    const el = containerRef.current
    if (!el) return
    const fn = () => {
      const st = el.scrollTop
      const vh = window.innerHeight || 800
      setScrollY(st)
      if (st > vh * 0.3) setShowStats(true)
      if (st > vh * 1.3) setShowFeatures(true)
      if (st > vh * 2.3) setShowSteps(true)
      if (st > vh * 3.3) setShowPricing(true)
    }
    el.addEventListener('scroll', fn, { passive: true })
    return () => el.removeEventListener('scroll', fn)
  }, [checking])

  if (checking) return null


  return (
    <div ref={containerRef} style={{
      background: '#070d1a', height: '100vh', overflowY: 'scroll', overflowX: 'hidden',
      fontFamily: "'Space Grotesk',sans-serif",
    }}>
      <canvas ref={bgCanvasRef} style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }} />
      <canvas ref={canvasRef}   style={{ position: 'fixed', inset: 0, zIndex: 10, pointerEvents: 'none' }} />

      {/* NAV */}
      <nav style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 50, height: '64px',
        padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: scrollY > 40 ? 'rgba(7,13,26,0.88)' : 'transparent',
        backdropFilter: scrollY > 40 ? 'blur(18px)' : 'none',
        borderBottom: scrollY > 40 ? '1px solid rgba(168,218,220,0.1)' : 'none',
        transition: 'all 0.3s ease',
      }}>
        <LogoMark />
        <div style={{ display: 'flex', gap: '12px', alignItems: 'center' }}>
          {isLoggedIn ? (
            <PrimaryBtn onClick={() => router.push('/dashboard')}>대시보드 →</PrimaryBtn>
          ) : (
            <>
              <PlainBtn onClick={() => router.push('/login')}>로그인</PlainBtn>
              <PrimaryBtn onClick={() => router.push('/signup')}>무료 시작하기</PrimaryBtn>
            </>
          )}
        </div>
      </nav>

      {/* HERO */}
      <section style={{
        position: 'relative', zIndex: 1, height: '100vh',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        justifyContent: 'center', textAlign: 'center', padding: '120px 24px 80px',
      }}>
        {/* orb glow */}
        <div style={{
          position: 'absolute', top: '18%', left: '50%', transform: 'translateX(-50%)',
          width: '700px', height: '700px', borderRadius: '50%', pointerEvents: 'none',
          background: 'radial-gradient(circle, rgba(69,123,157,0.2) 0%, rgba(168,218,220,0.07) 50%, transparent 70%)',
          filter: 'blur(50px)',
        }} />

        <Fade show={visible} delay={0}>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: '8px',
            background: 'rgba(168,218,220,0.1)', border: '1px solid rgba(168,218,220,0.25)',
            borderRadius: '100px', padding: '6px 18px', marginBottom: '36px',
          }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#a8dadc', display: 'inline-block' }} />
            <span style={{ color: '#a8dadc', fontSize: '13px', fontWeight: 600 }}>공간 관리 자동화 SaaS</span>
          </div>
        </Fade>

        <Fade show={visible} delay={0.1}>
          <h1 style={{
            fontSize: 'clamp(44px, 7.5vw, 84px)', fontWeight: 800,
            lineHeight: 1.08, letterSpacing: '-2.5px', marginBottom: '28px',
          }}>
            <span style={{ color: '#ffffff' }}>공간 관리,</span><br />
            <GradText>이제 자동으로.</GradText>
          </h1>
        </Fade>

        <Fade show={visible} delay={0.2}>
          <p style={{
            color: 'rgba(255,255,255,0.48)', fontSize: 'clamp(15px,2vw,19px)',
            lineHeight: 1.75, maxWidth: '540px', marginBottom: '52px',
          }}>
            수납 매칭, 전자계약, 알림톡 발송까지<br />
            복잡한 공간 관리 업무를 한 곳에서 자동화합니다.
          </p>
        </Fade>

        <Fade show={visible} delay={0.3}>
          <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap', justifyContent: 'center' }}>
            {isLoggedIn ? (
              <>
                <PrimaryBtn large onClick={() => router.push('/dashboard')}>대시보드로 가기 →</PrimaryBtn>
                <GhostBtn onClick={() => router.push('/pricing')}>요금제 보기</GhostBtn>
              </>
            ) : (
              <>
                <PrimaryBtn large onClick={() => router.push('/signup')}>무료로 시작하기 →</PrimaryBtn>
                <GhostBtn onClick={() => router.push('/login')}>로그인</GhostBtn>
              </>
            )}
          </div>
        </Fade>

        {/* scroll hint */}
        <div style={{
          position: 'absolute', bottom: '36px', left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px', opacity: 0.35,
          animation: 'bounce 2.2s ease-in-out infinite',
        }}>
          <div style={{ width: '1px', height: '44px', background: 'linear-gradient(to bottom, transparent, rgba(168,218,220,0.7))' }} />
          <span style={{ color: '#a8dadc', fontSize: '10px', letterSpacing: '3px', fontWeight: 700 }}>SCROLL</span>
        </div>
      </section>

      {/* STATS */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '60px 24px',
        height: '100vh', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <SectionTag>숫자로 보는 노아도</SectionTag>
          <SectionTitle>임대 관리, 이렇게 달라집니다</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(220px,1fr))', gap: '20px', marginTop: '52px' }}>
            {STATS.map((s, i) => <StatCard key={i} {...s} i={i} show={showStats} />)}
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '60px 24px 80px',
        height: '100vh', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <SectionTag>핵심 기능</SectionTag>
          <SectionTitle>공간 관리의 모든 것</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))', gap: '16px', marginTop: '40px' }}>
            {FEATURES.map((f, i) => <FeatureCard key={i} {...f} i={i} show={showFeatures} />)}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '60px 24px 80px',
        height: '100vh', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: '760px', width: '100%', margin: '0 auto', textAlign: 'center' }}>
          <SectionTag>워크플로우</SectionTag>
          <SectionTitle>딱 3단계면 끝납니다</SectionTitle>
          <div style={{ marginTop: '64px', textAlign: 'left' }}>
            {STEPS.map((s, i) => <StepRow key={i} {...s} i={i} last={i === STEPS.length - 1} />)}
          </div>
        </div>
      </section>

      {/* PRODUCT TOUR */}
      <section style={{
        position: 'relative', zIndex: 1, padding: '80px 24px',
        minHeight: '100vh', display: 'flex', alignItems: 'center',
      }}>
        <div style={{ maxWidth: '1100px', width: '100%', margin: '0 auto' }}>
          <SectionTag>제품 둘러보기</SectionTag>
          <SectionTitle>실제 화면으로 만나보세요</SectionTitle>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontSize: '14px', marginTop: '12px', marginBottom: '48px' }}>
            실데이터 기반 — 20개 호실, 16개 입주사, 월 5,092,000원 수납 처리
          </p>
          <ProductTour />
        </div>
      </section>

      {/* PRICING + FOOTER — 한 화면에 */}
      <section style={{
        position: 'relative', zIndex: 1,
        minHeight: '100vh', display: 'flex', flexDirection: 'column',
      }}>
        {/* 요금제 */}
        <div style={{ flex: 1, display: 'flex', alignItems: 'center', padding: '60px 24px 40px' }}>
          <div style={{ maxWidth: '1020px', width: '100%', margin: '0 auto' }}>
            <SectionTag>요금제</SectionTag>
            <SectionTitle>합리적인 가격, 투명한 구조</SectionTitle>
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))',
              gap: '16px', marginTop: '40px',
            }}>
              {[
                {
                  name: '스타터', sub: 'Starter', price: '무료', priceSub: '평생 무료',
                  featured: false, badge: null,
                  features: ['사업장 1개 관리', '호실 최대 3개', '기본 대시보드 & 통계', '수동 수납 관리'],
                  cta: '무료로 시작', ctaHref: '/signup',
                },
                {
                  name: '비기너', sub: 'Beginner', price: '₩9,900', priceSub: '/ 월',
                  featured: true, badge: '인기',
                  features: ['사업장 1개 관리', '호실 최대 5개', 'AI 통장 입금 자동 매칭', '전자세금계산서 자동 발행', '카카오 자동 알림톡'],
                  cta: '시작하기', ctaHref: '/pricing',
                },
                {
                  name: '프로', sub: 'Pro', price: '₩19,900', priceSub: '/ 월',
                  featured: false, badge: null,
                  features: ['사업장 최대 3개 관리', '호실 최대 50개', '스마트 카드/가상계좌 수납', '전자세금계산서 자동 발행', '전자계약 & 서명'],
                  cta: '자세히 보기', ctaHref: '/pricing',
                },
              ].map((plan, pi) => (
                <div key={pi} style={{
                  position: 'relative', borderRadius: '20px', padding: '24px',
                  background: plan.featured
                    ? 'linear-gradient(145deg, rgba(29,53,87,0.7), rgba(69,123,157,0.3))'
                    : 'rgba(255,255,255,0.04)',
                  border: plan.featured
                    ? '1px solid rgba(168,218,220,0.35)'
                    : '1px solid rgba(255,255,255,0.07)',
                  transition: 'transform 0.3s', cursor: 'default',
                }}>
                  {plan.badge && (
                    <div style={{
                      position: 'absolute', top: '-12px', left: '50%', transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg,#a8dadc,#7bbfc1)', color: '#070d1a',
                      fontSize: '11px', fontWeight: 700, padding: '3px 12px', borderRadius: '100px',
                    }}>{plan.badge}</div>
                  )}
                  <div style={{ marginBottom: '4px' }}>
                    <span style={{ color: '#fff', fontSize: '17px', fontWeight: 700 }}>{plan.name}</span>
                    <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', marginLeft: '7px' }}>{plan.sub}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', margin: '12px 0 16px' }}>
                    <span style={{ fontSize: plan.price === '무료' ? '26px' : '30px', fontWeight: 800, color: plan.featured ? '#a8dadc' : '#fff' }}>{plan.price}</span>
                    <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '12px' }}>{plan.priceSub}</span>
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px', marginBottom: '18px' }}>
                    {plan.features.map((f, fi) => (
                      <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                        <span style={{ color: plan.featured ? '#a8dadc' : 'rgba(255,255,255,0.3)', fontSize: '13px', marginTop: '1px' }}>✓</span>
                        <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '12px' }}>{f}</span>
                      </div>
                    ))}
                  </div>
                  <button onClick={() => router.push(plan.ctaHref)} style={{
                    width: '100%', padding: '10px', borderRadius: '10px',
                    fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                    background: plan.featured ? 'linear-gradient(135deg,#a8dadc,#7bbfc1)' : 'rgba(168,218,220,0.1)',
                    color: plan.featured ? '#070d1a' : '#a8dadc',
                    border: plan.featured ? 'none' : '1px solid rgba(168,218,220,0.25)',
                  }}>{plan.cta} →</button>
                </div>
              ))}
            </div>
            <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '20px' }}>
              언제든 취소 가능 · 숨겨진 비용 없음 · 결제 후 7일 이내 전액 환불
            </p>
          </div>
        </div>

        {/* FOOTER */}
        <footer style={{
          position: 'relative', zIndex: 1,
          padding: '36px 48px 32px',
          borderTop: '1px solid rgba(255,255,255,0.07)',
        }}>
          {/* 상단: 로고 + 링크 */}
          <div style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
            flexWrap: 'wrap', gap: '20px', marginBottom: '28px',
          }}>
            <LogoMark />
            <div style={{ display: 'flex', gap: '24px', alignItems: 'center', paddingTop: '2px' }}>
              <a href="/terms"   style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.01em' }}>이용약관</a>
              <a href="/privacy" style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.01em' }}>개인정보처리방침</a>
              <a href="/refund"  style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px', textDecoration: 'none', letterSpacing: '0.01em' }}>환불정책</a>
            </div>
          </div>

          {/* 사업자 정보 */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 0',
            color: 'rgba(255,255,255,0.35)', fontSize: '12px', lineHeight: '1.8',
            marginBottom: '24px',
          }}>
            {[
              ['상호', '대우오피스'],
              ['대표자', '이동윤'],
              ['사업자등록번호', '127-44-85045'],
              ['대표전화', '031-970-0600'],
              ['이메일', 'knot4844@gmail.com'],
            ].map(([label, value]) => (
              <div key={label} style={{ marginRight: '32px', whiteSpace: 'nowrap' }}>
                <span style={{ color: 'rgba(255,255,255,0.2)', marginRight: '6px' }}>{label}</span>
                {label === '이메일'
                  ? <a href={`mailto:${value}`} style={{ color: 'rgba(255,255,255,0.35)', textDecoration: 'none' }}>{value}</a>
                  : value}
              </div>
            ))}
            <div style={{ width: '100%' }}>
              <span style={{ color: 'rgba(255,255,255,0.2)', marginRight: '6px' }}>주소</span>
              경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호
            </div>
          </div>

          {/* 하단: 카피라이트 */}
          <div style={{
            borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '16px',
            color: 'rgba(255,255,255,0.18)', fontSize: '11px', letterSpacing: '0.02em',
          }}>
            © 2026 noado. All rights reserved.
          </div>
        </footer>
      </section>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;600;700;800&display=swap');
        @keyframes bounce { 0%,100%{transform:translateX(-50%) translateY(0)} 50%{transform:translateX(-50%) translateY(10px)} }
        @keyframes pulseRing { 0%{transform:scale(1);opacity:0.55} 100%{transform:scale(1.9);opacity:0} }
      `}</style>
    </div>
  )
}

/* ─── 4점 별 ─── */
function drawStar4(ctx: CanvasRenderingContext2D, cx: number, cy: number, inner: number, outer: number) {
  ctx.beginPath()
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4, r = i % 2 === 0 ? outer : inner
    i === 0 ? ctx.moveTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
            : ctx.lineTo(cx + r * Math.cos(a), cy + r * Math.sin(a))
  }
  ctx.closePath(); ctx.fill()
}

/* ─── 공통 컴포넌트 ─── */
function Fade({ show, delay, children }: { show: boolean; delay: number; children: React.ReactNode }) {
  return (
    <div style={{
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(28px)',
      transition: `opacity 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}s, transform 0.85s cubic-bezier(0.16,1,0.3,1) ${delay}s`,
    }}>
      {children}
    </div>
  )
}
function GradText({ children }: { children: React.ReactNode }) {
  return (
    <span style={{
      background: 'linear-gradient(135deg,#a8dadc 0%,#7bbfc1 45%,#457b9d 100%)',
      WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
    }}>{children}</span>
  )
}
function LogoMark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        <rect width="28" height="28" rx="8" fill="#a8dadc" fillOpacity="0.13" />
        <path d="M7 20V10l7-4 7 4v10" stroke="#a8dadc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        <rect x="11" y="14" width="6" height="6" rx="1" stroke="#a8dadc" strokeWidth="1.6" />
      </svg>
      <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.4px' }}>noado</span>
    </div>
  )
}
function PrimaryBtn({ children, onClick, large }: { children: React.ReactNode; onClick: () => void; large?: boolean }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      padding: large ? '16px 42px' : '10px 22px', fontSize: large ? '15px' : '13px', fontWeight: 700,
      borderRadius: '12px', border: 'none', cursor: 'pointer', fontFamily: 'inherit', letterSpacing: '-0.2px',
      background: h ? 'linear-gradient(135deg,#b8eaec,#5b91bd)' : 'linear-gradient(135deg,#a8dadc,#457b9d)',
      color: '#070d1a', transform: h ? 'translateY(-2px)' : 'translateY(0)',
      boxShadow: h ? '0 10px 36px rgba(168,218,220,0.38)' : 'none', transition: 'all 0.2s ease',
    }}>{children}</button>
  )
}
function GhostBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  const [h, setH] = useState(false)
  return (
    <button onClick={onClick} onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      padding: '10px 22px', fontSize: '13px', fontWeight: 600, borderRadius: '12px', cursor: 'pointer',
      fontFamily: 'inherit', border: '1px solid rgba(168,218,220,0.28)',
      background: h ? 'rgba(168,218,220,0.1)' : 'transparent',
      color: h ? '#fff' : 'rgba(255,255,255,0.75)', transition: 'all 0.2s ease',
    }}>{children}</button>
  )
}
function PlainBtn({ children, onClick }: { children: React.ReactNode; onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
      color: 'rgba(255,255,255,0.65)', fontSize: '13px', fontWeight: 500, padding: '8px 14px',
    }}>{children}</button>
  )
}
function SectionTag({ children }: { children: string }) {
  return (
    <div style={{ textAlign: 'center', marginBottom: '14px' }}>
      <span style={{ color: '#a8dadc', fontSize: '11px', fontWeight: 700, letterSpacing: '3.5px', textTransform: 'uppercase' }}>
        {children}
      </span>
    </div>
  )
}
function SectionTitle({ children }: { children: string }) {
  return (
    <h2 style={{
      color: '#fff', fontSize: 'clamp(26px,4vw,46px)', fontWeight: 800,
      letterSpacing: '-1.2px', textAlign: 'center',
    }}>{children}</h2>
  )
}

/* ─── 통계 카드 ─── */
const STAT_COLORS = [
  { from: '#a8dadc', to: '#5b91bd', glow: 'rgba(168,218,220,0.18)', bg: 'rgba(168,218,220,0.07)', border: 'rgba(168,218,220,0.25)' },
  { from: '#c8b6ff', to: '#9b6dff', glow: 'rgba(200,182,255,0.18)', bg: 'rgba(200,182,255,0.07)', border: 'rgba(200,182,255,0.25)' },
  { from: '#ffd18c', to: '#f59e3a', glow: 'rgba(255,209,140,0.18)', bg: 'rgba(255,209,140,0.07)', border: 'rgba(255,209,140,0.25)' },
  { from: '#7eb8f7', to: '#3b7dd8', glow: 'rgba(126,184,247,0.18)', bg: 'rgba(126,184,247,0.07)', border: 'rgba(126,184,247,0.25)' },
]
function StatCard({ num, label, sub, i, show }: { num: string; label: string; sub: string; i: number; show: boolean }) {
  const [h, setH] = useState(false)
  const c = STAT_COLORS[i % STAT_COLORS.length]
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      background: h ? c.bg : 'rgba(255,255,255,0.04)',
      border: `1px solid ${h ? c.border : c.border.replace('0.25', '0.15')}`,
      borderRadius: '20px', padding: h ? '36px 28px' : '32px 24px', textAlign: 'center',
      position: 'relative', overflow: 'hidden',
      opacity: show ? 1 : 0,
      transform: show ? (h ? 'translateY(-8px) scale(1.03)' : 'translateY(0) scale(1)') : 'translateY(32px) scale(1)',
      boxShadow: h ? `0 24px 60px ${c.glow}, 0 0 0 1px ${c.border}` : `0 0 0 1px ${c.border.replace('0.25','0.08')}`,
      transition: show
        ? `background 0.25s ease, border 0.25s ease, box-shadow 0.25s ease, transform 0.3s cubic-bezier(0.34,1.56,0.64,1), padding 0.3s ease`
        : `opacity 0.75s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`,
      cursor: 'default',
    }}>
      {/* 상단 컬러 바 */}
      <div style={{
        position: 'absolute', top: 0, left: '20%', right: '20%', height: '2px', borderRadius: '0 0 4px 4px',
        background: `linear-gradient(90deg, ${c.from}, ${c.to})`,
        boxShadow: `0 0 12px ${c.from}`,
      }} />
      <div style={{
        fontSize: h ? '54px' : '48px', fontWeight: 800, letterSpacing: '-2px', marginBottom: '10px',
        background: `linear-gradient(135deg, ${c.from}, ${c.to})`,
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        transition: 'font-size 0.3s cubic-bezier(0.34,1.56,0.64,1)',
      }}>{num}</div>
      <div style={{
        color: '#fff', fontWeight: 700, fontSize: h ? '16px' : '14px', marginBottom: '6px',
        transition: 'font-size 0.25s ease',
      }}>{label}</div>
      <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '13px' }}>{sub}</div>
    </div>
  )
}

/* ─── 기능 카드 ─── */
function FeatureCard({ icon, title, desc, color, i, show }: {
  icon: string; title: string; desc: string; color: string; i: number; show: boolean
}) {
  const [h, setH] = useState(false)
  return (
    <div onMouseEnter={() => setH(true)} onMouseLeave={() => setH(false)} style={{
      background: h
        ? `linear-gradient(145deg, ${color}18, ${color}08)`
        : `linear-gradient(145deg, ${color}0e, rgba(255,255,255,0.02))`,
      border: `1px solid ${h ? color + '55' : color + '28'}`,
      borderRadius: '16px', padding: h ? '26px 24px' : '22px 20px',
      position: 'relative', overflow: 'hidden',
      opacity: show ? 1 : 0,
      transform: show
        ? (h ? 'translateY(-10px) scale(1.02)' : 'translateY(0) scale(1)')
        : 'translateY(40px) scale(1)',
      transition: show
        ? `background 0.25s ease, border 0.25s ease, padding 0.3s ease, box-shadow 0.25s ease, transform 0.35s cubic-bezier(0.34,1.56,0.64,1)`
        : `opacity 0.75s ease ${i * 0.08}s, transform 0.75s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s`,
      boxShadow: h ? `0 20px 60px ${color}22, 0 0 0 1px ${color}30` : `0 0 0 1px ${color}15`,
      cursor: 'default',
    }}>
      {/* 배경 glow blob */}
      <div style={{
        position: 'absolute', top: '-30px', right: '-30px',
        width: '100px', height: '100px', borderRadius: '50%',
        background: `radial-gradient(circle, ${color}22 0%, transparent 70%)`,
        pointerEvents: 'none',
      }} />
      <div style={{
        width: '44px', height: '44px',
        borderRadius: '14px', fontSize: '20px',
        background: `linear-gradient(135deg, ${color}33, ${color}18)`,
        border: `1px solid ${color}50`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '16px',
        boxShadow: h ? `0 8px 24px ${color}40` : `0 4px 12px ${color}20`,
        transition: 'all 0.3s cubic-bezier(0.34,1.56,0.64,1)',
        transform: h ? 'scale(1.1)' : 'scale(1)',
      }}>{icon}</div>
      <h3 style={{
        color: h ? '#fff' : 'rgba(255,255,255,0.92)',
        fontSize: '15px', fontWeight: 700, marginBottom: '8px', letterSpacing: '-0.3px',
        transition: 'color 0.2s ease',
      }}>{title}</h3>
      <p style={{
        color: h ? 'rgba(255,255,255,0.62)' : 'rgba(255,255,255,0.48)',
        fontSize: '13px', lineHeight: 1.65, transition: 'color 0.2s ease',
      }}>{desc}</p>
    </div>
  )
}

/* ─── 단계 ─── */
function StepRow({ step, title, desc, i, last }: { step: string; title: string; desc: string; i: number; last: boolean }) {
  const [h, setH] = useState(false)
  return (
    <div
      onMouseEnter={() => setH(true)}
      onMouseLeave={() => setH(false)}
      style={{
        display: 'flex', gap: '24px', alignItems: 'flex-start',
        background: h ? 'rgba(168,218,220,0.05)' : 'transparent',
        border: `1px solid ${h ? 'rgba(168,218,220,0.2)' : 'transparent'}`,
        borderRadius: '16px', padding: '16px 20px', marginBottom: last ? 0 : '8px',
        transform: h ? 'translateY(-4px)' : 'translateY(0)',
        boxShadow: h ? '0 12px 40px rgba(168,218,220,0.1)' : 'none',
        transition: 'all 0.25s cubic-bezier(0.34,1.56,0.64,1)',
        cursor: 'default',
      }}
    >
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, position: 'relative',
          background: h
            ? 'linear-gradient(135deg,rgba(168,218,220,0.3),rgba(69,123,157,0.3))'
            : 'linear-gradient(135deg,rgba(168,218,220,0.15),rgba(69,123,157,0.15))',
          border: `1px solid ${h ? 'rgba(168,218,220,0.7)' : 'rgba(168,218,220,0.4)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#a8dadc', fontSize: '13px', fontWeight: 800,
          boxShadow: h ? '0 0 20px rgba(168,218,220,0.3)' : 'none',
          transition: 'all 0.25s ease',
        }}>
          {step}
          <div style={{
            position: 'absolute', inset: '-4px', borderRadius: '50%',
            border: '1px solid rgba(168,218,220,0.2)',
            animation: 'pulseRing 2.8s ease-out infinite', animationDelay: `${i * 0.9}s`,
          }} />
        </div>
        {!last && <div style={{ width: '1px', height: '32px', background: 'linear-gradient(to bottom, rgba(168,218,220,0.3), transparent)', marginTop: '8px' }} />}
      </div>
      <div style={{ paddingTop: '10px' }}>
        <h3 style={{
          color: h ? '#a8dadc' : '#fff',
          fontSize: h ? '18px' : '17px', fontWeight: 700, marginBottom: '8px',
          transition: 'all 0.2s ease',
        }}>{title}</h3>
        <p style={{
          color: h ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.42)',
          fontSize: '14px', lineHeight: 1.75,
          transition: 'color 0.2s ease',
        }}>{desc}</p>
      </div>
    </div>
  )
}

/* ─── 데이터 ─── */
const STATS = [
  { num: '98%',  label: '수납 자동매칭률',    sub: '은행 엑셀 업로드 한 번으로 자동 분류' },
  { num: '3분',  label: '월 수납 마감 시간',  sub: '기존 수작업 대비 97% 시간 단축' },
  { num: '0원',  label: '초기 도입 비용',     sub: '설치 없이 브라우저에서 바로 시작' },
  { num: '24/7', label: '실시간 현황 모니터링', sub: '스마트폰으로 언제 어디서나 확인' },
]

const FEATURES = [
  { icon: '🏦', color: '#a8dadc', title: '은행 엑셀 → 수납 자동매칭',
    desc: '매월 은행에서 받은 입금내역 엑셀을 올리면 입주사·호실과 자동으로 연결됩니다. (주)·주식회사 같은 법인명도 정규화해서 정확하게 매칭.' },
  { icon: '📋', color: '#c8b6ff', title: '전자계약 & 온라인 서명',
    desc: '계약서를 직접 출력·방문 없이 카카오톡 링크로 발송. 입주사가 스마트폰으로 서명하면 PDF로 자동 보관됩니다.' },
  { icon: '💬', color: '#ffd18c', title: '카카오 알림톡 자동발송',
    desc: '청구서 생성 시 결제 링크 자동 발송, 납부기한 D-3 사전 안내, 미납 시 독촉, 완납 확인까지 전부 자동.' },
  { icon: '🏢', color: '#7eb8f7', title: '호실·입주사 통합 관리',
    desc: '공실·입주·완납·미납 상태를 한눈에. 입주사별 계약기간, 월 이용료, 납부이력을 연도별로 조회 가능.' },
  { icon: '💳', color: '#86efac', title: '가상계좌 온라인 수납',
    desc: '입주사에게 전용 결제 링크를 보내면 본인 명의 가상계좌로 입금 가능. 입금 즉시 수납 완료 처리.' },
  { icon: '📊', color: '#f9a8d4', title: '수납 보고서 & 세무자료',
    desc: '월별 수납현황, 미납 현황, 부가세 자료를 엑셀로 내보내기. 세무사에게 바로 전달할 수 있는 포맷 제공.' },
]

/* ─── 프로덕트 투어 ─── */
const TOUR_SLIDES = [
  {
    id: 'dashboard', label: '대시보드', icon: '📊',
    color: '#a8dadc',
    title: 'AI 브리핑 & KPI 한눈에',
    desc: '오늘의 수납 현황, 미납 알림, 입주율을 실시간으로 확인합니다.',
    mockup: {
      type: 'kpi' as const,
      stats: [
        { label: '이번 달 수납', value: '5,092,000원', badge: '94%', color: '#34d399' },
        { label: '미납 총액', value: '330,000원', badge: '1세대', color: '#f87171' },
        { label: '입주율', value: '80%', badge: '16/20', color: '#60a5fa' },
        { label: '수납 완료', value: '15세대', badge: '', color: '#a8dadc' },
      ],
      feed: [
        { room: '238호', tenant: '강육희', amount: '+280,000원' },
        { room: '237호', tenant: '더부띠끄', amount: '+605,000원' },
        { room: '236호', tenant: '미래씨앤에스', amount: '+330,000원' },
      ],
    },
  },
  {
    id: 'units', label: '호실 관리', icon: '🏢',
    color: '#7eb8f7',
    title: '20개 호실 실시간 현황',
    desc: '공실/입주/납부 상태를 한눈에 파악하고 즉시 관리합니다.',
    mockup: {
      type: 'rooms' as const,
      summary: { total: 20, paid: 15, overdue: 1, vacant: 4 },
      rooms: [
        { name: '212호', tenant: '한규동', status: '미납' },
        { name: '213호', tenant: '기업경영연구소', status: '완납' },
        { name: '214호', tenant: '(주)더파트너즈', status: '완납' },
        { name: '215호', tenant: '주상완', status: '완납' },
        { name: '218호', tenant: '인용식', status: '완납' },
        { name: '221호', tenant: '—', status: '공실' },
      ],
    },
  },
  {
    id: 'payments', label: '수납 매칭', icon: '🏦',
    color: '#c8b6ff',
    title: 'AI가 자동으로 매칭합니다',
    desc: '은행 엑셀 업로드 → Gemini AI 분석 → 15/16건 자동 매칭 성공.',
    mockup: {
      type: 'matching' as const,
      total: '5,422,000원',
      matched: '5,092,000원',
      rate: '94%',
      items: [
        { note: '강육희 3월이용료', room: '238호', amount: '280,000', status: 'AI 매칭' },
        { note: '주식회사더부띠끄 3월', room: '237호', amount: '605,000', status: 'AI 매칭' },
        { note: '주식회사미래씨앤에스', room: '236호', amount: '330,000', status: 'AI 매칭' },
        { note: '박상민-이용료03', room: '235호', amount: '275,000', status: 'AI 매칭' },
      ],
    },
  },
  {
    id: 'tenants', label: '입주사 관리', icon: '👥',
    color: '#ffd18c',
    title: '12개월 납부 이력 한눈에',
    desc: '16개 입주사의 계약 현황, 월 이용료, 납부 도트를 실시간 조회합니다.',
    mockup: {
      type: 'tenants' as const,
      count: 16,
      tenants: [
        { name: '기업경영연구소', room: '213호', rent: '308,000원', dots: 12 },
        { name: '(주)더파트너즈', room: '214호', rent: '330,000원', dots: 12 },
        { name: '주상완', room: '215호', rent: '253,000원', dots: 11 },
        { name: '인용식', room: '218호', rent: '275,000원', dots: 12 },
      ],
    },
  },
  {
    id: 'notifications', label: '알림톡', icon: '💬',
    color: '#86efac',
    title: '카카오톡 16건 발송 성공',
    desc: '청구서 생성 시 결제 링크 자동 발송. 성공률 100%.',
    mockup: {
      type: 'notifications' as const,
      total: 16, success: 16, fail: 0,
      recent: [
        { to: '강육희', template: 'INVOICE_ISSUED', status: '성공' },
        { to: '주식회사더부띠끄', template: 'INVOICE_ISSUED', status: '성공' },
        { to: '주식회사미래씨앤에스', template: 'INVOICE_ISSUED', status: '성공' },
        { to: '박상민', template: 'INVOICE_ISSUED', status: '성공' },
      ],
    },
  },
  {
    id: 'contracts', label: '전자계약', icon: '📋',
    color: '#f9a8d4',
    title: '계약서 작성 & 전자서명',
    desc: '카카오톡으로 계약서 발송, 스마트폰에서 서명 후 PDF 보관.',
    mockup: {
      type: 'contracts' as const,
      statuses: [
        { label: '초안', count: 0, icon: '✏️' },
        { label: '발송됨', count: 0, icon: '📤' },
        { label: '서명완료', count: 0, icon: '✅' },
        { label: '만료됨', count: 0, icon: '⏰' },
      ],
    },
  },
]

function ProductTour() {
  const [active, setActive] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const slide = TOUR_SLIDES[active]

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  useEffect(() => {
    if (isPaused) return
    const timer = setInterval(() => {
      setActive(prev => (prev + 1) % TOUR_SLIDES.length)
    }, 4000)
    return () => clearInterval(timer)
  }, [isPaused])

  /* ── 모바일 레이아웃 ── */
  if (isMobile) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
        {/* 가로 스크롤 탭 바 */}
        <div style={{
          display: 'flex', gap: '8px', overflowX: 'auto', width: '100%',
          paddingBottom: '4px', msOverflowStyle: 'none',
        } as React.CSSProperties}>
          {TOUR_SLIDES.map((s, i) => (
            <button key={s.id} onClick={() => { setActive(i); setIsPaused(true) }} style={{
              flexShrink: 0, display: 'flex', alignItems: 'center', gap: '6px',
              padding: '8px 14px', borderRadius: '20px', cursor: 'pointer',
              background: i === active ? `linear-gradient(135deg,${s.color}33,${s.color}15)` : 'rgba(255,255,255,0.05)',
              border: i === active ? `1px solid ${s.color}88` : '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'inherit', transition: 'all 0.25s ease',
            }}>
              <span style={{ fontSize: '15px' }}>{s.icon}</span>
              <span style={{
                color: i === active ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '12px', fontWeight: i === active ? 700 : 500, whiteSpace: 'nowrap',
              }}>{s.label}</span>
            </button>
          ))}
        </div>

        {/* 설명 */}
        <div style={{ textAlign: 'center', padding: '0 4px' }}>
          <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: 700, marginBottom: '6px' }}>
            <span style={{ color: slide.color, marginRight: '6px' }}>{slide.icon}</span>
            {slide.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '13px', lineHeight: 1.5 }}>{slide.desc}</p>
        </div>

        {/* 폰 목업 */}
        <div style={{
          position: 'relative', margin: '0 auto',
          width: '270px', height: '460px',
          borderRadius: '30px', padding: '10px',
          background: 'linear-gradient(145deg,rgba(255,255,255,0.12),rgba(255,255,255,0.04))',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: `0 20px 60px rgba(0,0,0,0.5),0 0 40px ${slide.color}15`,
          transition: 'box-shadow 0.5s ease',
        }}>
          <div style={{
            position: 'absolute', top: '10px', left: '50%', transform: 'translateX(-50%)',
            width: '90px', height: '18px', borderRadius: '9px',
            background: 'rgba(0,0,0,0.6)', zIndex: 10,
          }} />
          <div style={{
            width: '100%', height: '100%', borderRadius: '20px', overflow: 'hidden',
            background: 'linear-gradient(180deg,#f8faf9 0%,#f0f4f2 100%)',
          }}>
            <TourScreen slide={slide} />
          </div>
        </div>

        {/* 네비게이션 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px' }}>
          {TOUR_SLIDES.map((s, i) => (
            <button key={i} onClick={() => { setActive(i); setIsPaused(true) }} style={{
              width: i === active ? '24px' : '7px', height: '7px',
              borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: i === active ? s.color : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>
    )
  }

  /* ── 데스크톱 레이아웃 ── */
  return (
    <div
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
      style={{ display: 'flex', gap: '40px', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}
    >
      {/* 왼쪽: 기능 탭 목록 */}
      <div style={{ flex: '0 0 280px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
        {TOUR_SLIDES.map((s, i) => (
          <button key={s.id} onClick={() => setActive(i)} style={{
            display: 'flex', alignItems: 'center', gap: '12px',
            padding: '14px 18px', borderRadius: '14px', border: 'none', cursor: 'pointer',
            background: i === active
              ? `linear-gradient(135deg, ${s.color}22, ${s.color}0a)`
              : 'transparent',
            borderLeft: i === active ? `3px solid ${s.color}` : '3px solid transparent',
            transition: 'all 0.3s ease',
            fontFamily: 'inherit',
          }}>
            <span style={{ fontSize: '20px' }}>{s.icon}</span>
            <div style={{ textAlign: 'left' }}>
              <div style={{
                color: i === active ? '#fff' : 'rgba(255,255,255,0.5)',
                fontSize: '14px', fontWeight: i === active ? 700 : 500,
                transition: 'all 0.3s ease',
              }}>{s.label}</div>
              {i === active && (
                <div style={{ color: 'rgba(255,255,255,0.35)', fontSize: '11px', marginTop: '2px' }}>
                  {s.desc.slice(0, 30)}...
                </div>
              )}
            </div>
          </button>
        ))}
      </div>

      {/* 오른쪽: 폰 목업 + 설명 */}
      <div style={{ flex: '1 1 400px', maxWidth: '700px' }}>
        {/* 상단 설명 */}
        <div style={{ marginBottom: '24px', textAlign: 'center' }}>
          <h3 style={{
            color: '#fff', fontSize: '22px', fontWeight: 700, marginBottom: '8px',
            transition: 'all 0.3s ease',
          }}>
            <span style={{ color: slide.color, marginRight: '8px' }}>{slide.icon}</span>
            {slide.title}
          </h3>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '14px' }}>{slide.desc}</p>
        </div>

        {/* 폰 프레임 */}
        <div style={{
          position: 'relative', margin: '0 auto',
          width: '340px', height: '580px',
          borderRadius: '36px', padding: '12px',
          background: 'linear-gradient(145deg, rgba(255,255,255,0.12), rgba(255,255,255,0.04))',
          border: '1px solid rgba(255,255,255,0.1)',
          boxShadow: `0 30px 80px rgba(0,0,0,0.5), 0 0 60px ${slide.color}15`,
          transition: 'box-shadow 0.5s ease',
        }}>
          {/* 노치 */}
          <div style={{
            position: 'absolute', top: '12px', left: '50%', transform: 'translateX(-50%)',
            width: '120px', height: '24px', borderRadius: '12px',
            background: 'rgba(0,0,0,0.6)', zIndex: 10,
          }} />

          {/* 화면 내용 */}
          <div style={{
            width: '100%', height: '100%', borderRadius: '24px', overflow: 'hidden',
            background: 'linear-gradient(180deg, #f8faf9 0%, #f0f4f2 100%)',
          }}>
            <TourScreen slide={slide} />
          </div>
        </div>

        {/* 네비게이션 도트 */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: '8px', marginTop: '24px' }}>
          {TOUR_SLIDES.map((s, i) => (
            <button key={i} onClick={() => setActive(i)} style={{
              width: i === active ? '28px' : '8px', height: '8px',
              borderRadius: '4px', border: 'none', cursor: 'pointer',
              background: i === active ? s.color : 'rgba(255,255,255,0.2)',
              transition: 'all 0.3s ease',
            }} />
          ))}
        </div>
      </div>
    </div>
  )
}

/* eslint-disable @typescript-eslint/no-explicit-any */
function TourScreen({ slide }: { slide: any }) {
  const m = slide.mockup

  /* 공통 헤더 */
  const Header = ({ title }: { title: string }) => (
    <div style={{
      padding: '40px 16px 12px', background: `linear-gradient(135deg, ${slide.color}18, ${slide.color}08)`,
      borderBottom: '1px solid rgba(0,0,0,0.06)',
    }}>
      <div style={{ fontSize: '16px', fontWeight: 800, color: '#1a2332', letterSpacing: '-0.5px' }}>{title}</div>
    </div>
  )

  if (m.type === 'kpi') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="대시보드" />
        {/* AI 브리핑 */}
        <div style={{ margin: '12px', padding: '12px 14px', borderRadius: '12px', background: '#f0f7ff', border: '1px solid #d0e7ff' }}>
          <div style={{ fontSize: '10px', fontWeight: 700, color: '#457b9d', marginBottom: '6px' }}>✨ AI 일일 브리핑</div>
          <div style={{ fontSize: '11px', color: '#456', lineHeight: 1.5 }}>
            현재 미납 <span style={{ color: '#ef4444', fontWeight: 700 }}>1세대 (330,000원)</span> 주의가 필요합니다.
          </div>
        </div>
        {/* KPI 그리드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '0 12px' }}>
          {m.stats.map((s: any, i: number) => (
            <div key={i} style={{
              padding: '12px', borderRadius: '12px', background: '#fff',
              border: '1px solid rgba(0,0,0,0.06)',
            }}>
              {s.badge && (
                <span style={{
                  fontSize: '9px', fontWeight: 700, color: s.color, background: s.color + '18',
                  padding: '2px 6px', borderRadius: '4px',
                }}>{s.badge}</span>
              )}
              <div style={{ fontSize: '17px', fontWeight: 800, color: '#1a2332', marginTop: '4px' }}>{s.value}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{s.label}</div>
            </div>
          ))}
        </div>
        {/* 최근 수납 */}
        <div style={{ padding: '12px', marginTop: '4px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a2332', marginBottom: '8px' }}>최근 수납</div>
          {m.feed.map((f: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '8px 10px', marginBottom: '4px', borderRadius: '8px', background: '#fff',
              border: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a2332' }}>{f.room} · {f.tenant}</div>
              </div>
              <div style={{ fontSize: '12px', fontWeight: 700, color: '#10b981' }}>{f.amount}</div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.type === 'rooms') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="호실 현황" />
        {/* 요약 탭 */}
        <div style={{ display: 'flex', gap: '4px', padding: '10px 12px' }}>
          {[
            { l: `전체 ${m.summary.total}`, active: true },
            { l: `납부완료 ${m.summary.paid}`, active: false },
            { l: `미납 ${m.summary.overdue}`, active: false },
            { l: `공실 ${m.summary.vacant}`, active: false },
          ].map((t, i) => (
            <div key={i} style={{
              padding: '6px 10px', borderRadius: '8px', fontSize: '10px', fontWeight: 600,
              background: t.active ? '#1a2332' : '#f0f2f4', color: t.active ? '#fff' : '#888',
            }}>{t.l}</div>
          ))}
        </div>
        {/* 호실 목록 */}
        <div style={{ padding: '0 12px' }}>
          {m.rooms.map((r: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '12px 10px', borderBottom: '1px solid rgba(0,0,0,0.05)',
            }}>
              <div>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#1a2332' }}>{r.name}</span>
                <span style={{ fontSize: '11px', color: '#888', marginLeft: '10px' }}>{r.tenant}</span>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 600, padding: '3px 8px', borderRadius: '6px',
                background: r.status === '완납' ? '#d1fae5' : r.status === '미납' ? '#fee2e2' : '#f0f2f4',
                color: r.status === '완납' ? '#059669' : r.status === '미납' ? '#dc2626' : '#888',
              }}>{r.status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.type === 'matching') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="수납 매칭" />
        {/* 요약 카드 */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 12px' }}>
          {[
            { l: '총 청구', v: m.total, c: '#1a2332' },
            { l: '수납 완료', v: m.matched, c: '#10b981' },
            { l: '매칭률', v: m.rate, c: '#8b5cf6' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '10px 8px', borderRadius: '10px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '13px', fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* Gemini AI 배너 */}
        <div style={{
          margin: '4px 12px 8px', padding: '8px 12px', borderRadius: '10px',
          background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)',
          border: '1px solid #c4b5fd',
          display: 'flex', alignItems: 'center', gap: '8px',
        }}>
          <div style={{
            width: '24px', height: '24px', borderRadius: '50%',
            background: 'linear-gradient(135deg, #8b5cf6, #6366f1)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: '12px', color: '#fff',
          }}>✦</div>
          <div>
            <div style={{ fontSize: '10px', fontWeight: 700, color: '#6d28d9' }}>Gemini AI 매칭 완료</div>
            <div style={{ fontSize: '9px', color: '#7c3aed' }}>15/16건 자동 매칭 성공</div>
          </div>
        </div>
        {/* 매칭 결과 */}
        <div style={{ padding: '0 12px' }}>
          {m.items.map((item: any, i: number) => (
            <div key={i} style={{
              padding: '10px', marginBottom: '4px', borderRadius: '10px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.05)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '11px', color: '#456', maxWidth: '160px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.note}</div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '2px 6px', borderRadius: '4px',
                  background: 'linear-gradient(135deg, #ede9fe, #e0e7ff)', color: '#7c3aed',
                }}>{item.status}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '4px' }}>
                <span style={{ fontSize: '10px', color: '#888' }}>→ {item.room}</span>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#1a2332' }}>{item.amount}원</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.type === 'tenants') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="입주사 관리" />
        <div style={{ padding: '10px 12px' }}>
          <div style={{ display: 'flex', gap: '8px', marginBottom: '12px' }}>
            <div style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 700, background: '#1a2332', color: '#fff' }}>전체 {m.count}</div>
            <div style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: '#f0f2f4', color: '#888' }}>완납 15</div>
            <div style={{ padding: '5px 12px', borderRadius: '8px', fontSize: '11px', fontWeight: 600, background: '#f0f2f4', color: '#888' }}>미납 1</div>
          </div>
          {m.tenants.map((t: any, i: number) => (
            <div key={i} style={{
              padding: '14px 12px', marginBottom: '8px', borderRadius: '14px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                <div>
                  <span style={{ fontSize: '10px', color: '#888' }}>{t.room}</span>
                  <div style={{ fontSize: '13px', fontWeight: 700, color: '#1a2332' }}>{t.name}</div>
                </div>
                <span style={{
                  fontSize: '9px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                  background: '#d1fae5', color: '#059669',
                }}>완납</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '11px', color: '#888' }}>월 이용료 {t.rent}</span>
                <div style={{ display: 'flex', gap: '3px' }}>
                  {Array.from({ length: Math.min(t.dots, 12) }).map((_, di) => (
                    <div key={di} style={{
                      width: '6px', height: '6px', borderRadius: '50%',
                      background: di < t.dots ? '#10b981' : '#e5e7eb',
                    }} />
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.type === 'notifications') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="알림톡" />
        {/* 요약 */}
        <div style={{ display: 'flex', gap: '6px', padding: '10px 12px' }}>
          {[
            { l: '총 발송', v: m.total, c: '#1a2332' },
            { l: '성공', v: m.success, c: '#10b981' },
            { l: '실패', v: m.fail, c: '#ef4444' },
          ].map((s, i) => (
            <div key={i} style={{
              flex: 1, padding: '14px 8px', borderRadius: '12px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.06)', textAlign: 'center',
            }}>
              <div style={{ fontSize: '22px', fontWeight: 800, color: s.c }}>{s.v}</div>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '2px' }}>{s.l}</div>
            </div>
          ))}
        </div>
        {/* 발송 이력 */}
        <div style={{ padding: '4px 12px' }}>
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#1a2332', marginBottom: '8px' }}>발송 이력</div>
          {m.recent.map((r: any, i: number) => (
            <div key={i} style={{
              display: 'flex', justifyContent: 'space-between', alignItems: 'center',
              padding: '10px', marginBottom: '4px', borderRadius: '10px',
              background: '#fff', border: '1px solid rgba(0,0,0,0.04)',
            }}>
              <div>
                <div style={{ fontSize: '11px', fontWeight: 600, color: '#1a2332' }}>{r.to}</div>
                <div style={{ fontSize: '9px', color: '#888', marginTop: '2px' }}>{r.template}</div>
              </div>
              <span style={{
                fontSize: '10px', fontWeight: 700, padding: '3px 8px', borderRadius: '6px',
                background: '#d1fae5', color: '#059669',
              }}>✓ {r.status}</span>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (m.type === 'contracts') {
    return (
      <div style={{ height: '100%', overflowY: 'auto' }}>
        <Header title="전자계약" />
        {/* 상태 카드 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', padding: '12px' }}>
          {m.statuses.map((s: any, i: number) => (
            <div key={i} style={{
              padding: '16px 12px', borderRadius: '12px', textAlign: 'center',
              background: '#fff', border: '1px solid rgba(0,0,0,0.06)',
            }}>
              <span style={{ fontSize: '18px' }}>{s.icon}</span>
              <div style={{ fontSize: '10px', color: '#888', marginTop: '4px' }}>{s.label}</div>
              <div style={{ fontSize: '22px', fontWeight: 800, color: '#1a2332', marginTop: '2px' }}>{s.count}</div>
            </div>
          ))}
        </div>
        {/* CTA */}
        <div style={{ padding: '12px', textAlign: 'center' }}>
          <div style={{
            padding: '14px', borderRadius: '12px',
            background: 'linear-gradient(135deg, #1a2332, #2d3748)',
            color: '#fff', fontSize: '13px', fontWeight: 700,
          }}>+ 계약서 작성</div>
          <p style={{ fontSize: '10px', color: '#aaa', marginTop: '10px', lineHeight: 1.6 }}>
            카카오톡으로 계약서 발송<br />스마트폰에서 전자서명
          </p>
        </div>
      </div>
    )
  }

  return null
}
/* eslint-enable @typescript-eslint/no-explicit-any */

const STEPS = [
  { step: '01', title: '호실 & 입주사 등록 (5분)',
    desc: '건물명·호실번호·입주사명·월 이용료를 입력합니다. 기존 엑셀이 있으면 한 번에 가져올 수 있습니다.' },
  { step: '02', title: '은행 입금내역 업로드 (1분)',
    desc: '매월 은행 앱·인터넷뱅킹에서 내려받은 거래내역 엑셀 파일을 업로드합니다. 입주사명으로 자동 매칭 제안이 뜹니다.' },
  { step: '03', title: '검토 후 수납 확정 (1분)',
    desc: '자동 매칭 결과를 확인하고 확정 버튼 클릭. 카카오 알림톡 발송, 호실 상태 업데이트, 보고서 생성이 한 번에 처리됩니다.' },
]
