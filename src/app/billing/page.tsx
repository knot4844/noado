"use client";

import React from "react";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { Calendar, CheckCircle2, AlertCircle, Play } from "lucide-react";

export default function BillingAutomationPage() {
    const { currentBusiness, getRoomsByBusiness, selectedBusinessId } = useBusiness();
    const rooms = getRoomsByBusiness(selectedBusinessId);

    return (
        <div className="p-4 md:p-8 max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
            <header className="mb-8 border-b border-neutral-200 pb-6 text-center max-w-2xl mx-auto mt-10">
                <div className="w-16 h-16 bg-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-4 rotate-3 transform">
                    <Calendar size={32} />
                </div>
                <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight mb-3">정기 청구 스케줄링</h1>
                <p className="text-neutral-500 text-lg">
                    매월 정해진 일자에 임대료와 관리비 청구서를 자동으로 생성하고 <br /> 임차인에게 안내문을 발송합니다.
                </p>
            </header>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Step 1 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 relative">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">1</div>
                    <h3 className="text-lg font-bold mb-2">계약 정보 연동</h3>
                    <p className="text-sm text-neutral-500 mb-6">등록된 임차인의 계약정보(보증금, 월세, 약정일)를 바탕으로 이번 달 청구 기준 데이터를 생성합니다.</p>
                    <div className="bg-neutral-50 rounded-lg p-4 flex items-center gap-3">
                        <CheckCircle2 className="text-emerald-500" />
                        <span className="text-sm font-bold">{rooms.length}개 호실 데이터 스캔 완료</span>
                    </div>
                </div>

                {/* Step 2 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 relative border-blue-500 ring-4 ring-blue-50">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-blue-600 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">2</div>
                    <h3 className="text-lg font-bold mb-2">추가 관리비 입력</h3>
                    <p className="text-sm text-neutral-500 mb-6">수도세, 전기세 등 호실별로 변동되는 관리비가 있다면 이번 달 청구서에 추가 기입합니다.</p>
                    <div className="space-y-2">
                        <button className="w-full text-left bg-neutral-100 hover:bg-neutral-200 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium">
                            + 공용 관리비 일괄 적용
                        </button>
                        <button className="w-full text-left bg-neutral-100 hover:bg-neutral-200 transition-colors p-3 rounded-lg text-sm text-neutral-700 font-medium flex justify-between">
                            실비 입력 대기 <span className="bg-rose-500 text-white px-2 py-0.5 rounded text-[10px]">2건</span>
                        </button>
                    </div>
                </div>

                {/* Step 3 */}
                <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-200 relative">
                    <div className="absolute -top-3 -left-3 w-8 h-8 bg-neutral-300 text-white rounded-full flex items-center justify-center font-bold border-4 border-white shadow-sm">3</div>
                    <h3 className="text-lg font-bold mb-2 text-neutral-400">청구서 자동 발송</h3>
                    <p className="text-sm text-neutral-400 mb-6">검토가 끝난 청구서를 카카오톡 알림톡이나 문자로 임차인들에게 일괄 전송합니다.</p>
                    <button disabled className="w-full bg-neutral-100 text-neutral-400 py-4 rounded-xl font-bold flex items-center justify-center gap-2">
                        <Play size={18} />
                        발송 스케줄러 시작
                    </button>
                </div>
            </div>

            <div className="bg-indigo-50 border border-indigo-100 rounded-xl p-6 flex gap-4 mt-8">
                <AlertCircle className="text-indigo-600 shrink-0" />
                <div>
                    <h4 className="font-bold text-indigo-900 mb-1">스마트 미청구 관리 시스템이 활성화되었습니다.</h4>
                    <p className="text-sm text-indigo-700 leading-relaxed">
                        혹시라도 수동으로 청구를 잊으시더라도, 납기일 기준 3일 전까지 청구서가 발행되지 않은 호실이 있다면 시스템이 대표님께 알림을 보냅니다. 누락되는 임대료 없이 꼼꼼하게 관리하세요!
                    </p>
                </div>
            </div>
        </div>
    );
}
