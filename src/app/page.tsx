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
  const [scrollY, setScrollY]     = useState(0)
  const [visible, setVisible]     = useState(false)
  const [checking, setChecking]   = useState(true)
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

  /* 스크롤 */
  useEffect(() => {
    const fn = () => setScrollY(window.scrollY)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  if (checking) return null


  return (
    <div style={{ background: '#070d1a', minHeight: '100vh', overflowX: 'hidden', fontFamily: "'Space Grotesk',sans-serif" }}>
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
        position: 'relative', zIndex: 1, minHeight: '100vh',
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
      <section style={{ position: 'relative', zIndex: 1, padding: '40px 24px 80px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(210px,1fr))', gap: '20px' }}>
          {STATS.map((s, i) => <StatCard key={i} {...s} i={i} show={scrollY > 350} />)}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ position: 'relative', zIndex: 1, padding: '60px 24px 120px' }}>
        <div style={{ maxWidth: '1100px', margin: '0 auto' }}>
          <SectionTag>핵심 기능</SectionTag>
          <SectionTitle>공간 관리의 모든 것</SectionTitle>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(300px,1fr))', gap: '20px', marginTop: '56px' }}>
            {FEATURES.map((f, i) => <FeatureCard key={i} {...f} i={i} show={scrollY > 720} />)}
          </div>
        </div>
      </section>

      {/* STEPS */}
      <section style={{ position: 'relative', zIndex: 1, padding: '60px 24px 120px' }}>
        <div style={{ maxWidth: '760px', margin: '0 auto', textAlign: 'center' }}>
          <SectionTag>워크플로우</SectionTag>
          <SectionTitle>딱 3단계면 끝납니다</SectionTitle>
          <div style={{ marginTop: '64px', textAlign: 'left' }}>
            {STEPS.map((s, i) => <StepRow key={i} {...s} i={i} last={i === STEPS.length - 1} />)}
          </div>
        </div>
      </section>

      {/* PRICING */}
      <section style={{ position: 'relative', zIndex: 1, padding: '60px 24px 120px' }}>
        <div style={{ maxWidth: '1020px', margin: '0 auto' }}>
          <SectionTag>요금제</SectionTag>
          <SectionTitle>합리적인 가격, 투명한 구조</SectionTitle>
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(280px,1fr))',
            gap: '20px', marginTop: '56px',
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
                position: 'relative', borderRadius: '20px', padding: '28px',
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
                <div style={{ marginBottom: '6px' }}>
                  <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700 }}>{plan.name}</span>
                  <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', marginLeft: '7px' }}>{plan.sub}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '5px', margin: '16px 0 20px' }}>
                  <span style={{ fontSize: plan.price === '무료' ? '28px' : '32px', fontWeight: 800, color: plan.featured ? '#a8dadc' : '#fff' }}>{plan.price}</span>
                  <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>{plan.priceSub}</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '9px', marginBottom: '24px' }}>
                  {plan.features.map((f, fi) => (
                    <div key={fi} style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                      <span style={{ color: plan.featured ? '#a8dadc' : 'rgba(255,255,255,0.3)', fontSize: '14px', marginTop: '1px' }}>✓</span>
                      <span style={{ color: 'rgba(255,255,255,0.6)', fontSize: '13px' }}>{f}</span>
                    </div>
                  ))}
                </div>
                <button onClick={() => router.push(plan.ctaHref)} style={{
                  width: '100%', padding: '11px', borderRadius: '10px',
                  fontSize: '13px', fontWeight: 700, cursor: 'pointer',
                  background: plan.featured ? 'linear-gradient(135deg,#a8dadc,#7bbfc1)' : 'rgba(168,218,220,0.1)',
                  color: plan.featured ? '#070d1a' : '#a8dadc',
                  border: plan.featured ? 'none' : '1px solid rgba(168,218,220,0.25)',
                }}>{plan.cta} →</button>
              </div>
            ))}
          </div>
          <p style={{ textAlign: 'center', color: 'rgba(255,255,255,0.25)', fontSize: '12px', marginTop: '28px' }}>
            언제든 취소 가능 · 숨겨진 비용 없음 · 결제 후 7일 이내 전액 환불
          </p>
        </div>
      </section>

      {/* CTA */}
      <section style={{ position: 'relative', zIndex: 1, padding: '80px 24px 140px' }}>
        <div style={{
          maxWidth: '700px', margin: '0 auto', textAlign: 'center',
          background: 'linear-gradient(135deg, rgba(69,123,157,0.14), rgba(168,218,220,0.07))',
          border: '1px solid rgba(168,218,220,0.18)', borderRadius: '32px',
          padding: '80px 40px', position: 'relative', overflow: 'hidden',
        }}>
          <div style={{
            position: 'absolute', top: '-40%', left: '50%', transform: 'translateX(-50%)',
            width: '400px', height: '300px', borderRadius: '50%', pointerEvents: 'none',
            background: 'radial-gradient(circle, rgba(168,218,220,0.1), transparent 70%)',
          }} />
          <h2 style={{ color: '#fff', fontSize: 'clamp(26px,4vw,44px)', fontWeight: 800, letterSpacing: '-1px', marginBottom: '14px' }}>
            지금 바로 시작하세요
          </h2>
          <p style={{ color: 'rgba(255,255,255,0.45)', fontSize: '15px', marginBottom: '40px', lineHeight: 1.75 }}>
            신용카드 없이 무료로 시작. 언제든 취소 가능.
          </p>
          {isLoggedIn
            ? <PrimaryBtn large onClick={() => router.push('/dashboard')}>대시보드로 가기 →</PrimaryBtn>
            : <PrimaryBtn large onClick={() => router.push('/signup')}>무료 계정 만들기 →</PrimaryBtn>
          }
        </div>
      </section>

      {/* FOOTER */}
      <footer style={{
        position: 'relative', zIndex: 1, padding: '40px 40px 36px',
        borderTop: '1px solid rgba(255,255,255,0.06)',
      }}>
        {/* 사업자 정보 */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '6px 40px', marginBottom: '28px',
          color: 'rgba(255,255,255,0.42)', fontSize: '12px', lineHeight: '1.9',
        }}>
          <div><span style={{ color: 'rgba(255,255,255,0.22)', marginRight: '6px' }}>상호</span>대우오피스</div>
          <div><span style={{ color: 'rgba(255,255,255,0.22)', marginRight: '6px' }}>사업자등록번호</span>127-44-85045</div>
          <div><span style={{ color: 'rgba(255,255,255,0.22)', marginRight: '6px' }}>대표전화</span>031-970-0600</div>
          <div style={{ gridColumn: 'span 2' }}>
            <span style={{ color: 'rgba(255,255,255,0.22)', marginRight: '6px' }}>주소</span>
            경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호
          </div>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.22)', marginRight: '6px' }}>이메일</span>
            <a href="mailto:knot4844@gmail.com" style={{ color: 'rgba(255,255,255,0.42)' }}>knot4844@gmail.com</a>
          </div>
        </div>
        {/* 정책 링크 + 카피라이트 */}
        <div style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          flexWrap: 'wrap', gap: '10px',
          borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '20px',
        }}>
          <LogoMark />
          <div style={{ display: 'flex', gap: '20px', alignItems: 'center' }}>
            <a href="/terms"   style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>이용약관</a>
            <a href="/privacy" style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>개인정보처리방침</a>
            <a href="/refund"  style={{ color: 'rgba(255,255,255,0.35)', fontSize: '12px', textDecoration: 'none' }}>환불정책</a>
          </div>
          <span style={{ color: 'rgba(255,255,255,0.22)', fontSize: '12px' }}>© 2025 noado. All rights reserved.</span>
        </div>
      </footer>

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
function StatCard({ num, label, sub, i, show }: { num: string; label: string; sub: string; i: number; show: boolean }) {
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(168,218,220,0.1)',
      borderRadius: '20px', padding: '32px 24px', textAlign: 'center',
      opacity: show ? 1 : 0, transform: show ? 'translateY(0)' : 'translateY(32px)',
      transition: `all 0.75s cubic-bezier(0.16,1,0.3,1) ${i * 0.1}s`,
    }}>
      <div style={{
        fontSize: '46px', fontWeight: 800, letterSpacing: '-2px', marginBottom: '8px',
        background: 'linear-gradient(135deg,#a8dadc,#457b9d)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
      }}>{num}</div>
      <div style={{ color: '#fff', fontWeight: 700, fontSize: '14px', marginBottom: '6px' }}>{label}</div>
      <div style={{ color: 'rgba(255,255,255,0.38)', fontSize: '13px' }}>{sub}</div>
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
      background: h ? 'rgba(255,255,255,0.055)' : 'rgba(255,255,255,0.025)',
      border: `1px solid ${h ? color + '55' : 'rgba(255,255,255,0.07)'}`,
      borderRadius: '20px', padding: '32px 26px',
      opacity: show ? 1 : 0,
      transform: show ? (h ? 'translateY(-6px)' : 'translateY(0)') : 'translateY(40px)',
      transition: `opacity 0.75s ease ${i * 0.08}s, transform ${h ? '0.2s ease' : `0.75s cubic-bezier(0.16,1,0.3,1) ${i * 0.08}s`}`,
      boxShadow: h ? `0 22px 60px ${color}22` : 'none',
    }}>
      <div style={{
        width: '48px', height: '48px', borderRadius: '14px', fontSize: '22px',
        background: color + '18', border: `1px solid ${color}30`,
        display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '20px',
      }}>{icon}</div>
      <h3 style={{ color: '#fff', fontSize: '16px', fontWeight: 700, marginBottom: '10px', letterSpacing: '-0.3px' }}>{title}</h3>
      <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '13.5px', lineHeight: 1.75 }}>{desc}</p>
    </div>
  )
}

/* ─── 단계 ─── */
function StepRow({ step, title, desc, i, last }: { step: string; title: string; desc: string; i: number; last: boolean }) {
  return (
    <div style={{ display: 'flex', gap: '24px', alignItems: 'flex-start' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', flexShrink: 0 }}>
        <div style={{
          width: '48px', height: '48px', borderRadius: '50%', flexShrink: 0, position: 'relative',
          background: 'linear-gradient(135deg,rgba(168,218,220,0.15),rgba(69,123,157,0.15))',
          border: '1px solid rgba(168,218,220,0.4)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: '#a8dadc', fontSize: '13px', fontWeight: 800,
        }}>
          {step}
          <div style={{
            position: 'absolute', inset: '-4px', borderRadius: '50%',
            border: '1px solid rgba(168,218,220,0.2)',
            animation: 'pulseRing 2.8s ease-out infinite', animationDelay: `${i * 0.9}s`,
          }} />
        </div>
        {!last && <div style={{ width: '1px', height: '60px', background: 'linear-gradient(to bottom, rgba(168,218,220,0.3), transparent)' }} />}
      </div>
      <div style={{ paddingTop: '10px', paddingBottom: last ? 0 : '28px' }}>
        <h3 style={{ color: '#fff', fontSize: '17px', fontWeight: 700, marginBottom: '8px' }}>{title}</h3>
        <p style={{ color: 'rgba(255,255,255,0.42)', fontSize: '14px', lineHeight: 1.75 }}>{desc}</p>
      </div>
    </div>
  )
}

/* ─── 데이터 ─── */
const STATS = [
  { num: '98%',  label: '수납 자동매칭률',  sub: '엑셀 업로드 한 번으로' },
  { num: '3분',  label: '월 정산 처리 시간', sub: '기존 대비 97% 단축' },
  { num: '0원',  label: '초기 도입 비용',   sub: '무료 플랜으로 바로 시작' },
  { num: '24/7', label: '실시간 현황 확인',  sub: '언제 어디서나 대시보드' },
]

const FEATURES = [
  { icon: '💳', color: '#a8dadc', title: '수납 자동매칭',
    desc: '은행 입금내역 엑셀을 업로드하면 호실·입주사와 자동 매칭. 중복 체크와 수동 조정까지 한 화면에서.' },
  { icon: '📋', color: '#7bbfc1', title: '전자계약',
    desc: '임대차 계약서를 온라인으로 생성·서명. 카카오톡으로 링크 전송, 서명 완료 시 자동 보관.' },
  { icon: '🔔', color: '#5b91bd', title: '알림톡 자동발송',
    desc: '납부기한 전 자동 안내, 미납 독촉, 완납 확인까지 카카오 알림톡으로 자동 발송.' },
  { icon: '📊', color: '#a8dadc', title: '수납 보고서',
    desc: '월별 수납 현황, 연체 추이, 세무 자료를 엑셀로 내보내기. 세무사에게 바로 전달.' },
  { icon: '🏢', color: '#7bbfc1', title: '호실 현황 대시보드',
    desc: '공실·입주·완납·미납 상태를 한눈에. 납부 기한 전은 납부예정, 이후는 미납으로 자동 분류.' },
  { icon: '🤖', color: '#5b91bd', title: 'AI 자동화',
    desc: '월 청구서 자동 생성, 수납 후 호실 상태 자동 동기화. 사람이 할 일을 AI가 대신합니다.' },
]

const STEPS = [
  { step: '01', title: '입주사 등록',
    desc: '호실과 입주사 정보를 등록하면 자동으로 월 청구서가 생성됩니다.' },
  { step: '02', title: '은행 내역 업로드',
    desc: '매월 은행 입금내역 엑셀을 업로드하면 호실별 자동 매칭 제안이 나타납니다.' },
  { step: '03', title: '확인 & 완료',
    desc: '매칭 결과를 검토하고 수납 확정 버튼 클릭. 알림톡 발송과 보고서 생성이 자동으로 처리됩니다.' },
]
