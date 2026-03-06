"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { Mail, ArrowRight, Gift } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function SignupPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    const handleEmailSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setMessage(null);

        try {
            const { error } = await supabase.auth.signInWithOtp({
                email,
                options: {
                    emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
                },
            });

            if (error) throw error;

            setMessage({ type: 'success', text: '가입 확인 메일이 발송됐습니다. 메일함을 확인해주세요!' });
        } catch (error: unknown) {
            const err = error as { message?: string };
            setMessage({ type: 'error', text: err.message || '가입 처리 중 오류가 발생했습니다.' });
        } finally {
            setLoading(false);
        }
    };

    const handleSocialSignup = async (provider: 'google' | 'kakao') => {
        try {
            const { error } = await supabase.auth.signInWithOAuth({
                provider,
                options: {
                    redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || window.location.origin}/auth/callback`,
                },
            });
            if (error) throw error;
        } catch (error: unknown) {
            const err = error as { message?: string };
            setMessage({ type: 'error', text: `${provider} 가입 중 오류가 발생했습니다. ${err.message ?? ''}` });
        }
    };

    return (
        <div className="absolute inset-0 z-50 bg-neutral-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
            <div className="sm:mx-auto sm:w-full sm:max-w-md">
                <div className="flex justify-center flex-col items-center">
                    <Link href="/" className="flex flex-col items-center group">
                        <div className="h-14 w-14 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-2xl shadow-lg flex items-center justify-center mb-4 transform -rotate-6 group-hover:rotate-0 transition-transform">
                            <span className="text-white font-black text-2xl tracking-tighter">DW</span>
                        </div>
                        <h2 className="text-center text-3xl font-extrabold text-neutral-900 tracking-tight group-hover:text-blue-600 transition-colors">
                            noado
                        </h2>
                    </Link>
                    <div className="mt-3 flex items-center gap-2 px-4 py-1.5 bg-blue-50 rounded-full border border-blue-100">
                        <Gift size={14} className="text-blue-600" />
                        <p className="text-sm font-semibold text-blue-600">지금 무료로 시작하세요</p>
                    </div>
                </div>
            </div>

            <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
                <div className="bg-white py-8 px-4 shadow sm:rounded-2xl sm:px-10 border border-neutral-100">

                    {message && (
                        <div className={`mb-6 p-4 rounded-xl text-sm font-medium ${message.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : 'bg-red-50 text-red-800 border border-red-200'}`}>
                            {message.text}
                        </div>
                    )}

                    {/* Social Signup */}
                    <div className="space-y-3">
                        <button
                            onClick={() => handleSocialSignup('kakao')}
                            className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-neutral-900 bg-[#FEE500] hover:bg-[#FEE500]/90 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[#FEE500] transition-colors"
                        >
                            카카오톡으로 3초 만에 시작하기
                        </button>
                        <button
                            onClick={() => handleSocialSignup('google')}
                            className="w-full flex justify-center items-center py-3 px-4 border border-neutral-300 rounded-xl shadow-sm text-sm font-bold text-neutral-700 bg-white hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-neutral-500 transition-colors"
                        >
                            Google 계정으로 가입하기
                        </button>
                    </div>

                    <div className="mt-8 mb-6">
                        <div className="relative">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-neutral-200" />
                            </div>
                            <div className="relative flex justify-center text-sm">
                                <span className="px-3 bg-white text-neutral-500">또는 이메일로 가입</span>
                            </div>
                        </div>
                    </div>

                    {/* Email Signup */}
                    <form className="space-y-5" onSubmit={handleEmailSignup}>
                        <div>
                            <label htmlFor="email" className="block text-sm font-medium text-neutral-700 sr-only">
                                이메일 주소
                            </label>
                            <div className="mt-1 relative rounded-md shadow-sm">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                    <Mail className="h-5 w-5 text-neutral-400" />
                                </div>
                                <input
                                    id="email"
                                    name="email"
                                    type="email"
                                    autoComplete="email"
                                    required
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    className="focus:ring-blue-500 focus:border-blue-500 block w-full pl-10 sm:text-sm border-neutral-300 rounded-xl py-3 border"
                                    placeholder="my@email.com"
                                />
                            </div>
                        </div>

                        <div>
                            <button
                                type="submit"
                                disabled={loading || !email}
                                className="w-full flex justify-center items-center py-3 px-4 border border-transparent rounded-xl shadow-sm text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed group"
                            >
                                {loading ? '메일 전송 중...' : (
                                    <>
                                        무료 가입 링크 받기
                                        <ArrowRight className="ml-2 h-4 w-4 opacity-0 group-hover:opacity-100 group-hover:translate-x-1 transition-all" />
                                    </>
                                )}
                            </button>
                        </div>
                    </form>

                    <p className="mt-6 text-center text-sm text-neutral-500">
                        이미 계정이 있으신가요?{" "}
                        <Link href="/login" className="font-semibold text-blue-600 hover:text-blue-500 transition-colors">
                            로그인
                        </Link>
                    </p>
                </div>
            </div>
        </div>
    );
}
