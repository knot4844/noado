'use client'

export const dynamic = 'force-dynamic'

/**
 * /invite/[token] - 전자계약 서명 페이지 (임차인 접근)
 * sign_token으로 계약서 조회 → Canvas 서명 → 저장
 */
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, PenTool, RotateCcw, Download } from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import type { Contract } from '@/types'

type Step = 'loading' | 'review' | 'sign' | 'done' | 'error' | 'expired'

export default function InvitePage() {
  const { token }  = useParams<{ token: string }>()
  const supabase   = createClient()
  const canvasRef  = useRef<HTMLCanvasElement>(null)

  const [step, setStep]         = useState<Step>('loading')
  const [contract, setContract] = useState<Contract | null>(null)
  const [drawing, setDrawing]   = useState(false)
  const [hasSig, setHasSig]     = useState(false)
  const [saving, setSaving]     = useState(false)
  const [signDate, setSignDate] = useState<string | null>(null)
  const [contentHash, setContentHash] = useState<string | null>(null)

  /* ─── 계약서 조회 ─── */
  useEffect(() => {
    if (!token) return
    ;(async () => {
      const { data, error } = await supabase
        .from('contracts')
        .select('*')
        .eq('sign_token', token)
        .single()

      if (error || !data) { setStep('error'); return }
      if (data.status === 'signed') { setContract(data); setStep('done'); return }

      // 토큰 만료 체크
      if (data.sign_token_expires_at && new Date(data.sign_token_expires_at) < new Date()) {
        await supabase.from('contracts').update({ status: 'expired' }).eq('id', data.id)
        setStep('expired'); return
      }

      setContract(data)
      setStep('review')
    })()
  }, [token, supabase])

  /* ─── Canvas 서명 이벤트 ─── */
  const getPos = (e: React.MouseEvent | React.TouchEvent, canvas: HTMLCanvasElement) => {
    const rect = canvas.getBoundingClientRect()
    if ('touches' in e) {
      return {
        x: e.touches[0].clientX - rect.left,
        y: e.touches[0].clientY - rect.top,
      }
    }
    return { x: e.clientX - rect.left, y: e.clientY - rect.top }
  }

  const startDraw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(pos.x, pos.y)
    setDrawing(true); setHasSig(true)
  }

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    if (!drawing) return
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.strokeStyle = '#1d3557'; ctx.lineWidth = 2.5; ctx.lineCap = 'round'
    ctx.stroke()
  }

  const endDraw = () => setDrawing(false)

  const clearSig = () => {
    const canvas = canvasRef.current; if (!canvas) return
    const ctx = canvas.getContext('2d')!
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSig(false)
  }

  /* ─── 서명 제출 ─── */
  const submitSign = async () => {
    if (!contract || !hasSig) return
    setSaving(true)

    const canvas   = canvasRef.current!
    const dataUrl  = canvas.toDataURL('image/png')

    try {
      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          roomId: contract.room_id,
          signature: dataUrl,
          tenantName: contract.tenant_name || '임차인',
          contractContent: contract.contract_snapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '서버 오류');

      const now = new Date(data.signedAt);
      setSignDate(`${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setContentHash(data.contentHash);

      // 초대한 토큰 계약 상태도 갱신
      await supabase.from('contracts').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data_url: dataUrl
      }).eq('id', contract.id);

      setStep('done');
    } catch (error) {
      const err = error as { message?: string };
      alert(`서명 저장 중 오류가 발생했습니다: ${err.message}`);
    } finally {
      setSaving(false);
    }
  }

  const snap = contract?.contract_snapshot as Record<string, string | number> | null

  /* ─── 렌더 ─── */
  if (step === 'loading') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--color-background)' }}>
      <Loader2 size={32} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
    </div>
  )

  if (step === 'error') return (
    <FullPage icon={<AlertCircle size={48} />} iconColor="var(--color-danger)"
      title="계약서를 찾을 수 없습니다" desc="링크가 올바른지 확인하거나 임대인에게 문의하세요." />
  )

  if (step === 'expired') return (
    <FullPage icon={<AlertCircle size={48} />} iconColor="var(--color-danger)"
      title="서명 링크가 만료되었습니다" desc="임대인에게 새 링크를 요청해주세요." />
  )

  if (step === 'done') return (
    <div className="min-h-screen py-10 px-4 flex items-center justify-center font-sans" style={{ background: 'var(--color-background)' }}>
      <div className="w-full max-w-lg rounded-3xl p-8 md:p-12 text-center"
           style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>
        <div className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
             style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={40} />
        </div>
        <h1 className="text-2xl font-bold mb-3" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          전자 서명이 완료되었습니다
        </h1>
        <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
          계약서에 서명이 안전하게 기록되었으며,<br /> 전자서명법에 따라 법적 효력이 발생합니다.
        </p>
        
        {/* 법적 증거 정보 */}
        <div className="rounded-xl p-5 mb-8 text-left space-y-3" style={{ background: 'var(--color-muted-bg)' }}>
          <div>
            <span className="text-xs font-bold block mb-0.5" style={{ color: 'var(--color-muted)' }}>📅 서명 일시 (타임스탬프)</span>
            <span className="text-sm font-mono font-bold" style={{ color: 'var(--color-text)' }}>{signDate}</span>
          </div>
          {contentHash && (
            <div>
              <span className="text-xs font-bold block mb-0.5" style={{ color: 'var(--color-muted)' }}>🔐 계약 내용 해시 (SHA-256)</span>
              <span className="text-[11px] font-mono break-all" style={{ color: 'var(--color-muted)' }}>{contentHash}</span>
            </div>
          )}
        </div>
        
        <button onClick={() => window.print()}
          className="w-full py-4 rounded-xl text-md font-bold text-white flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          style={{ background: 'var(--color-primary)' }}>
          <Download size={20} />
          계약서 PDF 다운로드 (화면 인쇄)
        </button>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen py-10 px-4" style={{ background: 'var(--color-background)' }}>
      <div className="max-w-lg mx-auto">
        {/* 로고 */}
        <div className="flex items-center gap-2 mb-8">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center font-bold text-sm"
               style={{ background: 'var(--color-primary)', color: 'var(--color-accent)' }}>N</div>
          <span className="text-lg font-bold" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
            noado
          </span>
        </div>

        {/* 계약서 내용 검토 */}
        {step === 'review' && (
          <>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              임대차 계약서 검토
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
              아래 계약 내용을 확인 후 서명해주세요.
            </p>

            <div className="rounded-2xl p-5 mb-6 space-y-4"
                 style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
              {[
                { label: '세입자',   value: contract?.tenant_name ?? '—' },
                { label: '소재지',   value: snap?.address as string ?? '—' },
                { label: '보증금',   value: snap?.deposit ? formatKRW(Number(snap.deposit)) : '—' },
                { label: '월세',     value: snap?.monthly_rent ? formatKRW(Number(snap.monthly_rent)) : '—' },
                { label: '계약 시작',value: contract?.lease_start ? formatDate(contract.lease_start) : '—' },
                { label: '계약 만료',value: contract?.lease_end   ? formatDate(contract.lease_end)   : '—' },
              ].map(({ label, value }) => (
                <div key={label} className="flex items-baseline gap-3">
                  <span className="text-xs font-medium w-20 shrink-0" style={{ color: 'var(--color-muted)' }}>{label}</span>
                  <span className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>{value}</span>
                </div>
              ))}
              {snap?.special_terms && (
                <div>
                  <p className="text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>특약사항</p>
                  <p className="text-sm p-3 rounded-lg whitespace-pre-wrap"
                     style={{ background: 'var(--color-background)', color: 'var(--color-text)' }}>
                    {snap.special_terms as string}
                  </p>
                </div>
              )}
            </div>

            <button onClick={() => setStep('sign')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              <PenTool size={16} /> 서명하러 가기
            </button>
          </>
        )}

        {/* 서명 패드 */}
        {step === 'sign' && (
          <>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              전자서명
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
              아래 박스에 서명해주세요.
            </p>

            <div className="rounded-2xl overflow-hidden mb-4"
                 style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
              <div className="px-4 py-3 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
                <span className="text-sm font-medium" style={{ color: 'var(--color-muted)' }}>서명란</span>
                <button onClick={clearSig} className="flex items-center gap-1 text-xs"
                        style={{ color: 'var(--color-muted)' }}>
                  <RotateCcw size={13} /> 초기화
                </button>
              </div>
              <canvas
                ref={canvasRef} width={440} height={180}
                className="w-full touch-none"
                style={{ cursor: 'crosshair', display: 'block', background: 'white' }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('review')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                돌아가기
              </button>
              <button onClick={submitSign} disabled={!hasSig || saving}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}>
                {saving && <Loader2 size={14} className="animate-spin" />}
                서명 완료
              </button>
            </div>

            <p className="text-center text-xs mt-4" style={{ color: 'var(--color-muted)' }}>
              서명 완료 시 위 계약 내용에 동의하는 것으로 간주됩니다.
            </p>
          </>
        )}
      </div>
    </div>
  )
}

/* ─── 전체화면 상태 컴포넌트 ─── */
function FullPage({ icon, iconColor, title, desc }: {
  icon: React.ReactNode; iconColor: string; title: string; desc: string
}) {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 text-center"
         style={{ background: 'var(--color-background)' }}>
      <div style={{ color: iconColor }} className="mb-4">{icon}</div>
      <h1 className="text-xl font-bold mb-2" style={{ color: 'var(--color-primary)', fontFamily: 'var(--font-display)' }}>
        {title}
      </h1>
      <p className="text-sm" style={{ color: 'var(--color-muted)' }}>{desc}</p>
    </div>
  )
}
