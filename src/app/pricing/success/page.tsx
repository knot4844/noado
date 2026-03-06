"use client";

import React, { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { CheckCircle2, ArrowRight } from "lucide-react";

function SuccessContent() {
    const searchParams = useSearchParams();
    const router = useRouter();
    const [status, setStatus] = useState("loading");

    const paymentKey = searchParams.get("paymentKey");
    const orderId = searchParams.get("orderId");
    const amount = searchParams.get("amount");

    useEffect(() => {
        // In a real application, we would send these parameters to our backend server
        // to call the Toss Payments Confirm API and verify the payment.
        // For this demo, we will simulate a successful confirmation.
        if (paymentKey && orderId && amount) {
            setTimeout(() => {
                setStatus("success");
            }, 1500);
        } else {
            setStatus("error");
        }
    }, [paymentKey, orderId, amount]);

    return (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-500">
            {status === "loading" ? (
                <>
                    <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
                    <h2 className="text-2xl font-bold text-neutral-900 mb-2">결제 승인 중...</h2>
                    <p className="text-neutral-500">토스페이먼츠 서버와 통신하고 있습니다.</p>
                </>
            ) : status === "success" ? (
                <>
                    <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle2 size={40} />
                    </div>
                    <h2 className="text-2xl font-bold text-neutral-900 mb-2">결제가 완료되었습니다!</h2>
                    <p className="text-neutral-500 mb-8">
                        이제 Pro 요금제의 모든 기능을 사용할 수 있습니다.<br />
                        냅둬와 함께 비즈니스를 무인화하세요.
                    </p>

                    <div className="bg-neutral-50 rounded-xl p-4 text-left space-y-2 mb-8 border border-neutral-100">
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-500">결제 금액</span>
                            <span className="font-bold text-neutral-900">{Number(amount).toLocaleString()}원</span>
                        </div>
                        <div className="flex justify-between text-sm">
                            <span className="text-neutral-500">주문 번호</span>
                            <span className="font-bold text-neutral-900">{orderId}</span>
                        </div>
                    </div>

                    <button
                        onClick={() => router.push('/')}
                        className="w-full py-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl transition-colors flex justify-center items-center gap-2 group"
                    >
                        대시보드로 돌아가기
                        <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                    </button>
                </>
            ) : (
                <>
                    <h2 className="text-2xl font-bold text-rose-600 mb-2">잘못된 접근입니다.</h2>
                    <p className="text-neutral-500 mb-8">필수 결제 파라미터가 누락되었습니다.</p>
                    <button
                        onClick={() => router.push('/pricing')}
                        className="w-full py-4 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl transition-colors"
                    >
                        요금제 페이지로 돌아가기
                    </button>
                </>
            )}
        </div>
    );
}

export default function TossSuccessPage() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <SuccessContent />
            </Suspense>
        </div>
    );
}
