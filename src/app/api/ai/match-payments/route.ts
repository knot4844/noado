import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface AiMatchResult {
  rowIdx:    number
  invoiceId: string | null
  reason:    string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 })
  }

  const { bankRows, invoices } = await req.json()
  if (!bankRows?.length || !invoices?.length) {
    return NextResponse.json({ results: [] })
  }

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const prompt = `당신은 임대 관리 시스템의 AI입니다. 은행 입금 내역의 "내용(비고)" 필드를 분석하여, 어느 세입자의 입금인지 추론해주세요.

[미매칭된 은행 입금 내역]
${JSON.stringify(bankRows, null, 2)}

[현재 미수납 청구서 목록 (id, 호실명, 세입자명, 청구금액)]
${JSON.stringify(invoices, null, 2)}

[추론 방법]
- 내용 필드에는 입금자 이름, 호실 번호, 이용료/월 이용료/관리비 등 키워드가 섞여 있을 수 있습니다.
- 이름이 일부만 표기되거나(예: 홍길 → 홍길동), 한자/영문 표기일 수 있습니다.
- 호실 번호(예: 101호, 201)가 직접 포함되기도 합니다.
- 금액이 일치하고 이름/호실이 유사하면 높은 신뢰도입니다.
- 매칭이 불분명하면 null을 반환하세요.

[응답 형식 - 순수 JSON만, 마크다운 없이]
{
  "results": [
    {
      "rowIdx": 0,
      "invoiceId": "invoice-uuid 또는 null",
      "reason": "한국어로 1문장 이내. 예: '내용에 홍길동과 101호가 포함되어 있고 금액 일치'"
    }
  ]
}`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const parsed = JSON.parse(text)
    return NextResponse.json({ results: parsed.results ?? [] })
  } catch (e) {
    console.error('AI match-payments error:', e)
    return NextResponse.json({ results: [] })
  }
}
