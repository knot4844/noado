"use client";

import React, { createContext, useContext, useState, ReactNode, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { Room, Business, Payment } from "@/lib/data";
import { useAuth } from "./AuthProvider";

// Supabase DB 행 타입 정의
interface BusinessRow {
    id: string;
    name: string;
    owner_name?: string;
    registration_number?: string;
    address?: string;
}

interface RoomRow {
    id: string;
    business_id: string;
    name: string;
    status: "PAID" | "UNPAID" | "VACANT";
    auto_notify: boolean;
    unpaid_months?: number;
    unpaid_amount?: number;
    lease_start?: string;
    lease_end?: string;
    deposit?: number;
    monthly_rent?: number;
    due_date?: string;
    is_vat_included?: boolean;
    tenant_id?: string;
    tenant_name?: string;
    tenant_contact?: string;
    tenant_company_name?: string;
    tenant_business_reg_num?: string;
}

interface PaymentRow {
    id: string;
    business_id: string;
    room_id: string;
    tenant_name: string;
    amount: number;
    paid_at: string;
    month: string;
    status: "PAID" | "UNPAID" | "PARTIAL";
    note?: string;
}

interface BusinessContextType {
    selectedBusinessId: string;
    setSelectedBusinessId: (id: string) => void;
    currentBusiness: Business | undefined;
    allBusinesses: Business[];
    setAllBusinesses: React.Dispatch<React.SetStateAction<Business[]>>;
    rooms: Room[];
    setRooms: React.Dispatch<React.SetStateAction<Room[]>>;
    payments: Payment[];
    getRoomsByBusiness: (businessId: string) => Room[];
    getPaymentsByBusiness: (businessId: string) => Payment[];
    addPayment: (payment: Payment) => void;
    refetchPayments: () => Promise<void>;
    isLoading: boolean;
}

const BusinessContext = createContext<BusinessContextType | undefined>(undefined);

export function BusinessProvider({ children }: { children: ReactNode }) {
    const { user } = useAuth();
    const [selectedBusinessId, setSelectedBusinessId] = useState<string>("ALL");
    const [rooms, setRooms] = useState<Room[]>([]);
    const [allBusinesses, setAllBusinesses] = useState<Business[]>([]);
    const [payments, setPayments] = useState<Payment[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const currentBusiness = allBusinesses.find(b => b.id === selectedBusinessId);

    const isDemoUser = user?.id === 'demo-user-123';
    const useSupabase = !isDemoUser && !!user && process.env.NEXT_PUBLIC_SUPABASE_URL !== 'https://placeholder-project.supabase.co';

    // Fetch businesses and rooms from Supabase
    useEffect(() => {
        if (!useSupabase) {
            // 데모 모드 or 미로그인: mock 데이터 사용
            // eslint-disable-next-line @typescript-eslint/no-var-requires
            const { businesses: mockB, allRooms: mockR, payments: mockP } = require('@/lib/data');
            setAllBusinesses(mockB);
            setRooms(mockR);
            if (mockP) setPayments(mockP);
            return;
        }

        const fetchData = async () => {
            setIsLoading(true);
            try {

                // 1. Fetch Businesses (Auto-filtered by RLS owner_id)
                // Since Demo User sets owner_id to NULL, demo users will get those rows too!
                const { data: bData, error: bError } = await supabase.from('businesses').select('*');
                if (bError) throw bError;

                if (bData) {
                    const mappedBusinesses: Business[] = (bData as BusinessRow[]).map((d) => ({
                        id: d.id,
                        name: d.name,
                        ownerName: d.owner_name || user.email?.split('@')[0] || "대표님",
                        registrationNumber: d.registration_number,
                        address: d.address || ""
                    }));
                    setAllBusinesses(mappedBusinesses);
                    if (mappedBusinesses.length > 0 && selectedBusinessId === "ALL" && false) {
                        // Optional: auto-select first business if needed, but ALL is fine
                    }
                }

                // 2. Fetch Rooms
                const { data: rData, error: rError } = await supabase.from('rooms').select('*');
                if (rError) throw rError;

                if (rData && rData.length > 0) {
                    const mappedRooms: Room[] = (rData as RoomRow[]).map((d) => ({
                        id: d.id,
                        businessId: d.business_id,
                        name: d.name,
                        status: d.status,
                        autoNotify: d.auto_notify,
                        unpaidMonths: d.unpaid_months,
                        unpaidAmount: d.unpaid_amount,
                        leaseStart: d.lease_start,
                        leaseEnd: d.lease_end,
                        paymentInfo: {
                            deposit: d.deposit ?? 0,
                            monthlyRent: d.monthly_rent ?? 0,
                            dueDate: d.due_date ?? "매월 25일",
                            isVATIncluded: d.is_vat_included ?? false
                        },
                        tenant: d.tenant_id ? {
                            id: d.tenant_id,
                            name: d.tenant_name ?? "미확인",
                            contact: d.tenant_contact,
                            companyName: d.tenant_company_name,
                            businessRegistrationNumber: d.tenant_business_reg_num
                        } : null
                    }));
                    setRooms(mappedRooms);
                }

                // 3. Fetch Payments
                const { data: pData, error: pError } = await supabase
                    .from('payments')
                    .select('*')
                    .order('paid_at', { ascending: false });
                if (pError) {
                    // payments 테이블이 없을 경우 graceful 처리
                    console.warn('payments 테이블 없음 (아직 마이그레이션 미실행):', pError.message);
                } else if (pData) {
                    const mappedPayments: Payment[] = (pData as PaymentRow[]).map((d) => ({
                        id: d.id,
                        businessId: d.business_id,
                        roomId: d.room_id,
                        tenantName: d.tenant_name,
                        amount: d.amount,
                        paidAt: d.paid_at,
                        month: d.month,
                        status: d.status,
                        note: d.note,
                    }));
                    setPayments(mappedPayments);
                }
            } catch (err) {
                console.error("Failed to fetch data from Supabase:", err);
            } finally {
                setIsLoading(false);
            }
        };

        fetchData();
    }, [useSupabase, user]);

    const getRoomsByBusiness = (businessId: string) => {
        if (businessId === "ALL") return rooms;
        return rooms.filter(r => r.businessId === businessId);
    };

    const getPaymentsByBusiness = (businessId: string) => {
        if (businessId === "ALL") return payments;
        return payments.filter(p => p.businessId === businessId);
    };

    const addPayment = (payment: Payment) => {
        setPayments(prev => [payment, ...prev]);
    };

    const refetchPayments = async () => {
        if (!useSupabase) return;
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) return;
            const res = await fetch('/api/payments', {
                headers: { Authorization: `Bearer ${session.access_token}` }
            });
            const json = await res.json();
            if (json.payments) {
                const mapped: Payment[] = json.payments.map((d: { id: string; business_id: string; room_id: string; tenant_name: string; amount: number; paid_at: string; month: string; status: 'PAID' | 'UNPAID' | 'PARTIAL'; note?: string }) => ({
                    id: d.id,
                    businessId: d.business_id,
                    roomId: d.room_id,
                    tenantName: d.tenant_name,
                    amount: d.amount,
                    paidAt: d.paid_at,
                    month: d.month,
                    status: d.status,
                    note: d.note,
                }));
                setPayments(mapped);
            }
        } catch (err) {
            console.error('refetchPayments error:', err);
        }
    };

    return (
        <BusinessContext.Provider value={{
            selectedBusinessId,
            setSelectedBusinessId,
            currentBusiness,
            allBusinesses,
            setAllBusinesses,
            rooms,
            setRooms,
            payments,
            getRoomsByBusiness,
            getPaymentsByBusiness,
            addPayment,
            refetchPayments,
            isLoading
        }}>
            {children}
        </BusinessContext.Provider>
    );
}

export function useBusiness() {
    const context = useContext(BusinessContext);
    if (context === undefined) {
        throw new Error("useBusiness must be used within a BusinessProvider");
    }
    return context;
}
