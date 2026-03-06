"use client";

import React, { useState, useRef, useEffect } from "react";
import { Bell, Search, User as UserIcon, Menu, LogOut, AlertTriangle, CalendarX } from "lucide-react";
import { useAuth, toggleDemoLogin } from "@/components/providers/AuthProvider";
import { useBusiness } from "@/components/providers/BusinessProvider";
import Link from "next/link";

export function Header() {
    const { user, signOut } = useAuth();
    const { currentBusiness, rooms } = useBusiness();
    const [showNotifications, setShowNotifications] = useState(false);
    const panelRef = useRef<HTMLDivElement>(null);

    // 알림 목록 계산
    const today = new Date();
    const notifications: { type: 'unpaid' | 'expiring'; title: string; desc: string; href: string }[] = [];

    // 1. 미납 임차인
    const unpaidRooms = rooms.filter(r => r.status === 'UNPAID');
    unpaidRooms.slice(0, 5).forEach(r => {
        notifications.push({
            type: 'unpaid',
            title: `${r.name} 미납`,
            desc: `${r.tenant?.name || '임차인'} · ${r.unpaidMonths || 1}개월 미납`,
            href: '/tenants',
        });
    });

    // 2. 계약 만료 임박 (30일 이내)
    rooms.filter(r => r.leaseEnd && r.status !== 'VACANT').forEach(r => {
        const end = new Date(r.leaseEnd!);
        const daysLeft = Math.ceil((end.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
        if (daysLeft >= 0 && daysLeft <= 30) {
            notifications.push({
                type: 'expiring',
                title: `${r.name} 계약만료 ${daysLeft}일 전`,
                desc: `${r.tenant?.name || '임차인'} · ${r.leaseEnd}`,
                href: '/tenants',
            });
        }
    });

    const hasNotifications = notifications.length > 0;

    // 외부 클릭 시 닫기
    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setShowNotifications(false);
            }
        };
        if (showNotifications) document.addEventListener('mousedown', handleClick);
        return () => document.removeEventListener('mousedown', handleClick);
    }, [showNotifications]);

    return (
        <header className="h-16 px-4 md:px-8 border-b border-neutral-200 bg-white flex items-center justify-between sticky top-0 z-10 w-full">
            <div className="flex items-center gap-2 md:gap-4 flex-1">
                <button className="md:hidden p-2 text-neutral-500 hover:bg-neutral-100 rounded-lg">
                    <Menu size={24} />
                </button>
                <div className="relative w-full max-w-sm hidden sm:block">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={16} />
                    <input
                        type="text"
                        placeholder="임차인, 호실, 전화번호 검색..."
                        className="w-full pl-9 pr-4 py-2 bg-neutral-100 border-transparent rounded-lg text-sm focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-200 outline-none transition-all placeholder:text-neutral-400"
                    />
                </div>
            </div>

            <div className="flex items-center gap-4">
                {/* 알림 버튼 */}
                <div className="relative" ref={panelRef}>
                    <button
                        onClick={() => setShowNotifications(v => !v)}
                        className="relative p-2 text-neutral-500 hover:bg-neutral-100 rounded-full transition-colors"
                    >
                        <Bell size={20} />
                        {hasNotifications && (
                            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white" />
                        )}
                    </button>

                    {/* 알림 드롭다운 */}
                    {showNotifications && (
                        <div className="absolute right-0 top-12 w-80 bg-white rounded-2xl shadow-xl border border-neutral-100 overflow-hidden z-50 animate-in fade-in slide-in-from-top-2 duration-200">
                            <div className="px-4 py-3 border-b border-neutral-100 flex items-center justify-between">
                                <h3 className="font-bold text-neutral-900 text-sm">알림</h3>
                                {hasNotifications && (
                                    <span className="text-xs bg-rose-100 text-rose-600 font-bold px-2 py-0.5 rounded-full">
                                        {notifications.length}건
                                    </span>
                                )}
                            </div>

                            <div className="max-h-80 overflow-y-auto divide-y divide-neutral-50">
                                {notifications.length === 0 ? (
                                    <div className="py-10 text-center text-neutral-400 text-sm">
                                        <Bell size={28} className="mx-auto mb-2 text-neutral-300" />
                                        새 알림이 없습니다
                                    </div>
                                ) : (
                                    notifications.map((n, i) => (
                                        <Link
                                            key={i}
                                            href={n.href}
                                            onClick={() => setShowNotifications(false)}
                                            className="flex items-start gap-3 px-4 py-3 hover:bg-neutral-50 transition-colors"
                                        >
                                            <div className={`mt-0.5 p-1.5 rounded-lg flex-shrink-0 ${n.type === 'unpaid' ? 'bg-rose-100 text-rose-600' : 'bg-amber-100 text-amber-600'}`}>
                                                {n.type === 'unpaid'
                                                    ? <AlertTriangle size={14} />
                                                    : <CalendarX size={14} />
                                                }
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <p className="text-sm font-semibold text-neutral-900 truncate">{n.title}</p>
                                                <p className="text-xs text-neutral-400 mt-0.5 truncate">{n.desc}</p>
                                            </div>
                                        </Link>
                                    ))
                                )}
                            </div>

                            {notifications.length > 0 && (
                                <div className="px-4 py-3 border-t border-neutral-100">
                                    <Link
                                        href="/tenants"
                                        onClick={() => setShowNotifications(false)}
                                        className="block text-center text-xs text-blue-600 font-bold hover:underline"
                                    >
                                        임차인 관리 바로가기 →
                                    </Link>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                <div className="h-6 w-px bg-neutral-200" />

                <div className="flex items-center gap-3">
                    <button className="flex items-center gap-2 hover:bg-neutral-50 px-2 py-1 rounded-lg transition-colors">
                        <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-700 flex items-center justify-center font-medium">
                            <UserIcon size={16} />
                        </div>
                        <div className="text-left hidden sm:block">
                            <p className="text-sm font-medium text-neutral-900 leading-none truncate max-w-[150px]">
                                {user?.email?.split('@')[0] || "관리자"}
                            </p>
                            <p className="text-xs text-neutral-500 mt-1 leading-none truncate max-w-[150px]">
                                {currentBusiness?.name || "noado"}
                            </p>
                        </div>
                    </button>
                    <button
                        onClick={() => {
                            if (user?.id === 'demo-user-123') {
                                toggleDemoLogin(false);
                            } else {
                                signOut();
                            }
                        }}
                        title="로그아웃"
                        className="p-2 text-neutral-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                        <LogOut size={18} />
                    </button>
                </div>
            </div>
        </header>
    );
}
