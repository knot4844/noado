export const dynamic = 'force-dynamic'
import React from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

export const metadata = {
  title: '환불 및 취소 정책 | noado',
  description: 'noado 서비스 환불 및 취소 정책',
}

export default function RefundPolicyPage() {
  return (
    <div className="min-h-screen bg-neutral-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-3xl mx-auto bg-white rounded-2xl shadow-sm p-8 sm:p-12 relative">
        <div className="absolute top-8 left-8">
          <Link href="/" className="flex items-center text-neutral-500 hover:text-neutral-900 transition-colors">
            <ArrowLeft className="w-5 h-5 mr-1" />
            <span className="text-sm font-medium">돌아가기</span>
          </Link>
        </div>

        <div className="mt-8 text-center mb-12">
          <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">환불 및 취소 정책</h1>
          <p className="mt-4 text-sm text-neutral-500">시행일자: 2026년 1월 1일</p>
        </div>

        <div className="prose prose-neutral max-w-none text-sm leading-relaxed text-neutral-600 space-y-8">

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제1조 (서비스 특성)</h2>
            <p>
              noado는 공간 관리 SaaS(Software as a Service) 구독형 서비스로, 실물 상품의 배송이 없는
              디지털 서비스입니다. 따라서 배송 기간 및 배송비는 적용되지 않습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제2조 (구독 서비스 취소 및 환불)</h2>
            <div className="space-y-3">
              <p><strong>① 월정액 구독 취소</strong><br />
                회원은 언제든지 서비스 내 설정 화면 또는 고객센터를 통해 구독을 취소할 수 있습니다.
                취소 신청 시 해당 결제 주기의 잔여 기간 동안 서비스가 유지되며, 이후 자동 결제가 중단됩니다.
              </p>
              <p><strong>② 결제 후 7일 이내 환불</strong><br />
                최초 결제일로부터 7일 이내이고 서비스를 실질적으로 이용하지 않은 경우, 전액 환불을 요청할 수 있습니다.
              </p>
              <p><strong>③ 결제 후 7일 초과 환불</strong><br />
                결제일로부터 7일을 초과한 경우 원칙적으로 환불이 불가합니다.
                단, 회사의 귀책사유(서비스 오류, 장애 등)로 인한 경우에는 이용하지 못한 기간에 대해 일할 계산하여 환불합니다.
              </p>
              <p><strong>④ 연간 구독</strong><br />
                연간 구독 상품의 경우, 결제일로부터 7일 이내 미사용 시 전액 환불 가능하며,
                7일 초과 시 잔여 월 수에 해당하는 금액을 월정액 기준으로 일할 계산하여 환불합니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제3조 (이용료(공간 수납) 결제 취소)</h2>
            <div className="space-y-3">
              <p><strong>① 가상계좌 입금 전 취소</strong><br />
                가상계좌 발급 후 실제 입금 전에는 해당 청구서 페이지에서 취소가 가능합니다.
              </p>
              <p><strong>② 가상계좌 입금 완료 후</strong><br />
                입금이 완료된 이용료는 공간 운영자와 이용자 간의 합의에 따라 처리되며,
                분쟁 발생 시 고객센터(031-970-0600)로 문의하여 주시기 바랍니다.
              </p>
              <p><strong>③ 카드 결제 취소</strong><br />
                카드 결제 완료 후 당일(영업일 기준) 취소를 원하시는 경우 고객센터로 즉시 연락 주시면 처리해 드립니다.
              </p>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제4조 (환불 불가 항목)</h2>
            <ul className="list-disc pl-5 space-y-1">
              <li>이미 사용된 카카오 알림톡 발송 건당 비용(실비)</li>
              <li>전자세금계산서 발행 건당 수수료(실비)</li>
              <li>회원의 귀책사유로 인한 서비스 이용 제한 및 계약 해지의 경우</li>
              <li>약관을 위반하여 이용계약이 해지된 경우</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제5조 (환불 처리 기간)</h2>
            <p>
              환불 요청이 승인된 경우, 영업일 기준 3~5일 이내에 결제 수단으로 환불됩니다.
              카드 결제의 경우 카드사 정책에 따라 환불 반영 시점이 다를 수 있습니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제6조 (교환 정책)</h2>
            <p>
              디지털 서비스 특성상 교환은 적용되지 않습니다.
              요금제 변경(업그레이드/다운그레이드)은 서비스 내 설정 화면에서 언제든지 가능합니다.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제7조 (고객센터)</h2>
            <div className="bg-neutral-50 rounded-xl p-4 space-y-1">
              <p><strong>상호</strong>: 대우오피스</p>
              <p><strong>사업자등록번호</strong>: 127-44-85045</p>
              <p><strong>전화</strong>: 031-970-0600 (평일 09:00~18:00)</p>
              <p><strong>이메일</strong>: knot4844@gmail.com</p>
              <p><strong>주소</strong>: 경기도 고양시 일산동구 중앙로 1129 제서관동 2017, 2018호</p>
            </div>
          </section>

        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-neutral-500">환불 및 취소 관련 문의는 고객센터(031-970-0600)로 연락 주시기 바랍니다.</p>
        </div>
      </div>
    </div>
  )
}
