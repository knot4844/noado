"use client";

import React, { useState } from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { FileText, Send, CheckCircle2 } from "lucide-react";
import * as XLSX from "xlsx";

export default function InvoicesPage() {
    const { selectedBusinessId, currentBusiness, getRoomsByBusiness } = useBusiness();

    const rooms = getRoomsByBusiness(selectedBusinessId).filter(r => r.status !== "VACANT");

    const [selectedRooms, setSelectedRooms] = useState<Set<string>>(new Set(rooms.map(r => r.id)));
    const [isComplete, setIsComplete] = useState(false);

    const toggleSelectAll = () => {
        if (selectedRooms.size === rooms.length) {
            setSelectedRooms(new Set());
        } else {
            setSelectedRooms(new Set(rooms.map(r => r.id)));
        }
    };

    const toggleSelectRoom = (id: string) => {
        const newSet = new Set(selectedRooms);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedRooms(newSet);
    };

    const handleIssueInvoices = () => {
        const hometaxData = rooms
            .filter(r => selectedRooms.has(r.id))
            .map((r) => {
                const rent = r.paymentInfo?.monthlyRent || 0;
                const supplyValue = Math.floor(rent / 1.1);
                const vat = rent - supplyValue;
                const today = new Date();
                const writeDate = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, '0')}15`;
                return {
                    "전자세금계산서 종류": "01",
                    "작성일자": writeDate,
                    "공급자 사업자등록번호": currentBusiness?.registrationNumber || "",
                    "공급자 상호": currentBusiness?.name || "",
                    "공급자 성명": currentBusiness?.ownerName || "",
                    "받는자 상호": r.tenant?.companyName || r.tenant?.name || "",
                    "받는자 성명": r.tenant?.name || "",
                    "공급가액": supplyValue,
                    "세액": vat,
                    "비고": `${r.name} 임대료`,
                };
            });
        const worksheet = XLSX.utils.json_to_sheet(hometaxData);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "일괄발행내역");
        XLSX.writeFile(workbook, `홈택스_일괄발행_${new Date().toISOString().slice(0, 10)}.xlsx`);
        setIsComplete(true);
    };

    if (isComplete) {
        return (
            <div className="p-4 md:p-8 max-w-4xl mx-auto flex flex-col items-center justify-center min-h-[60vh] text-center animate-in zoom-in duration-500">
                <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mb-6">
                    <CheckCircle2 size={40} />
                </div>
                <h1 className="text-3xl font-bold text-neutral-900 mb-2">홈택스 엑셀 다운로드 완료!</h1>
                <p className="text-neutral-500 mb-8 max-w-md">
                    {selectedRooms.size}건의 세금계산서 데이터가 엑셀 파일로 다운로드되었습니다. 홈택스에서 일괄 업로드하여 발행하세요.
                </p>
                <button
                    onClick={() => {
                        setIsComplete(false);
                        setSelectedRooms(new Set());
                    }}
                    className="bg-neutral-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-neutral-800 transition-colors"
                >
                    돌아가기
                </button>
            </div>
        );
    }

    const totalCalculatedAmount = rooms
        .filter(r => selectedRooms.has(r.id))
        .reduce((sum, r) => sum + (r.paymentInfo?.monthlyRent || 0), 0);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <header className="mb-6">
                <h1 className="text-2xl font-bold text-neutral-900 tracking-tight">원클릭 전자세금계산서 발행</h1>
                <p className="text-neutral-500 mt-1">
                    {currentBusiness ? currentBusiness.name : "전체 사업장"}의 수납 완료 건에 대해 세금계산서를 일괄 발행합니다.
                </p>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

                {/* Main Table */}
                <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-neutral-200 overflow-hidden flex flex-col h-full">
                    <div className="p-4 border-b border-neutral-200 flex justify-between items-center bg-neutral-50">
                        <span className="font-bold text-neutral-700">발행 대상 목록 ({rooms.length}건)</span>
                    </div>
                    <div className="overflow-x-auto flex-1">
                        <table className="w-full text-left text-sm">
                            <thead className="border-b border-neutral-100 text-neutral-500 font-medium">
                                <tr>
                                    <th className="p-3 w-12 text-center">
                                        <input
                                            type="checkbox"
                                            className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                            checked={rooms.length > 0 && selectedRooms.size === rooms.length}
                                            onChange={toggleSelectAll}
                                        />
                                    </th>
                                    <th className="p-3">임차인 (상호)</th>
                                    <th className="p-3">호실</th>
                                    <th className="p-3 text-right">공급가액</th>
                                    <th className="p-3 text-right">부가세</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-neutral-50">
                                {rooms.map(room => {
                                    const rent = room.paymentInfo?.monthlyRent || 0;
                                    const supplyValue = Math.floor(rent / 1.1); // Simplified split
                                    const vat = rent - supplyValue;

                                    return (
                                        <tr key={room.id} className="hover:bg-neutral-50 transition-colors">
                                            <td className="p-3 text-center">
                                                <input
                                                    type="checkbox"
                                                    className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                                                    checked={selectedRooms.has(room.id)}
                                                    onChange={() => toggleSelectRoom(room.id)}
                                                />
                                            </td>
                                            <td className="p-3 font-medium text-neutral-900">{room.tenant?.name}</td>
                                            <td className="p-3 text-neutral-500">{room.name}</td>
                                            <td className="p-3 text-right text-neutral-700">₩ {supplyValue.toLocaleString()}</td>
                                            <td className="p-3 text-right text-neutral-500">₩ {vat.toLocaleString()}</td>
                                        </tr>
                                    );
                                })}
                                {rooms.length === 0 && (
                                    <tr>
                                        <td colSpan={5} className="p-8 text-center text-neutral-500">발행 대상 내역이 없습니다.</td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* Summary Box */}
                <div className="lg:col-span-1">
                    <div className="bg-gradient-to-br from-indigo-900 to-blue-900 rounded-xl shadow-md border border-indigo-800 p-6 text-white sticky top-24">
                        <div className="mb-8 border-b border-indigo-700/50 pb-6">
                            <h3 className="text-indigo-200 font-medium mb-1">발행 예정 정보 요약</h3>
                            <div className="flex items-baseline gap-2 mt-4">
                                <span className="text-4xl font-bold tracking-tight text-white">
                                    {selectedRooms.size}
                                </span>
                                <span className="text-indigo-300 font-medium">건 선택됨</span>
                            </div>
                        </div>

                        <div className="space-y-3 mb-8">
                            <div className="flex justify-between text-indigo-100 text-sm">
                                <span>합계 공급가액</span>
                                <span>₩ {Math.floor(totalCalculatedAmount / 1.1).toLocaleString()}</span>
                            </div>
                            <div className="flex justify-between text-indigo-100 text-sm">
                                <span>합계 부가세</span>
                                <span>₩ {(totalCalculatedAmount - Math.floor(totalCalculatedAmount / 1.1)).toLocaleString()}</span>
                            </div>
                            <div className="h-px bg-indigo-700/50 my-4"></div>
                            <div className="flex flex-col gap-1">
                                <span className="text-indigo-200 text-sm">총 발행 예정 금액</span>
                                <span className="text-3xl font-bold text-white tracking-tight">₩ {totalCalculatedAmount.toLocaleString()}</span>
                            </div>
                        </div>

                        <button
                            onClick={handleIssueInvoices}
                            disabled={selectedRooms.size === 0}
                            className={`w-full flex items-center justify-center gap-2 py-4 rounded-xl font-bold transition-all shadow-lg text-lg ${selectedRooms.size > 0
                                ? "bg-white text-indigo-900 hover:bg-neutral-50 hover:shadow-xl hover:-translate-y-0.5"
                                : "bg-indigo-800 text-indigo-400 cursor-not-allowed"
                                }`}
                        >
                            <Send size={20} />
                            {selectedRooms.size}건 홈택스 엑셀 다운로드
                        </button>

                        <div className="mt-4 flex items-center justify-center gap-1.5 text-xs text-indigo-300">
                            <FileText size={14} />
                            <span>홈택스 일괄등록 표준 포맷 (엑셀)</span>
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
}
