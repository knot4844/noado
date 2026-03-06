import React from "react";

interface DashboardCardProps {
    title: string;
    value: string | number;
    subtitle?: string;
    icon?: React.ReactNode;
    trend?: {
        value: number;
        isPositive: boolean;
    };
}

export function DashboardCard({ title, value, subtitle, icon, trend }: DashboardCardProps) {
    return (
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-neutral-100 flex flex-col justify-between hover:shadow-md transition-all cursor-pointer hover:-translate-y-1">
            <div className="flex justify-between items-start mb-4">
                <h3 className="text-sm font-medium text-neutral-500">{title}</h3>
                {icon && <div className="text-neutral-400">{icon}</div>}
            </div>

            <div>
                <div className="flex items-baseline gap-2">
                    <span className="text-3xl font-bold text-neutral-900">{value}</span>
                    {trend && (
                        <span className={`text-sm font-medium ${trend.isPositive ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {trend.isPositive ? '+' : '-'}{Math.abs(trend.value)}%
                        </span>
                    )}
                </div>
                {subtitle && <p className="text-sm text-neutral-500 mt-1">{subtitle}</p>}
            </div>
        </div>
    );
}
