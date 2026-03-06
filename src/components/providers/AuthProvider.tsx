"use client";

import { createContext, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { User } from "@supabase/supabase-js";
import { useRouter, usePathname } from "next/navigation";
import { Loader2 } from "lucide-react";

interface AuthContextType {
    user: User | null;
    isLoading: boolean;
    signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
    user: null,
    isLoading: true,
    signOut: async () => { },
});

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (context === undefined) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

// Helper for demo login/logout exported for convenience
export const toggleDemoLogin = (status: boolean) => {
    if (typeof window === 'undefined') return;
    if (status) {
        document.cookie = "noado_demo_mode=true; path=/";
        localStorage.setItem('local_demo_login', 'true');
        window.location.href = '/dashboard';
    } else {
        document.cookie = "noado_demo_mode=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT";
        localStorage.removeItem('local_demo_login');
        window.location.href = '/login';
    }
};
export function AuthProvider({ children }: { children: ReactNode }) {
    const [user, setUser] = useState<User | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const router = useRouter();
    const pathname = usePathname();

    useEffect(() => {
        // Check for demo login first (Local UI testing bypassing Supabase)
        if (typeof window !== 'undefined' && localStorage.getItem('local_demo_login') === 'true') {
            setUser({ id: 'demo-user-123', email: 'demo@daewoo-office.com' } as any);
            setIsLoading(false);
            return;
        }

        // 1. Check active session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setUser(session?.user ?? null);
            setIsLoading(false);
        });

        // 2. Listen for auth changes
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setUser(session?.user ?? null);
                setIsLoading(false);
            }
        );

        return () => {
            subscription?.unsubscribe();
        };
    }, []);

    // 3. Route Guard
    useEffect(() => {
        if (!isLoading) {
            // Check for OAuth redirect (PKCE or Implicit)
            if (typeof window !== 'undefined' &&
                (window.location.search.includes('code=') || window.location.hash.includes('access_token='))) {
                return; // Let the callback handler take over
            }

            const publicRoutes = ['/', '/login', '/signup', '/master-admin', '/terms', '/privacy'];
            const isPublicPath = publicRoutes.includes(pathname) || pathname?.startsWith('/pricing') || pathname?.startsWith('/auth/');

            // Allow tenant flows to manage their own auth (they have local guards)
            const isTenantPath = pathname?.startsWith('/invite') || pathname?.startsWith('/tenant') || pathname?.startsWith('/portal') || pathname?.startsWith('/contracts');

            if (!user && !isPublicPath && !isTenantPath) {
                // Not logged in and trying to access landlord private route -> redirect to login
                router.push('/login');
            } else if (user && (pathname === '/login' || pathname === '/signup')) {
                // Logged in but on login/signup page -> redirect based on role
                const role = user.user_metadata?.role || "LANDLORD";
                router.push(role === "TENANT" ? "/tenant-portal" : "/dashboard");
            }
        }
    }, [user, isLoading, pathname, router]);

    const signOut = async () => {
        setIsLoading(true);
        await supabase.auth.signOut();
        router.push('/login');
    };

    return (
        <AuthContext.Provider value={{ user, isLoading, signOut }}>
            {isLoading && (
                <div className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-neutral-50 text-blue-600">
                    <Loader2 size={48} className="animate-spin mb-4" />
                    <p className="font-bold">인증 상태를 확인 중입니다...</p>
                </div>
            )}
            <div style={{ display: isLoading ? 'none' : 'block' }} className="w-full h-full min-h-screen">
                {children}
            </div>
        </AuthContext.Provider>
    );
}
