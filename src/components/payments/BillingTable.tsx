import React from "react";
import { Search, Filter, Download } from "lucide-react";

const DUMMY_BILLING = Array.from({ length: 15 }, (_, i) => ({
    id: `INV-202602-${String(i + 1).padStart(3, '0')}`,
    room: `${i + 1}호실`,
    tenant: `임차인${i + 1}`,
    amount: 350000,
    dueDate: `2026-02-${String(Math.floor(Math.random() * 28) + 1).padStart(2, '0')}`,
    status: Math.random() > 0.3 ? 'PAID' : 'UNPAID',
}));

export function BillingTable() {
    return (
        <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 overflow-hidden">
            {/* Table Toolbar */}
            <div className="p-6 border-b border-neutral-100 flex flex-col sm:flex-row justify-between items-center gap-4">
                <div className="relative w-full sm:w-80">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-400" size={18} />
                    <input
                        type="text"
                        placeholder="호실 또는 임차인명 검색..."
                        className="w-full pl-10 pr-4 py-2 bg-neutral-50 border border-neutral-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 transition-all"
                    />
                </div>
                <div className="flex gap-2 w-full sm:w-auto">
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <Filter size={16} />
                        <span>필터</span>
                    </button>
                    <button className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-4 py-2 border border-neutral-200 rounded-lg text-sm font-medium text-neutral-700 hover:bg-neutral-50 transition-colors">
                        <Download size={16} />
                        <span>엑셀 다운로드</span>
                    </button>
                </div>
            </div>

            {/* Table Data */}
            <div className="overflow-x-auto">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-neutral-50/50 text-neutral-500 font-medium">
                        <tr>
                            <th className="px-6 py-4 font-medium">청구 번호</th>
                            <th className="px-6 py-4 font-medium">호실</th>
                            <th className="px-6 py-4 font-medium">임차인</th>
                            <th className="px-6 py-4 font-medium text-right">청구 금액 (원)</th>
                            <th className="px-6 py-4 font-medium">납부 기한</th>
                            <th className="px-6 py-4 font-medium">상태</th>
                            <th className="px-6 py-4 font-medium">액션</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100">
                        {DUMMY_BILLING.map((item) => (
                            <tr key={item.id} className="hover:bg-neutral-50/50 transition-colors group">
                                <td className="px-6 py-4 text-neutral-500">{item.id}</td>
                                <td className="px-6 py-4 font-medium text-neutral-900">{item.room}</td>
                                <td className="px-6 py-4 text-neutral-600">{item.tenant}</td>
                                <td className="px-6 py-4 text-right tabular-nums font-medium text-neutral-900">
                                    {item.amount.toLocaleString()}
                                </td>
                                <td className="px-6 py-4 text-neutral-500">{item.dueDate}</td>
                                <td className="px-6 py-4">
                                    <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium border ${item.status === 'PAID'
                                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                            : 'bg-rose-50 text-rose-700 border-rose-200'
                                        }`}>
                                        {item.status === 'PAID' ? '완납' : '미납'}
                                    </span>
                                </td>
                                <td className="px-6 py-4">
                                    {item.status === 'UNPAID' && (
                                        <button className="text-blue-600 hover:text-blue-700 font-medium text-xs opacity-0 group-hover:opacity-100 transition-opacity">
                                            알림톡 발송
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
