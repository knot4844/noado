import { NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { address, businessName } = body;

        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            return NextResponse.json({ error: 'Gemini API Key가 설정되지 않았습니다.' }, { status: 500 });
        }

        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });

        const prompt = `
당신은 상업 부동산 및 주거용 오피스텔 빅데이터 분석 AI인 'noado Pro Analyst'입니다.
웹 브라우징 및 실거래가 데이터를 실시간으로 크롤링하여 인사이트를 제공하는 **컨셉**으로 동작하세요.

[요청 정보]
- 건물명: ${businessName}
- 소재지: ${address}

[요청 사항]
요청된 소재지를 기반으로 주변 (반경 1km 내) 상권, 평균 임대료(원룸/투룸/단기임대 등), 공실률 동향, 최근 3개월의 부동산 시장 트렌드를 가상으로 분석하여 프로페셔널한 "주변 시세 컨설팅 리포트" 문서 형태로 답변해 주세요.

[출력 양식 준수 (Markdown)]
1. **📍 지역 시세 브리핑** (평균 보증금/월세 요약)
2. **📈 수요 및 공실률 동향** (최근 유동인구 및 임차 문의 동향)
3. **💡 적정 임대료 설정 가이드 및 AI 제안** (현재 상황에서 수익을 극대화할 수 있는 월세/관리비 세팅 조언)

친절하지만 숫자에 강한 전문가의 톤앤매너를 유지하시고, 마크다운 표나 리스트를 적극 활용해 가독성을 극대화하세요. 실제 구체적인 예상 금액(숫자)을 적극적으로 명시해 주시기 바랍니다.
`;

        const result = await model.generateContent(prompt);
        const responseText = result.response.text();

        return NextResponse.json({ report: responseText });

    } catch (error: any) {
        console.error("AI Market Analysis Error:", error);
        return NextResponse.json({ error: error.message || '서버 오류 발생' }, { status: 500 });
    }
}
