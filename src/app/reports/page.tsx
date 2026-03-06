"use client";

import React, { useMemo } from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { BarChart3, TrendingUp, PieChart, FileSpreadsheet } from "lucide-react";
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as RechartsTooltip,
    ResponsiveContainer,
    PieChart as RechartsPieChart,
    Pie,
    Cell,
    Legend
} from 'recharts';
import * as XLSX from 'xlsx';

export default function ReportsPage() {
    const { currentBusiness, getRoomsByBusiness, allBusinesses } = useBusiness();
    const rooms = getRoomsByBusiness(currentBusiness?.id || "ALL");

    // --- Statistics Calculations ---
    const totalRooms = rooms.length;
    const vacantRooms = rooms.filter(r => r.status === "VACANT").length;
    const occupancyRate = totalRooms > 0 ? ((totalRooms - vacantRooms) / totalRooms) * 100 : 0;

    const unpaidRooms = rooms.filter(r => r.status === "UNPAID");
    const totalUnpaidAmount = unpaidRooms.reduce((sum, r) => sum + (r.unpaidAmount || 0), 0);
    const unpaidCount = unpaidRooms.length;

    // Simulate Yearly Cumulative Revenue based on monthly rent
    const monthlyExpectedRevenue = rooms
        .filter(r => r.status !== "VACANT")
        .reduce((sum, r) => sum + (r.paymentInfo?.monthlyRent || 0), 0);
    // Assume we've collected 11 months so far + some current month
    const estimatedYearlyRevenue = (monthlyExpectedRevenue * 11) - totalUnpaidAmount;

    // --- Chart 1: Monthly Revenue Trend (Mock projection based on real rent volume) ---
    const monthlyData = useMemo(() => {
        const data = [];
        const baseRev = monthlyExpectedRevenue;
        // Generate mock trend using actual base revenue
        for (let i = 1; i <= 12; i++) {
            // Apply some random fluctuation to make it look realistic (+/- 5%)
            // But if the base is 0, keep it 0
            const fluctuation = baseRev * (0.95 + (Math.random() * 0.1));
            data.push({
                name: `${i}월`,
                revenue: baseRev > 0 ? Math.floor(fluctuation) : 0,
            });
        }
        return data;
    }, [monthlyExpectedRevenue]);

    // --- Chart 2: Occupancy/Vacancy Distribution ---
    const pieData = [
        { name: '임대중 (Paid/Unpaid)', value: totalRooms - vacantRooms },
        { name: '공실 (Vacant)', value: vacantRooms },
    ];
    const COLORS = ['#2563eb', '#f1f5f9']; // Blue, Light Gray

    // --- Export to Excel ---
    const handleExportExcel = () => {
        // Prepare data
        const exportData = [
            { 항목: '총 누적 임대수익 (추정)', 금액: estimatedYearlyRevenue },
            { 항목: '총 미수 채권액', 금액: totalUnpaidAmount },
            { 항목: '미수 채권 건수', 일수_건수: unpaidCount },
            { 항목: '총 호실 수', 일수_건수: totalRooms },
            { 항목: '공실 수', 일수_건수: vacantRooms },
            { 항목: '평균 임대율', 일수_건수: `${occupancyRate.toFixed(1)}%` },
        ];

        const ws = XLSX.utils.json_to_sheet(exportData);
        // Style columns
        ws['!cols'] = [{ wch: 30 }, { wch: 20 }];
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, "재무_리포트");

        const fileName = `${currentBusiness?.name || '전체사업장'}_재무보고서.xlsx`;
        XLSX.writeFile(wb, fileName);
    };

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <header className="mb-6 flex flex-col md:flex-row md:items-end justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">보고서 및 통계</h1>
                    <p className="text-neutral-500 mt-1">
                        {currentBusiness ? currentBusiness.name : "전체 사업장"}의 매출 및 채권 현황을 한눈에 파악합니다.
                    </p>
                </div>
                <button
                    onClick={handleExportExcel}
                    className="flex items-center gap-2 px-4 py-2 bg-white border border-neutral-200 text-neutral-700 rounded-lg hover:bg-neutral-50 transition-colors shadow-sm font-medium"
                >
                    <FileSpreadsheet size={18} />
                    엑셀 다운로드
                </button>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
                {/* Summary Cards */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:-rotate-12 transition-transform duration-500">
                        <TrendingUp size={64} />
                    </div>
                    <span className="text-neutral-500 font-medium text-sm flex items-center gap-2 relative z-10">
                        <TrendingUp size={16} className="text-emerald-500" /> 누적 임대수익 (당해 추정)
                    </span>
                    <span className="text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 relative z-10">
                        ₩ {estimatedYearlyRevenue.toLocaleString()}
                    </span>
                    <span className="text-xs text-emerald-600 font-medium bg-emerald-50 w-fit px-2 py-0.5 rounded mt-1 relative z-10">+12% 전년 대비</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col gap-2 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 group-hover:rotate-12 transition-transform duration-500">
                        <BarChart3 size={64} />
                    </div>
                    <span className="text-neutral-500 font-medium text-sm flex items-center gap-2 relative z-10">
                        <BarChart3 size={16} className="text-rose-500" /> 총 미수 채권액
                    </span>
                    <span className="text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 relative z-10">
                        ₩ {totalUnpaidAmount.toLocaleString()}
                    </span>
                    <span className="text-xs text-rose-600 font-medium bg-rose-50 w-fit px-2 py-0.5 rounded mt-1 relative z-10">총 {unpaidCount}건 미수</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col gap-2 relative overflow-hidden group">
                    {/* Vacancy impact */}
                    <span className="text-neutral-500 font-medium text-sm flex items-center gap-2 relative z-10">
                        <PieChart size={16} className="text-blue-500" /> 공실률
                    </span>
                    <span className="text-2xl lg:text-3xl font-bold tracking-tight text-neutral-900 relative z-10">
                        {occupancyRate.toFixed(1)}%
                    </span>
                    <span className="text-xs text-neutral-500 font-medium bg-neutral-100 w-fit px-2 py-0.5 rounded mt-1 relative z-10">현재 {vacantRooms}개 공실</span>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-100 flex flex-col gap-2 relative overflow-hidden group justify-center items-center">
                    <div className="text-center">
                        <p className="text-neutral-500 text-sm font-medium mb-1">총 관리 호실</p>
                        <p className="text-4xl font-extrabold text-blue-600">{totalRooms}</p>
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* Recharts Bar Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-neutral-900 mb-6">월별 임대 수익 추이 ({new Date().getFullYear()}년)</h3>
                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <BarChart
                                data={monthlyData}
                                margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                                <XAxis
                                    dataKey="name"
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    dy={10}
                                />
                                <YAxis
                                    axisLine={false}
                                    tickLine={false}
                                    tick={{ fill: '#94a3b8', fontSize: 12 }}
                                    tickFormatter={(val) => `₩${(val / 10000).toLocaleString()}만`}
                                />
                                <RechartsTooltip
                                    cursor={{ fill: '#f8fafc' }}
                                    formatter={(value: number | undefined) => [`₩ ${Number(value).toLocaleString()}`, '임대수익']}
                                />
                                <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    </div>
                </div>

                {/* Recharts Pie Chart */}
                <div className="bg-white p-6 rounded-xl shadow-sm border border-neutral-200 min-h-[400px] flex flex-col">
                    <h3 className="text-lg font-bold text-neutral-900 mb-6">공실 현황 비중</h3>
                    <div className="flex-1 w-full h-[300px]">
                        <ResponsiveContainer width="100%" height="100%">
                            <RechartsPieChart>
                                <Pie
                                    data={pieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={70}
                                    outerRadius={100}
                                    paddingAngle={5}
                                    dataKey="value"
                                >
                                    {pieData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                    ))}
                                </Pie>
                                <RechartsTooltip
                                    formatter={(value: number | undefined) => [`${Number(value)}호실`, '호실 수']}
                                />
                                <Legend verticalAlign="bottom" height={36} iconType="circle" />
                            </RechartsPieChart>
                        </ResponsiveContainer>
                    </div>
                </div>
            </div>
        </div>
    );
}
