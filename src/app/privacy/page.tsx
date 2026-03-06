import React from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

export const metadata = {
    title: '개인정보 처리방침 | noado',
    description: 'noado 개인정보 처리방침',
};

export default function PrivacyPolicyPage() {
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
                    <h1 className="text-3xl font-extrabold text-neutral-900 tracking-tight sm:text-4xl">개인정보 처리방침</h1>
                    <p className="mt-4 text-sm text-neutral-500">시행일자: 2026년 2월 21일</p>
                </div>

                <div className="prose prose-neutral max-w-none text-sm leading-relaxed text-neutral-600 space-y-8">
                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제1조 (개인정보의 처리 목적)</h2>
                        <p>
                            noado(이하 "회사")는 다음의 목적을 위하여 개인정보를 처리합니다. 처리하고 있는 개인정보는 다음의 목적 이외의 용도로는 이용되지 않으며 이용 목적이 변경되는 경우에는 「개인정보 보호법」 제18조에 따라 별도의 동의를 받는 등 필요한 조치를 이행할 예정입니다.
                        </p>
                        <ol className="list-decimal pl-5 mt-2 space-y-1">
                            <li>홈페이지 회원가입 및 관리: 회원 가입의사 확인, 회원제 서비스 제공에 따른 본인 식별/인증, 서비스 부정이용 방지, 각종 고지/통지 등</li>
                            <li>재화 또는 서비스 제공: 임대관리 대시보드 제공, 알림톡 전송, 물품배송, 요금결제/정산 등</li>
                            <li>마케팅 및 광고에의 활용: 신규 서비스 개발 및 맞춤 서비스 제공, 이벤트 및 광고성 정보 제공 등</li>
                        </ol>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제2조 (처리하는 개인정보의 항목)</h2>
                        <p>
                            회사는 회원가입, 상담, 서비스 제공 등을 위해 아래와 같은 개인정보를 수집하고 있습니다.
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li><strong>필수항목:</strong> 이메일 주소, 이름(상호), 비밀번호, 결제 정보(카드번호, 유효기간 등 - 암호화 저장 또는 PG사 대행)</li>
                            <li><strong>선택항목:</strong> 휴대전화번호, 사업자등록번호, 세부 주소지</li>
                            <li><strong>자동수집항목:</strong> IP Address, 쿠키, 방문 일시, 서비스 이용 기록, 불량 이용 기록</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제3조 (개인정보의 처리 및 보유 기간)</h2>
                        <p>
                            회사는 법령에 따른 개인정보 보유/이용기간 또는 정보주체로부터 개인정보를 수집 시에 동의받은 보유/이용기간 내에서 개인정보를 처리/보유합니다.
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>회원 가입 및 관리: 회원 탈퇴 시까지</li>
                            <li>전자상거래 등에서의 소비자 보호에 관한 법률에 따른 보존: 대금결제 및 재화 등의 공급에 관한 기록 (5년), 소비자 불만 또는 분쟁처리에 관한 기록 (3년)</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제4조 (개인정보의 제3자 제공)</h2>
                        <p>
                            회사는 정보주체의 개인정보를 제1조(개인정보의 처리 목적)에서 명시한 범위 내에서만 처리하며, 정보주체의 동의, 법률의 특별한 규정 등 「개인정보 보호법」 제17조 및 제18조에 해당하는 경우에만 개인정보를 제3자에게 제공합니다. (예: 결제대행사 토스페이먼츠 등)
                        </p>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제5조 (개인정보의 안전성 확보 조치)</h2>
                        <p>
                            회사는 개인정보의 안전성 확보를 위해 다음과 같은 조치를 취하고 있습니다.
                        </p>
                        <ul className="list-disc pl-5 mt-2 space-y-1">
                            <li>관리적 조치: 내부관리계획 수립 및 시행, 정기적 직원 교육 등</li>
                            <li>기술적 조치: 개인정보처리시스템 등의 접근권한 관리, 접근통제시스템 설치, 고유식별정보 등의 암호화, 보안프로그램 설치</li>
                        </ul>
                    </section>

                    <section>
                        <h2 className="text-lg font-bold text-neutral-900 mb-3 border-b pb-2">제6조 (개인정보 보호책임자)</h2>
                        <p>
                            회사는 개인정보 처리에 관한 업무를 총괄해서 책임지고, 개인정보 처리와 관련한 정보주체의 불만처리 및 피해구제 등을 위하여 아래와 같이 개인정보 보호책임자를 지정하고 있습니다.
                        </p>
                        <ul className="pl-5 mt-2 space-y-1">
                            <li><strong>성명/직책:</strong> 고객지원팀장 (예시)</li>
                            <li><strong>연락처:</strong> support@noado.co.kr</li>
                        </ul>
                        <p className="mt-2 text-xs text-neutral-500">※ 실제 상용화 시, 대표님의 실제 성함과 연락 가능한 고객센터 이메일로 변경되어야 합니다.</p>
                    </section>
                </div>
            </div>
        </div>
    );
}
