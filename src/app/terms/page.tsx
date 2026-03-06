import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
    title: '이용약관 | noado',
    description: 'noado 서비스 이용약관',
};

export default function TermsOfServicePage() {
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
                    <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">이용약관</h1>
                    <p className="mt-4 text-sm text-neutral-500">시행일자: 2026년 2월 21일</p>
                </div>

                <div className="prose prose-neutral max-w-none text-sm leading-relaxed text-neutral-600 space-y-8">
                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제1조 (목적)</h2>
                        <p>
                            본 약관은 noado(이하 "회사")가 제공하는 임대 자동화 및 건물 관리 시스템 서비스(이하 "서비스")의 이용조건 및 절차, 회사와 회원 간의 권리, 의무, 책임사항 및 기타 필요한 사항을 규정함을 목적으로 합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제2조 (용어의 정의)</h2>
                        <ul className="list-disc pl-5 space-y-1">
                            <li>"서비스"란 회사가 제공하는 모든 클라우드 기반 소프트웨어 및 관련 부가 기능을 의미합니다.</li>
                            <li>"회원"이란 본 약관에 동의하고 회사와 서비스 이용계약을 체결하여 서비스를 이용하는 자를 의미합니다.</li>
                            <li>"유료서비스"란 회사가 유료로 제공하는 서비스 및 제반 기능을 의미합니다.</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제3조 (약관의 명시와 개정)</h2>
                        <p>
                            회사는 본 약관의 내용과 상호, 영업소 소재지, 대표자의 성명, 사업자등록번호, 연락처 등을 회원이 알 수 있도록 서비스 초기 화면에 게시합니다.
                            회사는 관련 법령을 위배하지 않는 범위 내에서 본 약관을 개정할 수 있으며, 개정 시에는 적용일자 및 개정사유를 명시하여 사전 공지합니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제4조 (이용계약의 체결)</h2>
                        <p>
                            이용계약은 회원이 되고자 하는 자(이하 "가입신청자")가 약관의 내용에 동의를 한 다음 회원가입 신청을 하고 회사가 이러한 신청에 대하여 승낙함으로써 체결됩니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제5조 (유료서비스의 이용 및 결제)</h2>
                        <p>
                            회원은 회사가 제공하는 결제 수단을 통하여 유료서비스를 이용할 수 있습니다.
                            정기결제(구독)의 경우, 회원이 등록한 결제수단으로 매월 혹은 매년 정해진 날짜에 요금이 자동 결제됩니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제6조 (계약해제, 해지 등)</h2>
                        <p>
                            회원은 언제든지 서비스 내 설정 화면을 통하여 이용계약 해지(회원탈퇴) 및 정기결제 해지를 신청할 수 있으며,
                            회사는 관련 법령이 정하는 바에 따라 이를 지체 없이 처리합니다. 결제 취소 및 환불 규정은 회사의 별도 운영정책에 따릅니다.
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제7조 (면책상항)</h2>
                        <p>
                            1. 회사는 천재지변 또는 이에 준하는 불가항력으로 인하여 서비스를 제공할 수 없는 경우에는 서비스 제공에 관한 책임이 면제됩니다.<br />
                            2. 회사는 회원의 귀책사유로 인한 서비스 이용의 장애에 대하여 책임을 지지 않습니다.<br />
                            3. 회사는 회원이 서비스를 이용하여 기대하는 수익을 상실한 것에 대하여 책임을 지지 않으며, 서비스를 통하여 얻은 자료로 인한 손해에 관하여 책임을 지지 않습니다.
                        </p>
                    </section>
                </div>

                <div className="mt-12 text-center">
                    <p className="text-sm text-neutral-500">본 약관에 대한 문의사항은 고객센터로 연락 주시기 바랍니다.</p>
                </div>
            </div>
        </div>
    );
}
