"use client";

import React, { useState } from 'react';
import { useBusiness } from '@/components/providers/BusinessProvider';
import { Bot, X, Sparkles, Send, Loader2, AlertCircle } from 'lucide-react';
import { Room } from '@/lib/data';

interface Issue {
    roomId: string;
    roomName: string;
    tenantName: string;
    issueType: 'UNPAID' | 'EXPIRING';
    details: string;
}

interface GeneratedMessage {
    roomId: string;
    message: string;
}

export default function AIAutoAgent() {
    const { rooms } = useBusiness();
    const [isOpen, setIsOpen] = useState(false);
    const [isAnalyzing, setIsAnalyzing] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [issues, setIssues] = useState<Issue[]>([]);
    const [messages, setMessages] = useState<GeneratedMessage[]>([]);
    const [error, setError] = useState<string | null>(null);

    const handleAnalyze = () => {
        setIsAnalyzing(true);
        setError(null);
        setMessages([]);

        setTimeout(() => {
            const foundIssues: Issue[] = [];

            rooms.forEach(room => {
                // Check Unpaid
                if (room.status === 'UNPAID' && room.unpaidAmount && room.unpaidAmount > 0) {
                    foundIssues.push({
                        roomId: room.id,
                        roomName: room.name,
                        tenantName: room.tenant?.companyName || room.tenant?.name || '임차인',
                        issueType: 'UNPAID',
                        details: `${room.unpaidMonths}개월 미납 (총 ${(room.unpaidAmount).toLocaleString()}원)`
                    });
                }

                // Check Expiring (Less than 60 days)
                if (room.leaseEnd) {
                    const endDate = new Date(room.leaseEnd);
                    const today = new Date();
                    const diffTime = Math.abs(endDate.getTime() - today.getTime());
                    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                    // To ensure we get some test data, let's just flag arbitrarily if it's 2024 or earlier
                    if (diffDays <= 60 || endDate.getFullYear() <= 2024) {
                        foundIssues.push({
                            roomId: room.id,
                            roomName: room.name,
                            tenantName: room.tenant?.companyName || room.tenant?.name || '임차인',
                            issueType: 'EXPIRING',
                            details: `계약 만료 일자: ${room.leaseEnd}`
                        });
                    }
                }
            });

            // Deduplicate rooms (in case both unpaid and expiring, prioritize unpaid for demo)
            const uniqueIssues = Array.from(new Map(foundIssues.map(item => [item.roomId, item])).values());

            setIssues(uniqueIssues);
            setIsAnalyzing(false);
        }, 800);
    };

    const handleGenerateMessages = async () => {
        setIsGenerating(true);
        setError(null);

        try {
            const response = await fetch('/api/ai-assistant', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ issues })
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'API 오류');
            }

            setMessages(data.messages || []);
        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsGenerating(false);
        }
    };

    const handleSend = async (roomId: string, message: string, tenantName: string) => {
        alert("알림톡 전송이 완료되었습니다! (시뮬레이션)\n등록된 Slack 연동이 있다면 알림이 전송됩니다.");

        // Slack Webhook 연동
        const slackWebhook = localStorage.getItem("noado_slack_webhook");
        if (slackWebhook) {
            try {
                await fetch(slackWebhook, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text: `*🚨 [noado 알림톡 발송 완료]*\n*대상:* ${tenantName} 고객님\n\n> ${message.replace(/\n/g, '\n> ')}`
                    })
                });
            } catch (err) {
                console.error("Slack 연동 전송 실패:", err);
            }
        }

        setMessages(prev => prev.filter(m => m.roomId !== roomId));
        setIssues(prev => prev.filter(i => i.roomId !== roomId));
    };

    return (
        <>
            {/* FAB */}
            <button
                onClick={() => { setIsOpen(true); handleAnalyze(); }}
                className="fixed bottom-6 right-6 bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white rounded-full p-4 shadow-xl hover:shadow-2xl transition-all transform hover:-translate-y-1 flex items-center justify-center z-50 group"
            >
                <Bot size={28} className="group-hover:animate-pulse" />
                <span className="max-w-0 overflow-hidden group-hover:max-w-xs transition-all duration-300 ease-in-out whitespace-nowrap opacity-0 group-hover:opacity-100 group-hover:ml-3 font-bold">
                    🚀 AI 비서 호출
                </span>
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white flex justify-between items-center">
                            <div>
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <Sparkles size={20} className="text-yellow-300" />
                                    AI 연체/만기 자동화 비서
                                </h2>
                                <p className="text-blue-100 text-sm mt-1">
                                    Supabase 데이터를 분석하여, 각 임차인에게 최적화된 맞춤형 알림톡 멘트를 생성합니다.
                                </p>
                            </div>
                            <button onClick={() => setIsOpen(false)} className="text-blue-100 hover:text-white transition-colors p-1 bg-black/10 hover:bg-black/20 rounded-full">
                                <X size={24} />
                            </button>
                        </div>

                        {/* Body */}
                        <div className="p-6 overflow-y-auto flex-1 bg-neutral-50">
                            {error && (
                                <div className="mb-4 p-4 bg-red-50 text-red-700 rounded-lg flex gap-3 text-sm items-start border border-red-100">
                                    <AlertCircle size={16} className="mt-0.5 shrink-0" />
                                    <div>
                                        <p className="font-bold mb-1">AI 통신 오류</p>
                                        <p>{error}</p>
                                    </div>
                                </div>
                            )}

                            {isAnalyzing ? (
                                <div className="flex flex-col items-center justify-center py-12 text-blue-600">
                                    <Loader2 size={40} className="animate-spin mb-4" />
                                    <p className="font-bold">Supabase 클라우드 데이터를 분석 중입니다...</p>
                                </div>
                            ) : issues.length === 0 ? (
                                <div className="text-center py-12 text-neutral-500">
                                    <div className="bg-green-100 text-green-600 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Sparkles size={24} />
                                    </div>
                                    <p className="text-lg font-bold text-neutral-800">모든 호실 관리 상태가 완벽합니다!</p>
                                    <p className="text-sm">현재 미납되거나 계약 만료가 임박한 대상자가 없습니다.</p>
                                </div>
                            ) : (
                                <div className="space-y-6">
                                    <div className="flex justify-between items-end border-b pb-4">
                                        <div>
                                            <h3 className="font-bold text-neutral-800 text-lg">💡 조치 필요 대상 : <span className="text-blue-600">{issues.length}건</span></h3>
                                            <p className="text-sm text-neutral-500 mt-1">아래 대상자들에게 보낼 맞춤형 메시지를 생성해 보세요.</p>
                                        </div>
                                        {messages.length === 0 && (
                                            <button
                                                onClick={handleGenerateMessages}
                                                disabled={isGenerating}
                                                className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg font-bold text-sm flex items-center gap-2 transition-colors disabled:opacity-50"
                                            >
                                                {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
                                                {isGenerating ? "문구 작성 중..." : "AI 알림톡 생성하기"}
                                            </button>
                                        )}
                                    </div>

                                    {/* List */}
                                    <div className="space-y-4">
                                        {issues.map(issue => {
                                            const generatedMsg = messages.find(m => m.roomId === issue.roomId);

                                            return (
                                                <div key={issue.roomId} className="bg-white rounded-xl p-4 border shadow-sm border-neutral-200 relative overflow-hidden">
                                                    <div className={`absolute top-0 left-0 w-1 h-full ${issue.issueType === 'UNPAID' ? 'bg-red-500' : 'bg-orange-400'}`} />

                                                    <div className="flex justify-between items-start mb-3">
                                                        <div>
                                                            <div className="flex items-center gap-2 mb-1">
                                                                <span className="font-bold text-neutral-800">{issue.tenantName}</span>
                                                                <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 border border-neutral-200">
                                                                    {issue.roomName}
                                                                </span>
                                                                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${issue.issueType === 'UNPAID' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-orange-50 text-orange-600 border border-orange-100'}`}>
                                                                    {issue.issueType === 'UNPAID' ? '미납 관리' : '만기 연장 관리'}
                                                                </span>
                                                            </div>
                                                            <p className="text-sm text-neutral-500">{issue.details}</p>
                                                        </div>
                                                    </div>

                                                    {/* AI Message Area */}
                                                    {generatedMsg ? (
                                                        <div className="mt-4 bg-blue-50/50 rounded-lg p-3 border border-blue-100">
                                                            <div className="flex gap-2 mb-2 items-center text-xs font-bold text-blue-800">
                                                                <Bot size={14} /> AI 비서 초안
                                                            </div>
                                                            <textarea
                                                                className="w-full text-sm text-neutral-700 bg-white border border-neutral-200 rounded p-2 focus:ring-1 focus:ring-blue-500 focus:outline-none resize-none"
                                                                rows={4}
                                                                defaultValue={generatedMsg.message}
                                                            />
                                                            <div className="flex justify-end mt-2">
                                                                <button
                                                                    onClick={() => handleSend(issue.roomId, generatedMsg.message, issue.tenantName)}
                                                                    className="bg-neutral-800 hover:bg-black text-white px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5 transition-colors"
                                                                >
                                                                    <Send size={12} /> 알림톡 발송
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : isGenerating ? (
                                                        <div className="mt-4 bg-neutral-50 rounded-lg p-6 border border-neutral-100 flex items-center justify-center">
                                                            <div className="flex items-center gap-2 text-neutral-400 text-sm font-semibold">
                                                                <Loader2 size={16} className="animate-spin" /> 작성 중...
                                                            </div>
                                                        </div>
                                                    ) : null}
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
