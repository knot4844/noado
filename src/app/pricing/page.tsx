"use client";

import React, { useState } from "react";
import { CheckCircle2, Star, Zap, Building2, ArrowRight } from "lucide-react";
import { TossCheckout } from "@/components/payments/TossCheckout";
import Link from "next/link";

export default function PricingPage() {
    const [selectedPlan, setSelectedPlan] = useState<{ amount: number, name: string } | null>(null);

    return (
        <div className="bg-neutral-50 pb-24 relative">

            {/* Background Decorations */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-gradient-to-b from-blue-100/50 to-transparent blur-3xl -z-10 rounded-full"></div>

            {/* Home Logo Button */}
            <div className="absolute top-6 left-6 z-10">
                <Link href="/" className="flex items-center gap-2 group">
                    <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md group-hover:bg-blue-700 transition-colors">
                        <Building2 size={20} className="text-white" />
                    </div>
                    <span className="font-extrabold text-xl tracking-tight text-neutral-900 group-hover:text-blue-600 transition-colors">noado</span>
                </Link>
            </div>


            <div className="max-w-7xl mx-auto px-4 md:px-8 pt-16 md:pt-24 animate-in fade-in slide-in-from-bottom-4 duration-700">
                <div className="text-center max-w-2xl mx-auto mb-16 space-y-4">
                    <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-blue-100 text-blue-700 text-xs font-bold mb-4">
                        <Star size={14} className="fill-blue-700" /> B2B SaaS 정식 오픈
                    </div>
                    <h1 className="text-4xl md:text-5xl font-black text-neutral-900 tracking-tight leading-tight">
                        부동산 관리를 완전히 <br className="hidden md:block" />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-600 to-indigo-600">자동화</span>하세요.
                    </h1>
                    <p className="text-lg text-neutral-500">
                        귀하의 비즈니스 규모에 맞는 요금제를 선택하세요.<br className="hidden md:block" />
                        수납 확인부터 세금계산서 발행까지, 모든 것이 Zero-Touch로 이루어집니다.
                    </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl mx-auto">

                    {/* Starter Plan */}
                    <div className="bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group">
                        <div className="w-12 h-12 rounded-xl bg-neutral-100 flex flex-col items-center justify-center text-neutral-600 mb-6 group-hover:bg-neutral-200 transition-colors">
                            <Building2 size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-900 mb-2">스타터 (Starter)</h3>
                        <p className="text-neutral-500 text-sm mb-6 h-10">소규모 임대업을 막 시작하신 분들을 위한 기본 요금제</p>

                        <div className="mb-8">
                            <span className="text-4xl font-black text-neutral-900">무료</span>
                            <span className="text-neutral-500 font-medium">/ 평생</span>
                        </div>

                        <button className="w-full py-4 px-4 bg-neutral-100 hover:bg-neutral-200 text-neutral-800 font-bold rounded-xl transition-colors mb-8">
                            현재 사용 중
                        </button>

                        <div className="space-y-4">
                            {[
                                "사업장 1개 한정 관리",
                                "호실 최대 3개까지 등록 가능",
                                "기본 대시보드와 통계 확인",
                                "수동 수납 관리 지원"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-neutral-700 font-medium">
                                    <CheckCircle2 size={18} className="text-neutral-400 shrink-0 mt-0.5" />
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Pro Plan */}
                    <div className="bg-white rounded-3xl p-8 border-2 border-blue-600 shadow-xl shadow-blue-900/5 hover:-translate-y-1 transition-transform duration-300 relative">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-blue-600 text-white text-xs font-bold px-3 py-1 rounded-full shadow-lg">
                            가장 많이 선택하는 요금제
                        </div>

                        <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-600 to-indigo-600 flex flex-col items-center justify-center text-white mb-6 shadow-md">
                            <Zap size={24} className="fill-white/20" />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-900 mb-2">비기너 (Beginner)</h3>
                        <p className="text-neutral-500 text-sm mb-6 h-10">생업과 임대업을 병행하는 알짜 임대사업자</p>

                        <div className="mb-8 flex items-baseline gap-1">
                            <span className="text-4xl font-black text-neutral-900">₩9,900</span>
                            <span className="text-neutral-500 font-medium">/ 월</span>
                        </div>

                        <button
                            onClick={() => setSelectedPlan({ amount: 9900, name: 'noado Beginner 요금제 (월정액)' })}
                            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex justify-center items-center gap-2 mb-8 group"
                        >
                            Beginner 요금제로 업그레이드
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="space-y-4">
                            {[
                                "사업장 1개 한정 관리",
                                "호실 최대 5개까지 유연한 등록",
                                "AI 통장 입금 내역 실시간 자동 매칭",
                                "입금 확인 즉시 전자세금계산서 자동 발행 (건당 300원 실비)",
                                "카톡/문자 자동 알림 템플릿 제공"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-neutral-900 font-bold">
                                    <CheckCircle2 size={20} className="text-blue-600 shrink-0" />
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Enterprise Plan */}
                    <div className="bg-white rounded-3xl p-8 border border-neutral-200 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 relative group">
                        <div className="w-12 h-12 rounded-xl bg-neutral-900 flex flex-col items-center justify-center text-white mb-6 shadow-md">
                            <Star size={24} />
                        </div>
                        <h3 className="text-2xl font-bold text-neutral-900 mb-2">프로 (Pro)</h3>
                        <p className="text-neutral-500 text-sm mb-6 h-10">중대형 건물 및 다수 임대주택을 운영하는 전문 임대사업자</p>

                        <div className="mb-8 flex items-baseline gap-1">
                            <span className="text-4xl font-black text-neutral-900">₩19,900</span>
                            <span className="text-neutral-500 font-medium">/ 월</span>
                        </div>

                        <button
                            onClick={() => setSelectedPlan({ amount: 19900, name: 'noado Pro 요금제 (월정액)' })}
                            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 hover:shadow-blue-300 transition-all flex justify-center items-center gap-2 mb-8 group"
                        >
                            Pro 요금제로 업그레이드
                            <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                        </button>

                        <div className="space-y-4">
                            {[
                                "사업장 최대 3개까지 완벽 관리",
                                "호실 최대 50개까지 넉넉한 등록",
                                "스마트 간편결제(카드/페이) 월세 수납",
                                "입금 확인 즉시 전자세금계산서 자동 발행 (건당 300원 실비)"
                            ].map((feature, i) => (
                                <div key={i} className="flex items-start gap-3 text-sm text-neutral-700 font-medium">
                                    <CheckCircle2 size={18} className="text-neutral-900 shrink-0 mt-0.5" />
                                    {feature}
                                </div>
                            ))}
                        </div>
                    </div>

                </div>
            </div>

            {selectedPlan && (
                <TossCheckout
                    amount={selectedPlan.amount}
                    orderName={selectedPlan.name}
                    onClose={() => setSelectedPlan(null)}
                />
            )}
        </div>
    );
}
