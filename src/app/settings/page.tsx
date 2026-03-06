"use client";

import React, { useState, useEffect } from "react";
import { Copy, Save, AlertCircle, Plus, Trash2, Loader2, Building2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/components/providers/AuthProvider";
import { useBusiness } from "@/components/providers/BusinessProvider";

export default function SettingsPage() {
    const { user } = useAuth();
    const { allBusinesses, setAllBusinesses, setRooms } = useBusiness();
    const isDemoUser = user?.id === 'demo-user-123';

    const [slackWebhook, setSlackWebhook] = useState("");
    const [isSaved, setIsSaved] = useState(false);
    const [notification, setNotification] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

    // 사업장 추가 폼
    const [showAddBiz, setShowAddBiz] = useState(false);
    const [bizForm, setBizForm] = useState({ name: '', address: '', ownerName: '' });
    const [addingBiz, setAddingBiz] = useState(false);
    const [businesses, setBusinesses] = useState(allBusinesses);

    useEffect(() => { setBusinesses(allBusinesses); }, [allBusinesses]);

    useEffect(() => {
        const stored = localStorage.getItem("noado_slack_webhook");
        if (stored) setSlackWebhook(stored);
    }, []);

    const showNotif = (type: 'success' | 'error', text: string) => {
        setNotification({ type, text });
        setTimeout(() => setNotification(null), 3000);
    };

    const handleSave = () => {
        localStorage.setItem("noado_slack_webhook", slackWebhook);
        setIsSaved(true);
        setTimeout(() => setIsSaved(false), 2000);
    };

    const handleAddBusiness = async () => {
        if (!bizForm.name) return showNotif('error', '사업장명을 입력해주세요.');
        setAddingBiz(true);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/businesses', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` },
                body: JSON.stringify(bizForm),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            const newBiz = { id: data.business.id, name: bizForm.name, ownerName: bizForm.ownerName, address: bizForm.address };
            setBusinesses(prev => [...prev, newBiz]);
            setAllBusinesses(prev => [...prev, newBiz]);
            setShowAddBiz(false);
            setBizForm({ name: '', address: '', ownerName: '' });
            showNotif('success', `"${bizForm.name}" 사업장이 추가되었습니다.`);
        } catch (e: any) {
            showNotif('error', e.message);
        } finally {
            setAddingBiz(false);
        }
    };

    const handleDeleteBusiness = async (id: string, name: string) => {
        if (!confirm(`"${name}" 사업장을 삭제하시겠습니까?\n소속된 모든 호실 데이터도 함께 삭제됩니다.`)) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            const res = await fetch('/api/businesses', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${session!.access_token}` },
                body: JSON.stringify({ id }),
            });
            if (!res.ok) throw new Error((await res.json()).error);
            setBusinesses(prev => prev.filter(b => b.id !== id));
            setAllBusinesses(prev => prev.filter(b => b.id !== id));
            setRooms(prev => prev.filter(r => r.businessId !== id));
            showNotif('success', `"${name}" 사업장이 삭제되었습니다.`);
        } catch (e: any) {
            showNotif('error', e.message);
        }
    };

    const inputClass = "w-full px-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500";

    return (
        <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
            {notification && (
                <div className={`fixed top-6 right-6 z-50 px-5 py-3 rounded-xl shadow-lg text-sm font-bold animate-in slide-in-from-top-2 ${notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {notification.text}
                </div>
            )}

            <header className="mb-8 border-b border-neutral-200 pb-4">
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">환경 설정</h1>
                <p className="text-neutral-500 mt-1">사업장 정보 및 연동 설정을 관리합니다.</p>
            </header>

            <div className="space-y-6">
                {/* 사업장 관리 (실제 사용자만) */}
                {!isDemoUser && (
                    <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                        <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50 flex justify-between items-center">
                            <div>
                                <h2 className="text-lg font-bold text-neutral-900">사업장 관리</h2>
                                <p className="text-xs text-neutral-500 mt-0.5">임대 건물/사업장 단위로 호실을 관리합니다.</p>
                            </div>
                            <button
                                onClick={() => setShowAddBiz(!showAddBiz)}
                                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-bold hover:bg-blue-700 transition-colors"
                            >
                                <Plus size={16} /> 사업장 추가
                            </button>
                        </div>

                        {showAddBiz && (
                            <div className="px-6 py-4 bg-blue-50/50 border-b border-blue-100">
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-600 mb-1">사업장명 *</label>
                                        <input className={inputClass} placeholder="대우빌딩" value={bizForm.name} onChange={e => setBizForm({ ...bizForm, name: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-600 mb-1">대표자명</label>
                                        <input className={inputClass} placeholder="홍길동" value={bizForm.ownerName} onChange={e => setBizForm({ ...bizForm, ownerName: e.target.value })} />
                                    </div>
                                    <div>
                                        <label className="block text-xs font-semibold text-neutral-600 mb-1">주소</label>
                                        <input className={inputClass} placeholder="서울시 강남구..." value={bizForm.address} onChange={e => setBizForm({ ...bizForm, address: e.target.value })} />
                                    </div>
                                </div>
                                <div className="flex gap-2 mt-3">
                                    <button onClick={() => setShowAddBiz(false)} className="px-4 py-2 border border-neutral-200 rounded-lg text-sm font-bold text-neutral-600 hover:bg-neutral-50">취소</button>
                                    <button onClick={handleAddBusiness} disabled={addingBiz} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2">
                                        {addingBiz ? <Loader2 size={14} className="animate-spin" /> : <Plus size={14} />}
                                        추가
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="divide-y divide-neutral-100">
                            {businesses.length === 0 ? (
                                <div className="px-6 py-8 text-center text-neutral-400">
                                    <Building2 size={32} className="mx-auto mb-2 opacity-40" />
                                    <p className="text-sm font-medium">아직 등록된 사업장이 없습니다.</p>
                                    <p className="text-xs mt-1">위에서 사업장을 추가해보세요.</p>
                                </div>
                            ) : (
                                businesses.map(biz => (
                                    <div key={biz.id} className="px-6 py-4 flex items-center justify-between group">
                                        <div>
                                            <p className="font-bold text-neutral-900">{biz.name}</p>
                                            <p className="text-xs text-neutral-500 mt-0.5">{biz.address || '주소 미입력'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeleteBusiness(biz.id, biz.name)}
                                            className="p-2 text-neutral-300 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                            title="사업장 삭제"
                                        >
                                            <Trash2 size={16} />
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </section>
                )}

                {/* 알림 설정 */}
                <section className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="px-6 py-4 border-b border-neutral-100 bg-neutral-50/50">
                        <h2 className="text-lg font-bold text-neutral-900">알림 연동</h2>
                    </div>
                    <div className="p-6 space-y-4">
                        <div>
                            <label className="block text-sm font-medium text-neutral-700 mb-1">Slack Webhook URL</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    className={inputClass}
                                    placeholder="https://hooks.slack.com/services/..."
                                    value={slackWebhook}
                                    onChange={e => setSlackWebhook(e.target.value)}
                                />
                                <button
                                    onClick={() => { navigator.clipboard.writeText(slackWebhook); }}
                                    className="p-2 bg-neutral-100 rounded-lg hover:bg-neutral-200 transition-colors"
                                    title="복사"
                                >
                                    <Copy size={18} className="text-neutral-600" />
                                </button>
                            </div>
                        </div>
                        <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
                            <AlertCircle size={18} className="text-amber-600 shrink-0 mt-0.5" />
                            <p className="text-sm text-amber-800">Slack 채널에 Incoming Webhook을 설치하고 URL을 입력하면 알림이 자동 발송됩니다.</p>
                        </div>
                        <button
                            onClick={handleSave}
                            className={`flex items-center gap-2 px-5 py-2 rounded-lg text-sm font-bold transition-all ${isSaved ? 'bg-emerald-600 text-white' : 'bg-neutral-900 text-white hover:bg-neutral-700'}`}
                        >
                            <Save size={16} />
                            {isSaved ? '저장완료!' : '저장'}
                        </button>
                    </div>
                </section>
            </div>
        </div>
    );
}
