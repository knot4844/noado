import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Determine the API key. Fall back to the Claude config env if provided by the user in .env.local
const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY || process.env.GEMINI_API_KEY || '';

const genAI = new GoogleGenerativeAI(apiKey);

export async function POST(req: NextRequest) {
    if (!apiKey) {
        return NextResponse.json({ error: 'Gemini API 키가 설정되지 않았습니다. .env.local 파일에 GEMINI_API_KEY를 추가해주세요.' }, { status: 500 });
    }

    try {
        const body = await req.json();
        const { issues } = body;

        if (!issues || !Array.isArray(issues) || issues.length === 0) {
            return NextResponse.json({ messages: [] });
        }

        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 'noado' 임대 관리 시스템의 자동화 AI입니다.
임차인에게 발송할 미납 및 계약 만료 안내 메시지를 작성해야 합니다.
사용자(대표)의 지시: 정기적으로 연락하는 임차인들이므로, 길고 구구절절한 인사말이나 감성적인 멘트는 전부 빼세요. 가장 사무적이고, 건조하고, 정확하게 요점만 전달하는 아주 짧은 미니멀한 텍스트를 작성하세요. 

[이슈 목록]
${JSON.stringify(issues, null, 2)}

[응답 형식]
반드시 아래의 순수 JSON 배열 형식으로만 응답하세요. 마크다운(\`\`\`json 등)을 포함하지 마세요.
[
    {
        "roomId": "방ID",
        "message": "[noado] OOO 대표님, n월 임대료 000,000원이 미납되었습니다. 확인 부탁드립니다."
    },
    ...
]
        `;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        // Clean up markdown in case the model ignored instructions
        const cleanedText = responseText.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();

        try {
            const parsedArray = JSON.parse(cleanedText);
            return NextResponse.json({ messages: parsedArray });
        } catch (e) {
            console.error("Failed to parse Gemini JSON:", cleanedText);
            return NextResponse.json({ error: 'AI 응답을 처리하는 중 오류가 발생했습니다.' }, { status: 500 });
        }

    } catch (error: any) {
        console.error('Gemini API Error:', error);
        return NextResponse.json({ error: error.message || '서버 오류가 발생했습니다.' }, { status: 500 });
    }
}
