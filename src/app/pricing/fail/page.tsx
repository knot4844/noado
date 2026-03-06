"use client";

import React, { Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertTriangle } from "lucide-react";

function FailContent() {
    const searchParams = useSearchParams();
    const router = useRouter();

    const message = searchParams.get("message") || "결제가 취소되었거나 오류가 발생했습니다.";
    const code = searchParams.get("code") || "UNKNOWN_ERROR";

    return (
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 text-center animate-in zoom-in-95 duration-500">
            <div className="w-16 h-16 bg-rose-100 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertTriangle size={32} />
            </div>

            <h2 className="text-2xl font-bold text-neutral-900 mb-2">결제 실패</h2>
            <p className="text-neutral-500 mb-6">{message}</p>

            <div className="bg-neutral-50 rounded-xl p-4 text-left text-sm text-neutral-500 mb-8 border border-neutral-100">
                <strong>에러 코드:</strong> {code}
            </div>

            <button
                onClick={() => router.push('/pricing')}
                className="w-full py-4 bg-neutral-900 hover:bg-black text-white font-bold rounded-xl transition-colors"
            >
                이전 페이지로 돌아가기
            </button>
        </div>
    );
}

export default function TossFailPage() {
    return (
        <div className="min-h-screen bg-neutral-50 flex flex-col items-center justify-center p-4">
            <Suspense fallback={<div>Loading...</div>}>
                <FailContent />
            </Suspense>
        </div>
    );
}
