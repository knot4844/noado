import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TenantPaymentView from './TenantPaymentView'
import type { Invoice, Room, Contract } from '@/types'

// Revalidate this page dynamically
export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{
    invoiceId: string
  }>
}

export default async function TenantPaymentPage({ params }: PageProps) {
  const { invoiceId } = await params

  if (!invoiceId) {
    notFound()
  }

  // Bypass RLS for the public payment link using service_role key
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 청구서 및 관련 호실 정보 조회 (rooms에는 name만 남아있음)
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, rooms(name)')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    console.error('[TenantPaymentPage] Invoice fetch error:', error)
    notFound()
  }

  // lease/tenant 정보 조회 (입주사명 등)
  let tenantName = ''
  if (invoice.lease_id) {
    const { data: lease } = await supabase
      .from('leases')
      .select('monthly_rent, tenant_id, tenants(name, phone)')
      .eq('id', invoice.lease_id)
      .single()
    if (lease) {
      const tenant = lease.tenants as unknown as { name: string; phone: string } | null
      tenantName = tenant?.name || ''
    }
  } else if (invoice.tenant_id) {
    const { data: tenant } = await supabase
      .from('tenants')
      .select('name, phone')
      .eq('id', invoice.tenant_id)
      .single()
    tenantName = tenant?.name || ''
  }

  // 계약서 조회 (contract_id가 있을 때만)
  let contract: Contract | null = null
  if (invoice.contract_id) {
    const { data: contractData } = await supabase
      .from('contracts')
      .select('id, tenant_name, monthly_rent, deposit, lease_start, lease_end, address, special_terms, status, signed_at')
      .eq('id', invoice.contract_id)
      .single()
    contract = (contractData as Contract) ?? null
  }

  // 데이터 가공 (타입 단언)
  const room = invoice.rooms as unknown as Room

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-neutral-100">
        <TenantPaymentView invoice={invoice as Invoice} room={room} contract={contract} tenantName={tenantName} />
      </div>
    </div>
  )
}
