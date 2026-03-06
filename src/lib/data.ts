export type RoomStatus = "PAID" | "UNPAID" | "VACANT";
export type PaymentStatus = "PAID" | "UNPAID" | "PARTIAL";

export interface Payment {
    id: string;
    businessId: string;
    roomId: string;
    tenantName: string;
    amount: number;
    paidAt: string;       // ISO date string
    month: string;        // e.g. '2026-02'
    status: PaymentStatus;
    note?: string;
}

export interface Tenant {
    id: string;
    name: string;
    contact?: string;
    companyName?: string;
    businessRegistrationNumber?: string;
}

export interface PaymentInfo {
    dueDate: string; // e.g., "매월 25일"
    monthlyRent: number; // e.g., 500000
    deposit: number; // e.g., 5000000
    isVATIncluded: boolean;
}

export interface Room {
    id: string;
    name: string; // e.g., "213호"
    businessId: string;
    status: RoomStatus;
    tenant: Tenant | null;
    paymentInfo: PaymentInfo | null;
    autoNotify: boolean;
    unpaidAmount?: number; // accumulated unpaid amount if status === "UNPAID"
    unpaidMonths?: number;
    leaseStart?: string;
    leaseEnd?: string;
}

export interface Business {
    id: string;
    name: string;
    ownerName: string;
    registrationNumber?: string;
    address: string;
}

// 1. 사업장 데이터
export const businesses: Business[] = [
    { id: "b_daewoo", name: "대우 고시원", ownerName: "대표님", address: "서울시 강남구 역삼동" },
    { id: "b_royal", name: "로얄 오피스텔", ownerName: "대표님", address: "서울시 서초구 서초동" },
    { id: "b_teheran", name: "테헤란로상가", ownerName: "대표님", address: "서울시 강남구 테헤란로" },
];

const generateId = () => Math.random().toString(36).substr(2, 9);

// 도우미 함수: 지정된 개수만큼 호실 생성
const generateRooms = (businessId: string, count: number, startRoomNum: number): Room[] => {
    const rooms: Room[] = [];
    for (let i = 0; i < count; i++) {
        // 공급가액 30만 ~ 60만 사이 (만원 단위)
        const monthlyRent = (30 + Math.floor(Math.random() * 31)) * 10000;
        const deposit = monthlyRent * 10;

        let status: RoomStatus = "PAID";
        if (Math.random() < 0.15) status = "VACANT"; // 15% 확률로 공실
        else if (Math.random() < 0.25) status = "UNPAID"; // 25% 확률로 미납

        const roomName = `${startRoomNum + i}호`;

        // unpaidMonths를 먼저 계산하고 unpaidAmount는 monthlyRent * unpaidMonths로 통일
        // (각각 별도 random()을 쓰면 "2개월 미납인데 금액은 3달치" 같은 불일치 발생)
        const unpaidMonths = status === "UNPAID" ? Math.floor(Math.random() * 3) + 1 : 0;
        const unpaidAmount = unpaidMonths * monthlyRent;

        rooms.push({
            id: `r_${businessId}_${i}`,
            name: roomName,
            businessId,
            status,
            tenant: status === "VACANT" ? null : {
                id: generateId(),
                name: `임차인_${roomName}`,
                contact: `010-${Math.floor(1000 + Math.random() * 9000)}-${Math.floor(1000 + Math.random() * 9000)}`,
                companyName: `(주)비즈_${roomName}`,
                businessRegistrationNumber: `${Math.floor(100 + Math.random() * 899)}-81-${Math.floor(10000 + Math.random() * 89999)}`
            },
            paymentInfo: status === "VACANT" ? null : {
                dueDate: `매월 ${Math.floor(Math.random() * 28) + 1}일`,
                monthlyRent,
                deposit,
                isVATIncluded: false // 기본적으로 부가세 별도 (공급가액 기준)
            },
            autoNotify: status !== "VACANT" && Math.random() > 0.5,
            unpaidMonths,
            unpaidAmount,
            leaseStart: status === "VACANT" ? undefined : "2024-01-01",
            leaseEnd: status === "VACANT" ? undefined : (Math.random() > 0.8 ? "2024-11-30" : "2025-12-31")
        });
    }
    return rooms;
};

// 2. 대우오피스 호실 데이터 (30개)
const mockDaewooRooms = generateRooms("b_daewoo", 30, 201);

// 3. 로얄 오피스텔 호실 데이터 (5개)
const mockRoyalRooms = generateRooms("b_royal", 5, 101);

// 4. 테헤란로 상가 호실 데이터 (12개)
const mockTeheranRooms = generateRooms("b_teheran", 12, 101);

export const allRooms: Room[] = [...mockDaewooRooms, ...mockRoyalRooms, ...mockTeheranRooms];

// Mock API functions
export const getRoomsByBusiness = (businessId: string | "ALL"): Room[] => {
    if (businessId === "ALL") return allRooms;
    return allRooms.filter(r => r.businessId === businessId);
};

export const payments: Payment[] = [];
allRooms.forEach(room => {
    if (room.status === "VACANT") return;

    const monthlyRent = room.paymentInfo?.monthlyRent || 0;

    // 최근 3개월치 결제 내역 생성
    for (let i = 1; i <= 3; i++) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        // month: 'YYYY-MM' format (used in payment sorting)
        const monthStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

        let paymentStatus: PaymentStatus = "PAID";
        // 미납 호실인 경우, 미납 개월 수만큼 UNPAID 로 설정
        if (room.status === "UNPAID" && i <= (room.unpaidMonths || 0)) {
            paymentStatus = "UNPAID";
        }

        let paidAt = "";
        if (paymentStatus === "PAID") {
            const paidDate = new Date(date);
            // 약정일에서 숫자만 추출
            const dueDay = parseInt(room.paymentInfo?.dueDate.replace(/[^0-9]/g, '') || "25");
            paidDate.setDate(dueDay);
            // 시간은 오전 10시경
            paidDate.setHours(10 + Math.floor(Math.random() * 5), Math.floor(Math.random() * 60));
            paidAt = paidDate.toISOString();
        }

        payments.push({
            id: `p_${room.id}_${monthStr}`,
            businessId: room.businessId,
            roomId: room.id,
            tenantName: room.tenant?.name || "알 수 없음",
            amount: monthlyRent,
            paidAt,
            month: monthStr,
            status: paymentStatus
        });
    }
});
