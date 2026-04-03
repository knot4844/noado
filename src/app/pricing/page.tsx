'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { CheckCircle2, Zap, Building2, Crown, ArrowRight, X } from 'lucide-react'
import Link from 'next/link'

/* ── PortOne 결제 컴포넌트 ── */
import { PortOneCheckout } from '@/components/payments/PortOneCheckout'

/* ── 요금제 데이터 ── */
const PLANS = [
  {
    key: 'starter',
    icon: <Building2 size={20} />,
    name: '스타터',
    sub: 'Starter',
    desc: '소규모 공간 관리를 막 시작하신 분',
    price: null,
    priceLabel: '무료',
    priceSub: '평생 무료',
    cta: '현재 사용 중',
    ctaDisabled: true,
    featured: false,
    features: [
      '사업장 1개 관리',
      '호실 최대 3개',
      '기본 대시보드 & 통계',
      '수동 수납 관리',
    ],
  },
  {
    key: 'beginner',
    icon: <Zap size={20} />,
    name: '비기너',
    sub: 'Beginner',
    desc: '생업과 공간 관리를 병행하는 알짜 사업자',
    price: 9900,
    priceLabel: '₩9,900',
    priceSub: '/ 월',
    cta: 'Beginner로 업그레이드',
    ctaDisabled: false,
    featured: true,
    badge: '가장 많이 선택',
    orderName: 'noado Beginner 요금제 (월정액)',
    features: [
      '사업장 1개 관리',
      '호실 최대 5개',
      'AI 통장 입금 자동 매칭',
      '전자세금계산서 자동 발행',
      '카카오 자동 알림톡 제공',
    ],
  },
  {
    key: 'pro',
    icon: <Crown size={20} />,
    name: '프로',
    sub: 'Pro',
    desc: '중대형 공간·다수 오피스를 운영하는 전문가',
    price: 19900,
    priceLabel: '₩19,900',
    priceSub: '/ 월',
    cta: 'Pro로 업그레이드',
    ctaDisabled: false,
    featured: false,
    orderName: 'noado Pro 요금제 (월정액)',
    features: [
      '사업장 최대 3개 관리',
      '호실 최대 50개',
      '스마트 카드/가상계좌 수납',
      '전자세금계산서 자동 발행',
      '전용 전자계약 & 서명',
    ],
  },
]

export default function PricingPage() {
  const router = useRouter()
  const [selectedPlan, setSelectedPlan] = useState<{ amount: number; name: string } | null>(null)

  return (
    <div style={{
      background: '#070d1a',
      minHeight: '100vh',
      fontFamily: "'Space Grotesk', -apple-system, sans-serif",
      overflowX: 'hidden',
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800&display=swap');
        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(24px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .fade-up { animation: fadeUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .fade-up-1 { animation-delay: 0.05s; }
        .fade-up-2 { animation-delay: 0.15s; }
        .fade-up-3 { animation-delay: 0.25s; }
        .fade-up-4 { animation-delay: 0.35s; }
        .plan-card:hover { transform: translateY(-4px); }
        .plan-card { transition: transform 0.3s cubic-bezier(0.16,1,0.3,1), box-shadow 0.3s; }
      `}</style>

      {/* ── 배경 오브 글로우 ── */}
      <div style={{
        position: 'fixed', top: '5%', left: '50%', transform: 'translateX(-50%)',
        width: '900px', height: '500px', borderRadius: '50%', pointerEvents: 'none', zIndex: 0,
        background: 'radial-gradient(circle, rgba(29,53,87,0.35) 0%, rgba(168,218,220,0.06) 55%, transparent 75%)',
        filter: 'blur(60px)',
      }} />

      {/* ── NAV ── */}
      <nav style={{
        position: 'sticky', top: 0, zIndex: 50,
        padding: '0 40px', height: '64px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        background: 'rgba(7,13,26,0.80)', backdropFilter: 'blur(16px)',
        borderBottom: '1px solid rgba(168,218,220,0.08)',
      }}>
        <Link href="/" style={{ display: 'flex', alignItems: 'center', gap: '10px', textDecoration: 'none' }}>
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
            <rect width="28" height="28" rx="8" fill="#a8dadc" fillOpacity="0.13" />
            <path d="M7 20V10l7-4 7 4v10" stroke="#a8dadc" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
            <rect x="11" y="14" width="6" height="6" rx="1" stroke="#a8dadc" strokeWidth="1.6" />
          </svg>
          <span style={{ color: '#fff', fontSize: '18px', fontWeight: 700, letterSpacing: '-0.4px' }}>noado</span>
        </Link>
        <div style={{ display: 'flex', gap: '10px' }}>
          <button onClick={() => router.push('/login')} style={{
            padding: '8px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 600,
            color: 'rgba(255,255,255,0.6)', background: 'transparent',
            border: '1px solid rgba(255,255,255,0.12)', cursor: 'pointer',
          }}>로그인</button>
          <button onClick={() => router.push('/signup')} style={{
            padding: '8px 18px', borderRadius: '10px', fontSize: '14px', fontWeight: 700,
            color: '#070d1a', background: '#a8dadc', border: 'none', cursor: 'pointer',
          }}>무료 시작</button>
        </div>
      </nav>

      {/* ── 헤더 ── */}
      <div className="fade-up fade-up-1" style={{
        position: 'relative', zIndex: 1,
        textAlign: 'center', padding: '80px 24px 60px',
      }}>
        <div style={{
          display: 'inline-flex', alignItems: 'center', gap: '7px',
          background: 'rgba(168,218,220,0.08)', border: '1px solid rgba(168,218,220,0.2)',
          borderRadius: '100px', padding: '5px 16px', marginBottom: '28px',
        }}>
          <span style={{ width: '5px', height: '5px', borderRadius: '50%', background: '#a8dadc', display: 'inline-block' }} />
          <span style={{ color: '#a8dadc', fontSize: '12px', fontWeight: 600, letterSpacing: '0.5px' }}>B2B SaaS 정식 오픈</span>
        </div>

        <h1 style={{
          fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 800,
          lineHeight: 1.1, letterSpacing: '-2px', marginBottom: '20px',
        }}>
          <span style={{ color: '#ffffff' }}>공간 관리, </span>
          <span style={{
            background: 'linear-gradient(135deg, #a8dadc 0%, #7bbfc1 45%, #457b9d 100%)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>가격은 합리적으로.</span>
        </h1>
        <p style={{
          color: 'rgba(255,255,255,0.42)', fontSize: 'clamp(14px, 1.8vw, 17px)',
          lineHeight: 1.8, maxWidth: '480px', margin: '0 auto',
        }}>
          수납 확인부터 전자계약·세금계산서 발행까지<br />
          모든 것이 Zero-Touch로 자동화됩니다.
        </p>
      </div>

      {/* ── 카드 그리드 ── */}
      <div className="fade-up fade-up-2" style={{
        position: 'relative', zIndex: 1,
        maxWidth: '1020px', margin: '0 auto', padding: '0 24px 80px',
        display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px',
      }}>
        {PLANS.map((plan) => (
          <div
            key={plan.key}
            className="plan-card"
            style={{
              position: 'relative',
              borderRadius: '20px',
              padding: '32px 28px 28px',
              background: plan.featured
                ? 'linear-gradient(145deg, rgba(29,53,87,0.7), rgba(69,123,157,0.3))'
                : 'rgba(255,255,255,0.04)',
              border: plan.featured
                ? '1px solid rgba(168,218,220,0.35)'
                : '1px solid rgba(255,255,255,0.07)',
              boxShadow: plan.featured
                ? '0 0 40px rgba(168,218,220,0.08), 0 20px 40px rgba(0,0,0,0.3)'
                : '0 4px 20px rgba(0,0,0,0.2)',
            }}
          >
            {/* 추천 배지 */}
            {plan.badge && (
              <div style={{
                position: 'absolute', top: '-13px', left: '50%', transform: 'translateX(-50%)',
                background: 'linear-gradient(135deg, #a8dadc, #7bbfc1)',
                color: '#070d1a', fontSize: '11px', fontWeight: 700,
                padding: '4px 14px', borderRadius: '100px', whiteSpace: 'nowrap',
                letterSpacing: '0.2px',
              }}>
                {plan.badge}
              </div>
            )}

            {/* 아이콘 */}
            <div style={{
              width: '44px', height: '44px', borderRadius: '12px', marginBottom: '20px',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              background: plan.featured ? 'rgba(168,218,220,0.18)' : 'rgba(255,255,255,0.07)',
              color: plan.featured ? '#a8dadc' : 'rgba(255,255,255,0.5)',
            }}>
              {plan.icon}
            </div>

            {/* 타이틀 */}
            <div style={{ marginBottom: '8px' }}>
              <span style={{ color: '#fff', fontSize: '20px', fontWeight: 700 }}>{plan.name}</span>
              <span style={{ color: 'rgba(255,255,255,0.28)', fontSize: '13px', marginLeft: '8px' }}>{plan.sub}</span>
            </div>
            <p style={{ color: 'rgba(255,255,255,0.38)', fontSize: '13px', marginBottom: '24px', lineHeight: 1.6 }}>
              {plan.desc}
            </p>

            {/* 가격 */}
            <div style={{ marginBottom: '24px', display: 'flex', alignItems: 'baseline', gap: '6px' }}>
              <span style={{
                fontSize: plan.price ? '36px' : '32px', fontWeight: 800,
                color: plan.featured ? '#a8dadc' : '#fff',
              }}>{plan.priceLabel}</span>
              <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '14px' }}>{plan.priceSub}</span>
            </div>

            {/* CTA 버튼 */}
            <button
              disabled={plan.ctaDisabled}
              onClick={() => {
                if (!plan.ctaDisabled && plan.price && plan.orderName) {
                  setSelectedPlan({ amount: plan.price, name: plan.orderName })
                }
              }}
              style={{
                width: '100%', padding: '13px', borderRadius: '12px',
                fontSize: '14px', fontWeight: 700, cursor: plan.ctaDisabled ? 'default' : 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
                marginBottom: '24px', transition: 'all 0.2s',
                background: plan.ctaDisabled
                  ? 'rgba(255,255,255,0.07)'
                  : plan.featured
                    ? 'linear-gradient(135deg, #a8dadc, #7bbfc1)'
                    : 'rgba(168,218,220,0.12)',
                color: plan.ctaDisabled
                  ? 'rgba(255,255,255,0.3)'
                  : plan.featured ? '#070d1a' : '#a8dadc',
                border: plan.ctaDisabled
                  ? '1px solid rgba(255,255,255,0.07)'
                  : plan.featured ? 'none' : '1px solid rgba(168,218,220,0.3)',
              }}
            >
              {plan.cta}
              {!plan.ctaDisabled && <ArrowRight size={15} />}
            </button>

            {/* 기능 목록 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '11px' }}>
              {plan.features.map((f, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
                  <CheckCircle2 size={15} style={{
                    flexShrink: 0, marginTop: '1px',
                    color: plan.featured ? '#a8dadc' : 'rgba(255,255,255,0.3)',
                  }} />
                  <span style={{ fontSize: '13px', color: 'rgba(255,255,255,0.65)', lineHeight: 1.5 }}>{f}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* ── FAQ 한 줄 ── */}
      <div className="fade-up fade-up-3" style={{
        position: 'relative', zIndex: 1, textAlign: 'center', padding: '0 24px 80px',
      }}>
        <p style={{ color: 'rgba(255,255,255,0.3)', fontSize: '13px' }}>
          언제든지 취소 가능 · 숨겨진 비용 없음 ·{' '}
          <Link href="/refund" style={{ color: '#a8dadc', textDecoration: 'none' }}>결제 후 7일 이내 전액 환불</Link>
        </p>
      </div>

      {/* ── FOOTER 사업자 정보 ── */}
      <footer className="fade-up fade-up-4" style={{
        position: 'relative', zIndex: 1,
        borderTop: '1px solid rgba(255,255,255,0.06)',
        padding: '32px 40px',
      }}>
        <div style={{
          maxWidth: '1020px', margin: '0 auto',
          display: 'flex', flexDirection: 'column', gap: '16px',
        }}>
          {/* 사업자 정보 */}
          <div style={{
            display: 'flex', flexWrap: 'wrap', gap: '6px 28px',
            fontSize: '11px', color: 'rgba(255,255,255,0.28)', lineHeight: '1.8',
          }}>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>상호</span> 대우오피스</span>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>사업자등록번호</span> 127-44-85045</span>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>대표전화</span> 031-970-0600</span>
            <span><span style={{ color: 'rgba(255,255,255,0.15)' }}>주소</span> 경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호</span>
          </div>
          {/* 링크 + 카피라이트 */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
            <div style={{ display: 'flex', gap: '20px' }}>
              {[['이용약관', '/terms'], ['개인정보처리방침', '/privacy'], ['환불정책', '/refund']].map(([label, href]) => (
                <Link key={href} href={href} style={{ color: 'rgba(255,255,255,0.28)', fontSize: '12px', textDecoration: 'none' }}>
                  {label}
                </Link>
              ))}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.18)', fontSize: '11px' }}>© 2025 noado. All rights reserved.</span>
          </div>
        </div>
      </footer>

      {/* ── PortOne 정기결제 모달 ── */}
      {selectedPlan && (
        <PortOneCheckout
          amount={selectedPlan.amount}
          orderName={selectedPlan.name}
          mode="billing"
          onClose={() => setSelectedPlan(null)}
          onSuccess={() => {
            setSelectedPlan(null)
            alert('구독이 완료되었습니다!')
          }}
        />
      )}
    </div>
  )
}
