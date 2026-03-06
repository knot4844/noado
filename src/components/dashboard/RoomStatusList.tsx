"use client";

import React, { useState } from "react";
import { Plus, Bell, X, Loader2 } from "lucide-react";
import Link from "next/link";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { useAuth } from "@/components/providers/AuthProvider";
import { supabase } from "@/lib/supabase";
import { Room } from "@/lib/data";

export function RoomStatusList() {
    const { selectedBusinessId, getRoomsByBusiness, setRooms, rooms: allRooms, allBusinesses } = useBusiness();
    const { user } = useAuth();
    const rooms = getRoomsByBusiness(selectedBusinessId);
    const isDemoUser = user?.id === 'demo-user-123';

    const [showModal, setShowModal] = useState(false);
    const [form, setForm] = useState({ name: '', tenantName: '', tenantContact: '', monthlyRent: 0, businessId: '' });
    const [saving, setSaving] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);

    const showNotif = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3000);
    };

    const handleAdd = async () => {
        const bizId = form.businessId || allBusinesses[0]?.id;
        if (!bizId) return showNotif('사업장을 먼저 추가해주세요.');
        if (!form.name) return showNotif('호실명을 입력해주세요.');
        setSaving(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/rooms', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` },
                body: JSON.stringify({ ...form, businessId: bizId, status: form.tenantName ? 'PAID' : 'VACANT' }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const newRoom: Room = {
                id: data.room.id, businessId: bizId, name: form.name,
                status: form.tenantName ? 'PAID' : 'VACANT',
                autoNotify: true, unpaidMonths: 0, unpaidAmount: 0,
                leaseStart: '', leaseEnd: '',
                paymentInfo: { monthlyRent: form.monthlyRent, deposit: 0, dueDate: '매월 25일', isVATIncluded: false },
                tenant: form.tenantName ? { id: data.room.id, name: form.tenantName, contact: form.tenantContact } : null
            };
            setRooms(prev => [...prev, newRoom]);
            setShowModal(false);
            setForm({ name: '', tenantName: '', tenantContact: '', monthlyRent: 0, businessId: '' });
            showNotif(`${form.name} 호실이 추가되었습니다!`);
        } catch (e: any) {
            showNotif(e.message);
        } finally {
            setSaving(false);
        }
    };

    const toggleAutoNotify = (e: React.MouseEvent, id: string) => {
        e.stopPropagation();
        setRooms(allRooms.map(room =>
            room.id === id ? { ...room, autoNotify: !room.autoNotify } : room
        ));
    };

    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100">
            {/* 토스트 알림 */}
            {notification && (
                <div className="fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold bg-emerald-600 text-white animate-in slide-in-from-top-2">
                    {notification}
                </div>
            )}

            {/* 호실 추가 모달 */}
            {showModal && (
                <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
                        <div className="flex items-center justify-between">
                            <h2 className="text-lg font-bold">새 호실 추가</h2>
                            <button onClick={() => setShowModal(false)} className="p-2 hover:bg-neutral-100 rounded-lg"><X size={18} /></button>
                        </div>
                        {allBusinesses.length > 1 && (
                            <div>
                                <label className="block text-xs font-semibold text-neutral-600 mb-1">사업장</label>
                                <select className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none" value={form.businessId} onChange={e => setForm({ ...form, businessId: e.target.value })}>
                                    {allBusinesses.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                </select>
                            </div>
                        )}
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="block text-xs font-semibold text-neutral-600 mb-1">호실명 *</label>
                                <input className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="101호" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-600 mb-1">월세 (원)</label>
                                <input type="number" className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500" value={form.monthlyRent} onChange={e => setForm({ ...form, monthlyRent: Number(e.target.value) })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-600 mb-1">임차인명</label>
                                <input className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="홍길동" value={form.tenantName} onChange={e => setForm({ ...form, tenantName: e.target.value })} />
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-neutral-600 mb-1">연락처</label>
                                <input className="w-full px-3 py-2.5 bg-neutral-50 border border-neutral-200 rounded-lg text-sm outline-none focus:border-blue-500" placeholder="010-0000-0000" value={form.tenantContact} onChange={e => setForm({ ...form, tenantContact: e.target.value })} />
                            </div>
                        </div>
                        <div className="flex gap-3 pt-1">
                            <button onClick={() => setShowModal(false)} className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-50">취소</button>
                            <button onClick={handleAdd} disabled={saving} className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50">
                                {saving ? <Loader2 size={16} className="animate-spin mx-auto" /> : '추가하기'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            <div className="flex justify-between items-center mb-6">
                <h2 className="text-lg font-bold text-neutral-900">전체 호실 현황 ({rooms.length}개)</h2>
                <div className="hidden sm:flex gap-4 text-sm">
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-emerald-500"></span><span className="text-neutral-600">납부완료</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-rose-500"></span><span className="text-neutral-600">미납</span></div>
                    <div className="flex items-center gap-1.5"><span className="w-3 h-3 rounded-full bg-white border border-neutral-300"></span><span className="text-neutral-600">공실</span></div>
                </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-4">
                {rooms.map((room) => {
                    const isPaid = room.status === "PAID";
                    const isUnpaid = room.status === "UNPAID";
                    const isVacant = room.status === "VACANT";
                    return (
                        <Link
                            key={room.id}
                            href={`/rooms/${room.id}`}
                            className={`relative p-4 rounded-xl border flex flex-col items-center justify-center text-center transition-all cursor-pointer hover:-translate-y-0.5 hover:shadow-md ${isPaid ? "bg-emerald-50/30 border-emerald-200 hover:border-emerald-400" :
                                isUnpaid ? "bg-rose-50 border-rose-200 hover:border-rose-400" :
                                    "bg-white border-neutral-200 hover:border-neutral-400"
                                }`}
                        >
                            {!isVacant && (
                                <button
                                    onClick={(e) => { e.preventDefault(); toggleAutoNotify(e, room.id); }}
                                    className={`absolute top-2 right-2 p-1.5 rounded-full transition-colors ${room.autoNotify ? "text-blue-600 bg-blue-100" : "text-neutral-300 hover:bg-neutral-100"}`}
                                    title="자동 알림톡 발송"
                                >
                                    <Bell size={12} fill={room.autoNotify ? "currentColor" : "none"} />
                                </button>
                            )}
                            <span className={`font-bold mb-1 ${isUnpaid ? "text-rose-700" : isPaid ? "text-emerald-800" : "text-neutral-900"}`}>{room.name}</span>
                            {!isVacant ? (
                                <>
                                    <span className={`text-xs font-medium ${isUnpaid ? "text-rose-600" : "text-emerald-700"}`}>{room.tenant?.name}</span>
                                    <span className={`text-[10px] mt-1 ${isUnpaid ? "text-rose-500 font-bold" : "text-emerald-600"}`}>{isUnpaid ? "미납 발생" : room.paymentInfo?.dueDate}</span>
                                </>
                            ) : (
                                <span className="text-xs text-neutral-400 font-medium py-1">공실</span>
                            )}
                        </Link>
                    );
                })}

                {/* 호실 추가 버튼 */}
                <button
                    onClick={() => isDemoUser
                        ? alert('실제 계정으로 로그인 후 호실을 추가할 수 있습니다.')
                        : setShowModal(true)
                    }
                    className="p-4 rounded-xl border-2 border-dashed border-neutral-200 flex flex-col items-center justify-center text-center transition-all hover:bg-neutral-50 hover:border-blue-300 group min-h-[100px]"
                >
                    <div className="w-8 h-8 rounded-full bg-neutral-100 text-neutral-400 flex items-center justify-center group-hover:bg-blue-50 group-hover:text-blue-600 mb-2 transition-colors">
                        <Plus size={16} />
                    </div>
                    <span className="text-xs font-bold text-neutral-500 group-hover:text-blue-700 transition-colors">
                        호실 추가
                    </span>
                </button>
            </div>
        </div>
    );
}
