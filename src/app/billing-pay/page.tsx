'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { ExternalLink, CreditCard, Building2, Calendar, AlertCircle, CheckCircle2, Clock } from 'lucide-react'

interface InvoiceRow {
  id: string
  room_id: string
  lease_id: string | null
  tenant_id: string | null
  billing_month: string
  amount: number
  status: string
  due_date: string | null
  portone_payment_id: string | null
  virtual_account_number: string | null
  virtual_account_bank: string | null
  room_name: string
  tenant_name: string
}

export default function BillingPayPage() {
  const supabase = useMemo(() => createClient(), [])
  const [invoices, setInvoices] = useState<InvoiceRow[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadInvoices()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  async function loadInvoices() {
    setLoading(true)
    try {
      // 청구서 조회 (최근 3개월)
      const { data: invoiceData, error } = await supabase
        .from('invoices')
        .select('id, room_id, lease_id, tenant_id, billing_month, amount, status, due_date, portone_payment_id, virtual_account_number, virtual_account_bank, rooms(name)')
        .order('billing_month', { ascending: false })
        .limit(100)

      if (error) {
        console.error('Invoice fetch error:', error)
        return
      }

      if (!invoiceData) return

      // lease/tenant 정보 조회
      const leaseIds = [...new Set(invoiceData.filter(i => i.lease_id).map(i => i.lease_id!))]
      const tenantIds = [...new Set(invoiceData.filter(i => i.tenant_id).map(i => i.tenant_id!))]

      let tenantsMap: Record<string, string> = {}

      // leases에서 tenant 이름 가져오기
      if (leaseIds.length > 0) {
        const { data: leases } = await supabase
          .from('leases')
          .select('id, tenant_id')
          .in('id', leaseIds)

        if (leases) {
          const leasetenantIds = leases.map(l => l.tenant_id).filter(Boolean)
          if (leasetenantIds.length > 0) {
            const { data: tenants } = await supabase
              .from('tenants')
              .select('id, name')
              .in('id', leasetenantIds)
            if (tenants) {
              const tenantNameMap: Record<string, string> = {}
              tenants.forEach(t => { tenantNameMap[t.id] = t.name })
              leases.forEach(l => {
                if (l.tenant_id && tenantNameMap[l.tenant_id]) {
                  tenantsMap[l.id] = tenantNameMap[l.tenant_id]
                }
              })
            }
          }
        }
      }

      // 직접 tenant_id가 있는 경우
      if (tenantIds.length > 0) {
        const { data: tenants } = await supabase
          .from('tenants')
          .select('id, name')
          .in('id', tenantIds)
        if (tenants) {
          tenants.forEach(t => { tenantsMap[t.id] = t.name })
        }
      }

      const rows: InvoiceRow[] = invoiceData.map(inv => {
        const room = inv.rooms as unknown as { name: string } | null
        let tenantName = ''
        if (inv.lease_id && tenantsMap[inv.lease_id]) {
          tenantName = tenantsMap[inv.lease_id]
        } else if (inv.tenant_id && tenantsMap[inv.tenant_id]) {
          tenantName = tenantsMap[inv.tenant_id]
        }

        return {
          id: inv.id,
          room_id: inv.room_id,
          lease_id: inv.lease_id,
          tenant_id: inv.tenant_id,
          billing_month: inv.billing_month,
          amount: inv.amount,
          status: inv.status,
          due_date: inv.due_date,
          portone_payment_id: inv.portone_payment_id,
          virtual_account_number: inv.virtual_account_number,
          virtual_account_bank: inv.virtual_account_bank,
          room_name: room?.name || '-',
          tenant_name: tenantName || '-',
        }
      })

      setInvoices(rows)
    } finally {
      setLoading(false)
    }
  }

  const unpaid = invoices.filter(i => i.status !== 'paid')
  const paid = invoices.filter(i => i.status === 'paid')

  const statusBadge = (status: string) => {
    switch (status) {
      case 'paid':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
            <CheckCircle2 size={12} /> 완납
          </span>
        )
      case 'overdue':
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-red-50 text-red-700">
            <AlertCircle size={12} /> 연체
          </span>
        )
      default:
        return (
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700">
            <Clock size={12} /> 미납
          </span>
        )
    }
  }

  const formatAmount = (n: number) =>
    new Intl.NumberFormat('ko-KR').format(n)

  const formatMonth = (m: string) => {
    if (!m) return '-'
    const [y, mo] = m.split('-')
    return `${y}년 ${parseInt(mo)}월`
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* 헤더 */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 flex items-center gap-2">
          <CreditCard className="text-blue-600" size={28} />
          이용료 결제
        </h1>
        <p className="text-neutral-500 mt-1">청구서를 선택하여 가상계좌로 이용료를 결제할 수 있습니다.</p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <div className="w-8 h-8 border-2 border-blue-200 border-t-blue-600 rounded-full animate-spin" />
        </div>
      ) : (
        <>
          {/* 미납 청구서 */}
          {unpaid.length > 0 && (
            <section className="mb-10">
              <h2 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                <AlertCircle size={20} className="text-amber-500" />
                결제 대기 ({unpaid.length}건)
              </h2>
              <div className="grid gap-3">
                {unpaid.map(inv => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-xl border border-neutral-200 p-5 hover:shadow-md hover:border-blue-200 transition-all"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                          <Building2 size={22} className="text-blue-600" />
                        </div>
                        <div>
                          <div className="font-semibold text-neutral-900">
                            {inv.room_name} {inv.tenant_name !== '-' && <span className="text-neutral-500 font-normal">· {inv.tenant_name}</span>}
                          </div>
                          <div className="flex items-center gap-3 mt-1 text-sm text-neutral-500">
                            <span>{formatMonth(inv.billing_month)}</span>
                            {inv.due_date && (
                              <span className="flex items-center gap-1">
                                <Calendar size={13} />
                                납기 {inv.due_date}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div className="text-lg font-bold text-neutral-900">{formatAmount(inv.amount)}원</div>
                          {statusBadge(inv.status)}
                        </div>
                        <a
                          href={`/pay/${inv.id}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-700 transition-colors shadow-sm"
                        >
                          결제하기
                          <ExternalLink size={14} />
                        </a>
                      </div>
                    </div>

                    {inv.virtual_account_number && (
                      <div className="mt-3 px-4 py-2.5 bg-blue-50 rounded-lg text-sm text-blue-800 flex items-center gap-2">
                        <CreditCard size={14} />
                        발급된 가상계좌: {inv.virtual_account_bank} {inv.virtual_account_number}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 완납 청구서 */}
          {paid.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-neutral-800 mb-4 flex items-center gap-2">
                <CheckCircle2 size={20} className="text-emerald-500" />
                결제 완료 ({paid.length}건)
              </h2>
              <div className="grid gap-2">
                {paid.slice(0, 20).map(inv => (
                  <div
                    key={inv.id}
                    className="bg-white rounded-xl border border-neutral-100 p-4 opacity-75"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-emerald-50 flex items-center justify-center">
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        </div>
                        <div>
                          <div className="font-medium text-neutral-700">
                            {inv.room_name} {inv.tenant_name !== '-' && <span className="text-neutral-400">· {inv.tenant_name}</span>}
                          </div>
                          <div className="text-xs text-neutral-400 mt-0.5">{formatMonth(inv.billing_month)}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className="text-sm font-semibold text-neutral-600">{formatAmount(inv.amount)}원</span>
                        {statusBadge('paid')}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {invoices.length === 0 && (
            <div className="text-center py-20 text-neutral-400">
              <CreditCard size={48} className="mx-auto mb-4 opacity-30" />
              <p className="text-lg">청구서가 없습니다.</p>
              <p className="text-sm mt-1">정기 청구에서 청구서를 먼저 생성해주세요.</p>
            </div>
          )}
        </>
      )}
    </div>
  )
}
