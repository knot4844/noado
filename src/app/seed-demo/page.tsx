'use client'

export const dynamic = 'force-dynamic'

import { useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Database, Trash2, CheckCircle2, AlertCircle, Building2, Store, Home } from 'lucide-react'

// ── 케이스 메타 ───────────────────────────────────────────
const CASES = [
  {
    key:   'A',
    icon:  <Building2 size={20} />,
    label: '소호사무실',
    desc:  '사무실 20개 (30만 × 10, 50만 × 10)',
    rooms: 20,
    monthlyRent: '800만원',
    fixed: '전기세·관리비 100만원/월',
    color: '#1D3557',
    details: [
      '101~110호 (30만원) — 개인 프리랜서·소규모 사업자',
      '201~210호 (50만원) — 법인·교육기관·컨설팅',
      '완납 17개 / 미납 3개 (2달·3달 연체 포함)',
      '신규 입주 2개 (1~2개월 전)',
      '만료 임박 2개 (D-15, D-29)',
    ],
  },
  {
    key:   'B',
    icon:  <Store size={20} />,
    label: '상가빌딩',
    desc:  '상가 8개 (1층 3개, 2층 5개)',
    rooms: 8,
    monthlyRent: '1,144만원',
    fixed: '공동 관리비 3만원 + 2층 엘베 2만원 임대료에 포함',
    color: '#2d6a4f',
    details: [
      '101호 카페봄봄 253만 / 102호 헤어클리닉 153만 / 103호 건강약국 203만',
      '201~205호 (학원·피부과·회계·인테리어·법무사)',
      '완납 6개 / 2달 미납 1개 / 중간 연체 1개',
      '만료됨 2개 (계약 갱신 협의 필요)',
    ],
  },
  {
    key:   'C',
    icon:  <Home size={20} />,
    label: '고시원',
    desc:  '룸 30개 (25만 × 20, 35만 × 10)',
    rooms: 30,
    monthlyRent: '850만원',
    fixed: '고정 관리비 150만원/월',
    color: '#7b2d8b',
    details: [
      '101~120호 (25만원) — 20대 개인 입주자',
      '201~210호 (35만원) — 원룸형 고급 룸',
      '완납 24개 / 연체 다양 / 신규 2개',
      '3달 연체 각 1개씩 (퇴실 협의 시나리오)',
    ],
  },
]

export default function SeedDemoPage() {
  const supabase = useMemo(() => createClient(), [])
  const [loading, setLoading]       = useState<string | null>(null)  // 'A'|'B'|'C'|'all'|'delete'
  const [results, setResults]       = useState<Record<string, { created: number; skipped: number }> | null>(null)
  const [error, setError]           = useState<string | null>(null)
  const [deleteDone, setDeleteDone] = useState(false)

  const callApi = async (method: 'POST' | 'DELETE', caseKey?: string) => {
    const key = method === 'DELETE' ? 'delete' : (caseKey ?? 'all')
    setLoading(key)
    setResults(null)
    setError(null)
    setDeleteDone(false)

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('로그인이 필요합니다.'); setLoading(null); return }

      const url = caseKey ? `/api/seed-demo?case=${caseKey}` : '/api/seed-demo'
      const res = await fetch(url, {
        method,
        headers: { Authorization: `Bearer ${session.access_token}` },
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'API 오류'); setLoading(null); return }

      if (method === 'DELETE') setDeleteDone(true)
      else setResults(data.summary)
    } catch (e) {
      setError(String(e))
    }
    setLoading(null)
  }

  return (
    <div className="p-6 max-w-3xl">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          데모 데이터 생성
        </h1>
        <p className="text-sm" style={{ color: 'var(--color-muted)' }}>
          3가지 실사용 시나리오를 바탕으로 12개월 납부 이력까지 포함한 현실적인 데모 데이터를 생성합니다.
        </p>
      </div>

      {/* 케이스 카드 */}
      <div className="grid gap-4 mb-6">
        {CASES.map(c => (
          <div key={c.key} className="rounded-2xl border overflow-hidden"
               style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}>
            <div className="flex items-center justify-between p-5">
              <div className="flex items-start gap-4 flex-1">
                {/* 아이콘 */}
                <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 text-white mt-0.5"
                     style={{ background: c.color }}>
                  {c.icon}
                </div>
                {/* 내용 */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
                          style={{ background: c.color }}>케이스 {c.key}</span>
                    <span className="font-bold" style={{ color: 'var(--color-text)' }}>{c.label}</span>
                  </div>
                  <p className="text-sm mb-2" style={{ color: 'var(--color-muted)' }}>{c.desc}</p>
                  <div className="flex gap-3 text-xs mb-3" style={{ color: 'var(--color-muted)' }}>
                    <span>🏠 {c.rooms}개 호실</span>
                    <span>💰 월세 합계 {c.monthlyRent}</span>
                  </div>
                  <ul className="space-y-0.5">
                    {c.details.map((d, i) => (
                      <li key={i} className="text-xs flex items-start gap-1.5" style={{ color: 'var(--color-muted)' }}>
                        <span className="mt-0.5 shrink-0">·</span>{d}
                      </li>
                    ))}
                  </ul>
                  <p className="text-xs mt-2 px-2 py-1 rounded-lg inline-block"
                     style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
                    📌 {c.fixed}
                  </p>
                </div>
              </div>
              {/* 버튼 */}
              <button
                onClick={() => callApi('POST', c.key)}
                disabled={loading !== null}
                className="ml-4 flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-semibold text-white shrink-0 disabled:opacity-50"
                style={{ background: c.color }}>
                {loading === c.key
                  ? <><Loader2 size={14} className="animate-spin" /> 생성중</>
                  : <><Database size={14} /> 생성</>
                }
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* 전체 생성 + 초기화 */}
      <div className="flex gap-3 mb-6">
        <button
          onClick={() => callApi('POST')}
          disabled={loading !== null}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}>
          {loading === 'all'
            ? <><Loader2 size={16} className="animate-spin" /> 3케이스 생성 중 (약 30초)...</>
            : <><Database size={16} /> 3케이스 전체 생성</>
          }
        </button>
        <button
          onClick={() => callApi('DELETE')}
          disabled={loading !== null}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-semibold border disabled:opacity-60"
          style={{ borderColor: 'var(--color-danger)', color: 'var(--color-danger)' }}>
          {loading === 'delete'
            ? <Loader2 size={16} className="animate-spin" />
            : <Trash2 size={16} />
          }
          초기화
        </button>
      </div>

      {/* 에러 */}
      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl text-sm mb-4"
             style={{ background: 'var(--color-danger-bg)', border: '1px solid var(--color-danger)', color: 'var(--color-danger)' }}>
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {/* 삭제 완료 */}
      {deleteDone && (
        <div className="flex items-center gap-2 p-4 rounded-xl text-sm mb-4"
             style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
          <CheckCircle2 size={16} />
          데모 데이터가 모두 삭제되었습니다.
        </div>
      )}

      {/* 생성 결과 */}
      {results && (
        <div className="p-5 rounded-2xl border"
             style={{ background: 'var(--color-success-bg)', borderColor: 'var(--color-success)' }}>
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle2 size={18} style={{ color: 'var(--color-success)' }} />
            <p className="font-bold" style={{ color: 'var(--color-success)' }}>데모 데이터 생성 완료!</p>
          </div>
          <div className="grid gap-2 mb-4">
            {Object.entries(results).map(([label, { created, skipped }]) => (
              <div key={label} className="flex justify-between text-sm px-3 py-2 rounded-lg"
                   style={{ background: 'var(--color-surface)' }}>
                <span style={{ color: 'var(--color-text)' }}>{label}</span>
                <span style={{ color: 'var(--color-success)' }}>
                  {created}개 호실 생성{skipped > 0 ? ` (${skipped}개 오류)` : ''}
                </span>
              </div>
            ))}
          </div>
          <p className="text-xs mb-2" style={{ color: 'var(--color-success)' }}>바로 확인하세요:</p>
          <div className="flex gap-2 flex-wrap">
            {[
              ['입주사 관리', '/tenants'],
              ['수납 매칭', '/payments'],
              ['대시보드', '/dashboard'],
            ].map(([label, href]) => (
              <a key={href} href={href}
                 className="px-3 py-1.5 text-xs font-semibold rounded-lg text-white"
                 style={{ background: 'var(--color-success)' }}>
                {label} →
              </a>
            ))}
          </div>
        </div>
      )}

      {/* 주의사항 */}
      <div className="mt-6 p-4 rounded-xl text-xs space-y-1"
           style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}>
        <p className="font-semibold mb-1">⚠️ 주의사항</p>
        {/* eslint-disable-next-line react/no-unescaped-entities */}
        <p>· 데모 데이터는 실제 데이터와 섞입니다. 실제 운영 계정에서 사용 시 "초기화" 버튼으로 삭제하세요.</p>
        <p>· 데모 데이터는 메모 필드의 <code>__DEMO__</code> 태그로 구분합니다.</p>
        <p>· 3케이스 전체 생성 시 약 30~60초 소요됩니다 (58개 호실 × 12개월 이력).</p>
      </div>
    </div>
  )
}
