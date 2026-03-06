"use client";

import { useEffect, useState, useRef } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { CheckCircle2, AlertCircle, Loader2, Eye, EyeOff } from "lucide-react";

export default function ProfilePage() {
    const params = useParams();
    const router = useRouter();
    const token = params?.token as string;

    const [userId, setUserId] = useState<string | null>(null);
    const [isCheckingAuth, setIsCheckingAuth] = useState(true);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showSsn, setShowSsn] = useState(false);

    const [form, setForm] = useState({
        name: "",
        phone: "",
        ssn: "",         // 주민번호 - 전송 후 즉시 해시 처리
        email: "",
        address: "",
    });

    // 로그인 유저 확인
    useEffect(() => {
        const handleSession = (user: any) => {
            setUserId(user.id);
            setForm(f => ({ ...f, email: user.email ?? "" }));
            setIsCheckingAuth(false);
        };

        supabase.auth.getSession().then(({ data }) => {
            if (data.session?.user) {
                handleSession(data.session.user);
                return;
            }

            if (window.location.search.includes("code=") || window.location.hash.includes("access_token=")) {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (session?.user) {
                        handleSession(session.user);
                        subscription.unsubscribe();
                    }
                });
                return;
            }

            router.push(`/invite/${token}`);
        });
    }, [token, router]);

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setForm(f => ({ ...f, [e.target.name]: e.target.value }));
    };

    const formatPhone = (val: string) => {
        const digits = val.replace(/\D/g, "").slice(0, 11);
        if (digits.length <= 3) return digits;
        if (digits.length <= 7) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
        return `${digits.slice(0, 3)}-${digits.slice(3, 7)}-${digits.slice(7)}`;
    };

    const formatSsn = (val: string) => {
        const digits = val.replace(/\D/g, "").slice(0, 13);
        if (digits.length <= 6) return digits;
        return `${digits.slice(0, 6)}-${digits.slice(6)}`;
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!userId) return;

        // 주민번호 유효성 검사
        const ssnClean = form.ssn.replace("-", "");
        if (ssnClean.length !== 13) {
            setError("주민번호 13자리를 정확히 입력해주세요.");
            return;
        }

        setIsSubmitting(true);
        setError(null);

        const res = await fetch("/api/invite/complete", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                token,
                authId: userId,
                name: form.name,
                phone: form.phone,
                ssn: ssnClean, // 서버에서 해시 처리
                email: form.email,
                address: form.address,
            }),
        });

        const data = await res.json();
        setIsSubmitting(false);

        if (!res.ok) {
            setError(data.error ?? "저장 중 오류가 발생했습니다.");
            return;
        }

        // 계약서 서명 페이지로 이동
        router.push(`/contracts/${data.roomId}?onboarding=true`);
    };

    if (isCheckingAuth) {
        return (
            <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
                <Loader2 className="animate-spin text-blue-600" size={36} />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-neutral-50 py-12 px-4">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="text-center mb-8">
                    <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={40} />
                    <h1 className="text-2xl font-extrabold text-neutral-900">본인 인증 완료</h1>
                    <p className="text-neutral-500 mt-1 text-sm">계약을 위한 기본 정보를 입력해주세요.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
                    <form onSubmit={handleSubmit} className="space-y-4">
                        {/* 이름 */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1.5">이름 *</label>
                            <input
                                name="name" required value={form.name} onChange={handleChange}
                                placeholder="홍길동"
                                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* 전화번호 */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1.5">전화번호 *</label>
                            <input
                                name="phone" required type="tel"
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: formatPhone(e.target.value) }))}
                                placeholder="010-0000-0000"
                                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* 주민번호 */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1.5">
                                주민등록번호 * <span className="font-normal text-neutral-400">(암호화 저장)</span>
                            </label>
                            <div className="relative">
                                <input
                                    name="ssn" required
                                    type={showSsn ? "text" : "password"}
                                    value={form.ssn}
                                    onChange={e => setForm(f => ({ ...f, ssn: formatSsn(e.target.value) }))}
                                    placeholder="000000-0000000"
                                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                                />
                                <button type="button" onClick={() => setShowSsn(v => !v)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-700">
                                    {showSsn ? <EyeOff size={18} /> : <Eye size={18} />}
                                </button>
                            </div>
                            <p className="text-xs text-neutral-400 mt-1">원문은 저장되지 않으며 암호화(SHA-256) 처리됩니다.</p>
                        </div>

                        {/* 이메일 */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1.5">이메일</label>
                            <input
                                name="email" type="email" value={form.email} onChange={handleChange}
                                placeholder="example@email.com"
                                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {/* 주소 */}
                        <div>
                            <label className="block text-xs font-bold text-neutral-500 mb-1.5">주소</label>
                            <input
                                name="address" value={form.address} onChange={handleChange}
                                placeholder="서울특별시 강남구..."
                                className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-rose-600 bg-rose-50 px-4 py-3 rounded-xl">
                                <AlertCircle size={16} /> {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={isSubmitting || !form.name || !form.phone || !form.ssn}
                            className="w-full py-4 mt-2 rounded-xl text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {isSubmitting ? "저장 중..." : "다음 → 계약서 작성"}
                        </button>
                    </form>
                </div>

                <p className="text-center text-xs text-neutral-400 mt-4">
                    입력하신 정보는 임대차 계약서 작성에만 사용됩니다.
                </p>
            </div>
        </div>
    );
}
