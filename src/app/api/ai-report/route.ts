import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

export async function POST(req: NextRequest) {
    if (!process.env.GEMINI_API_KEY) {
        return NextResponse.json({ error: "GEMINI_API_KEY is not configured" }, { status: 500 });
    }

    try {
        const { stats } = await req.json();

        const prompt = `
            당신은 부동산 임대업 SaaS 'noado'의 AI 비서입니다.
            최고경영자(건물주/임대인)에게 전달할 오늘의 '일일 브리핑(Daily Briefing)'을 작성해주세요.

            다음과 같은 건물 현황 통계가 주어집니다:
            ${JSON.stringify(stats, null, 2)}

            요구사항:
            1. 매우 비즈니스적이고 간결한 톤앤매너 유지 (감성적이거나 과장된 표현 금지)
            2. 주요 이슈(미수금, 공실율, 곧 만료되는 계약 등)를 한눈에 파악할 수 있도록 3~4문장 내외로 요약
            3. 인사말("안녕하세요 대표님,")로 시작하고, 마무리는 행동 제안(예: "미납자에게 알림톡을 발송하시겠습니까?")으로 끝맺음
            4. Markdown 문법을 사용하여 볼드, 목록 등을 적절히 활용해 가독성 높이기
        `;

        const result = await model.generateContent(prompt);
        const response = await result.response;
        const textArea = response.text();

        return NextResponse.json({ text: textArea });
    } catch (error: any) {
        console.error("AI Report Generation Error:", error);
        return NextResponse.json({ error: "Failed to generate report" }, { status: 500 });
    }
}
