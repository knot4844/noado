"use client";

import React, { useEffect, useRef, useState } from "react";
import { loadPaymentWidget, PaymentWidgetInstance } from "@tosspayments/payment-widget-sdk";
import { X, Loader2 } from "lucide-react";
import { useAuth } from "@/components/providers/AuthProvider";

const clientKey = "test_gck_docs_Ovk5rk1EwkEbP0W43n07xlzm";

interface TossCheckoutProps {
    amount: number;
    orderName: string;
    onClose: () => void;
}

export function TossCheckout({ amount, orderName, onClose }: TossCheckoutProps) {
    const { user } = useAuth();
    const paymentWidgetRef = useRef<PaymentWidgetInstance | null>(null);
    const paymentMethodsWidgetRef = useRef<ReturnType<PaymentWidgetInstance["renderPaymentMethods"]> | null>(null);
    const [price, setPrice] = useState(amount);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        (async () => {
            try {
                // Fetch widget instance
                const customerKey = user?.id || `ANON_${Math.random().toString(36).substring(2, 10)}`;
                const paymentWidget = await loadPaymentWidget(clientKey, customerKey);

                // Render Payment Methods
                const paymentMethodsWidget = paymentWidget.renderPaymentMethods(
                    "#payment-widget",
                    { value: price },
                    { variantKey: "DEFAULT" }
                );

                // Render Agreement
                paymentWidget.renderAgreement(
                    "#agreement",
                    { variantKey: "AGREEMENT" }
                );

                paymentWidgetRef.current = paymentWidget;
                paymentMethodsWidgetRef.current = paymentMethodsWidget;
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching Toss widget:", error);
            }
        })();
    }, [user, price]);

    const requestPayment = async () => {
        const paymentWidget = paymentWidgetRef.current;
        if (!paymentWidget) return;

        try {
            await paymentWidget.requestPayment({
                orderId: `ORDER_${Math.random().toString(36).substring(2, 11).toUpperCase()}`,
                orderName: orderName,
                customerName: user?.email?.split('@')[0] || "임대인",
                customerEmail: user?.email || "customer@example.com",
                customerMobilePhone: "01012341234",
                successUrl: `${window.location.origin}/pricing/success`,
                failUrl: `${window.location.origin}/pricing/fail`,
            });
        } catch (error) {
            console.error("Payment failed", error);
        }
    };

    return (
        <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-200">
                <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center sticky top-0 bg-white z-10">
                    <div>
                        <h2 className="text-xl font-bold text-neutral-900">결제하기</h2>
                        <p className="text-xs text-neutral-500 mt-0.5">{orderName}</p>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="p-4 overflow-y-auto flex-1 bg-neutral-50/50">
                    {isLoading && (
                        <div className="flex flex-col items-center justify-center py-20 text-neutral-400">
                            <Loader2 size={32} className="animate-spin mb-4" />
                            <p className="text-sm font-medium">결제 모듈을 불러오는 중입니다...</p>
                        </div>
                    )}

                    {/* Toss Payments Widget Containers */}
                    <div id="payment-widget" className="w-full" />
                    <div id="agreement" className="w-full mt-4" />
                </div>

                <div className="p-6 border-t border-neutral-100 bg-white">
                    <button
                        disabled={isLoading}
                        onClick={requestPayment}
                        className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-lg"
                    >
                        {isLoading ? (
                            <Loader2 size={24} className="animate-spin" />
                        ) : (
                            `${price.toLocaleString()}원 결제하기`
                        )}
                    </button>
                    <p className="text-center text-xs text-neutral-400 mt-3 flex items-center justify-center gap-1">
                        안전한 결제 환경을 위해 <strong>토스페이먼츠</strong>를 사용합니다.
                    </p>
                </div>
            </div>
        </div>
    );
}
