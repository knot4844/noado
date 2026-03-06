import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { query, dbContext } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API Key가 설정되지 않았습니다.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 부동산 임대 관리 및 자산 분석 전문 AI 비서입니다.
사용자가 자신의 데이터베이스(DB) 정보를 바탕으로 질문을 했습니다.

[현재 DB 컨텍스트 (JSON 포맷)]
${JSON.stringify(dbContext, null, 2)}

[사용자 질문]
${query}

[지침]
1. DB 데이터를 분석하여 사용자 질문에 정확하게 답변하세요.
2. 답변은 친절하고 전문적인 말투로 작성하세요. 항상 리스트나 표를 활용해 읽기 쉽게 정리해주세요.
3. 숫자는 가독성을 위해 콤마를 찍어서 출력해주세요 (예: 1,000,000원).
4. 만약 데이터에 없는 질문을 하면, 제공된 데이터로는 알 수 없다고 말하세요.
5. Markdown 형식을 적절히 사용하여 핵심 정보를 굵게 또는 색깔로 강조하세요.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ reply: responseText });

    } catch (error: any) {
        console.error("AI Chat DB Error:", error);
        return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
    }
}
