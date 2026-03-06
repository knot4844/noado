"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Mail, AlertCircle } from "lucide-react";

export default function TenantLoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [isSending, setIsSending] = useState(false);
    const [emailSent, setEmailSent] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // 이미 로그인된 경우 포털로 이동
    useEffect(() => {
        supabase.auth.getSession().then(async ({ data }) => {
            if (data.session?.user) {
                const userId = data.session.user.id;
                // 연결된 방 찾기
                const { data: room } = await supabase
                    .from("rooms")
                    .select("id")
                    .eq("tenant_auth_id", userId)
                    .single();
                if (room) router.push(`/portal/${room.id}`);
            }
        });
    }, [router]);

    const handleKakao = async () => {
        await supabase.auth.signInWithOAuth({
            provider: "kakao",
            options: {
                redirectTo: `${window.location.origin}/tenant/callback`,
            },
        });
    };

    const handleEmail = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsSending(true);
        const { error } = await supabase.auth.signInWithOtp({
            email,
            options: { emailRedirectTo: `${window.location.origin}/tenant/callback` },
        });
        if (error) setError(error.message);
        else setEmailSent(true);
        setIsSending(false);
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-blue-50 to-neutral-50 flex flex-col justify-center py-12 px-4">
            <div className="sm:mx-auto sm:w-full sm:max-w-sm">
                <div className="text-center mb-8">
                    <div className="h-12 w-12 bg-gradient-to-br from-blue-600 to-indigo-600 rounded-xl flex items-center justify-center mx-auto mb-4 -rotate-6">
                        <span className="text-white font-black text-xl">DW</span>
                    </div>
                    <h1 className="text-2xl font-extrabold text-neutral-900">임차인 로그인</h1>
                    <p className="text-neutral-500 mt-1 text-sm">계약서 및 납부 내역을 확인하세요.</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm border border-neutral-100 p-6">
                    {emailSent ? (
                        <div className="text-center py-4">
                            <Mail className="mx-auto text-blue-600 mb-3" size={40} />
                            <h3 className="font-bold text-neutral-900 mb-2">이메일을 확인해주세요</h3>
                            <p className="text-sm text-neutral-500">
                                <strong>{email}</strong>로 로그인 링크를 보냈어요.
                            </p>
                        </div>
                    ) : (
                        <>
                            <button
                                onClick={handleKakao}
                                className="w-full flex justify-center items-center py-3.5 px-4 rounded-xl text-sm font-bold text-neutral-900 bg-[#FEE500] hover:bg-[#FEE500]/90 transition-colors mb-4"
                            >
                                카카오톡으로 로그인
                            </button>

                            <div className="relative my-4">
                                <div className="absolute inset-0 flex items-center">
                                    <div className="w-full border-t border-neutral-200" />
                                </div>
                                <div className="relative flex justify-center text-xs">
                                    <span className="px-3 bg-white text-neutral-400">또는 이메일로</span>
                                </div>
                            </div>

                            <form onSubmit={handleEmail} className="space-y-3">
                                <input
                                    type="email" required value={email}
                                    onChange={e => setEmail(e.target.value)}
                                    placeholder="이메일 주소"
                                    className="w-full border border-neutral-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                />
                                {error && (
                                    <div className="flex items-center gap-2 text-xs text-rose-600">
                                        <AlertCircle size={14} /> {error}
                                    </div>
                                )}
                                <button type="submit" disabled={isSending || !email}
                                    className="w-full py-3 rounded-xl text-sm font-bold text-white bg-neutral-900 hover:bg-black transition-colors disabled:opacity-50">
                                    {isSending ? "전송 중..." : "이메일 링크 받기"}
                                </button>
                            </form>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
