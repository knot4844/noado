import { notFound } from 'next/navigation'
import { createClient } from '@supabase/supabase-js'
import TenantPaymentView from './TenantPaymentView'
import type { Invoice, Room } from '@/types'

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

  // 청구서 및 관련 호실 정보 조회
  const { data: invoice, error } = await supabase
    .from('invoices')
    .select('*, rooms(name, tenant_name, tenant_phone, monthly_rent)')
    .eq('id', invoiceId)
    .single()

  if (error || !invoice) {
    console.error('[TenantPaymentPage] Invoice fetch error:', error)
    notFound()
  }

  // 데이터 가공 (타입 단언)
  const room = invoice.rooms as unknown as Room

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4 selection:bg-blue-100">
      <div className="w-full max-w-md bg-white rounded-3xl shadow-xl overflow-hidden border border-neutral-100">
        <TenantPaymentView invoice={invoice as Invoice} room={room} />
      </div>
    </div>
  )
}
