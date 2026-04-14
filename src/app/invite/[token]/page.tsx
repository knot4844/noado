'use client'

export const dynamic = 'force-dynamic'

/**
 * /invite/[token] - 전자계약 서명 페이지 (임차인 접근)
 * sign_token으로 계약서 조회 → Canvas 서명 → 저장
 */
import { useEffect, useState, useRef } from 'react'
import { useParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { Loader2, CheckCircle2, AlertCircle, PenTool, RotateCcw, Download, User } from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import type { Contract } from '@/types'

type Step = 'loading' | 'review' | 'fill-info' | 'sign' | 'done' | 'error' | 'expired'

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

  // 임차인 정보 입력 폼
  const [tenantForm, setTenantForm] = useState({
    name: '',
    phone: '',
    address: '',
    business_no: '',
    biz_type: '',
  })

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
      // 임차인 정보 초기화 (이미 입력된 정보가 있으면 사용)
      setTenantForm(prev => ({
        ...prev,
        name: data.tenant_name || '',
        phone: data.tenant_phone || '',
        address: data.address || '',
      }))
      setStep('review')
    })()
  }, [token, supabase])

  /* ─── Canvas 서명 이벤트 (CSS 픽셀 좌표) ─── */
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

  /* ─── Canvas 내부 픽셀을 표시 크기에 맞게 리사이즈 ─── */
  useEffect(() => {
    if (step !== 'sign') return
    const canvas = canvasRef.current
    if (!canvas) return
    const dpr = window.devicePixelRatio || 1
    const rect = canvas.getBoundingClientRect()
    canvas.width  = Math.round(rect.width  * dpr)
    canvas.height = Math.round(rect.height * dpr)
    const ctx = canvas.getContext('2d')!
    ctx.scale(dpr, dpr)
    // 다시 보이도록 흰 배경
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
  }, [step])

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
    const rect = canvas.getBoundingClientRect()
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, rect.width, rect.height)
    setHasSig(false)
  }

  /* ─── 서명 제출 ─── */
  const submitSign = async () => {
    if (!contract || !hasSig) return
    setSaving(true)

    const canvas   = canvasRef.current!
    const dataUrl  = canvas.toDataURL('image/png')

    try {
      // 임차인이 입력한 정보로 스냅샷 업데이트
      const updatedSnapshot = {
        ...(contract.contract_snapshot || {}),
        tenant_name: tenantForm.name || contract.tenant_name,
        tenant_phone: tenantForm.phone || contract.tenant_phone,
        tenant_address: tenantForm.address,
        tenant_business_no: tenantForm.business_no,
        tenant_biz_type: tenantForm.biz_type,
      }

      const res = await fetch('/api/contracts/sign', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contractId: contract.id,
          roomId: contract.room_id,
          signature: dataUrl,
          tenantName: tenantForm.name || contract.tenant_name || '임차인',
          contractContent: updatedSnapshot,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || '서버 오류');

      const now = new Date(data.signedAt);
      setSignDate(`${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`);
      setContentHash(data.contentHash);

      // 초대한 토큰 계약 상태도 갱신 + 임차인 입력 정보 저장
      await supabase.from('contracts').update({
        status: 'signed',
        signed_at: new Date().toISOString(),
        signature_data_url: dataUrl,
        tenant_name: tenantForm.name || contract.tenant_name,
        tenant_phone: tenantForm.phone || contract.tenant_phone,
        contract_snapshot: updatedSnapshot,
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

  // 새로고침 후에도 서명일/해시 표시되도록 contract에서 폴백
  const displaySignDate = signDate ?? (contract?.signed_at
    ? (() => {
        const d = new Date(contract.signed_at!)
        return `${d.getFullYear()}년 ${d.getMonth()+1}월 ${d.getDate()}일 ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`
      })()
    : null)
  const displayHash = contentHash ?? contract?.content_hash ?? null

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
    <div className="min-h-screen py-10 px-4 font-sans print:py-0 print:px-0" style={{ background: 'var(--color-background)' }}>
      <style jsx global>{`
        @media print {
          @page { size: A4; margin: 16mm; }
          body { background: white !important; }
          .no-print { display: none !important; }
          .print-area { box-shadow: none !important; border: none !important; padding: 0 !important; max-width: 100% !important; }
        }
      `}</style>

      {/* 성공 카드 (인쇄 시 숨김) */}
      <div className="no-print w-full max-w-lg mx-auto rounded-3xl p-8 text-center mb-6"
           style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>
        <div className="w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4"
             style={{ background: 'var(--color-success-bg)', color: 'var(--color-success)' }}>
          <CheckCircle2 size={32} />
        </div>
        <h1 className="text-xl font-bold mb-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
          전자 서명이 완료되었습니다
        </h1>
        <p className="text-sm mb-5" style={{ color: 'var(--color-muted)' }}>
          아래 계약서를 PDF로 저장해 보관해주세요.<br />전자서명법에 따라 법적 효력이 발생합니다.
        </p>
        <button onClick={() => window.print()}
          className="w-full py-3 rounded-xl text-sm font-bold text-white flex items-center justify-center gap-2 hover:opacity-90"
          style={{ background: 'var(--color-primary)' }}>
          <Download size={16} />
          계약서 PDF 다운로드 (인쇄)
        </button>
      </div>

      {/* 인쇄 대상 계약서 본문 */}
      <div className="print-area w-full max-w-2xl mx-auto rounded-2xl p-8"
           style={{ background: 'white', boxShadow: 'var(--shadow-soft)', border: '1px solid var(--color-border)' }}>
        <div className="text-center mb-6 pb-4 border-b" style={{ borderColor: '#e5e5e5' }}>
          <div className="inline-block px-6 py-2 rounded-lg font-bold text-xl"
               style={{ border: '2px solid #1d3557', color: '#1d3557' }}>
            임 대 차 계 약 서
          </div>
        </div>

        {/* 업로드된 양식 */}
        {contract?.template_url && (
          <div className="mb-6 pb-6 border-b" style={{ borderColor: '#e5e5e5' }}>
            {contract.template_mime?.startsWith('image/') ? (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src={contract.template_url} alt="계약서 양식" className="w-full rounded border" style={{ borderColor: '#e5e5e5' }} />
            ) : contract.template_mime === 'application/pdf' ? (
              <>
                <iframe src={contract.template_url} className="w-full rounded border no-print"
                        style={{ borderColor: '#e5e5e5', height: 480 }} title="계약서 양식" />
                <p className="text-xs text-center mt-2" style={{ color: '#777' }}>
                  ※ PDF 양식은 인쇄 시 별도로 다운로드해 함께 보관해주세요.
                </p>
              </>
            ) : null}
          </div>
        )}

        {/* 계약 정보 */}
        <dl className="space-y-3 mb-6">
          {[
            { label: '임차인',      value: (snap?.tenant_name as string) || tenantForm.name || contract?.tenant_name || '—' },
            { label: '연락처',      value: (snap?.tenant_phone as string) || tenantForm.phone || contract?.tenant_phone || '—' },
            { label: '주소',        value: (snap?.tenant_address as string) || tenantForm.address || '—' },
            { label: '사업자번호',  value: (snap?.tenant_business_no as string) || tenantForm.business_no || '—' },
            { label: '업종',        value: (snap?.tenant_biz_type as string) || tenantForm.biz_type || '—' },
            { label: '보증금',      value: snap?.deposit ? formatKRW(Number(snap.deposit)) : '—' },
            { label: '월 임대료',   value: snap?.monthly_rent ? formatKRW(Number(snap.monthly_rent)) : '—' },
            { label: '계약 시작',   value: contract?.lease_start ? formatDate(contract.lease_start) : '—' },
            { label: '계약 만료',   value: contract?.lease_end   ? formatDate(contract.lease_end)   : '—' },
          ].filter(({ value }) => value !== '—').map(({ label, value }) => (
            <div key={label} className="flex gap-3">
              <dt className="text-sm font-medium w-24 shrink-0" style={{ color: '#555' }}>{label}</dt>
              <dd className="text-sm" style={{ color: '#111' }}>{value}</dd>
            </div>
          ))}
          {snap?.special_terms && (
            <div className="pt-2">
              <dt className="text-sm font-medium mb-1" style={{ color: '#555' }}>특약사항</dt>
              <dd className="text-sm whitespace-pre-wrap p-3 rounded" style={{ background: '#f7f7f7', color: '#111' }}>
                {snap.special_terms as string}
              </dd>
            </div>
          )}
        </dl>

        {/* 서명 */}
        <div className="pt-5 mt-5 border-t" style={{ borderColor: '#e5e5e5' }}>
          <p className="text-sm font-bold mb-2" style={{ color: '#1d3557' }}>임차인 전자서명</p>
          {contract?.signature_data_url ? (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src={contract.signature_data_url} alt="서명" className="max-h-28 border rounded p-2" style={{ borderColor: '#e5e5e5', background: 'white' }} />
          ) : (
            <p className="text-xs" style={{ color: '#999' }}>서명 이미지 없음</p>
          )}
        </div>

        {/* 법적 증거 */}
        <div className="mt-6 pt-4 border-t text-xs space-y-1.5" style={{ borderColor: '#e5e5e5', color: '#555' }}>
          <div><strong>📅 서명 일시:</strong> {displaySignDate}</div>
          {displayHash && (
            <div className="break-all">
              <strong>🔐 콘텐츠 해시(SHA-256):</strong> <span className="font-mono">{displayHash}</span>
            </div>
          )}
        </div>
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
              이용 계약서 검토
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
              아래 계약 내용을 확인 후 서명해주세요.
            </p>

            {/* 임대인이 업로드한 계약서 양식 */}
            {contract?.template_url && (
              <div className="rounded-2xl p-4 mb-4"
                   style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
                <div className="flex items-center justify-between mb-2">
                  <p className="text-xs font-semibold" style={{ color: 'var(--color-primary)' }}>계약서 원본</p>
                  <a href={contract.template_url} target="_blank" rel="noreferrer"
                     className="text-xs flex items-center gap-1" style={{ color: 'var(--color-accent-dark)' }}>
                    <Download size={11} /> 다운로드
                  </a>
                </div>
                {contract.template_mime?.startsWith('image/') ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={contract.template_url} alt={contract.template_name || '계약서'}
                       className="w-full rounded-lg border" style={{ borderColor: 'var(--color-border)' }} />
                ) : contract.template_mime === 'application/pdf' ? (
                  <iframe src={contract.template_url} className="w-full rounded-lg border"
                          style={{ borderColor: 'var(--color-border)', height: 480 }} title="계약서 양식" />
                ) : (
                  <p className="text-xs" style={{ color: 'var(--color-muted)' }}>다운로드 후 확인해주세요.</p>
                )}
              </div>
            )}

            <div className="rounded-2xl p-5 mb-6 space-y-4"
                 style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
              {[
                { label: '이용자',   value: contract?.tenant_name ?? '—' },
                { label: '소재지',   value: snap?.address as string ?? '—' },
                { label: '선납금',   value: snap?.deposit ? formatKRW(Number(snap.deposit)) : '—' },
                { label: '월 이용료', value: snap?.monthly_rent ? formatKRW(Number(snap.monthly_rent)) : '—' },
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

            <button onClick={() => setStep('fill-info')}
              className="w-full py-3 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
              style={{ background: 'var(--color-primary)' }}>
              <PenTool size={16} /> 임차인 정보 입력 및 서명
            </button>
          </>
        )}

        {/* 임차인 정보 입력 */}
        {step === 'fill-info' && (
          <>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
              임차인 정보 입력
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--color-muted)' }}>
              계약서에 기재될 임차인 정보를 입력해주세요.
            </p>

            {/* 자동 채워진 계약 조건 (읽기 전용) */}
            <div className="rounded-2xl p-5 mb-4"
                 style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                     style={{ background: 'rgba(29,53,87,0.08)', color: 'var(--color-primary)' }}>
                  <CheckCircle2 size={14} />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>계약 조건 (자동 입력됨)</span>
              </div>
              <div className="space-y-2">
                {[
                  { label: '계약기간', value: contract?.lease_start && contract?.lease_end
                    ? `${formatDate(contract.lease_start)} ~ ${formatDate(contract.lease_end)}`
                    : '—' },
                  { label: '보증금', value: snap?.deposit ? formatKRW(Number(snap.deposit)) : '—' },
                  { label: '월 임대료', value: snap?.monthly_rent ? formatKRW(Number(snap.monthly_rent)) : '—' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex items-baseline gap-3">
                    <span className="text-xs font-medium w-16 shrink-0" style={{ color: 'var(--color-muted)' }}>{label}</span>
                    <span className="text-sm font-bold" style={{ color: 'var(--color-text)' }}>{value}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* 임차인 입력 폼 */}
            <div className="rounded-2xl p-5 mb-6 space-y-3"
                 style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-6 h-6 rounded-full flex items-center justify-center"
                     style={{ background: 'rgba(29,53,87,0.08)', color: 'var(--color-primary)' }}>
                  <User size={14} />
                </div>
                <span className="text-xs font-bold" style={{ color: 'var(--color-primary)' }}>임차인 정보</span>
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>성명 (상호) *</label>
                <input
                  value={tenantForm.name}
                  onChange={e => setTenantForm(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="성명 또는 상호를 입력하세요"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>연락처 *</label>
                <input
                  value={tenantForm.phone}
                  onChange={e => setTenantForm(prev => ({ ...prev, phone: e.target.value }))}
                  placeholder="010-0000-0000"
                  type="tel"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>주소</label>
                <input
                  value={tenantForm.address}
                  onChange={e => setTenantForm(prev => ({ ...prev, address: e.target.value }))}
                  placeholder="주소를 입력하세요"
                  className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                  style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>사업자등록번호</label>
                  <input
                    value={tenantForm.business_no}
                    onChange={e => setTenantForm(prev => ({ ...prev, business_no: e.target.value }))}
                    placeholder="000-00-00000"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1" style={{ color: 'var(--color-muted)' }}>업종</label>
                  <input
                    value={tenantForm.biz_type}
                    onChange={e => setTenantForm(prev => ({ ...prev, biz_type: e.target.value }))}
                    placeholder="업종"
                    className="w-full px-3 py-2.5 rounded-lg border text-sm outline-none"
                    style={{ borderColor: 'var(--color-border)', background: 'var(--color-background)' }}
                  />
                </div>
              </div>
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('review')}
                className="flex-1 py-2.5 rounded-xl text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                돌아가기
              </button>
              <button onClick={() => {
                  if (!tenantForm.name.trim()) { alert('성명(상호)을 입력해주세요.'); return }
                  if (!tenantForm.phone.trim()) { alert('연락처를 입력해주세요.'); return }
                  setStep('sign')
                }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-white flex items-center justify-center gap-2"
                style={{ background: 'var(--color-primary)' }}>
                <PenTool size={16} /> 서명하기
              </button>
            </div>
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
                ref={canvasRef}
                className="w-full touch-none"
                style={{ cursor: 'crosshair', display: 'block', background: 'white', height: 180 }}
                onMouseDown={startDraw} onMouseMove={draw} onMouseUp={endDraw} onMouseLeave={endDraw}
                onTouchStart={startDraw} onTouchMove={draw} onTouchEnd={endDraw}
              />
            </div>

            <div className="flex gap-2">
              <button onClick={() => setStep('fill-info')}
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
