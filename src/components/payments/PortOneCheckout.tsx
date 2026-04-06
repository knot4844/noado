'use client'

import React, { useState } from 'react'
import { X, Loader2, CreditCard, ShieldCheck } from 'lucide-react'
import { useAuth } from '@/components/providers/AuthProvider'

interface PortOneCheckoutProps {
  /** 결제 금액 */
  amount: number
  /** 주문명 (ex: "noado Beginner 요금제 (월정액)") */
  orderName: string
  /** 모달 닫기 콜백 */
  onClose: () => void
  /** 결제 모드: payment(일반결제) | billing(정기결제 빌링키 발급) */
  mode?: 'payment' | 'billing'
  /** 결제 성공 콜백 */
  onSuccess?: (data: { paymentId?: string; billingKey?: string }) => void
}

export function PortOneCheckout({
  amount,
  orderName,
  onClose,
  mode = 'payment',
  onSuccess,
}: PortOneCheckoutProps) {
  const { user } = useAuth()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const storeId = (process.env.NEXT_PUBLIC_PORTONE_STORE_ID || 'store-f448cc28-0f2f-4dd8-898c-ec5505ba43ac').trim()
  // 결제창 채널키 (KG이니시스 결제창 일반/정기결제)
  const channelKey = (process.env.NEXT_PUBLIC_PORTONE_CHANNEL_KEY || 'channel-key-6b818e51-4872-4a0e-84a7-d8f43eb72a55').trim()

  const handlePayment = async () => {
    setIsLoading(true)
    setError(null)

    try {
      const PortOne = await import('@portone/browser-sdk/v2')

      if (mode === 'billing') {
        // ── 정기결제: 빌링키 발급 ──
        const response = await PortOne.requestIssueBillingKey({
          storeId,
          channelKey,
          billingKeyMethod: 'CARD',
          issueId: `BILL_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
          issueName: orderName,
          customer: {
            customerId: user?.id || `ANON_${Date.now()}`,
            email: user?.email || 'guest@noado.kr',
            fullName: user?.user_metadata?.name || '노아도 이용자',
            phoneNumber: user?.user_metadata?.phone || user?.phone || '01000000000',
          },
        })

        if (response?.code) {
          setError(response.message || '빌링키 발급에 실패했습니다.')
          return
        }

        if (response?.billingKey) {
          // 빌링키를 서버로 전송하여 첫 결제 실행 + 구독 등록
          const res = await fetch('/api/portone/subscribe', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              billingKey: response.billingKey,
              planName: orderName,
              amount,
            }),
          })

          if (!res.ok) {
            const errData = await res.json()
            setError(errData.error || '구독 등록에 실패했습니다.')
            return
          }

          onSuccess?.({ billingKey: response.billingKey })
          onClose()
        }
      } else {
        // ── 일반결제: 카드 결제 ──
        const paymentId = `PAY_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`

        const response = await PortOne.requestPayment({
          storeId,
          channelKey,
          paymentId,
          orderName,
          totalAmount: amount,
          currency: 'CURRENCY_KRW',
          payMethod: 'CARD',
          customer: {
            customerId: user?.id || `ANON_${Date.now()}`,
            email: user?.email || 'guest@noado.kr',
            fullName: user?.user_metadata?.name || '노아도 이용자',
            phoneNumber: user?.user_metadata?.phone || user?.phone || '01000000000',
          },
        })

        if (response?.code) {
          setError(response.message || '결제에 실패했습니다.')
          return
        }

        // 결제 완료 → 서버에서 검증
        const res = await fetch('/api/portone/payment-complete', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ paymentId }),
        })

        if (!res.ok) {
          const errData = await res.json()
          setError(errData.error || '결제 확인에 실패했습니다.')
          return
        }

        onSuccess?.({ paymentId })
        onClose()
      }
    } catch (err: unknown) {
      if (err instanceof Error) {
        // 사용자가 결제창을 닫은 경우
        if (err.message?.includes('cancelled') || err.message?.includes('USER_CANCEL')) {
          setError(null)
          return
        }
        setError(err.message)
      } else {
        setError('결제 중 오류가 발생했습니다.')
      }
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-neutral-900/60 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col animate-in zoom-in-95 duration-200">
        {/* 헤더 */}
        <div className="px-6 py-4 border-b border-neutral-100 flex justify-between items-center">
          <div>
            <h2 className="text-xl font-bold text-neutral-900">
              {mode === 'billing' ? '정기결제 등록' : '결제하기'}
            </h2>
            <p className="text-xs text-neutral-500 mt-0.5">{orderName}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-neutral-400 hover:text-neutral-900 hover:bg-neutral-100 rounded-full transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* 본문 */}
        <div className="p-6 space-y-5">
          {/* 결제 정보 */}
          <div className="bg-neutral-50 rounded-xl p-5 border border-neutral-100">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-blue-50 rounded-lg flex items-center justify-center">
                <CreditCard size={20} className="text-blue-600" />
              </div>
              <div>
                <div className="text-sm text-neutral-500">
                  {mode === 'billing' ? '월 정기결제 금액' : '결제 금액'}
                </div>
                <div className="text-2xl font-bold text-neutral-900">
                  {amount.toLocaleString()}원
                </div>
              </div>
            </div>
            {mode === 'billing' && (
              <p className="text-xs text-neutral-400 leading-relaxed">
                신용카드를 등록하면 매월 자동으로 결제됩니다.
                언제든지 구독을 취소할 수 있습니다.
              </p>
            )}
          </div>

          {/* 에러 메시지 */}
          {error && (
            <div className="bg-red-50 text-red-700 text-sm px-4 py-3 rounded-lg border border-red-100">
              {error}
            </div>
          )}

          {/* 결제 버튼 */}
          <button
            disabled={isLoading}
            onClick={handlePayment}
            className="w-full py-4 px-4 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-xl shadow-lg shadow-blue-200 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center text-lg gap-2"
          >
            {isLoading ? (
              <Loader2 size={24} className="animate-spin" />
            ) : (
              <>
                {mode === 'billing'
                  ? `${amount.toLocaleString()}원 정기결제 등록`
                  : `${amount.toLocaleString()}원 결제하기`
                }
              </>
            )}
          </button>

          {/* 안내 */}
          <p className="text-center text-xs text-neutral-400 flex items-center justify-center gap-1">
            <ShieldCheck size={13} />
            안전한 결제 환경을 위해 <strong>PortOne · KG이니시스</strong>를 사용합니다.
          </p>
        </div>
      </div>
    </div>
  )
}
