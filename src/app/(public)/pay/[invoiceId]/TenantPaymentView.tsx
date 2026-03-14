'use client'

import { useState } from 'react'
import { Building2, CheckCircle2, Copy, FileText, Loader2, Wallet, AlertCircle } from 'lucide-react'
import { formatKRW, formatDate } from '@/lib/utils'
import type { Invoice, Room } from '@/types'

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
  invoice: Invoice
  room?: Room
}

export default function TenantPaymentView({ invoice, room }: Props) {
  const [bank, setBank] = useState<string>('SHINHAN')
  const [loading, setLoading] = useState(false)
  const [errorObj, setErrorObj] = useState<string | null>(null)
  
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

  const isPaid = invoice.status === 'paid'
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
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invoiceId: invoice.id,
          bank: bank,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || '가상계좌 발급 중 오류가 발생했습니다.')
      }

      setVaInfo({
        accountNumber: data.accountNumber,
        bank: data.bank,
        due: data.expiredAt,
      })
    } catch (err) {
      setErrorObj(err instanceof Error ? err.message : '알 수 없는 오류 발생')
    } finally {
      setLoading(false)
    }
  }

  return (
    <>
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
          <p className="text-sm font-medium opacity-80 mb-1">{room?.name}호 임대료</p>
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
      <div className="p-8 space-y-8">
        
        {/* Invoice Summary Details */}
        <div className="space-y-4">
          <div className="flex justify-between items-center text-sm border-b border-neutral-100 pb-4">
            <span className="text-neutral-500 font-medium flex items-center gap-2">
              <FileText size={16} /> 청구 항목
            </span>
            <span className="text-neutral-900 font-medium tracking-tight">월 임대료 및 관리비</span>
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
               입주자명
            </span>
            <span className="text-neutral-900 font-medium">{room?.tenant_name || '미등록'}</span>
          </div>
        </div>

        {/* Action / Payment Area */}
        {!isPaid && (
          <div className="pt-4 space-y-4">
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

      </div>
      
      {/* Footer Details */}
      <div className="bg-neutral-50 p-6 border-t border-neutral-100 text-center rounded-b-3xl">
         <p className="text-xs text-neutral-400">
           {isPaid 
             ? '정상적으로 수납 처리되었습니다. 감사합니다.' 
             : '입금 시 반드시 위원된 가상계좌로 기한 내에 입금하시기 바랍니다.'}
         </p>
         <p className="text-[10px] text-neutral-300 mt-2">Powered by Noado & PortOne</p>
      </div>
    </>
  )
}
