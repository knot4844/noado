'use client'

export const dynamic = 'force-dynamic'

import React, { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { allRooms as mockRooms } from "@/lib/data";
import { TossCheckout } from "@/components/payments/TossCheckout";
import {
    ArrowLeft,
    CreditCard,
    CheckCircle2,
    CalendarDays
} from "lucide-react";
import Link from "next/link";

interface PayRoom {
    id: string;
    name: string;
    status: string;
    tenantName: string;
    tenantCompany: string;
    monthlyRent: number;
    unpaidAmount: number;
}

export default function TenantPaymentPage() {
    const params = useParams();
    const router = useRouter();
    const id = params?.tenantId as string;

    const [room, setRoom]           = useState<PayRoom | null>(null);
    const [isSuccess, setIsSuccess] = useState(false);
    const [isCheckoutOpen, setIsCheckoutOpen] = useState(false);

    useEffect(() => {
        if (!id) return;

        const load = async () => {
            /* 데모 */
            if (id.startsWith('r_')) {
                const mockRoom = mockRooms.find(r => r.id === id);
                if (mockRoom) {
                    setRoom({
                        id:            mockRoom.id,
                        name:          mockRoom.name,
                        status:        mockRoom.status,
                        tenantName:    mockRoom.tenant?.name        ?? '미확인',
                        tenantCompany: mockRoom.tenant?.companyName ?? '',
                        monthlyRent:   mockRoom.paymentInfo?.monthlyRent ?? 0,
                        unpaidAmount:  mockRoom.unpaidAmount ?? 0,
                    });
                }
                return;
            }

            /* Supabase */
            const { data: sessionData } = await supabase.auth.getSession();
            if (!sessionData.session) { router.push('/tenant/login'); return; }

            const { data: row } = await supabase
                .from("rooms")
                .select("id, name, status, tenant_name, tenant_company_name, monthly_rent, unpaid_amount")
                .eq("id", id)
                .single();

            if (row) {
                setRoom({
                    id:            row.id,
                    name:          row.name,
                    status:        row.status,
                    tenantName:    row.tenant_name         ?? '미확인',
                    tenantCompany: row.tenant_company_name ?? '',
                    monthlyRent:   row.monthly_rent        ?? 0,
                    unpaidAmount:  row.unpaid_amount       ?? 0,
                });
            }
        };

        load();
    }, [id, router]);

    if (!room) return null;

    const paymentAmount = room.status === "UNPAID" && room.unpaidAmount
        ? room.unpaidAmount
        : room.monthlyRent;

    if (isSuccess) {
        return (
            <div className="min-h-screen bg-neutral-50 p-4 flex items-center justify-center">
                <div className="bg-white p-8 md:p-12 rounded-3xl shadow-sm max-w-md w-full text-center border border-neutral-200 animate-in zoom-in duration-500">
                    <div className="w-20 h-20 bg-blue-100 rounded-full flex items-center justify-center mx-auto mb-6 text-blue-600">
                        <CheckCircle2 size={40} />
                    </div>
                    <h1 className="text-2xl font-extrabold text-neutral-900 mb-3 tracking-tight">결제가 완료되었습니다</h1>
                    <p className="text-neutral-500 mb-8 leading-relaxed">
                        이번 달 이용료 납부가 정상적으로 처리되었습니다.<br />이용해 주셔서 감사합니다.
                    </p>
                    <div className="bg-neutral-50 border border-neutral-200 rounded-xl p-5 mb-8 text-left space-y-3">
                        <div className="flex justify-between items-center pb-3 border-b border-neutral-200">
                            <span className="text-sm font-bold text-neutral-500">결제 금액</span>
                            <span className="text-lg font-bold text-blue-600">₩ {paymentAmount.toLocaleString()}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-bold text-neutral-500">결제 수단</span>
                            <span className="text-sm font-bold text-neutral-900">신용카드 (토스페이먼츠)</span>
                        </div>
                    </div>
                    <Link
                        href={`/portal/${room.id}`}
                        className="w-full block py-4 bg-neutral-900 text-white rounded-xl font-bold text-lg hover:bg-neutral-800 transition-colors"
                    >
                        포털 홈으로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-neutral-50 pb-20 font-sans">
            {/* Header */}
            <header className="bg-white border-b border-neutral-200 px-4 py-4 sticky top-0 z-10 flex items-center">
                <div className="max-w-md mx-auto w-full flex items-center gap-3">
                    <button onClick={() => router.back()} className="p-2 -ml-2 text-neutral-500 hover:text-neutral-900 transition-colors rounded-full hover:bg-neutral-100">
                        <ArrowLeft size={24} />
                    </button>
                    <span className="font-extrabold text-lg text-neutral-900 tracking-tight flex items-center gap-2">
                        <CreditCard size={20} className="text-neutral-400" />
                        이용료 카드 결제
                    </span>
                </div>
            </header>

            <main className="max-w-md mx-auto p-4 mt-2 space-y-6">
                {/* Payment Summary */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                    <div className="flex items-center gap-3 mb-6">
                        <div className="w-12 h-12 bg-neutral-100 rounded-full flex items-center justify-center text-neutral-500">
                            <CalendarDays size={24} />
                        </div>
                        <div>
                            <span className="text-sm font-bold text-neutral-400">{room.name}</span>
                            <h2 className="text-xl font-black text-neutral-900 tracking-tight">당월 이용료 결제</h2>
                        </div>
                    </div>
                    <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-100">
                        <div className="flex justify-between items-center mb-2">
                            <span className="text-sm font-medium text-neutral-500">청구 대상</span>
                            <span className="text-sm font-bold text-neutral-900">{room.tenantName} ({room.tenantCompany})</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-sm font-medium text-neutral-500">총 결제 금액</span>
                            <span className="text-2xl font-black text-blue-600">₩ {paymentAmount.toLocaleString()}</span>
                        </div>
                    </div>
                    <p className="text-xs text-neutral-400 mt-4 text-center">
                        * 신용카드 결제 수수료는 이용자 부담으로 진행됩니다.
                    </p>
                </div>

                {/* Toss Payments Widget */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-5 border-b border-neutral-100 bg-neutral-50/50">
                        <h3 className="font-bold text-neutral-900">결제 진행</h3>
                    </div>
                    <div className="p-6">
                        <button
                            onClick={() => setIsCheckoutOpen(true)}
                            className="w-full py-4 bg-blue-600 text-white font-bold rounded-xl text-lg hover:bg-blue-700 transition-colors shadow-blue-200 shadow-lg"
                        >
                            신용카드로 결제하기
                        </button>
                    </div>
                </div>

                {/* Toss Checkout Modal */}
                {isCheckoutOpen && (
                    <TossCheckout
                        amount={paymentAmount}
                        orderName={`${room.name} 당월 이용료`}
                        onClose={() => setIsCheckoutOpen(false)}
                    />
                )}
            </main>
        </div>
    );
}
