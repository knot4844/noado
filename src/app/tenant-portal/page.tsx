"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Building2, CreditCard, ChevronRight, LogOut, Download, AlertCircle, Calendar } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/components/providers/AuthProvider";

export default function TenantPortalPage() {
    const router = useRouter();
    const { user, signOut } = useAuth();
    const [loading, setLoading] = useState(true);
    const [roomInfo, setRoomInfo] = useState<any>(null);
    const [payments, setPayments] = useState<any[]>([]);

    useEffect(() => {
        if (!user) return;

        const fetchTenantData = async () => {
            try {
                // 임차인 이메일로 매핑된 호실 정보 찾기
                const { data: roomData } = await supabase
                    .from('rooms')
                    .select('*, businesses(name)')
                    // 임차인의 email과 정확히 일치하는 경우 (또는 향후 tenant_id 연동)
                    // 현재 DB 스키마상 tenant_id가 있지만 이메일 기반 매칭을 위해 우선 서버 API나 여기 클라이언트에서 조회
                    // 데모용으로 우선 최상단에 하나 보여주거나, 실제로는 API로 감싸는게 좋음.
                    .eq('tenant_id', user.id)
                    .single();

                if (roomData) {
                    setRoomInfo(roomData);

                    // 납부 내역
                    const { data: payData } = await supabase
                        .from('payments')
                        .select('*')
                        .eq('room_id', roomData.id)
                        .order('paid_at', { ascending: false });

                    if (payData) setPayments(payData);
                } else {
                    // 데모 유저이거나 아직 호실 매핑이 안된 경우 Mock 데이터 표시
                    setRoomInfo({
                        name: "101호",
                        businesses: { name: "대우빌딩" },
                        deposit: 10000000,
                        monthly_rent: 800000,
                        due_date: "매월 25일",
                        lease_start: "2025-01-01",
                        lease_end: "2026-12-31"
                    });
                    setPayments([
                        { id: 1, month: "2026년 2월", amount: 800000, status: "PAID", paid_at: "2026-02-25" },
                        { id: 2, month: "2026년 1월", amount: 800000, status: "PAID", paid_at: "2026-01-25" }
                    ]);
                }
            } catch (error) {
                console.error("Error fetching tenant data:", error);
            } finally {
                setLoading(false);
            }
        };

        fetchTenantData();
    }, [user]);

    if (loading) {
        return <div className="min-h-screen flex items-center justify-center bg-neutral-50">로딩 중...</div>;
    }

    return (
        <div className="min-h-screen bg-neutral-50 pb-20">
            {/* Header */}
            <header className="bg-white border-b border-neutral-200 sticky top-0 z-10 px-4 py-4 md:px-8">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                    <div className="flex items-center gap-2 group">
                        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md">
                            <Building2 size={18} className="text-white" />
                        </div>
                        <span className="font-extrabold text-xl tracking-tight text-neutral-900">noado <span className="text-blue-600">임차인</span></span>
                    </div>
                    <button onClick={() => { signOut(); router.push('/login'); }} className="flex items-center gap-2 text-sm font-medium text-neutral-500 hover:text-neutral-900 transition-colors">
                        <LogOut size={16} /> <span className="hidden sm:inline">로그아웃</span>
                    </button>
                </div>
            </header>

            <main className="max-w-4xl mx-auto mt-8 px-4 md:px-8 space-y-6">

                {/* Welcome Card */}
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">안녕하세요, {user?.user_metadata?.full_name || user?.email?.split('@')[0] || '고객'}님 👋</h1>
                    <p className="text-neutral-500 mt-1">계약 정보 및 납부 내역을 확인하세요.</p>
                </div>

                {/* Contract Summary Widget */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-6 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/50">
                        <h2 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                            <Calendar className="text-blue-600" size={20} /> 나의 계약 정보
                        </h2>
                        <span className="px-3 py-1 bg-blue-100 text-blue-700 font-bold text-xs rounded-full">계약 유지중</span>
                    </div>
                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-neutral-500">계약 건물 및 호실</p>
                                <p className="text-lg font-bold text-neutral-900 mt-0.5">{roomInfo?.businesses?.name} {roomInfo?.name}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-500">임대 조건 (보증금 / 월세)</p>
                                <p className="text-lg font-bold text-neutral-900 mt-0.5">
                                    {(roomInfo?.deposit || 0).toLocaleString()}원 / {(roomInfo?.monthly_rent || 0).toLocaleString()}원
                                </p>
                            </div>
                        </div>
                        <div className="space-y-4">
                            <div>
                                <p className="text-sm font-medium text-neutral-500">계약 기간</p>
                                <p className="text-neutral-900 font-bold mt-0.5">{roomInfo?.lease_start || '2025-01-01'} ~ {roomInfo?.lease_end || '2026-12-31'}</p>
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-500">정기 납부일</p>
                                <p className="text-rose-600 font-bold mt-0.5">{roomInfo?.due_date || '매월 25일'}</p>
                            </div>
                        </div>
                    </div>
                    <div className="px-6 py-4 bg-blue-50/50 border-t border-blue-100">
                        <button className="flex items-center text-sm font-bold text-blue-700 hover:text-blue-800 gap-1.5 transition-colors">
                            <Download size={16} /> 전자계약서 PDF 다운로드
                        </button>
                    </div>
                </div>

                {/* Payment Alert */}
                <div className="bg-gradient-to-r from-rose-50 to-orange-50 rounded-2xl border border-rose-100 p-6 flex items-start gap-4">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center shrink-0">
                        <AlertCircle className="text-rose-600" size={20} />
                    </div>
                    <div>
                        <h3 className="text-rose-800 font-bold text-lg">이번 달 임대료 납부 안내</h3>
                        <p className="text-rose-700/80 text-sm mt-1">임대료 <span className="font-bold">{(roomInfo?.monthly_rent || 0).toLocaleString()}원</span>을 지정된 계좌로 입금해 주세요.</p>
                        <div className="mt-3 bg-white/60 p-3 rounded-lg border border-rose-200/50 inline-block">
                            <p className="text-sm font-medium text-neutral-600">입금 계좌: <span className="font-bold text-neutral-900">신한은행 110-123-456789 (예금주: 대우빌딩)</span></p>
                        </div>
                    </div>
                </div>

                {/* Payment History */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="p-6 border-b border-neutral-100">
                        <h2 className="font-bold text-lg text-neutral-900 flex items-center gap-2">
                            <CreditCard className="text-emerald-600" size={20} /> 최근 납부 내역
                        </h2>
                    </div>
                    <div className="divide-y divide-neutral-100">
                        {payments.length === 0 ? (
                            <div className="p-8 text-center text-neutral-500 text-sm">최근 납부 내역이 없습니다.</div>
                        ) : payments.map((p, i) => (
                            <div key={i} className="p-4 sm:px-6 flex items-center justify-between hover:bg-neutral-50 transition-colors">
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                                    <span className="font-bold text-neutral-900 min-w-24">{p.month}</span>
                                    <span className="text-sm text-neutral-500">{p.paid_at ? new Date(p.paid_at).toLocaleDateString() : '-'} 결제완료</span>
                                </div>
                                <div className="flex items-center gap-3">
                                    <span className="font-bold text-neutral-900">{p.amount.toLocaleString()}원</span>
                                    <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-bold rounded-md">수납완료</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

            </main>
        </div>
    );
}
