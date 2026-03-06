"use client";

import React, { useState } from "react";
import { ChevronDown, TrendingUp, AlertCircle } from "lucide-react";
import { useBusiness } from "@/components/providers/BusinessProvider";

type Period = "MONTHLY" | "QUARTERLY" | "BIANNUALLY" | "ANNUALLY";

const periodLabels: Record<Period, string> = {
    MONTHLY: "당월",
    QUARTERLY: "1분기",
    BIANNUALLY: "상반기",
    ANNUALLY: "2026년 방기"
};

export function UnpaidSummary() {
    const [period, setPeriod] = useState<Period>("MONTHLY");
    const { selectedBusinessId, getRoomsByBusiness } = useBusiness();

    // Dynamic Calculation
    const rooms = getRoomsByBusiness(selectedBusinessId);
    const unpaidRooms = rooms.filter(r => r.status === "UNPAID");

    // Base amount: 실제 누적 미납금액 (이미 unpaidMonths × monthlyRent로 계산된 값)
    const baseUnpaidAmount = unpaidRooms.reduce((sum, room) => sum + (room.unpaidAmount || 0), 0);
    // 기간별 예측용: 월세 총합 (미납자 기준)
    const baseMonthlyRent = unpaidRooms.reduce((sum, room) => sum + (room.paymentInfo?.monthlyRent || 0), 0);
    const baseCount = unpaidRooms.length;

    // 기간별 계산:
    // - MONTHLY: 현재 실제 누적 미납금 그대로 표시
    // - 그 외: 미납자들의 월세 합계 × 기간 (미래 예측치)
    const multipliers: Record<Period, number> = {
        MONTHLY: 1,
        QUARTERLY: 3,
        BIANNUALLY: 6,
        ANNUALLY: 12
    };

    const multiplier = multipliers[period];
    const displayAmount = period === "MONTHLY"
        ? baseUnpaidAmount                  // 당월: 실제 누적 미납금
        : baseMonthlyRent * multiplier;     // 그 외: 월세 기준 기간 예측 (이중 계산 방지)
    const displayCount = baseCount;

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 h-full flex flex-col relative z-20">
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-lg font-bold text-neutral-900 leading-none">기간별 미납 현황</h2>
                    <p className="text-sm text-neutral-500 mt-1">지정된 기간 동안의 미납 누적액</p>
                </div>

                <div className="relative group">
                    <button className="flex items-center gap-2 px-3 py-1.5 rounded-lg border border-neutral-200 text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                        {periodLabels[period]}
                        <ChevronDown size={14} className="text-neutral-400" />
                    </button>

                    <div className="absolute right-0 top-full mt-1 w-32 bg-white rounded-lg shadow-xl border border-neutral-100 overflow-hidden opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-30">
                        {Object.entries(periodLabels).map(([key, label]) => (
                            <button
                                key={key}
                                onClick={() => setPeriod(key as Period)}
                                className={`w-full text-left px-4 py-2 text-sm hover:bg-blue-50 transition-colors ${period === key ? "text-blue-600 font-bold bg-blue-50/50" : "text-neutral-700"}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            <div className="flex-1 flex flex-col justify-center py-2 animate-in fade-in slide-in-from-bottom-2 duration-300" key={period}>
                {displayCount === 0 ? (
                    <div className="flex flex-col items-center justify-center text-neutral-400 py-8">
                        <AlertCircle size={32} className="mb-2 opacity-50" />
                        <p className="font-medium text-sm">미납 건이 없습니다</p>
                    </div>
                ) : (
                    <>
                        <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-4xl font-bold text-rose-600">₩ {displayAmount.toLocaleString()}</span>
                        </div>

                        <div className="flex items-center gap-2 mt-4">
                            <div className="flex -space-x-2">
                                {Array.from({ length: Math.min(3, displayCount) }).map((_, i) => (
                                    <div key={i} className="w-8 h-8 rounded-full border-2 border-white bg-rose-100 text-rose-700 flex items-center justify-center text-xs font-bold z-10 relative">
                                        임차
                                    </div>
                                ))}
                                {displayCount > 3 && (
                                    <div className="w-8 h-8 rounded-full border-2 border-white bg-neutral-100 text-neutral-600 flex items-center justify-center text-xs font-bold z-0 relative">
                                        +{displayCount - 3}
                                    </div>
                                )}
                            </div>
                            <span className="text-sm font-medium text-neutral-600 ml-2">
                                총 <strong className="text-rose-600">{displayCount}명</strong>의 임차인이 미납 중입니다
                            </span>
                        </div>
                    </>
                )}
            </div>

            <div className="mt-auto pt-4 border-t border-neutral-100 flex items-center justify-between text-sm">
                <div className="flex items-center gap-1.5 text-rose-600 font-medium opacity-50">
                    <TrendingUp size={16} />
                    <span>전 주기 대비 데이터 없음</span>
                </div>
                <button className="text-blue-600 font-medium hover:text-blue-700 hover:underline">
                    상세 내역 보기 &rarr;
                </button>
            </div>
        </div>
    );
}
