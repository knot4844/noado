"use client";

import React, { useEffect, useState } from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { Sparkles, ArrowRight, Loader2 } from "lucide-react";
import ReactMarkdown from "react-markdown";

export function AIBriefingWidget() {
    const { currentBusiness, getRoomsByBusiness } = useBusiness();
    const [report, setReport] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!currentBusiness) {
            setIsLoading(false);
            return;
        }

        const fetchReport = async () => {
            setIsLoading(true);
            try {
                const rooms = getRoomsByBusiness(currentBusiness.id);
                const unpaid = rooms.filter(r => r.status === "UNPAID");
                const vacant = rooms.filter(r => r.status === "VACANT");

                // Real basic stats to send to Gemini
                const stats = {
                    businessName: currentBusiness.name,
                    date: new Date().toLocaleDateString('ko-KR'),
                    totalRooms: rooms.length,
                    unpaidCount: unpaid.length,
                    unpaidAmount: unpaid.reduce((sum, r) => sum + (r.paymentInfo?.monthlyRent || 0), 0),
                    vacantCount: vacant.length,
                    unpaidTenants: unpaid.map(r => r.tenant?.name).join(', ')
                };

                const res = await fetch('/api/ai-report', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ stats })
                });

                if (res.ok) {
                    const data = await res.json();
                    setReport(data.text);
                } else {
                    setReport("AI 보고서를 생성하지 못했습니다.");
                }
            } catch (err) {
                console.error("AI Report error:", err);
                setReport("네트워크 오류로 보고서를 불러오지 못했습니다.");
            } finally {
                setIsLoading(false);
            }
        };

        // Cache check could be added here in a real app to prevent re-fetching on every mount
        fetchReport();
    }, [currentBusiness]);

    if (!currentBusiness) return null;

    return (
        <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-3xl p-6 text-white shadow-xl relative overflow-hidden">
            {/* Background elements */}
            <div className="absolute top-0 right-0 p-8 opacity-10 blur-2xl pointer-events-none">
                <div className="w-32 h-32 bg-white rounded-full"></div>
            </div>

            <div className="flex items-center gap-3 mb-6 relative z-10">
                <div className="w-10 h-10 bg-white/20 rounded-xl flex items-center justify-center backdrop-blur-sm">
                    <Sparkles size={20} className="text-white" />
                </div>
                <div>
                    <h3 className="font-bold text-lg">오늘의 AI 브리핑</h3>
                    <p className="text-sm text-indigo-200">{new Date().toLocaleDateString('ko-KR')} 기준</p>
                </div>
            </div>

            <div className="bg-white/10 rounded-2xl p-5 mb-6 backdrop-blur-md border border-white/10 min-h-[120px] relative z-10 text-sm leading-relaxed prose prose-invert prose-p:my-1 prose-strong:text-white prose-ul:my-2 w-full max-w-none">
                {isLoading ? (
                    <div className="flex flex-col items-center justify-center h-full py-4 opacity-50">
                        <Loader2 size={24} className="animate-spin mb-2" />
                        <p>건물 결산 데이터를 분석하여 보고서를 작성 중입니다...</p>
                    </div>
                ) : (
                    <ReactMarkdown>{report || "보고서 데이터가 없습니다."}</ReactMarkdown>
                )}
            </div>

            <div className="flex flex-col sm:flex-row justify-end relative z-10 gap-2">
                <button
                    onClick={async () => {
                        const webhook = localStorage.getItem("noado_slack_webhook");
                        if (!webhook) {
                            alert("환경설정에서 Slack Webhook URL을 먼저 등록해주세요.");
                            return;
                        }
                        if (!report) return;

                        try {
                            await fetch(webhook, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    text: `*📊 [noado 오늘의 통계 브리핑]*\n\n${report}`
                                })
                            });
                            alert("Slack으로 브리핑 전송이 완료되었습니다.");
                        } catch (err) {
                            console.error(err);
                            alert("전송에 실패했습니다.");
                        }
                    }}
                    disabled={isLoading || !report}
                    className="flex items-center justify-center gap-2 text-sm font-bold bg-[#4A154B] hover:bg-[#361036] text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
                >
                    Slack으로 전송
                </button>
                <button className="flex items-center justify-center gap-2 text-sm font-bold bg-white text-indigo-900 px-4 py-2 rounded-lg hover:bg-neutral-100 transition-colors">
                    전체 통계 보기 <ArrowRight size={16} />
                </button>
            </div>
        </div>
    );
}
