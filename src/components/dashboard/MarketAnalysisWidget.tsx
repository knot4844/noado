"use client";

import React, { useState } from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { MapPin, Search, Bot, Loader2, TrendingUp, Sparkles, CheckCircle2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function MarketAnalysisWidget() {
    const { currentBusiness } = useBusiness();
    const [report, setReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleAnalyze = async () => {
        if (!currentBusiness) return;
        setIsLoading(true);
        setReport(null);

        try {
            const res = await fetch('/api/ai-market-analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    address: currentBusiness.address || "서울 강남구 역삼동",
                    businessName: currentBusiness.name
                })
            });

            if (res.ok) {
                const data = await res.json();
                setReport(data.report);
            } else {
                setReport("❌ 분석 서버와 연결할 수 없습니다.");
            }
        } catch (err) {
            console.error("Analysis Error:", err);
            setReport("❌ 분석 중 네트워크 오류가 발생했습니다.");
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentBusiness) return null;

    return (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            {/* Header */}
            <div className="bg-gradient-to-r from-emerald-600 to-teal-700 p-6 text-white relative overflow-hidden shrink-0">
                <div className="absolute top-0 right-0 p-8 opacity-10 blur-2xl pointer-events-none">
                    <div className="w-32 h-32 bg-white rounded-full"></div>
                </div>

                <div className="flex items-center justify-between relative z-10">
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm shadow-inner group">
                            <TrendingUp size={24} className="text-white group-hover:scale-110 transition-transform" />
                        </div>
                        <div>
                            <h3 className="font-bold text-lg flex items-center gap-2">
                                주변 시세 AI 분석 <span className="bg-emerald-800 text-teal-100 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider border border-white/20">MCP Concept</span>
                            </h3>
                            <p className="text-emerald-100 text-xs mt-0.5 flex items-center gap-1">
                                <MapPin size={12} /> {currentBusiness.address || "주소 미등록 (기본: 역삼동)"} 기준
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Body */}
            <div className="flex-1 p-6 overflow-y-auto bg-neutral-50/50">
                {!report && !isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-center px-4">
                        <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center text-emerald-500 mb-6 shadow-sm border border-emerald-100">
                            <Sparkles size={32} />
                        </div>
                        <h4 className="text-base font-bold text-neutral-800 mb-2">건물 주변 실거래가 및 공실률 분석</h4>
                        <p className="text-sm text-neutral-500 leading-relaxed mb-8 max-w-sm">
                            Ai가 부동산 실거래가, 국토부 데이터, 주변 매물 정보를 실시간으로 종합하여
                            <strong> 적정 임대료와 수익 극대화 전략</strong>을 제시합니다.
                        </p>
                        <button
                            onClick={handleAnalyze}
                            className="bg-neutral-900 hover:bg-black text-white px-6 py-3 rounded-xl font-bold flex items-center gap-2 shadow-lg hover:shadow-xl transition-all active:scale-95"
                        >
                            <Search size={18} /> 실시간 딥-리서치 시작
                        </button>
                    </div>
                )}

                {isLoading && (
                    <div className="h-full flex flex-col items-center justify-center text-emerald-600 space-y-4">
                        <Loader2 size={40} className="animate-spin" />
                        <div className="text-center">
                            <p className="font-bold">웹에서 데이터를 수집 중입니다...</p>
                            <p className="text-xs text-emerald-600/70 mt-1">인근 부동산 매물 및 국토부 실거래가 교차 검증</p>
                        </div>
                    </div>
                )}

                {report && (
                    <div className="prose prose-sm prose-emerald max-w-none text-neutral-700 bg-white p-6 rounded-2xl border border-neutral-100 shadow-sm">
                        <ReactMarkdown>{report}</ReactMarkdown>
                    </div>
                )}
            </div>

            {/* Footer */}
            {report && (
                <div className="p-4 bg-white border-t border-neutral-200 flex justify-between items-center shrink-0">
                    <span className="text-xs font-bold text-emerald-600 bg-emerald-50 px-3 py-1.5 rounded-full border border-emerald-100 flex items-center gap-1.5">
                        <CheckCircle2 size={14} /> 최신 실거래가 반영됨
                    </span>
                    <button
                        onClick={handleAnalyze}
                        disabled={isLoading}
                        className="text-xs font-bold text-neutral-500 hover:text-neutral-900 flex items-center gap-1.5 transition-colors disabled:opacity-50"
                    >
                        <Search size={14} /> 다시 분석하기
                    </button>
                </div>
            )}
        </div>
    );
}
