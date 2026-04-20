import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServerClient } from '@/lib/supabase/server'

// GET /api/export/vat?from=2025-01&to=2025-03
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from') // e.g. "2025-01"
  const to   = searchParams.get('to')   // e.g. "2025-03"

  if (!from || !to) {
    return NextResponse.json(
      { error: 'from, to 파라미터가 필요합니다. 예) ?from=2025-01&to=2025-03' },
      { status: 400 }
    )
  }

  // 날짜 파싱
  const [fromYear, fromMonth] = from.split('-').map(Number)
  const [toYear,   toMonth  ] = to.split('-').map(Number)

  if (
    !fromYear || !fromMonth || !toYear || !toMonth ||
    fromYear > toYear ||
    (fromYear === toYear && fromMonth > toMonth)
  ) {
    return NextResponse.json(
      { error: '날짜 범위가 올바르지 않습니다.' },
      { status: 400 }
    )
  }

  const supabase = await createServerClient()
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    return NextResponse.json({ error: '로그인이 필요합니다.' }, { status: 401 })
  }

  // paid 상태 invoices + rooms 조인 (기간 내)
  // year/month 범위 필터: (year > fromYear) OR (year = fromYear AND month >= fromMonth)
  //                    AND (year < toYear)   OR (year = toYear   AND month <= toMonth)
  const { data: invoices, error } = await supabase
    .from('invoices')
    .select(`
      id,
      year,
      month,
      amount,
      paid_amount,
      paid_at,
      rooms (
        name,
        tenant_name,
        virtual_account_number
      )
    `)
    .eq('owner_id', user.id)
    .eq('status', 'paid')
    .or(
      `and(year.gt.${fromYear},year.lt.${toYear}),` +
      `and(year.eq.${fromYear},month.gte.${fromMonth},year.eq.${toYear},month.lte.${toMonth}),` +
      `and(year.eq.${fromYear},month.gte.${fromMonth},year.lt.${toYear}),` +
      `and(year.gt.${fromYear},year.eq.${toYear},month.lte.${toMonth})`
    )
    .order('year', { ascending: true })
    .order('month', { ascending: true })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // 기간 필터 (JS 레벨에서 한 번 더 확인)
  const filtered = (invoices || []).filter((inv) => {
    const y = inv.year
    const m = inv.month
    const afterFrom = y > fromYear || (y === fromYear && m >= fromMonth)
    const beforeTo  = y < toYear   || (y === toYear   && m <= toMonth)
    return afterFrom && beforeTo
  })

  // XLSX 생성
  const { utils, write } = await import('xlsx')

  const rows = filtered.map((inv) => {
    const room = (inv.rooms as unknown) as {
      name: string | null
      tenant_name: string | null
      virtual_account_number: string | null
    } | null

    const paidDate = inv.paid_at
      ? new Date(inv.paid_at).toLocaleDateString('ko-KR', {
          year: 'numeric', month: '2-digit', day: '2-digit',
        })
      : ''

    return {
      '호실':       room?.name                   ?? '',
      '입주사명':   room?.tenant_name             ?? '',
      '청구월':     `${inv.year}-${String(inv.month).padStart(2, '0')}`,
      '청구금액':   inv.amount,
      '입금액':     inv.paid_amount,
      '입금일':     paidDate,
      '가상계좌번호': room?.virtual_account_number ?? '',
    }
  })

  // 합계 행 추가
  const totalAmount = rows.reduce((s, r) => s + (r['청구금액'] as number), 0)
  const totalPaid   = rows.reduce((s, r) => s + (r['입금액']   as number), 0)
  rows.push({
    '호실':         '합계',
    '입주사명':     '',
    '청구월':       '',
    '청구금액':     totalAmount,
    '입금액':       totalPaid,
    '입금일':       '',
    '가상계좌번호': '',
  })

  const ws = utils.json_to_sheet(rows)

  // 컬럼 너비 설정
  ws['!cols'] = [
    { wch: 12 }, // 호실
    { wch: 14 }, // 입주사명
    { wch: 10 }, // 청구월
    { wch: 14 }, // 청구금액
    { wch: 14 }, // 입금액
    { wch: 14 }, // 입금일
    { wch: 20 }, // 가상계좌번호
  ]

  const wb = utils.book_new()
  utils.book_append_sheet(wb, ws, '부가세신고용')

  const buf = write(wb, { type: 'buffer', bookType: 'xlsx' })

  const filename = `부가세신고_${from}_${to}.xlsx`

  return new NextResponse(buf, {
    status: 200,
    headers: {
      'Content-Type':        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
    },
  })
}
