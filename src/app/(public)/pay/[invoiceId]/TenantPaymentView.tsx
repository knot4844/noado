'use client'

import { useState } from 'react'
import {
  Building2, CheckCircle2, Copy, FileText, Loader2,
  Wallet, AlertCircle, ChevronDown, ChevronUp, Download, Lock,
} from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import type { Invoice, Room, Contract } from '@/types'

const VA_BANKS: Record<string, string> = {
  SHINHAN: '신한은행',
  KOOKMIN: '국민은행',
  HANA:    '하나은행',
  WOORI:   '우리은행',
  NH:      '농협은행',
  IBK:     'IBK기업은행',
  BUSAN:   '부산은행',
  DAEGU:   '대구은행',
  GWANGJU: '광주은행',
}

interface Props {
  invoice:  Invoice
  room?:    Room
  contract?: Contract | null
  tenantName?: string
}

export default function TenantPaymentView({ invoice, room, contract, tenantName }: Props) {
  const [bank, setBank]             = useState<string>('SHINHAN')
  const [loading, setLoading]       = useState(false)
  const [errorObj, setErrorObj]     = useState<string | null>(null)
  const [contractOpen, setContractOpen] = useState(false)

  // 가상계좌 상태를 로컬에서 즉각 반영하기 위함
  const [vaInfo, setVaInfo] = useState<{
    accountNumber: string | null;
    bank: string | null;
    due: string | null;
  }>({
    accountNumber: invoice.virtual_account_number,
    bank: invoice.virtual_account_bank,
    due: invoice.virtual_account_due,
  })

  const isPaid    = invoice.status === 'paid'
  const isOverdue = invoice.status === 'overdue'

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text)
      .then(() => alert('계좌번호가 복사되었습니다.'))
      .catch(() => alert('복사에 실패했습니다.'))
  }

  const handleIssueVirtualAccount = async () => {
    setLoading(true)
    setErrorObj(null)
    try {
      const res = await fetch('/api/portone/virtual-account', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ invoiceId: invoice.id, bank }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || '가상계좌 발급 중 오류가 발생했습니다.')
      setVaInfo({ accountNumber: data.accountNumber, bank: data.bank, due: data.expiredAt })
    } catch (err) {
      setErrorObj(err instanceof Error ? err.message : '알 수 없는 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  // 계약서 인쇄/PDF 저장
  const handlePrintContract = () => {
    window.print()
  }

  return (
    <>
      {/* 인쇄 시 계약서만 표시 */}
      <style>{`
        @media print {
          body > * { display: none !important; }
          #contract-print-area { display: block !important; }
        }
        #contract-print-area { display: none; }
      `}</style>

      {/* 인쇄 전용 계약서 영역 */}
      {contract && (
        <div id="contract-print-area" style={{ padding: '40px', fontFamily: 'serif', fontSize: '14px', lineHeight: '1.8' }}>
          <h1 style={{ textAlign: 'center', fontSize: '22px', marginBottom: '32px', fontWeight: 'bold' }}>
            부동산 임대차 계약서
          </h1>
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '24px' }}>
            <tbody>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', width: '25%', background: '#f5f5f5', fontWeight: 'bold' }}>임차인</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{contract.tenant_name}</td>
                <td style={{ border: '1px solid #000', padding: '8px', width: '25%', background: '#f5f5f5', fontWeight: 'bold' }}>연락처</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{contract.tenant_phone ?? '-'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', background: '#f5f5f5', fontWeight: 'bold' }}>소재지</td>
                <td colSpan={3} style={{ border: '1px solid #000', padding: '8px' }}>{room?.name}호 · {contract.address ?? '대우오피스'}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', background: '#f5f5f5', fontWeight: 'bold' }}>보증금</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{formatKRW(contract.deposit)}</td>
                <td style={{ border: '1px solid #000', padding: '8px', background: '#f5f5f5', fontWeight: 'bold' }}>월 임대료</td>
                <td style={{ border: '1px solid #000', padding: '8px' }}>{formatKRW(contract.monthly_rent)}</td>
              </tr>
              <tr>
                <td style={{ border: '1px solid #000', padding: '8px', background: '#f5f5f5', fontWeight: 'bold' }}>계약기간</td>
                <td colSpan={3} style={{ border: '1px solid #000', padding: '8px' }}>
                  {contract.lease_start ? formatDate(contract.lease_start) : '미정'} ~ {contract.lease_end ? formatDate(contract.lease_end) : '미정'}
                </td>
              </tr>
              {contract.special_terms && (
                <tr>
                  <td style={{ border: '1px solid #000', padding: '8px', background: '#f5f5f5', fontWeight: 'bold' }}>특약사항</td>
                  <td colSpan={3} style={{ border: '1px solid #000', padding: '8px', whiteSpace: 'pre-wrap' }}>{contract.special_terms}</td>
                </tr>
              )}
            </tbody>
          </table>
          <p style={{ marginTop: '16px', fontSize: '12px', color: '#555' }}>
            납부 확인일: {invoice.paid_at ? formatDate(invoice.paid_at) : '-'} · 납부 금액: {formatKRW(invoice.paid_amount)} · Powered by Noado
          </p>
        </div>
      )}

      {/* Header Section */}
      <div className={`p-8 pb-6 text-white transition-colors duration-500 ${isPaid ? 'bg-emerald-500' : 'bg-slate-900'}`}>
        <div className="flex items-center justify-between mb-8 opacity-90">
          <div className="flex items-center gap-2">
            <Building2 size={24} />
            <span className="font-semibold tracking-tight">대우오피스 결제</span>
          </div>
          <span className="text-xs px-2.5 py-1 rounded-full bg-white/20 font-medium backdrop-blur-md">
            {invoice.year}년 {invoice.month}월
          </span>
        </div>

        <div className="space-y-1">
          <p className="text-sm font-medium opacity-80 mb-1">{room?.name}호 이용료</p>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-bold tracking-tight">{formatKRW(invoice.amount).replace('원', '')}</span>
            <span className="text-lg font-medium opacity-80">원</span>
          </div>
        </div>

        {isPaid && (
          <div className="mt-6 flex items-center gap-2 bg-white/20 px-4 py-2.5 rounded-xl backdrop-blur-md">
            <CheckCircle2 size={18} className="text-white" />
            <span className="font-semibold text-sm">결제가 완료되었습니다</span>
          </div>
        )}
      </div>

      {/* Content Section */}
      <div className="p-8 space-y-6">

        {/* Invoice Summary Details */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-4">
            <span className="text-neutral-500 font-medium flex items-center gap-2">
              <FileText size={16} /> 청구 항목
            </span>
            <span className="text-neutral-900 font-medium tracking-tight">월 이용료 및 관리비</span>
          </div>
          <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-4">
            <span className="text-neutral-500 font-medium flex items-center gap-2">
               납부 기한
            </span>
            <span className={`font-semibold tracking-tight ${isOverdue ? 'text-red-500' : 'text-neutral-900'}`}>
              {invoice.due_date ? formatDate(invoice.due_date) : '미정'}
              {isOverdue && ' (연체)'}
            </span>
          </div>
          <div className="flex justify-between items-center text-sm pb-2">
            <span className="text-neutral-500 font-medium flex items-center gap-2">
               이용자명
            </span>
            <span className="text-neutral-900 font-medium">{tenantName || '미등록'}</span>
          </div>
        </div>

        {/* 계약서 섹션 */}
        {contract && (
          <div className="rounded-2xl border overflow-hidden" style={{ borderColor: '#e5e7eb' }}>
            {/* 계약서 헤더 (항상 표시) */}
            <button
              onClick={() => setContractOpen(v => !v)}
              className="w-full flex items-center justify-between px-5 py-4 text-sm font-semibold bg-neutral-50 hover:bg-neutral-100 transition-colors"
            >
              <span className="flex items-center gap-2 text-neutral-700">
                <FileText size={16} className="text-blue-500" />
                계약서 확인
                {isPaid && (
                  <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                    다운로드 가능
                  </span>
                )}
              </span>
              {contractOpen ? <ChevronUp size={16} className="text-neutral-400" /> : <ChevronDown size={16} className="text-neutral-400" />}
            </button>

            {/* 계약서 내용 (펼쳤을 때) */}
            {contractOpen && (
              <div className="px-5 py-4 space-y-3 text-sm border-t border-neutral-100">
                <div className="flex justify-between">
                  <span className="text-neutral-500">임차인</span>
                  <span className="font-medium text-neutral-800">{contract.tenant_name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">계약기간</span>
                  <span className="font-medium text-neutral-800">
                    {contract.lease_start ? formatDate(contract.lease_start) : '미정'}
                    {' ~ '}
                    {contract.lease_end ? formatDate(contract.lease_end) : '미정'}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">월 임대료</span>
                  <span className="font-semibold text-neutral-800">{formatKRW(contract.monthly_rent)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-neutral-500">보증금</span>
                  <span className="font-semibold text-neutral-800">{formatKRW(contract.deposit)}</span>
                </div>
                {contract.special_terms && (
                  <div className="pt-2 border-t border-neutral-100">
                    <p className="text-neutral-500 mb-1">특약사항</p>
                    <p className="text-neutral-700 whitespace-pre-wrap leading-relaxed">{contract.special_terms}</p>
                  </div>
                )}

                {/* 납부 완료 시: 다운로드 버튼 */}
                {isPaid ? (
                  <button
                    onClick={handlePrintContract}
                    className="w-full mt-3 flex items-center justify-center gap-2 py-3 rounded-xl bg-emerald-500 hover:bg-emerald-600 text-white text-sm font-semibold transition-colors"
                  >
                    <Download size={16} />
                    계약서 다운로드 (PDF)
                  </button>
                ) : (
                  <div className="mt-3 flex items-center gap-2 px-4 py-3 rounded-xl bg-neutral-100 text-neutral-500 text-xs">
                    <Lock size={14} className="shrink-0" />
                    <span>납부 완료 후 계약서를 다운로드할 수 있습니다.</span>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Action / Payment Area */}
        {!isPaid && (
          <div className="pt-2 space-y-4">
            {vaInfo.accountNumber ? (
              <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 relative overflow-hidden group">
                <div className="absolute top-0 right-0 -mt-4 -mr-4 w-24 h-24 bg-blue-100/50 rounded-full blur-2xl transform group-hover:scale-110 transition-transform duration-700 pointer-events-none" />

                <div className="relative">
                  <h3 className="text-sm font-semibold text-blue-900 mb-4 flex items-center gap-2">
                    <Wallet size={16} className="text-blue-600" />
                    입금 전용 가상계좌
                  </h3>

                  <div className="space-y-4">
                    <div className="flex flex-col gap-1 border-b border-blue-100/50 pb-3">
                      <span className="text-xs text-blue-600/80 font-medium tracking-wide">은행</span>
                      <span className="text-base font-bold text-blue-950">
                        {VA_BANKS[vaInfo.bank || ''] || vaInfo.bank}
                      </span>
                    </div>

                    <div className="flex flex-col gap-1 border-b border-blue-100/50 pb-3">
                      <span className="text-xs text-blue-600/80 font-medium tracking-wide">계좌번호</span>
                      <div className="flex items-center justify-between">
                        <span className="text-xl font-bold text-blue-700 tracking-wider font-mono">
                          {vaInfo.accountNumber}
                        </span>
                        <button
                          onClick={() => copyToClipboard(vaInfo.accountNumber!)}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-200 hover:text-blue-800 transition-colors shadow-sm"
                          title="계좌번호 복사"
                        >
                          <Copy size={14} />
                          <span className="text-xs font-semibold">복사</span>
                        </button>
                      </div>
                    </div>

                    <div className="flex justify-between items-center pt-1">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-blue-600/80 font-medium">예금주</span>
                        <span className="text-sm font-bold text-blue-950">대우오피스</span>
                      </div>
                      <div className="flex flex-col gap-0.5 items-end">
                        <span className="text-xs text-blue-600/80 font-medium">입금기한</span>
                        <span className="text-sm font-bold text-rose-500">
                          {vaInfo.due ? formatDate(vaInfo.due) : '기한 없음'} 까지
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-4 bg-white p-1 rounded-2xl">
                <div className="space-y-2">
                  <label className="text-xs font-semibold text-neutral-500 uppercase tracking-wider ml-1">입금하실 은행 선택</label>
                  <select
                    value={bank}
                    onChange={e => setBank(e.target.value)}
                    className="w-full px-4 py-3.5 bg-neutral-50 border border-neutral-200 rounded-xl text-neutral-900 font-medium hover:border-blue-400 focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all appearance-none cursor-pointer"
                  >
                    {Object.entries(VA_BANKS).map(([code, name]) => (
                      <option key={code} value={code}>{name}</option>
                    ))}
                  </select>
                </div>

                {errorObj && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-start gap-2 text-rose-700 text-sm animate-in fade-in slide-in-from-top-1">
                    <AlertCircle size={16} className="shrink-0 mt-0.5" />
                    <p className="font-medium leading-snug">{errorObj}</p>
                  </div>
                )}

                <button
                  onClick={handleIssueVirtualAccount}
                  disabled={loading}
                  className="w-full h-14 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-bold shadow-lg shadow-slate-900/10 transition-all transform hover:-translate-y-0.5 active:translate-y-0 disabled:opacity-50 disabled:hover:translate-y-0 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  {loading ? (
                    <><Loader2 size={18} className="animate-spin" /> 발급 중...</>
                  ) : (
                    '결제용 가상계좌 발급받기'
                  )}
                </button>
              </div>
            )}

            <p className="text-center text-xs font-medium text-neutral-400 mt-6 px-4">
              위 계좌로 정확한 금액을 입금하시면<br/>실시간으로 안전하게 수납이 완료됩니다.
            </p>
          </div>
        )}

        {/* 납부 완료 후 계약서 다운로드 안내 (계약서 없이 결제된 경우 숨김) */}
        {isPaid && !contract && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-emerald-50 text-emerald-700 text-sm">
            <CheckCircle2 size={16} className="shrink-0" />
            <span>정상적으로 수납 처리되었습니다. 감사합니다.</span>
          </div>
        )}
      </div>

      {/* Footer Details */}
      <div className="bg-neutral-50 p-6 border-t border-neutral-100 text-center rounded-b-3xl">
        <p className="text-xs text-neutral-400">
          {isPaid
            ? '정상적으로 수납 처리되었습니다. 감사합니다.'
            : '입금 시 반드시 위 가상계좌로 기한 내에 입금하시기 바랍니다.'}
        </p>
        <p className="text-[10px] text-neutral-300 mt-2">Powered by Noado & PortOne</p>
      </div>
    </>
  )
}
