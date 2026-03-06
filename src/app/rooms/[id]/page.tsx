"use client";

import React from "react";
import { useParams, useRouter } from "next/navigation";
import { useBusiness } from "@/components/providers/BusinessProvider";
import {
    ArrowLeft,
    Building2,
    CalendarClock,
    FileText,
    CreditCard,
    CheckCircle2,
    Clock,
    AlertCircle
} from "lucide-react";
import Link from "next/link";
import * as XLSX from "xlsx";

export default function RoomDetailPage() {
    const params = useParams();
    const router = useRouter();
    const { rooms } = useBusiness();

    // Find matching room
    const id = params?.id as string;
    const room = rooms.find(r => r.id === id);

    if (!room) {
        return (
            <div className="p-8 text-center min-h-[50vh] flex flex-col items-center justify-center">
                <AlertCircle className="text-neutral-400 mb-4" size={48} />
                <h2 className="text-xl font-bold text-neutral-900 mb-2">호실을 찾을 수 없습니다</h2>
                <p className="text-sm text-neutral-500 mb-4 whitespace-pre-wrap text-left">
                    디버그 정보:<br />
                    - 요청된 ID: {id} <br />
                    - 현재 불러온 총 호실 수: {rooms.length} 개 <br />
                    - Context Rooms 첫 1개 샘플 ID: {rooms[0]?.id || '없음'}
                </p>
                <button onClick={() => router.back()} className="text-blue-600 hover:underline">
                    이전 페이지로 돌아가기
                </button>
            </div>
        );
    }

    const { tenant, paymentInfo, status } = room;
    const isVacant = status === "VACANT";

    // Mock payment history for the last 6 months
    const mockPaymentHistory = Array.from({ length: 6 }).map((_, i) => {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthStr = `${date.getFullYear()}년 ${String(date.getMonth() + 1).padStart(2, '0')}월`;

        // Let's create a realistic mock history based on the current status
        let paymentStatus: "PAID" | "UNPAID" | "PENDING" = "PAID";
        if (status === "UNPAID" && i < (room.unpaidMonths || 1)) {
            paymentStatus = "UNPAID";
        } else if (i === 0 && (room.id.length % 2 === 0)) { // use stable condition
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
        // 컬럼 너비 설정
        ws["!cols"] = [
            { wch: 15 }, // 청구 월
            { wch: 15 }, // 납부 금액
            { wch: 15 }, // 약정일
            { wch: 12 }, // 수납 상태
            { wch: 15 }, // 수납 완료일
        ];

        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "상세 납입 내역");
        XLSX.writeFile(wb, `${room.name}_납입내역_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    return (
        <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6 animate-in fade-in duration-500">
            {/* Header */}
            <header className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                    <button
                        onClick={() => router.back()}
                        className="p-2 hover:bg-neutral-100 rounded-full transition-colors text-neutral-500"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <div className="flex items-center gap-3">
                            <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight">{room.name}</h1>
                            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${isVacant ? "bg-neutral-100 text-neutral-600 border border-neutral-200" :
                                status === "UNPAID" ? "bg-rose-100 text-rose-700" : "bg-emerald-100 text-emerald-700"
                                }`}>
                                {isVacant ? "공실" : status === "UNPAID" ? "미납 발생" : "납부 완료"}
                            </span>
                        </div>
                        <p className="text-neutral-500 mt-1 flex items-center gap-2">
                            <Building2 size={16} />
                            {isVacant ? "현재 비어있는 호실입니다." : `${tenant?.name} (${tenant?.companyName || "사업자 미등록"})`}
                        </p>
                    </div>
                </div>

                {!isVacant && (
                    <div className="flex gap-2">
                        <Link href={`/contracts/${room.id}`} target="_blank" className="px-4 py-2 bg-emerald-50 text-emerald-700 shadow-sm rounded-lg text-sm font-bold hover:bg-emerald-100 transition-colors flex items-center gap-1.5">
                            <FileText size={16} /> 전자계약서 보기
                        </Link>
                        <Link href="/payments" className="px-4 py-2 bg-white border border-neutral-200 shadow-sm rounded-lg text-sm font-bold text-neutral-700 hover:bg-neutral-50 transition-colors">
                            수납 등록
                        </Link>
                        <Link href="/invoices" className="px-4 py-2 bg-blue-600 text-white shadow-sm rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors">
                            세금계산서 발행
                        </Link>
                    </div>
                )}
            </header>

            {!isVacant && (
                <>
                    {/* Contract Details Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-1">
                            <span className="text-sm font-medium text-neutral-500 flex items-center gap-1.5"><CalendarClock size={16} /> 계약 기간</span>
                            <span className="text-neutral-900 font-bold mt-1 tracking-tight">{room.leaseStart} ~</span>
                            <span className="text-neutral-900 font-bold tracking-tight">{room.leaseEnd}</span>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-1">
                            <span className="text-sm font-medium text-neutral-500 flex items-center gap-1.5"><CreditCard size={16} /> 임대 조건</span>
                            <span className="text-neutral-900 font-bold mt-1 tracking-tight">
                                보증금 ₩ {paymentInfo?.deposit.toLocaleString()}
                            </span>
                            <span className="text-blue-600 font-bold tracking-tight">
                                월세 ₩ {paymentInfo?.monthlyRent.toLocaleString()} {paymentInfo?.isVATIncluded ? "(VAT 포함)" : "(VAT 별도)"}
                            </span>
                        </div>

                        <div className="bg-white p-5 rounded-xl border border-neutral-200 shadow-sm flex flex-col gap-1 lg:col-span-2">
                            <span className="text-sm font-medium text-neutral-500 flex items-center gap-1.5"><FileText size={16} /> 임차인 및 사업자 정보</span>
                            <div className="flex items-center gap-6 mt-1">
                                <div>
                                    <span className="text-xs text-neutral-400 block mb-0.5">상호명 (대표자)</span>
                                    <span className="text-neutral-900 font-bold">{tenant?.companyName || "-"} ({tenant?.name})</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-100"></div>
                                <div>
                                    <span className="text-xs text-neutral-400 block mb-0.5">사업자등록번호</span>
                                    <span className="text-neutral-900 font-mono tracking-tight">{tenant?.businessRegistrationNumber || "미등록"}</span>
                                </div>
                                <div className="w-px h-8 bg-neutral-100"></div>
                                <div>
                                    <span className="text-xs text-neutral-400 block mb-0.5">연락처</span>
                                    <span className="text-neutral-900 font-bold">{tenant?.contact || "-"}</span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Payment History Timeline */}
                    <div className="bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden">
                        <div className="p-5 border-b border-neutral-100 bg-neutral-50/50 flex items-center justify-between">
                            <h3 className="font-bold text-neutral-900 text-lg">상세 임대료 징수 이력</h3>
                            <button
                                onClick={handleExportExcel}
                                className="text-sm font-medium text-blue-600 hover:underline flex items-center gap-1"
                            >
                                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" x2="12" y1="15" y2="3" /></svg>
                                전체 이력 엑셀 다운로드
                            </button>
                        </div>
                        <div className="divide-y divide-neutral-100">
                            {mockPaymentHistory.map((history) => (
                                <div key={history.id} className="p-5 flex items-center justify-between hover:bg-neutral-50 transition-colors group">
                                    <div className="flex items-center gap-5">
                                        {/* Status Icon */}
                                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 border-4 border-white shadow-sm ${history.status === "PAID" ? "bg-emerald-100 text-emerald-600" :
                                            history.status === "UNPAID" ? "bg-rose-100 text-rose-600" :
                                                "bg-amber-100 text-amber-600"
                                            }`}>
                                            {history.status === "PAID" ? <CheckCircle2 size={24} /> :
                                                history.status === "UNPAID" ? <AlertCircle size={24} /> :
                                                    <Clock size={24} />}
                                        </div>

                                        {/* Month & Amount */}
                                        <div>
                                            <h4 className="font-bold text-neutral-900 mb-1">{history.month} 임대료</h4>
                                            <div className="flex items-center gap-3 text-sm">
                                                <span className="font-bold text-neutral-700">₩ {history.amount.toLocaleString()}</span>
                                                <span className="text-neutral-300">|</span>
                                                <span className="text-neutral-500">약정일: {history.dueDate}</span>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Action/Paid Date */}
                                    <div className="text-right">
                                        {history.status === "PAID" ? (
                                            <div>
                                                <span className="block text-xs text-neutral-400 font-medium mb-1">수납 완료일</span>
                                                <span className="text-sm font-bold text-emerald-700">{history.paidDate}</span>
                                            </div>
                                        ) : history.status === "UNPAID" ? (
                                            <div className="flex flex-col items-end gap-2">
                                                <span className="px-2.5 py-1 rounded text-xs font-bold bg-rose-50 text-rose-600 border border-rose-100">
                                                    미납 상태
                                                </span>
                                                <button className="text-xs font-bold text-blue-600 hover:underline">
                                                    알림톡 재발송
                                                </button>
                                            </div>
                                        ) : (
                                            <div>
                                                <span className="block text-xs text-neutral-400 font-medium mb-1">수납 대기 (예정일 도래 전)</span>
                                                <span className="text-sm font-bold text-amber-600">-</span>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
