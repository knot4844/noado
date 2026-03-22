'use client'

import { useState } from 'react'

interface LaunchBannerProps {
  onDismiss?: () => void
}

export default function LaunchBanner({ onDismiss }: LaunchBannerProps) {
  const [dismissed, setDismissed] = useState(false)

  const dismiss = () => { setDismissed(true); onDismiss?.() }

  if (dismissed) return null

  return (
    <div
      style={{ position: 'fixed', top: 0, left: 0, right: 0, zIndex: 60 }}
      className="flex items-center gap-x-6 overflow-hidden px-6 py-2.5 sm:px-3.5"
      role="banner"
    >
      {/* 배경 */}
      <div
        className="absolute inset-0 -z-10"
        style={{
          background: 'linear-gradient(90deg, #0d1b2e 0%, #0f2744 40%, #112244 60%, #0d1b2e 100%)',
          borderBottom: '1px solid rgba(168,218,220,0.15)',
        }}
      />

      {/* 빛 번짐 */}
      <div
        className="absolute left-1/2 top-1/2 -z-10 -translate-x-1/2 -translate-y-1/2 pointer-events-none"
        style={{
          width: '500px', height: '80px',
          background: 'radial-gradient(ellipse, rgba(168,218,220,0.12) 0%, transparent 70%)',
          filter: 'blur(20px)',
        }}
      />

      <div className="flex flex-1 flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <p className="text-sm leading-6 font-medium" style={{ color: 'rgba(255,255,255,0.85)' }}>
          <strong className="font-semibold" style={{ color: '#a8dadc' }}>🎉 Noado 론칭</strong>
          <svg viewBox="0 0 2 2" className="mx-2 inline h-0.5 w-0.5 fill-current opacity-50" aria-hidden="true">
            <circle cx={1} cy={1} r={1} />
          </svg>
          노아도가 Product Hunt에 출시됐습니다! 한 번의 클릭으로 응원해 주세요.
        </p>
        <a
          href="https://www.producthunt.com/posts/noado"
          target="_blank"
          rel="noopener noreferrer"
          className="flex-none rounded-full px-3.5 py-1 text-sm font-semibold shadow-sm transition-all hover:scale-105 active:scale-95"
          style={{
            background: 'rgba(168,218,220,0.12)',
            color: '#a8dadc',
            border: '1px solid rgba(168,218,220,0.3)',
            backdropFilter: 'blur(8px)',
          }}
        >
          응원하러 가기 →
        </a>
      </div>

      <button
        type="button"
        onClick={dismiss}
        className="-m-3 p-3 transition-opacity hover:opacity-100 opacity-50"
        aria-label="배너 닫기"
      >
        <svg className="h-4 w-4" style={{ color: '#a8dadc' }} viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
          <path d="M6.28 5.22a.75.75 0 00-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 101.06 1.06L10 11.06l3.72 3.72a.75.75 0 101.06-1.06L11.06 10l3.72-3.72a.75.75 0 00-1.06-1.06L10 8.94 6.28 5.22z" />
        </svg>
      </button>
    </div>
  )
}
