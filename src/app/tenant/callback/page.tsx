"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

// 카카오/이메일 OAuth 콜백 후 처리
export default function TenantCallbackPage() {
    const router = useRouter();

    useEffect(() => {
        const processUser = async (userId: string) => {
            // 연결된 방 조회
            const { data: room } = await supabase
                .from("rooms")
                .select("id")
                .eq("tenant_auth_id", userId)
                .single();

            if (room) {
                router.push(`/portal/${room.id}`);
            } else {
                // 미가입자: 초대 링크 필요 안내
                router.push("/tenant/no-room");
            }
        };

        const handle = async () => {
            const { data } = await supabase.auth.getSession();
            if (data.session?.user) {
                processUser(data.session.user.id);
                return;
            }

            // If no session but there's a code/token, wait for auth state change
            if (window.location.search.includes("code=") || window.location.hash.includes("access_token=")) {
                const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
                    if (session?.user) {
                        processUser(session.user.id);
                        subscription.unsubscribe();
                    }
                });
                return;
            }

            router.push("/tenant/login");
        };

        handle();
    }, [router]);

    return (
        <div className="min-h-screen bg-neutral-50 flex items-center justify-center">
            <div className="text-center">
                <Loader2 className="animate-spin text-blue-600 mx-auto mb-3" size={36} />
                <p className="text-neutral-500 text-sm">로그인 처리 중...</p>
            </div>
        </div>
    );
}
