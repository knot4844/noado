"use client";

import React, { useState, useEffect } from 'react';
import { Building2, Users, Home, TrendingUp, ShieldCheck, Loader2, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { useRouter } from 'next/navigation';

export default function MasterAdminPage() {
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const router = useRouter();

    const [stats, setStats] = useState<any>(null);
    const [recentBusinesses, setRecentBusinesses] = useState<any[]>([]);

    useEffect(() => {
        const checkAuthAndFetchStats = async () => {
            try {
                const { data: { session }, error: sessionError } = await supabase.auth.getSession();

                if (sessionError || !session) {
                    router.push('/login');
                    return;
                }

                const res = await fetch('/api/admin/stats', {
                    headers: {
                        'Authorization': `Bearer ${session.access_token}`
                    }
                });
                const data = await res.json();

                if (!res.ok) {
                    throw new Error(data.error || '마스터 관리자 권한이 없습니다.');
                }

                setStats(data.stats);
                setRecentBusinesses(data.recentBusinesses);
                setIsAuthenticated(true);
                setIsLoading(false);
            } catch (err: any) {
                setError(err.message);
                setIsLoading(false);
            }
        };

        checkAuthAndFetchStats();
    }, [router]);

    if (isLoading) {
        return (
            <div className="min-h-screen bg-neutral-900 flex flex-col items-center justify-center p-4">
                <Loader2 className="animate-spin text-blue-500 mb-4" size={40} />
                <p className="text-white">마스터 권한을 확인하고 있습니다...</p>
            </div>
        );
    }

    if (error) {
        return (
            <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-4">
                <div className="max-w-md w-full bg-white rounded-2xl shadow-xl overflow-hidden p-8 text-center">
                    <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-4">
                        <ShieldCheck size={32} />
                    </div>
                    <h1 className="text-xl font-bold text-neutral-900 mb-2">접근 권한 없음</h1>
                    <p className="text-neutral-500 mb-6">{error}</p>
                    <Link href="/dashboard" className="inline-flex items-center justify-center w-full py-3 bg-neutral-900 text-white font-bold rounded-xl hover:bg-neutral-800 transition-colors">
                        대시보드로 돌아가기
                    </Link>
                </div>
            </div>
        );
    }

    if (!isAuthenticated) return null;

    return (
        <div className="min-h-screen bg-neutral-50">
            {/* Admin Header */}
            <header className="bg-neutral-900 text-white">
                <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <ShieldCheck className="text-blue-400" size={24} />
                        <h1 className="font-bold text-lg tracking-tight">noado 백오피스 (SaaS Admin)</h1>
                    </div>
                    <Link
                        href="/dashboard"
                        className="text-sm text-neutral-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        일반 대시보드 가기 <ArrowRight size={16} />
                    </Link>
                </div>
            </header>

            <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
                <div className="mb-8">
                    <h2 className="text-2xl font-bold text-neutral-900">SaaS 비즈니스 현황</h2>
                    <p className="text-neutral-500 mt-1">시스템에 가입된 모든 파트너사의 통계를 확인합니다.</p>
                </div>

                {/* KPI Cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-neutral-500">누적 가입 사업장</h3>
                            <div className="p-2 bg-blue-50 text-blue-600 rounded-lg"><Building2 size={20} /></div>
                        </div>
                        <div className="text-3xl font-bold text-neutral-900">{stats?.totalBusinesses}개</div>
                        <p className="text-sm text-emerald-600 font-medium mt-2 flex items-center gap-1">
                            <TrendingUp size={14} /> +2 이번 주
                        </p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-neutral-500">시스템 관리 호실 수</h3>
                            <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg"><Home size={20} /></div>
                        </div>
                        <div className="text-3xl font-bold text-neutral-900">{stats?.totalRooms}개</div>
                        <p className="text-sm text-neutral-500 mt-2">전체 호실 통합 데이터</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-sm font-medium text-neutral-500">등록된 총 세입자</h3>
                            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg"><Users size={20} /></div>
                        </div>
                        <div className="text-3xl font-bold text-neutral-900">{stats?.totalTenants}명</div>
                        <p className="text-sm text-neutral-500 mt-2">전체 사업장 세입자 합계</p>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-blue-200 relative overflow-hidden">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-50/50 rounded-full -translate-y-1/2 translate-x-1/3 blur-2xl"></div>
                        <div className="flex items-center justify-between mb-4 relative z-10">
                            <h3 className="text-sm font-medium text-blue-800">예상 월간 MRR (Pro 기준)</h3>
                            <div className="p-2 bg-blue-100 text-blue-600 rounded-lg"><TrendingUp size={20} /></div>
                        </div>
                        <div className="text-3xl font-bold text-blue-900 relative z-10">
                            ₩{(stats?.monthlyRecurringRevenue || 0).toLocaleString()}
                        </div>
                        <p className="text-sm text-blue-600 font-medium mt-2 relative z-10">
                            *현재 가입 사업장 전체 유료 가정
                        </p>
                    </div>
                </div>

                {/* Data Table */}
                <div className="bg-white rounded-2xl shadow-sm border border-neutral-200 overflow-hidden">
                    <div className="px-6 py-5 border-b border-neutral-200 bg-neutral-50/50">
                        <h3 className="font-bold text-neutral-900 text-lg">최근 가입한 파트너스</h3>
                    </div>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-neutral-50 text-neutral-500 border-b border-neutral-200">
                                <tr>
                                    <th className="px-6 py-4 font-medium">사업장 명 / ID</th>
                                    <th className="px-6 py-4 font-medium">관리자 (Owner ID)</th>
                                    <th className="px-6 py-4 font-medium">가입 일자</th>
                                    <th className="px-6 py-4 font-medium">플랜 권한</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-100">
                                {recentBusinesses.length > 0 ? recentBusinesses.map((b) => (
                                    <tr key={b.id} className="hover:bg-neutral-50/50 transition-colors">
                                        <td className="px-6 py-4">
                                            <div className="font-bold text-neutral-900">{b.name}</div>
                                            <div className="text-xs text-neutral-400 mt-1">{b.id}</div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="font-mono text-xs text-neutral-600 bg-neutral-100 px-2 py-1 rounded inline-block">
                                                {b.owner_id ? b.owner_id.substring(0, 8) + '...' + b.owner_id.substring(b.owner_id.length - 4) : 'Demo System'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 text-neutral-500">
                                            {new Date(b.created_at).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4">
                                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800">
                                                기본 플랜
                                            </span>
                                        </td>
                                    </tr>
                                )) : (
                                    <tr>
                                        <td colSpan={4} className="px-6 py-12 text-center text-neutral-500">
                                            조회된 파트너스 데이터가 없습니다.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            </main>
        </div>
    );
}
