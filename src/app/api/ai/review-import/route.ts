import { NextRequest, NextResponse } from 'next/server'
import { GoogleGenerativeAI } from '@google/generative-ai'

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '')

export interface ReviewIssue {
  rowIndex: number
  field: string
  level: 'warning' | 'info'
  message: string
  fixValue?: string
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY 미설정' }, { status: 500 })
  }

  const { rows, message } = await req.json()
  if (!rows?.length) return NextResponse.json({ issues: [], reply: null })

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' })

  const systemPrompt = message
    ? `당신은 임대 관리 시스템의 AI 보조입니다. 사용자가 호실 데이터를 엑셀에서 업로드했고, 이미 자동 검토를 완료한 상태입니다.
사용자가 추가 질문이나 수정 요청을 했습니다. 현재 행 데이터를 참고하여 간결하게 답변하거나 수정사항을 JSON으로 반환하세요.`
    : `당신은 임대 관리 시스템의 AI 보조입니다. 사용자가 호실 입주사 데이터를 엑셀에서 업로드했습니다.
아래 데이터를 분석하여 문제가 있거나 확인이 필요한 항목을 찾아주세요.`

  const dataDescription = rows.map((r: Record<string, string>, i: number) => ({
    index: i,
    ...r,
  }))

  const prompt = `${systemPrompt}

[업로드된 호실 데이터 (${rows.length}개 행)]
${JSON.stringify(dataDescription, null, 2)}

${message ? `[사용자 메시지]\n${message}\n` : ''}
[검토 기준]
1. 세입자 이름이 있는데 상태가 공실(VACANT)이거나, 반대로 이름이 없는데 미납/납부완료인 경우
2. 연락처가 없는 입주 세대 (VACANT 제외)
3. 월 이용료가 0원이거나 비정상적으로 낮거나 높은 경우 (다른 행들 평균 대비 2배 이상 또는 절반 이하)
4. 계약 시작일이 만료일보다 늦은 경우
5. 중복된 호실명
6. 납부일이 1~31 범위를 벗어나는 경우
7. 기타 주목할 만한 이상 데이터

[응답 형식 - 반드시 순수 JSON만, 마크다운 없이]
{
  "issues": [
    {
      "rowIndex": 0,
      "field": "필드명 (name/tenant_name/tenant_phone/monthly_rent/status/lease_start/lease_end/payment_day/memo)",
      "level": "warning 또는 info",
      "message": "한국어로 간결하게 문제 설명 (1~2문장)",
      "fixValue": "수정 제안값 (있는 경우만, 없으면 생략)"
    }
  ],
  "reply": "사용자 메시지에 대한 자연스러운 한국어 답변 (메시지가 없으면 null, 있으면 1~2문장)"
}

이슈가 없으면 issues 배열을 비워주세요. 사소한 것은 info, 반드시 확인해야 할 것은 warning 레벨을 사용하세요.`

  try {
    const result = await model.generateContent(prompt)
    const text = result.response.text()
      .replace(/```json\n?/g, '').replace(/```\n?/g, '').trim()

    const parsed = JSON.parse(text)
    return NextResponse.json({
      issues: parsed.issues ?? [],
      reply: parsed.reply ?? null,
    })
  } catch (e) {
    console.error('AI review-import error:', e)
    return NextResponse.json({ issues: [], reply: null })
  }
}
