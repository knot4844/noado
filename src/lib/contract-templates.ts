/**
 * 기본 제공 전자계약서 양식 템플릿
 *
 * Canvas로 계약서 이미지를 생성하여 PNG Blob으로 반환
 * 임차인 서명 페이지에서 template_url로 표시됨
 */

export type ContractVatType = 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE'

export interface TemplateData {
  tenant_name:  string
  tenant_phone: string
  address:      string
  monthly_rent: string
  deposit:      string
  lease_start:  string
  lease_end:    string
  special_terms: string
  room_name:    string
  vat_type?:    ContractVatType  // 부가세 납부 여부 (세금계산서 발행이면 10% 별도 명시)
}

export interface TemplateInfo {
  id:    string
  name:  string
  desc:  string
  color: string
}

export const BUILT_IN_TEMPLATES: TemplateInfo[] = [
  {
    id:    'basic-lease',
    name:  '전자계약',
    desc:  '카톡/문자 링크로 전자서명 — 2페이지 계약서',
    color: '#1d3557',
  },
  {
    id:    'paper-lease',
    name:  '서면계약',
    desc:  '프린트 후 대면 서명 — 전자서명 불필요',
    color: '#4a4e69',
  },
]

function formatMoney(val: string): string {
  const n = Number(val.replace(/,/g, ''))
  if (!n) return '0'
  return n.toLocaleString('ko-KR')
}

/** 월 임대료 + vat_type을 기준으로 부가세/합계 행 값 계산 */
function computeVatRow(monthlyRentStr: string, vatType?: ContractVatType): {
  vatLabel:   string         // "부가가치세" row에 표시할 값
  totalLabel: string | null  // 합계 행 값 (VAT_INVOICE일 때만 존재)
} {
  const rent = Number((monthlyRentStr || '').replace(/,/g, '')) || 0
  if (vatType === 'VAT_INVOICE') {
    const vat   = Math.round(rent * 0.1)
    const total = rent + vat
    return {
      vatLabel:   `금 ${vat.toLocaleString('ko-KR')}원 (임대료의 10%)`,
      totalLabel: `금 ${total.toLocaleString('ko-KR')}원 (임대료 + 부가세)`,
    }
  }
  // 세금계산서 미발행 (현금영수증 또는 해당없음)
  return {
    vatLabel:   vatType === 'CASH_RECEIPT' ? '해당 없음 (현금영수증 발행)' : '해당 없음',
    totalLabel: null,
  }
}

function formatDateKR(val: string): string {
  if (!val) return '____년 __월 __일'
  const d = new Date(val)
  return `${d.getFullYear()}년 ${d.getMonth() + 1}월 ${d.getDate()}일`
}

/** Canvas에 계약서를 그려 PNG Blob으로 반환 */
export async function generateTemplateImage(
  templateId: string,
  data: TemplateData,
): Promise<Blob> {
  const W = 1200
  // 초기 높이를 넉넉히 잡고, 실제 사용 영역만 크롭
  const maxH = 5000
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = maxH
  const ctx = canvas.getContext('2d')!

  // 배경
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, W, maxH)

  let usedHeight = maxH

  switch (templateId) {
    case 'basic-lease':
      usedHeight = drawCommercialLease(ctx, W, maxH, data)
      break
    case 'paper-lease':
      usedHeight = drawPaperContract(ctx, W, maxH, data)
      break
    case 'shared-office':
      drawSharedOffice(ctx, W, maxH, data)
      break
    case 'short-term':
      drawShortTerm(ctx, W, maxH, data)
      break
    case 'commercial-lease':
      usedHeight = drawCommercialLease(ctx, W, maxH, data)
      break
  }

  // 실제 사용 영역만 크롭하여 최종 Canvas 생성
  const finalH = Math.min(usedHeight + 40, maxH) // 하단 여백 40px
  const finalCanvas = document.createElement('canvas')
  finalCanvas.width = W
  finalCanvas.height = finalH
  const fCtx = finalCanvas.getContext('2d')!
  fCtx.drawImage(canvas, 0, 0, W, finalH, 0, 0, W, finalH)

  return new Promise<Blob>((resolve, reject) => {
    finalCanvas.toBlob(blob => {
      if (blob) resolve(blob)
      else reject(new Error('Canvas to Blob 실패'))
    }, 'image/png')
  })
}

/* ─── 유틸: 박스 그리기 ─── */
function drawBox(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, opts?: { fill?: string; stroke?: string; lineWidth?: number }) {
  if (opts?.fill) {
    ctx.fillStyle = opts.fill
    ctx.fillRect(x, y, w, h)
  }
  if (opts?.stroke) {
    ctx.strokeStyle = opts.stroke
    ctx.lineWidth = opts?.lineWidth ?? 1
    ctx.strokeRect(x, y, w, h)
  }
}

function drawTableRow(ctx: CanvasRenderingContext2D, x: number, y: number, labelW: number, valueW: number, h: number, label: string, value: string, opts?: { labelBg?: string; color?: string }) {
  const labelBg = opts?.labelBg ?? '#f0f4f8'
  const color = opts?.color ?? '#1d3557'
  // label cell
  drawBox(ctx, x, y, labelW, h, { fill: labelBg, stroke: '#ccc' })
  ctx.fillStyle = color
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText(label, x + labelW / 2, y + h / 2)
  // value cell
  drawBox(ctx, x + labelW, y, valueW, h, { stroke: '#ccc' })
  ctx.fillStyle = '#222'
  ctx.font = '26px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.fillText(value, x + labelW + 18, y + h / 2)
}

function drawWrappedText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxW: number, lineH: number): number {
  const lines: string[] = []
  for (const paragraph of text.split('\n')) {
    if (!paragraph.trim()) { lines.push(''); continue }
    let line = ''
    for (const ch of paragraph) {
      const testLine = line + ch
      if (ctx.measureText(testLine).width > maxW && line) {
        lines.push(line)
        line = ch
      } else {
        line = testLine
      }
    }
    if (line) lines.push(line)
  }
  for (const l of lines) {
    ctx.fillText(l, x, y)
    y += lineH
  }
  return y
}

/* ═══════════════════════════════════════════════════════════════
   1. 임대차계약서 (기본)
   ═══════════════════════════════════════════════════════════════ */
function drawBasicLease(ctx: CanvasRenderingContext2D, W: number, _H: number, d: TemplateData) {
  const mx = 80 // margin x

  // ── 제목 ──
  ctx.fillStyle = '#1d3557'
  ctx.font = 'bold 42px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('임 대 차 계 약 서', W / 2, 70)

  // 구분선
  ctx.strokeStyle = '#1d3557'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(mx, 110)
  ctx.lineTo(W - mx, 110)
  ctx.stroke()

  // ── 전문 ──
  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const preamble = `임대인(이하 "갑")과 임차인(이하 "을")은 아래 부동산에 대하여 다음과 같이 임대차계약을 체결한다.`
  drawWrappedText(ctx, preamble, mx, 135, W - mx * 2, 32)

  // ── 부동산 표시 ──
  let y = 210
  ctx.fillStyle = '#1d3557'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제1조 [부동산의 표시]', mx, y)
  y += 45

  const labelW = 180
  const valueW = W - mx * 2 - labelW
  const rowH = 48

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '소 재 지', d.address || '—')
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '호     실', d.room_name || '—')
  y += rowH + 20

  // ── 계약 내용 ──
  ctx.fillStyle = '#1d3557'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제2조 [계약 내용]', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '보 증 금', `금 ${formatMoney(d.deposit)}원`)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 임대료', `금 ${formatMoney(d.monthly_rent)}원 (매월 납부)`)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '계약기간', `${formatDateKR(d.lease_start)} ~ ${formatDateKR(d.lease_end)}`)
  y += rowH + 20

  // ── 임차인 정보 ──
  ctx.fillStyle = '#1d3557'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제3조 [임차인 정보]', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '성명/상호', d.tenant_name || '—')
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '연 락 처', d.tenant_phone || '—')
  y += rowH + 20

  // ── 주요 조항 ──
  ctx.fillStyle = '#1d3557'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제4조 [주요 약정사항]', mx, y)
  y += 40

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  const clauses = [
    '1. 임차인은 매월 약정일까지 임대료를 납부하여야 한다.',
    '2. 임차인은 임대인의 동의 없이 목적물을 전대하거나 용도를 변경할 수 없다.',
    '3. 계약기간 만료 1개월 전까지 갱신 여부를 통지하여야 한다.',
    '4. 임차인은 퇴실 시 원상복구 후 반환하여야 한다.',
    '5. 보증금은 계약 종료 후 원상복구 확인 뒤 반환한다.',
  ]
  for (const c of clauses) {
    ctx.fillText(c, mx, y)
    y += 34
  }
  y += 10

  // ── 특약사항 ──
  if (d.special_terms) {
    ctx.fillStyle = '#1d3557'
    ctx.font = 'bold 26px "Pretendard", sans-serif'
    ctx.fillText('제5조 [특약사항]', mx, y)
    y += 40
    ctx.fillStyle = '#333'
    ctx.font = '20px "Pretendard", sans-serif'
    y = drawWrappedText(ctx, d.special_terms, mx, y, W - mx * 2, 32)
    y += 10
  }

  // ── 날짜 + 서명란 ──
  y += 30
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 30

  ctx.fillStyle = '#333'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${new Date().getFullYear()}년   ${new Date().getMonth() + 1}월   ${new Date().getDate()}일`, W / 2, y)
  y += 60

  ctx.textAlign = 'left'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.fillText('임 대 인 (갑):                                        (서명 또는 날인)', mx, y)
  y += 50
  ctx.fillText(`임 차 인 (을):  ${d.tenant_name || ''}`, mx, y)
  y += 30
  ctx.fillStyle = '#888'
  ctx.font = '18px "Pretendard", sans-serif'
  ctx.fillText('※ 아래 전자서명란에 서명해주세요.', mx, y)
}

/* ═══════════════════════════════════════════════════════════════
   2. 공유오피스 이용계약서
   ═══════════════════════════════════════════════════════════════ */
function drawSharedOffice(ctx: CanvasRenderingContext2D, W: number, _H: number, d: TemplateData) {
  const mx = 80

  // 제목
  ctx.fillStyle = '#2a9d8f'
  ctx.font = 'bold 42px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('공유오피스 이용계약서', W / 2, 70)

  ctx.strokeStyle = '#2a9d8f'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(mx, 110)
  ctx.lineTo(W - mx, 110)
  ctx.stroke()

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const preamble = `운영사(이하 "갑")와 이용자(이하 "을")는 공유오피스 이용에 관하여 다음과 같이 계약을 체결한다.`
  drawWrappedText(ctx, preamble, mx, 135, W - mx * 2, 32)

  let y = 210
  const labelW = 180
  const valueW = W - mx * 2 - labelW
  const rowH = 48
  const opts = { labelBg: '#e8f5f3', color: '#2a9d8f' }

  // 이용 공간
  ctx.fillStyle = '#2a9d8f'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제1조 [이용 공간]', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '소 재 지', d.address || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '좌석/호실', d.room_name || '—', opts)
  y += rowH + 20

  // 이용 조건
  ctx.fillStyle = '#2a9d8f'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제2조 [이용 조건]', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '예 치 금', `금 ${formatMoney(d.deposit)}원`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 이용료', `금 ${formatMoney(d.monthly_rent)}원 (VAT 별도)`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '이용기간', `${formatDateKR(d.lease_start)} ~ ${formatDateKR(d.lease_end)}`, opts)
  y += rowH + 20

  // 이용자 정보
  ctx.fillStyle = '#2a9d8f'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제3조 [이용자 정보]', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '상호/성명', d.tenant_name || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '연 락 처', d.tenant_phone || '—', opts)
  y += rowH + 20

  // 이용 규정
  ctx.fillStyle = '#2a9d8f'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('제4조 [이용 규정]', mx, y)
  y += 40

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  const rules = [
    '1. 이용시간: 평일 09:00 ~ 22:00 / 주말·공휴일 10:00 ~ 18:00',
    '2. 공용시설(회의실, 라운지, 복합기)은 예약 후 이용 가능하다.',
    '3. 이용자는 지정된 좌석/공간 외 타인의 공간을 무단 점유할 수 없다.',
    '4. 이용료는 매월 약정일까지 납부하며, 7일 이상 연체 시 이용이 제한된다.',
    '5. 퇴실 시 개인 물품을 모두 반출하고 원상태로 정리하여야 한다.',
    '6. 시설 훼손 시 복구 비용을 부담하며, 예치금에서 차감될 수 있다.',
    '7. 운영사는 시설 안전 및 운영을 위해 이용 규칙을 변경할 수 있다.',
  ]
  for (const r of rules) {
    ctx.fillText(r, mx, y)
    y += 34
  }
  y += 10

  // 특약
  if (d.special_terms) {
    ctx.fillStyle = '#2a9d8f'
    ctx.font = 'bold 26px "Pretendard", sans-serif'
    ctx.fillText('제5조 [특약사항]', mx, y)
    y += 40
    ctx.fillStyle = '#333'
    ctx.font = '20px "Pretendard", sans-serif'
    y = drawWrappedText(ctx, d.special_terms, mx, y, W - mx * 2, 32)
    y += 10
  }

  // 날짜 + 서명
  y += 30
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 30

  ctx.fillStyle = '#333'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${new Date().getFullYear()}년   ${new Date().getMonth() + 1}월   ${new Date().getDate()}일`, W / 2, y)
  y += 60

  ctx.textAlign = 'left'
  ctx.fillText('운 영 사 (갑):                                        (서명 또는 날인)', mx, y)
  y += 50
  ctx.fillText(`이 용 자 (을):  ${d.tenant_name || ''}`, mx, y)
  y += 30
  ctx.fillStyle = '#888'
  ctx.font = '18px "Pretendard", sans-serif'
  ctx.fillText('※ 아래 전자서명란에 서명해주세요.', mx, y)
}

/* ═══════════════════════════════════════════════════════════════
   3. 단기 입주 계약서
   ═══════════════════════════════════════════════════════════════ */
function drawShortTerm(ctx: CanvasRenderingContext2D, W: number, _H: number, d: TemplateData) {
  const mx = 80

  // 제목
  ctx.fillStyle = '#e76f51'
  ctx.font = 'bold 42px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('단기 입주 계약서', W / 2, 70)

  ctx.strokeStyle = '#e76f51'
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(mx, 110)
  ctx.lineTo(W - mx, 110)
  ctx.stroke()

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  const preamble = `운영사(이하 "갑")와 이용자(이하 "을")는 단기 입주에 관하여 아래와 같이 간이계약을 체결한다.`
  drawWrappedText(ctx, preamble, mx, 135, W - mx * 2, 32)

  let y = 205
  const labelW = 180
  const valueW = W - mx * 2 - labelW
  const rowH = 48
  const opts = { labelBg: '#fde8e2', color: '#e76f51' }

  // 입주 정보
  ctx.fillStyle = '#e76f51'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('■ 입주 정보', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '이용자', d.tenant_name || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '연락처', d.tenant_phone || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '호실/좌석', d.room_name || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '소재지', d.address || '—', opts)
  y += rowH + 20

  // 계약 조건
  ctx.fillStyle = '#e76f51'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('■ 계약 조건', mx, y)
  y += 45

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '이용기간', `${formatDateKR(d.lease_start)} ~ ${formatDateKR(d.lease_end)}`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '이용료', `금 ${formatMoney(d.monthly_rent)}원`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '예치금', `금 ${formatMoney(d.deposit)}원`, opts)
  y += rowH + 20

  // 유의사항
  ctx.fillStyle = '#e76f51'
  ctx.font = 'bold 26px "Pretendard", sans-serif'
  ctx.fillText('■ 유의사항', mx, y)
  y += 40

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  const notes = [
    '1. 단기 계약은 중도 해지 시 예치금이 반환되지 않을 수 있다.',
    '2. 연장을 희망할 경우 만료 7일 전까지 운영사에 통지한다.',
    '3. 시설 이용 규정은 운영사의 공유오피스 이용 규칙에 따른다.',
    '4. 퇴실 시 개인 물품 반출 및 원상복구 의무가 있다.',
  ]
  for (const n of notes) {
    ctx.fillText(n, mx, y)
    y += 34
  }
  y += 10

  // 특약
  if (d.special_terms) {
    ctx.fillStyle = '#e76f51'
    ctx.font = 'bold 26px "Pretendard", sans-serif'
    ctx.fillText('■ 특약사항', mx, y)
    y += 40
    ctx.fillStyle = '#333'
    ctx.font = '20px "Pretendard", sans-serif'
    y = drawWrappedText(ctx, d.special_terms, mx, y, W - mx * 2, 32)
    y += 10
  }

  // 날짜 + 서명
  y += 30
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 30

  ctx.fillStyle = '#333'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(`${new Date().getFullYear()}년   ${new Date().getMonth() + 1}월   ${new Date().getDate()}일`, W / 2, y)
  y += 60

  ctx.textAlign = 'left'
  ctx.fillText('운 영 사 (갑):                                        (서명 또는 날인)', mx, y)
  y += 50
  ctx.fillText(`이 용 자 (을):  ${d.tenant_name || ''}`, mx, y)
  y += 30
  ctx.fillStyle = '#888'
  ctx.font = '18px "Pretendard", sans-serif'
  ctx.fillText('※ 아래 전자서명란에 서명해주세요.', mx, y)
}

/* ═══════════════════════════════════════════════════════════════
   4. 상가임대차계약서 (상가건물임대차보호법 적용)
   ═══════════════════════════════════════════════════════════════ */
function drawCommercialLease(ctx: CanvasRenderingContext2D, W: number, _H: number, d: TemplateData) {
  const mx = 70
  const clr = '#4a4e69'

  // ── A4 비율 참고: W=1200 → 페이지 높이 ≈ 1697 (1:√2) ──
  const PAGE_H = 1697

  // ── 제목 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 54px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('상  가  임  대  차  계  약  서', W / 2, 70)

  ctx.fillStyle = '#666'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.fillText('( 상가건물 임대차보호법 적용 )', W / 2, 115)

  ctx.strokeStyle = clr
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(mx, 145)
  ctx.lineTo(W - mx, 145)
  ctx.stroke()

  const labelW = 200
  const valueW = W - mx * 2 - labelW
  const rowH = 50
  const opts = { labelBg: '#eee5e9', color: clr }

  // ── 임대차 목적물의 표시 ──
  let y = 165
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('▪ 임대차 목적물의 표시', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '소 재 지', d.address || '경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 호실', d.room_name || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '건물 용도', '제2종 근린생활시설 (사무소)', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 용도', '소호사무실', opts)
  y += rowH + 16

  // ── 계약 당사자 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.fillText('▪ 계약 당사자', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대인 (갑)', '대우오피스 / 이동윤', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임차인 (을)', d.tenant_name || '(서명 시 입력)', opts)
  y += rowH + 16

  // ── 임대차 조건 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.fillText('▪ 임대차 조건', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대차기간', `${formatDateKR(d.lease_start)} ~ ${formatDateKR(d.lease_end)}`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 보증금', `금 ${formatMoney(d.deposit)}원정`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 임대료', `금 ${formatMoney(d.monthly_rent)}원정`, opts)
  y += rowH
  const vatRow = computeVatRow(d.monthly_rent, d.vat_type)
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '부가가치세', vatRow.vatLabel, opts)
  y += rowH
  if (vatRow.totalLabel) {
    drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 총 납부액', vatRow.totalLabel, opts)
    y += rowH
  }
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '납부 계좌', '신한 110-517-388781 (이동윤)', opts)
  y += rowH + 20

  // ── 계약 조항 ──
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 16

  const clauses: { title: string; items: string[] }[] = [
    { title: '제 1 조 (임대차기간 및 갱신)', items: [
      '① 본 계약의 임대차기간은 상기 임대차 조건에 기재된 기간으로 한다.',
      '② 임대차기간 만료 6개월 전부터 1개월 전까지 쌍방이 갱신 거절 또는 조건 변경을 서면 통보하지 않는 경우, 동일한 조건으로 갱신된 것으로 본다.',
      '③ 임차인은 계약기간 중 임대인의 사전 서면 동의 없이 임차권을 양도하거나 임대 목적물을 전대할 수 없다.',
    ]},
    { title: '제 2 조 (임대 보증금)', items: [
      '① 임차인은 본 계약 체결과 동시에 보증금 전액을 임대인에게 지급한다.',
      '② 보증금은 임대료 미납, 관리비 미납, 원상복구비용 등 손해를 담보한다.',
      '③ 보증금은 무이자이며, 계약 종료 후 명도 및 정산 완료 후 14일 이내에 반환한다.',
      '④ 임차인은 보증금을 임대료에 충당 요구할 수 없다.',
    ]},
    { title: '제 3 조 (임대료 납부)', items: [
      '① 임차인은 매월 임대료 및 부가가치세를 납부 기일까지 임대인의 지정 계좌로 선납한다.',
      '② 부가가치세는 임대료에 포함되지 않으며 별도로 납부한다.',
      '③ 납부 기일까지 미납 시 연 20%의 지연손해금을 가산하여 납부하여야 한다.',
      '④ 전기료 등 실비(주차, 인터넷 등)는 임대료에 포함되지 않으며, 사용량에 따라 별도 청구한다.',
    ]},
    { title: '제 4 조 (임대료 연체 및 강제 조치) ★', items: [
      '① 1기(1개월) 연체 시 임대인은 즉시 서면으로 이행을 최고할 수 있다.',
      '② 2기(2개월) 이상 연체 시 최고 없이 즉시 계약 해지 및 명도 요구 가능.',
      '③ 명도 지연 시 월 임대료의 2배에 해당하는 손해배상액을 지급한다.',
      '④ 연체 시 임차인의 동산에 대하여 유치권 행사 또는 압류 가능.',
    ]},
    { title: '제 5 조 (임대료 인상)', items: [
      '① 임대료는 상가건물임대차보호법 제11조에 따라 연 5%를 초과하여 인상할 수 없다.',
      '② 인상 시 만료 3개월 전까지 서면 통보 및 협의한다.',
    ]},
    { title: '제 6 조 (시설 설치 및 원상복구)', items: [
      '① 임대인의 사전 서면 동의 없이 시설물을 신설·변경·부착할 수 없다.',
      '② 계약 종료 시 임대 목적물을 입주 당시 상태로 원상복구하여야 한다.',
    ]},
    { title: '제 7 조 (임차인의 의무)', items: [
      '① 임대 목적물을 선량한 관리자의 주의로 사용·관리한다.',
      '② 계약상 용도 이외의 목적으로 사용하거나 전대·양도할 수 없다.',
      '③ 퇴실 30일 전까지 임대인에게 서면으로 퇴실 의사를 통보한다.',
    ]},
    { title: '제 8 조 (임대인의 면책)', items: [
      '① 천재지변, 화재, 도난, 정전 등 불가항력 사유로 인한 손해에 대하여 책임을 지지 아니한다.',
    ]},
    { title: '제 9 조 (계약의 해지)', items: [
      '① 임차인이 각 조항을 위반하거나 임대료를 연체한 경우 계약 해지 가능.',
      '② 2기 이상 연체 시 최고 없이 즉시 해지 가능. (상가건물임대차보호법 제10조의8)',
      '③ 임차인 사정으로 중도 해지 시 잔여기간 임대료의 10%를 위약금으로 지급.',
    ]},
    { title: '제 10 조 (공증 협조 의무)', items: [
      '① 임차인은 임대인의 요청 시 본 계약서에 대한 공증 작성에 협조한다. 비용은 임차인 부담.',
    ]},
    { title: '제 11 조 (자진 명도 확약)', items: [
      '① 임대차기간 만료 후 갱신 미체결, 2기 이상 연체 해지, 중대 위반 해지 시 자진 명도한다.',
    ]},
    { title: '제 12 조 (기타 사항 및 준거법)', items: [
      '① 본 계약에서 정하지 않은 사항은 상가건물임대차보호법, 민법 등에 따른다.',
      '② 분쟁의 관할 법원은 임대인 소재지를 관할하는 법원으로 한다.',
      '③ 본 계약서는 2통을 작성하여 쌍방이 서명·날인 후 각 1통씩 보관한다.',
    ]},
  ]

  ctx.textAlign = 'left'
  for (const clause of clauses) {
    ctx.fillStyle = clr
    ctx.font = 'bold 24px "Pretendard", sans-serif'
    ctx.fillText(clause.title, mx, y)
    y += 30
    ctx.fillStyle = '#333'
    ctx.font = '20px "Pretendard", sans-serif'
    for (const item of clause.items) {
      y = drawWrappedText(ctx, item, mx + 14, y, W - mx * 2 - 28, 28)
      y += 2
    }
    y += 10
  }

  // ── 특약사항 ──
  if (d.special_terms) {
    ctx.fillStyle = clr
    ctx.font = 'bold 28px "Pretendard", sans-serif'
    ctx.fillText('▪ 특약 사항', mx, y)
    y += 38
    ctx.fillStyle = '#333'
    ctx.font = '22px "Pretendard", sans-serif'
    y = drawWrappedText(ctx, d.special_terms, mx, y, W - mx * 2, 32)
    y += 16
  }

  // ── 2페이지 내 맞춤: 날짜+서명 텍스트 = 약 120px (절반 크기) ──
  const maxY = PAGE_H * 2 - 140
  if (y > maxY) y = maxY

  // ── 날짜 + 확인 문구 ──
  y += 14
  ctx.strokeStyle = clr
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 20

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('위와 같이 계약이 성립하였음을 확인하고, 쌍방 서명·날인한다.', W / 2, y)
  y += 28
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.fillText(`${new Date().getFullYear()}년   ${new Date().getMonth() + 1}월   ${new Date().getDate()}일`, W / 2, y)
  y += 32

  ctx.textAlign = 'left'
  ctx.font = '18px "Pretendard", sans-serif'
  ctx.fillText('임 대 인 (갑):  대우오피스 / 이동윤          (서명 또는 날인)', mx, y)
  y += 24
  ctx.fillText(`임 차 인 (을):  ${d.tenant_name || ''}                        (서명 또는 날인)`, mx, y)
  y += 18

  ctx.fillStyle = '#888'
  ctx.font = '14px "Pretendard", sans-serif'
  ctx.fillText('※ 아래 전자서명란에 서명해주세요.', mx, y)
  y += 14

  return y
}

/* ═══════════════════════════════════════════════════════════════
   5. 임대차계약서 (서면용) — 프린트 후 대면 서명
   ═══════════════════════════════════════════════════════════════ */
function drawPaperContract(ctx: CanvasRenderingContext2D, W: number, _H: number, d: TemplateData) {
  const mx = 70
  const clr = '#1d3557'
  const PAGE_H = 1697

  // ── 제목 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 54px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.textBaseline = 'middle'
  ctx.fillText('상  가  임  대  차  계  약  서', W / 2, 70)

  ctx.fillStyle = '#666'
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.fillText('( 상가건물 임대차보호법 적용 )', W / 2, 115)

  ctx.strokeStyle = clr
  ctx.lineWidth = 3
  ctx.beginPath()
  ctx.moveTo(mx, 145)
  ctx.lineTo(W - mx, 145)
  ctx.stroke()

  const labelW = 200
  const valueW = W - mx * 2 - labelW
  const rowH = 54
  const opts = { labelBg: '#f0f4f8', color: clr }

  // ── 임대차 목적물 ──
  let y = 165
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.textAlign = 'left'
  ctx.textBaseline = 'top'
  ctx.fillText('▪ 임대차 목적물의 표시', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '소 재 지', d.address || '경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호 대우오피스', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 호실', d.room_name || '—', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '건물 용도', '제2종 근린생활시설 (사무소)', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 용도', '소호사무실', opts)
  y += rowH + 16

  // ── 계약 당사자 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.fillText('▪ 계약 당사자', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대인 (갑)', '대우오피스 / 이동윤', opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임차인 (을)', d.tenant_name || '(                    )', opts)
  y += rowH + 16

  // ── 임대차 조건 ──
  ctx.fillStyle = clr
  ctx.font = 'bold 28px "Pretendard", sans-serif'
  ctx.fillText('▪ 임대차 조건', mx, y)
  y += 38

  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대차기간', `${formatDateKR(d.lease_start)} ~ ${formatDateKR(d.lease_end)}`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '임대 보증금', `금 ${formatMoney(d.deposit)}원정`, opts)
  y += rowH
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 임대료', `금 ${formatMoney(d.monthly_rent)}원정`, opts)
  y += rowH
  const vatRow = computeVatRow(d.monthly_rent, d.vat_type)
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '부가가치세', vatRow.vatLabel, opts)
  y += rowH
  if (vatRow.totalLabel) {
    drawTableRow(ctx, mx, y, labelW, valueW, rowH, '월 총 납부액', vatRow.totalLabel, opts)
    y += rowH
  }
  drawTableRow(ctx, mx, y, labelW, valueW, rowH, '납부 계좌', '신한 110-517-388781 (이동윤)', opts)
  y += rowH + 20

  // ── 계약 조항 ──
  ctx.strokeStyle = '#ccc'
  ctx.lineWidth = 1
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 16

  const clauses: { title: string; items: string[] }[] = [
    { title: '제 1 조 (임대차기간 및 갱신)', items: [
      '① 본 계약의 임대차기간은 상기 기간으로 한다.',
      '② 만료 6개월~1개월 전까지 갱신 거절 통보 없으면 동일 조건으로 갱신된 것으로 본다.',
      '③ 임차인은 임대인의 서면 동의 없이 임차권 양도·전대할 수 없다.',
    ]},
    { title: '제 2 조 (임대 보증금)', items: [
      '① 임차인은 계약 체결과 동시에 보증금 전액을 지급한다.',
      '② 보증금은 임대료 미납, 원상복구비용 등 손해를 담보하며, 충당 요구할 수 없다.',
      '③ 보증금은 무이자이며, 명도 후 14일 이내 반환한다.',
    ]},
    { title: '제 3 조 (임대료 납부)', items: [
      '① 임차인은 매월 임대료+부가세를 납부 기일까지 지정 계좌로 선납한다.',
      '② 미납 시 연 20%의 지연손해금을 가산한다.',
      '③ 전기료 등 실비(주차, 인터넷 등)는 임대료에 포함되지 않으며 별도 청구한다.',
    ]},
    { title: '제 4 조 (연체 및 강제 조치) ★', items: [
      '① 1기 연체 시 서면 최고, 2기 이상 연체 시 최고 없이 즉시 해지·명도 요구 가능.',
      '② 명도 지연 시 월 임대료 2배 손해배상. 동산 유치권·압류 가능.',
    ]},
    { title: '제 5 조 (임대료 인상)', items: [
      '① 상가건물임대차보호법 제11조에 따라 연 5% 초과 인상 불가. 만료 3개월 전 서면 협의.',
    ]},
    { title: '제 6 조 (시설·원상복구)', items: [
      '① 서면 동의 없이 시설 변경 불가. 종료 시 원상복구 후 반환.',
    ]},
    { title: '제 7 조 (임차인의 의무)', items: [
      '① 선량한 관리자 주의로 사용. 용도 외 사용·전대 불가. 퇴실 30일 전 서면 통보.',
    ]},
    { title: '제 8 조 (면책)', items: [
      '① 천재지변·화재·도난·정전 등 불가항력 손해에 대해 임대인은 책임지지 않는다.',
    ]},
    { title: '제 9 조 (해지)', items: [
      '① 조항 위반·연체 시 해지 가능. 2기 이상 연체 시 즉시 해지.',
      '② 임차인 사정 중도 해지 시 잔여기간 임대료 10%를 위약금으로 지급.',
    ]},
    { title: '제 10 조 (공증·명도·준거법)', items: [
      '① 임대인 요청 시 공증에 협조 (비용 임차인 부담).',
      '② 기간 만료·해지 시 자진 명도. 미정 사항은 상가건물임대차보호법·민법에 따른다.',
      '③ 관할 법원은 임대인 소재지. 본 계약서는 2통 작성, 각 1통 보관.',
    ]},
  ]

  ctx.textAlign = 'left'
  for (const clause of clauses) {
    ctx.fillStyle = clr
    ctx.font = 'bold 22px "Pretendard", sans-serif'
    ctx.fillText(clause.title, mx, y)
    y += 28
    ctx.fillStyle = '#333'
    ctx.font = '19px "Pretendard", sans-serif'
    for (const item of clause.items) {
      y = drawWrappedText(ctx, item, mx + 12, y, W - mx * 2 - 24, 26)
      y += 2
    }
    y += 8
  }

  // ── 특약사항 ──
  if (d.special_terms) {
    ctx.fillStyle = clr
    ctx.font = 'bold 26px "Pretendard", sans-serif'
    ctx.fillText('▪ 특약 사항', mx, y)
    y += 36
    ctx.fillStyle = '#333'
    ctx.font = '20px "Pretendard", sans-serif'
    y = drawWrappedText(ctx, d.special_terms, mx, y, W - mx * 2, 30)
    y += 16
  }

  // ── 서명란이 2페이지 하단에 오도록 (절반 크기) ──
  const sigNeed = 220  // 날짜+확인+서명박스(100px)
  const signMinY = PAGE_H + 40
  const signMaxY = PAGE_H * 2 - sigNeed
  if (y < signMinY) y = signMinY
  if (y > signMaxY) y = signMaxY

  // ── 날짜 + 확인 문구 ──
  y += 14
  ctx.strokeStyle = clr
  ctx.lineWidth = 2
  ctx.beginPath()
  ctx.moveTo(mx, y)
  ctx.lineTo(W - mx, y)
  ctx.stroke()
  y += 22

  ctx.fillStyle = '#333'
  ctx.font = '20px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('위와 같이 계약이 성립하였음을 확인하고, 쌍방 서명·날인한다.', W / 2, y)
  y += 28
  ctx.font = '22px "Pretendard", sans-serif'
  ctx.fillText(`${new Date().getFullYear()}년   ${new Date().getMonth() + 1}월   ${new Date().getDate()}일`, W / 2, y)
  y += 30

  // ── 서명란 (2열 박스, 절반 크기) ──
  const colW = (W - mx * 2 - 40) / 2
  const sigBoxH = 100
  const leftX = mx
  const rightX = mx + colW + 40

  // 임대인 (갑)
  drawBox(ctx, leftX, y, colW, sigBoxH, { stroke: clr, lineWidth: 2 })
  ctx.fillStyle = clr
  ctx.font = 'bold 20px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('임 대 인 (갑)', leftX + colW / 2, y + 20)

  ctx.fillStyle = '#333'
  ctx.font = '17px "Pretendard", sans-serif'
  ctx.fillText('대우오피스 / 이동윤', leftX + colW / 2, y + 46)

  ctx.fillStyle = '#bbb'
  ctx.font = '13px "Pretendard", sans-serif'
  ctx.fillText('(서명 또는 날인)', leftX + colW / 2, y + sigBoxH - 14)

  // 임차인 (을)
  drawBox(ctx, rightX, y, colW, sigBoxH, { stroke: clr, lineWidth: 2 })
  ctx.fillStyle = clr
  ctx.font = 'bold 20px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('임 차 인 (을)', rightX + colW / 2, y + 20)

  ctx.fillStyle = '#333'
  ctx.font = '17px "Pretendard", sans-serif'
  ctx.fillText(d.tenant_name || '(                    )', rightX + colW / 2, y + 46)

  ctx.fillStyle = '#bbb'
  ctx.font = '13px "Pretendard", sans-serif'
  ctx.fillText('(서명 또는 날인)', rightX + colW / 2, y + sigBoxH - 14)

  y += sigBoxH + 14

  ctx.fillStyle = '#aaa'
  ctx.font = '14px "Pretendard", sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('본 계약서는 노아도(noado.kr) 임대관리 시스템을 통해 작성되었습니다.', W / 2, y)
  y += 16

  return y
}
