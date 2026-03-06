"use client";

import React, { useState, useRef, useEffect } from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { MessageSquare, Send, Bot, User, Loader2, Database } from "lucide-react";
import ReactMarkdown from "react-markdown";

interface ChatMessage {
    id: string;
    role: "user" | "assistant";
    content: string;
}

export function AIChatWidget() {
    const { currentBusiness, getRoomsByBusiness } = useBusiness();
    const [messages, setMessages] = useState<ChatMessage[]>([]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages]);

    useEffect(() => {
        if (currentBusiness && messages.length === 0) {
            setMessages([
                { id: '1', role: 'assistant', content: `안녕하세요, 대표님! ${currentBusiness.name}의 DB와 연동된 AI 비서입니다.\n궁금한 통계나 특정 조건의 임차인 (예: "3개월 이상 연체된 사람 다 알려줘", "내년 초에 만기되는 방이 어디야?")을 질문해 주시면 즉각 답변해 드립니다.` }
            ]);
        }
    }, [currentBusiness]);

    const handleSend = async () => {
        if (!input.trim() || !currentBusiness) return;

        const userMsg: ChatMessage = { id: Date.now().toString(), role: "user", content: input };
        setMessages(prev => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const rooms = getRoomsByBusiness(currentBusiness.id);
            const basicContext = rooms.map(r => ({
                호실상태: r.status,
                방이름: r.name,
                임차인: r.tenant?.name || '공실',
                월세: r.paymentInfo?.monthlyRent || 0,
                계약종료일: r.leaseEnd,
                연체개월수: r.unpaidMonths,
                연체금액: r.unpaidAmount
            }));

            const res = await fetch('/api/ai-chat-db', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ query: userMsg.content, dbContext: basicContext })
            });

            if (res.ok) {
                const data = await res.json();
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: data.reply }]);
            } else {
                setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "서버 오류로 답변할 수 없습니다." }]);
            }
        } catch (err) {
            console.error("Chat error:", err);
            setMessages(prev => [...prev, { id: Date.now().toString(), role: 'assistant', content: "네트워크 오류가 발생했습니다." }]);
        } finally {
            setIsLoading(false);
        }
    };

    if (!currentBusiness) return null;

    return (
        <div className="bg-white rounded-3xl border border-neutral-200 shadow-sm overflow-hidden flex flex-col h-[500px]">
            <div className="bg-neutral-50 p-4 border-b border-neutral-200 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center text-indigo-600">
                        <Database size={20} />
                    </div>
                    <div>
                        <h3 className="font-bold text-neutral-900">AI 데이터베이스 질의</h3>
                        <p className="text-xs text-neutral-500">Text-to-SQL (MCP 구조 시뮬레이션)</p>
                    </div>
                </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-neutral-50/50">
                {messages.map((msg) => (
                    <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        {msg.role === 'assistant' && (
                            <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1">
                                <Bot size={16} />
                            </div>
                        )}
                        <div className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white rounded-tr-sm' : 'bg-white border border-neutral-200 text-neutral-800 rounded-tl-sm shadow-sm'}`}>
                            {msg.role === 'user' ? (
                                <p className="whitespace-pre-wrap">{msg.content}</p>
                            ) : (
                                <div className="prose prose-sm prose-indigo max-w-none">
                                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                                </div>
                            )}
                        </div>
                    </div>
                ))}
                {isLoading && (
                    <div className="flex gap-3 justify-start">
                        <div className="w-8 h-8 rounded-full bg-indigo-600 flex items-center justify-center text-white shrink-0 mt-1">
                            <Bot size={16} />
                        </div>
                        <div className="bg-white border border-neutral-200 rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex items-center gap-2 text-neutral-500 shadow-sm">
                            <Loader2 size={16} className="animate-spin" /> DB 분석 중...
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            <div className="p-4 bg-white border-t border-neutral-200">
                <form
                    onSubmit={(e) => { e.preventDefault(); handleSend(); }}
                    className="flex gap-2"
                >
                    <input
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="예: 현재 연체 중인 방만 모두 나열해줘"
                        className="flex-1 px-4 py-3 bg-neutral-100 focus:bg-white border border-transparent focus:border-indigo-500 rounded-xl text-sm outline-none transition-colors"
                        disabled={isLoading}
                    />
                    <button
                        type="submit"
                        disabled={!input.trim() || isLoading}
                        className="w-12 h-12 bg-indigo-600 hover:bg-indigo-700 disabled:bg-neutral-300 disabled:cursor-not-allowed text-white rounded-xl flex items-center justify-center transition-colors shrink-0"
                    >
                        <Send size={18} />
                    </button>
                </form>
            </div>
        </div>
    );
}
