"use client";

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import {
    Clock,
    CheckCircle2,
    CreditCard,
    ChevronRight,
    AlertCircle,
    UserCircle,
    FileSignature,
    CalendarClock,
    Download,
    Lock
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function TenantPortalPage() {
    const params = useParams();
    const router = useRouter();
    const { rooms, currentBusiness } = useBusiness();
    const { user } = useAuth();
    const [authState, setAuthState] = useState<"loading" | "allowed" | "denied" | "unauthenticated">("loading");

    const id = params?.tenantId as string;
    const room = rooms.find(r => r.id === id);

    useEffect(() => {
        const check = async () => {
            // 데모 호실 바이패스
            if (id?.startsWith('r_')) {
                setAuthState("allowed");
                return;
            }

            const { data } = await supabase.auth.getSession();
            const sessionUser = data.session?.user;

            if (!sessionUser) {
                // 미로그인: 임차인 로그인 페이지로
                router.push(`/tenant/login?redirect=/portal/${id}`);
                return;
            }

            // 관리자(rooms owner)이면 허용
            if (user) {
                setAuthState("allowed");
                return;
            }

            // 임차인: 본인 방인지 확인
            const { data: linkedRoom } = await supabase
                .from("rooms")
                .select("id")
                .eq("tenant_auth_id", sessionUser.id)
                .eq("id", id)
                .single();

            if (linkedRoom) setAuthState("allowed");
            else setAuthState("denied");
        };
        if (id) check();
    }, [id, user, router]);

    if (authState === "loading") {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (authState === "denied") {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full border border-neutral-200">
                    <Lock className="mx-auto text-rose-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-neutral-900 mb-2">접근 권한 없음</h2>
                    <p className="text-neutral-500 text-sm mb-6">본인의 계약 페이지만 확인할 수 있습니다.</p>
                    <Link href="/tenant/login" className="text-blue-600 font-semibold text-sm hover:underline">로그인 페이지로</Link>
                </div>
            </div>
        );
    }

    if (!room || room.status === "VACANT") {
        return (
            <div className="min-h-screen bg-neutral-100 flex items-center justify-center p-4">
                <div className="bg-white p-8 rounded-2xl shadow-sm text-center max-w-sm w-full border border-neutral-200">
                    <AlertCircle className="mx-auto text-rose-500 mb-4" size={48} />
                    <h2 className="text-xl font-bold text-neutral-900 mb-2">접근할 수 없습니다</h2>
                    <p className="text-neutral-500 text-sm mb-6">존재하지 않거나 유효하지 않은 임대차 계약 링크입니다.</p>
                </div>
            </div>
        );
    }

    const { tenant, paymentInfo, status } = room;

    const mockPaymentHistory = Array.from({ length: 3 }).map((_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`;

        let paymentStatus: "PAID" | "UNPAID" | "PENDING" = "PAID";
        if (status === "UNPAID" && i < (room.unpaidMonths || 1)) {
            paymentStatus = "UNPAID";
        } else if (i === 0 && (room.id.length % 2 === 0)) {
            paymentStatus = "PENDING";
        }

        return {
            id: `p_${i}`,
            month: monthStr,
            amount: paymentInfo?.monthlyRent || 0,
            dueDate: paymentInfo?.dueDate || "매월 15일",
            status: paymentStatus,
            paidDate: paymentStatus === "PAID" ? `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-15` : null
        };
    });

    const handleExportExcel = () => {
        const exportData = mockPaymentHistory.map((row) => ({
            "청구 월": row.month,
            "납부 금액(원)": row.amount,
            "약정일": row.dueDate,
            "수납 상태": row.status === "PAID" ? "납부 완료" : row.status === "UNPAID" ? "미납" : "수납 대기",
            "수납 완료일": row.paidDate || "-",
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        ws["!cols"] = [{ wch: 15 }, { wch: 15 }, { wch: 15 }, { wch: 12 }, { wch: 15 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "납입 영수증");
        XLSX.writeFile(wb, `임대료_납입영수증_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="min-h-screen bg-neutral-100 pb-20 font-sans">
            {/* Minimal Header */}
            <header className="bg-white border-b border-neutral-200 px-4 py-4 sticky top-0 z-10 shadow-sm">
                <div className="max-w-md mx-auto flex items-center justify-between">
                    <span className="font-exrabold text-lg text-neutral-900 tracking-tight">{currentBusiness?.name || 'noado'}</span>
                    <UserCircle size={24} className="text-neutral-400" />
                </div>
            </header>

            <main className="max-w-md mx-auto p-4 mt-2 space-y-4">
                {/* Greeting Card */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 animate-in fade-in duration-500">
                    <h1 className="text-2xl font-black text-neutral-900 tracking-tight mb-1">
                        안녕하세요, <span className="text-blue-600">{tenant?.name}</span>님
                    </h1>
                    <p className="text-neutral-500 text-sm">{room.name} 계약 현황입니다.</p>
                </div>

                {/* Status Alert Card */}
                {status === "UNPAID" && (
                    <div className="bg-rose-50 border border-rose-200 p-5 rounded-2xl flex items-start gap-4 animate-in slide-in-from-bottom-2 duration-500">
                        <AlertCircle className="text-rose-500 shrink-0 mt-0.5" size={24} />
                        <div>
                            <h3 className="font-bold text-rose-800 text-base mb-1">미납된 임대료가 있습니다</h3>
                            <p className="text-rose-600 text-sm mb-3">
                                {room.unpaidMonths}개월분 (₩ {room.unpaidAmount?.toLocaleString()})이 미납되었습니다.
                            </p>
                            <Link
                                href={`/portal/${room.id}/pay`}
                                className="inline-block px-4 py-2 bg-rose-600 text-white text-sm font-bold rounded-lg hover:bg-rose-700 transition-colors shadow-sm"
                            >
                                지금 신용카드로 납부하기
                            </Link>
                        </div>
                    </div>
                )}

                {/* Contract Summary */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden animate-in slide-in-from-bottom-4 duration-500">
                    <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2">
                            <CalendarClock size={20} className="text-neutral-400" />
                            나의 임대차 계약
                        </h2>
                        <Link href={`/contracts/${room.id}`} className="text-xs font-bold px-3 py-1.5 bg-neutral-100 text-neutral-700 rounded-md hover:bg-neutral-200 transition-colors flex items-center gap-1">
                            <FileSignature size={14} /> 계약서 보기
                        </Link>
                    </div>
                    <div className="p-5 space-y-5">
                        <div>
                            <span className="text-xs font-bold text-neutral-400 block mb-1">임대 기간</span>
                            <span className="text-neutral-900 font-medium">
                                {room.leaseStart} ~ <span className="font-bold">{room.leaseEnd}</span>
                            </span>
                        </div>
                        <div className="flex bg-neutral-50 rounded-xl p-4 divide-x divide-neutral-200">
                            <div className="flex-1 pr-4">
                                <span className="text-xs font-bold text-neutral-400 block mb-1">보증금</span>
                                <span className="font-bold text-neutral-900 block text-lg">₩ {paymentInfo?.deposit.toLocaleString()}</span>
                            </div>
                            <div className="flex-1 pl-4">
                                <span className="text-xs font-bold text-neutral-400 block mb-1">월임대료 ({paymentInfo?.dueDate})</span>
                                <span className="font-bold text-blue-600 block text-lg">₩ {paymentInfo?.monthlyRent.toLocaleString()}</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Payment History Tracker */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden animate-in slide-in-from-bottom-6 duration-500">
                    <div className="p-5 border-b border-neutral-100 flex items-center justify-between">
                        <h2 className="font-bold text-neutral-900 text-lg flex items-center gap-2">
                            <CreditCard size={20} className="text-neutral-400" />
                            최근 납부 내역
                        </h2>
                        <button onClick={handleExportExcel} className="text-xs font-bold px-3 py-1.5 text-blue-600 bg-blue-50 border border-blue-100 rounded-md hover:bg-blue-100 transition-colors flex items-center gap-1">
                            <Download size={14} /> 영수증 다운
                        </button>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {mockPaymentHistory.map((history) => (
                            <div key={history.id} className="p-5 flex items-center justify-between">
                                <div className="flex items-center gap-3">
                                    <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 border-2 border-white shadow-sm ${history.status === "PAID" ? "bg-emerald-100 text-emerald-600" :
                                        history.status === "UNPAID" ? "bg-rose-100 text-rose-600" :
                                            "bg-neutral-100 text-neutral-500"
                                        }`}>
                                        {history.status === "PAID" ? <CheckCircle2 size={20} /> :
                                            history.status === "UNPAID" ? <AlertCircle size={20} /> :
                                                <Clock size={20} />}
                                    </div>
                                    <div>
                                        <h4 className="font-bold text-neutral-900">{history.month} 청구분</h4>
                                        <p className="text-sm font-medium text-neutral-500 mt-0.5">₩ {history.amount.toLocaleString()}</p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    {history.status === "PAID" ? (
                                        <span className="text-sm font-bold text-emerald-600">수납완료</span>
                                    ) : history.status === "UNPAID" ? (
                                        <span className="text-sm font-bold text-rose-600 bg-rose-50 px-2 py-1 rounded">미납</span>
                                    ) : (
                                        <span className="text-sm font-bold text-neutral-500">납부대기</span>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                    <Link href={`/portal/${room.id}/pay`} className="flex items-center justify-between p-5 bg-neutral-50 hover:bg-neutral-100 transition-colors group">
                        <span className="font-bold text-neutral-700 group-hover:text-neutral-900">당월 임대료 신용카드 결제하기</span>
                        <ChevronRight size={20} className="text-neutral-400 group-hover:text-neutral-700 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </main>
        </div>
    );
}
