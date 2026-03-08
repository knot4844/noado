'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { Download, FileSpreadsheet, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'

export default function ExportPage() {
  const now       = new Date()
  const thisYear  = now.getFullYear()
  const thisMonth = String(now.getMonth() + 1).padStart(2, '0')
  const defaultTo = `${thisYear}-${thisMonth}`

  // 기본: 당해년도 1월 ~ 이번 달
  const defaultFrom = `${thisYear}-01`

  const [from,        setFrom]        = useState(defaultFrom)
  const [to,          setTo]          = useState(defaultTo)
  const [loading,     setLoading]     = useState(false)
  const [toast,       setToast]       = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const handleDownload = async () => {
    if (!from || !to) return showToast('error', '기간을 선택해주세요.')

    const [fy, fm] = from.split('-').map(Number)
    const [ty, tm] = to.split('-').map(Number)
    if (fy > ty || (fy === ty && fm > tm)) {
      return showToast('error', '시작월이 종료월보다 클 수 없습니다.')
    }

    setLoading(true)
    try {
      const res = await fetch(`/api/export/vat?from=${from}&to=${to}`)
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error || '다운로드 실패')
      }

      // 파일 다운로드
      const blob     = await res.blob()
      const url      = URL.createObjectURL(blob)
      const a        = document.createElement('a')
      a.href         = url
      a.download     = `부가세신고_${from}_${to}.xlsx`
      a.click()
      URL.revokeObjectURL(url)

      showToast('success', '다운로드 완료')
    } catch (err) {
      showToast('error', err instanceof Error ? err.message : '오류가 발생했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 빠른 기간 선택 버튼
  const quickRanges = [
    {
      label: '이번 분기',
      getRange: () => {
        const q     = Math.floor(now.getMonth() / 3)
        const start = String(q * 3 + 1).padStart(2, '0')
        const end   = String(Math.min(q * 3 + 3, 12)).padStart(2, '0')
        return { from: `${thisYear}-${start}`, to: `${thisYear}-${end}` }
      },
    },
    {
      label: '상반기',
      getRange: () => ({ from: `${thisYear}-01`, to: `${thisYear}-06` }),
    },
    {
      label: '하반기',
      getRange: () => ({ from: `${thisYear}-07`, to: `${thisYear}-12` }),
    },
    {
      label: '올해 전체',
      getRange: () => ({ from: `${thisYear}-01`, to: `${thisYear}-12` }),
    },
    {
      label: '작년 전체',
      getRange: () => ({ from: `${thisYear - 1}-01`, to: `${thisYear - 1}-12` }),
    },
  ]

  return (
    <div className="p-6 max-w-[720px]">
      {/* Toast */}
      {toast && (
        <div
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
          style={{ background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}
        >
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="mb-8">
        <h1
          className="text-2xl font-bold"
          style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}
        >
          세무 내보내기
        </h1>
        <p className="text-sm mt-1" style={{ color: 'var(--color-muted)' }}>
          부가세 신고용 수납내역을 엑셀로 다운로드합니다.
        </p>
      </div>

      {/* 카드 */}
      <div
        className="rounded-2xl p-6"
        style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}
      >
        {/* 아이콘 + 제목 */}
        <div className="flex items-center gap-3 mb-6">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'rgba(29,53,87,0.08)' }}
          >
            <FileSpreadsheet size={20} style={{ color: 'var(--color-primary)' }} />
          </div>
          <div>
            <p className="font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              부가세 신고용 엑셀
            </p>
            <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>
              호실 · 임차인명 · 청구월 · 청구금액 · 입금액 · 입금일 · 가상계좌번호
            </p>
          </div>
        </div>

        {/* 빠른 선택 */}
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
          빠른 선택
        </p>
        <div className="flex flex-wrap gap-2 mb-5">
          {quickRanges.map((r) => {
            const range   = r.getRange()
            const active  = from === range.from && to === range.to
            return (
              <button
                key={r.label}
                onClick={() => { setFrom(range.from); setTo(range.to) }}
                className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all border"
                style={{
                  background:   active ? 'var(--color-primary)' : 'var(--color-surface)',
                  color:        active ? '#fff' : 'var(--color-text)',
                  borderColor:  active ? 'var(--color-primary)' : 'var(--color-border)',
                }}
              >
                {r.label}
              </button>
            )
          })}
        </div>

        {/* 기간 직접 입력 */}
        <p className="text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>
          기간 직접 선택
        </p>
        <div className="flex items-center gap-3 mb-6">
          <input
            type="month"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          />
          <span className="text-sm" style={{ color: 'var(--color-muted)' }}>~</span>
          <input
            type="month"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="flex-1 px-3 py-2 rounded-lg border text-sm outline-none"
            style={{ borderColor: 'var(--color-border)', background: 'var(--color-surface)' }}
          />
        </div>

        {/* 안내 */}
        <div
          className="rounded-xl p-4 mb-6 text-xs leading-relaxed"
          style={{ background: 'var(--color-muted-bg)', color: 'var(--color-muted)' }}
        >
          <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>포함 조건</p>
          <p>· 수납 완료(paid) 상태의 청구서만 포함됩니다.</p>
          <p>· 가상계좌번호는 호실 정보에 등록된 값이 출력됩니다.</p>
          <p>· 마지막 행에 합계가 자동으로 추가됩니다.</p>
        </div>

        {/* 다운로드 버튼 */}
        <button
          onClick={handleDownload}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold text-white transition-opacity disabled:opacity-60"
          style={{ background: 'var(--color-primary)' }}
        >
          {loading ? (
            <><Loader2 size={16} className="animate-spin" /> 생성 중...</>
          ) : (
            <><Download size={16} /> {from} ~ {to} 엑셀 다운로드</>
          )}
        </button>
      </div>
    </div>
  )
}
