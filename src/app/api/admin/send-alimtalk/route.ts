import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendKakaoAlimtalk } from "@/lib/alimtalk";

const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/admin/send-alimtalk
 * body: { roomIds: string[], type: 'UNPAID_REMINDER' | 'PAYMENT_CONFIRM' }
 * 관리자가 수동으로 선택한 호실에 알림톡 발송
 */
export async function POST(request: Request) {
    try {
        const authHeader = request.headers.get("Authorization");
        if (!authHeader?.startsWith("Bearer ")) {
            return NextResponse.json({ error: "인증이 필요합니다." }, { status: 401 });
        }
        const token = authHeader.split(" ")[1];

        const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
        if (authError || !user) {
            return NextResponse.json({ error: "유효하지 않은 토큰" }, { status: 401 });
        }

        const body = await request.json();
        const { roomIds, type } = body as { roomIds: string[]; type: "UNPAID_REMINDER" | "PAYMENT_CONFIRM" };

        if (!roomIds || roomIds.length === 0) {
            return NextResponse.json({ error: "호실 ID가 필요합니다." }, { status: 400 });
        }

        // 본인 소유 호실만 조회 (owner_id로 보안)
        const { data: rooms, error: roomError } = await supabaseAdmin
            .from("rooms")
            .select("id, name, tenant_name, tenant_contact, unpaid_amount, unpaid_months, status")
            .in("id", roomIds)
            .eq("owner_id", user.id);

        if (roomError) throw roomError;

        const results: { room: string; sent: boolean; reason?: string }[] = [];
        let sentCount = 0;

        for (const room of rooms || []) {
            if (!room.tenant_contact) {
                results.push({ room: room.name, sent: false, reason: "연락처 없음" });
                continue;
            }

            let templateCode: string;
            let variables: Record<string, string>;

            if (type === "UNPAID_REMINDER") {
                templateCode = "KA01TP260302200441583wMOcyLIy71M"; // 미납 독촉
                variables = {
                    tenantName: room.tenant_name || "임차인",
                    roomName: room.name,
                    unpaidAmount: (room.unpaid_amount || 0).toLocaleString(),
                    unpaidMonths: String(room.unpaid_months || 1),
                };
            } else {
                templateCode = "KA01TP2603022005171505KORmx0Qpva"; // 수납 완료
                variables = {
                    tenantName: room.tenant_name || "임차인",
                    roomName: room.name,
                };
            }

            const sent = await sendKakaoAlimtalk({
                to: room.tenant_contact.replace(/-/g, ""),
                templateCode,
                variables,
            });

            results.push({ room: room.name, sent });
            if (sent) sentCount++;
        }

        return NextResponse.json({
            success: true,
            message: `${sentCount}건 발송 완료 (실패: ${results.length - sentCount}건)`,
            results,
        });
    } catch (error: unknown) {
        const msg = error instanceof Error ? error.message : String(error);
        console.error("[POST /api/admin/send-alimtalk]", msg);
        return NextResponse.json({ error: msg }, { status: 500 });
    }
}
