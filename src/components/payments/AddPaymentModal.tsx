"use client";

import { useState } from "react";
import { X, Loader2, AlertTriangle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { Payment } from "@/lib/data";

interface AddPaymentModalProps {
    onClose: () => void;
}

export function AddPaymentModal({ onClose }: AddPaymentModalProps) {
    const { allBusinesses, getRoomsByBusiness, addPayment, selectedBusinessId } = useBusiness();
    const { user } = useAuth();
    const isDemoUser = user?.id === 'demo-user-123';

    const [form, setForm] = useState({
        businessId: selectedBusinessId === "ALL" ? (allBusinesses[0]?.id || "") : selectedBusinessId,
        roomId: "",
        tenantName: "",
        amount: "",
        paidAt: new Date().toISOString().split("T")[0],
        month: new Date().toISOString().slice(0, 7), // e.g. 2026-03
        status: "PAID" as "PAID" | "UNPAID",
        note: "",
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const rooms = getRoomsByBusiness(form.businessId).filter(r => r.status !== "VACANT");

    const handleRoomChange = (roomId: string) => {
        const room = rooms.find(r => r.id === roomId);
        setForm(prev => ({
            ...prev,
            roomId,
            tenantName: room?.tenant?.name || prev.tenantName,
            amount: room?.paymentInfo?.monthlyRent ? String(room.paymentInfo.monthlyRent) : prev.amount,
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        if (isDemoUser) {
            setError("데모 모드에서는 수납 등록이 불가합니다. 실제 계정으로 로그인하세요.");
            return;
        }
        if (!form.businessId || !form.amount || !form.month) {
            setError("필수 항목을 모두 입력해주세요.");
            return;
        }
        setIsSubmitting(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error("로그인이 필요합니다.");

            const res = await fetch("/api/payments", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    businessId: form.businessId,
                    roomId: form.roomId || null,
                    tenantName: form.tenantName,
                    amount: Number(form.amount),
                    paidAt: form.paidAt,
                    month: form.month,
                    status: form.status,
                    note: form.note || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || "수납 등록 실패");

            // context 즉시 반영
            const newPayment: Payment = {
                id: data.payment.id,
                businessId: data.payment.business_id,
                roomId: data.payment.room_id,
                tenantName: data.payment.tenant_name,
                amount: data.payment.amount,
                paidAt: data.payment.paid_at,
                month: data.payment.month,
                status: data.payment.status,
                note: data.payment.note,
            };
            addPayment(newPayment);
            onClose();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : "오류가 발생했습니다.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6">
                <div className="flex items-center justify-between mb-5">
                    <h2 className="text-lg font-bold text-neutral-900">수납 등록</h2>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {/* 사업장 선택 */}
                    {allBusinesses.length > 1 && (
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">사업장 *</label>
                            <select
                                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                value={form.businessId}
                                onChange={e => setForm({ ...form, businessId: e.target.value, roomId: "", tenantName: "" })}
                            >
                                {allBusinesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            </select>
                        </div>
                    )}

                    {/* 호실 선택 */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5">호실</label>
                        <select
                            className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                            value={form.roomId}
                            onChange={e => handleRoomChange(e.target.value)}
                        >
                            <option value="">호실 선택 (선택사항)</option>
                            {rooms.map(r => (
                                <option key={r.id} value={r.id}>{r.name} — {r.tenant?.name}</option>
                            ))}
                        </select>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                        {/* 임차인명 */}
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">임차인명 *</label>
                            <input
                                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                placeholder="홍길동"
                                value={form.tenantName}
                                onChange={e => setForm({ ...form, tenantName: e.target.value })}
                                required
                            />
                        </div>

                        {/* 금액 */}
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">금액 (원) *</label>
                            <input
                                type="number"
                                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                placeholder="500000"
                                value={form.amount}
                                onChange={e => setForm({ ...form, amount: e.target.value })}
                                required
                            />
                        </div>

                        {/* 대상 월 */}
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">대상 월 *</label>
                            <input
                                type="month"
                                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                value={form.month}
                                onChange={e => setForm({ ...form, month: e.target.value })}
                                required
                            />
                        </div>

                        {/* 납부일 */}
                        <div>
                            <label className="block text-xs font-semibold text-neutral-600 mb-1.5">납부일</label>
                            <input
                                type="date"
                                className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                                value={form.paidAt}
                                onChange={e => setForm({ ...form, paidAt: e.target.value })}
                            />
                        </div>
                    </div>

                    {/* 상태 */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5">상태</label>
                        <div className="flex gap-2">
                            {(["PAID", "UNPAID"] as const).map(s => (
                                <button
                                    key={s}
                                    type="button"
                                    onClick={() => setForm({ ...form, status: s })}
                                    className={`flex-1 py-2 rounded-lg text-sm font-bold transition-all ${form.status === s
                                        ? s === "PAID" ? "bg-emerald-600 text-white" : "bg-rose-600 text-white"
                                        : "bg-neutral-100 text-neutral-500 hover:bg-neutral-200"
                                        }`}
                                >
                                    {s === "PAID" ? "✅ 수납완료" : "❌ 미납"}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* 메모 */}
                    <div>
                        <label className="block text-xs font-semibold text-neutral-600 mb-1.5">메모</label>
                        <input
                            className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500"
                            placeholder="예: 이체 확인, 카드 결제 등"
                            value={form.note}
                            onChange={e => setForm({ ...form, note: e.target.value })}
                        />
                    </div>

                    {isDemoUser && (
                        <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800">
                            <AlertTriangle size={15} className="flex-shrink-0" />
                            데모 모드 — 실제 계정으로 로그인 후 사용 가능합니다.
                        </div>
                    )}
                    {error && (
                        <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 rounded-xl text-sm text-rose-700">
                            <AlertTriangle size={15} className="flex-shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="flex gap-3 pt-1">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
                        >
                            취소
                        </button>
                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            {isSubmitting ? <><Loader2 size={16} className="animate-spin" /> 등록 중...</> : "수납 등록"}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
