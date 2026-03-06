"use client";

import { useState, useRef } from "react";
import { X, Upload, CheckCircle2, AlertCircle, Loader2, FileSpreadsheet } from "lucide-react";
import * as XLSX from "xlsx";
import { supabase } from "@/lib/supabase";
import { useBusiness } from "@/components/providers/BusinessProvider";
import { Room } from "@/lib/data";

interface BankRow {
    date: string;       // 날짜
    description: string; // 적요/메모
    amount: number;     // 입금액
    balance?: number;   // 잔액
}

interface MatchedRow extends BankRow {
    matchedRoom: Room | null;
    selected: boolean;
    month: string;
}

interface ImportBankStatementModalProps {
    onClose: () => void;
    onImported: () => void;
}

// 알려진 은행 컬럼 키워드 매핑
const DATE_KEYS = ['거래일시', '거래일자', '날짜', '일자', '거래일', 'date'];
// 실제 입금인 이름이 있는 컬럼 (적요보다 우선)
const NAME_KEYS = ['기재내용', '내용', '통장메모', '메모', '비고', '거래메모'];
// 거래 유형 컬럼 (타행인터넷뱅킹, 모바일 등)
const TYPE_KEYS = ['적요', '거래내용', '거래구분', '거래종류', '내역', 'desc', 'description'];
const DEPOSIT_KEYS = ['입금금액', '입금액', '입금', '입금(원)', '받은금액', 'deposit', '크레딧'];
const BALANCE_KEYS = ['잔액', '잔고', 'balance', '잔액(원)'];

function findColValue(row: Record<string, string | number>, keywords: string[]): string | number | undefined {
    for (const key of Object.keys(row)) {
        const normalized = key.replace(/\s/g, '').toLowerCase();
        if (keywords.some(k => normalized.includes(k.toLowerCase()))) {
            return row[key];
        }
    }
    return undefined;
}

function parseDate(val: string | number | undefined): string {
    if (!val) return '';
    const s = String(val).trim();
    // YYYY-MM-DD HH:mm:ss → YYYY-MM-DD
    const m = s.match(/(\d{4})[.\-/]?(\d{2})[.\-/]?(\d{2})/);
    if (m) return `${m[1]}-${m[2]}-${m[3]}`;
    return s.slice(0, 10);
}

// 주요 은행 엑셀 컬럼 파서 (신한, 국민, 기업, 우리, 하나)
function parseBankExcel(rows: Record<string, string | number>[]): BankRow[] {
    if (rows.length === 0) return [];

    const result: BankRow[] = [];

    // 첫 행 헤더를 보고 헤더 기반 파싱 가능 여부 확인
    const firstKeys = Object.keys(rows[0]);
    const hasKnownHeader = firstKeys.some(k => {
        const n = k.replace(/\s/g, '').toLowerCase();
        return [...DATE_KEYS, ...NAME_KEYS, ...TYPE_KEYS, ...DEPOSIT_KEYS].some(kw => n.includes(kw.toLowerCase()));
    });

    for (const row of rows) {
        if (hasKnownHeader) {
            // ── 헤더 기반 파싱 (신한, 국민 등) ──
            const dateRaw = findColValue(row, DATE_KEYS);
            // 기재내용(실제 이름) 우선, 없으면 적요(거래유형)
            const nameRaw = findColValue(row, NAME_KEYS);
            const typeRaw = findColValue(row, TYPE_KEYS);
            const depositRaw = findColValue(row, DEPOSIT_KEYS);
            const balanceRaw = findColValue(row, BALANCE_KEYS);

            const date = parseDate(dateRaw);
            if (!date) continue;

            const amount = Number(depositRaw) || 0;
            if (amount <= 0) continue; // 출금/0원 건 스킵

            const balance = balanceRaw !== undefined ? Number(balanceRaw) : undefined;

            // 설명: 기재내용(이름) 우선, 없으면 적요(유형)
            const nameStr = String(nameRaw ?? '').trim();
            const typeStr = String(typeRaw ?? '').trim();
            const description = nameStr || typeStr;

            result.push({ date, description, amount, balance });
        } else {
            // ── 폴백: 휴리스틱 파싱 ──
            const values = Object.values(row).map(v => String(v ?? ''));
            const dateVal = values.find(v => /^\d{4}[.\-/]?\d{2}[.\-/]?\d{2}/.test(v.trim()));
            if (!dateVal) continue;

            const numCols = Object.entries(row)
                .filter(([, v]) => typeof v === 'number' && (v as number) > 0)
                .map(([, v]) => Number(v));
            if (numCols.length === 0) continue;

            const sorted = [...numCols].sort((a, b) => a - b);
            const amount = sorted.find(v => v > 0 && v < (sorted[sorted.length - 1] || Infinity));
            if (!amount) continue;

            // 시간 패턴(HH:mm:ss) 제외하고 적요 탐색
            const descVal = values.find(v =>
                v && v.trim() &&
                !/^\d+$/.test(v) &&
                !/^\d{2}:\d{2}(:\d{2})?$/.test(v.trim()) &&
                v !== dateVal
            ) || '';

            result.push({ date: parseDate(dateVal), description: descVal.trim(), amount });
        }
    }
    return result;
}

// 임차인 이름 / 금액으로 호실 자동 매칭
function autoMatch(row: BankRow, rooms: Room[]): Room | null {
    // 1. 임차인 이름 포함 여부
    for (const room of rooms) {
        const name = room.tenant?.name || '';
        const company = room.tenant?.companyName || '';
        if (name && row.description.includes(name)) return room;
        if (company && row.description.includes(company)) return room;
    }
    // 2. 금액 일치
    const byAmount = rooms.filter(r =>
        r.paymentInfo?.monthlyRent === row.amount
    );
    if (byAmount.length === 1) return byAmount[0];
    return null;
}

export function ImportBankStatementModal({ onClose, onImported }: ImportBankStatementModalProps) {
    const { selectedBusinessId, getRoomsByBusiness, addPayment } = useBusiness();
    const rooms = getRoomsByBusiness(selectedBusinessId).filter(r => r.status !== 'VACANT');

    const [step, setStep] = useState<'upload' | 'review' | 'done'>('upload');
    const [rows, setRows] = useState<MatchedRow[]>([]);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const fileRef = useRef<HTMLInputElement>(null);

    const today = new Date();
    const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`;

    const handleFile = (file: File) => {
        setError(null);
        const reader = new FileReader();
        reader.onload = (e) => {
            try {
                const data = e.target?.result;
                const wb = XLSX.read(data, { type: 'binary' });
                const ws = wb.Sheets[wb.SheetNames[0]];

                // ── 헤더 행 동적 탐색 ──
                // 신한, 국민 등 은행 엑셀은 상단에 계좌번호/조회기간 등 메타 행이 있음
                // raw 배열로 읽어서 '거래일시', '적요', '입금' 등 실제 헤더가 있는 행을 찾음
                const rawAll = XLSX.utils.sheet_to_json<string[]>(ws, { header: 1, defval: '' }) as string[][];
                const HEADER_KEYWORDS = ['거래일시', '거래일자', '날짜', '적요', '입금금액', '입금액', '입금', '거래내용'];

                let headerRowIndex = -1;
                for (let i = 0; i < Math.min(rawAll.length, 20); i++) {
                    const row = rawAll[i];
                    const rowJoined = row.map(c => String(c ?? '').replace(/\s/g, '')).join('|');
                    const matchCount = HEADER_KEYWORDS.filter(k => rowJoined.includes(k)).length;
                    if (matchCount >= 2) { // 2개 이상 키워드가 있으면 헤더 행으로 판단
                        headerRowIndex = i;
                        break;
                    }
                }

                let jsonRows: Record<string, string | number>[];
                if (headerRowIndex >= 0) {
                    // 헤더 행을 찾은 경우: 해당 행을 헤더로 지정해 파싱
                    jsonRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, {
                        defval: '',
                        range: headerRowIndex, // 이 행부터 읽기 (헤더로 사용)
                    });
                } else {
                    // 찾지 못했으면 기본 파싱
                    jsonRows = XLSX.utils.sheet_to_json<Record<string, string | number>>(ws, { defval: '' });
                }

                // 🔍 디버그: 실제 컬럼명 확인
                if (jsonRows.length > 0) {
                    console.log('[은행엑셀] 감지된 컬럼명:', Object.keys(jsonRows[0]));
                    console.log('[은행엑셀] 첫 행 데이터:', jsonRows[0]);
                }

                const parsed = parseBankExcel(jsonRows);
                if (parsed.length === 0) {
                    setError('입금 내역을 찾을 수 없습니다. 신한·국민·기업·우리·하나은행 엑셀 파일을 사용해주세요.');
                    return;
                }

                const matched: MatchedRow[] = parsed.map(row => ({
                    ...row,
                    matchedRoom: autoMatch(row, rooms),
                    selected: !!autoMatch(row, rooms),
                    month: currentMonth,
                }));
                setRows(matched);
                setStep('review');
            } catch {
                setError('파일을 읽는 중 오류가 발생했습니다.');
            }
        };
        reader.readAsBinaryString(file);
    };


    const handleSubmit = async () => {
        setIsSubmitting(true);
        setError(null);
        try {
            const { data: { session } } = await supabase.auth.getSession();
            if (!session) throw new Error('로그인이 필요합니다.');

            const toImport = rows.filter(r => r.selected && r.matchedRoom);

            for (const row of toImport) {
                const room = row.matchedRoom!;
                const res = await fetch('/api/payments', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        Authorization: `Bearer ${session.access_token}`,
                    },
                    body: JSON.stringify({
                        businessId: room.businessId,
                        roomId: room.id,
                        tenantName: room.tenant?.name || row.description,
                        amount: row.amount,
                        paidAt: row.date,
                        month: row.month,
                        status: 'PAID',
                        note: `통장내역 가져오기: ${row.description}`,
                    }),
                });
                const data = await res.json();
                if (!res.ok) throw new Error(data.error);

                addPayment({
                    id: data.payment.id,
                    businessId: data.payment.business_id,
                    roomId: data.payment.room_id,
                    tenantName: data.payment.tenant_name,
                    amount: data.payment.amount,
                    paidAt: data.payment.paid_at,
                    month: data.payment.month,
                    status: data.payment.status,
                    note: data.payment.note,
                });
            }
            setStep('done');
            onImported();
        } catch (err: unknown) {
            setError(err instanceof Error ? err.message : '오류가 발생했습니다.');
        } finally {
            setIsSubmitting(false);
        }
    };

    const matchedCount = rows.filter(r => r.selected && r.matchedRoom).length;
    const unmatchedCount = rows.filter(r => !r.matchedRoom).length;

    return (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b border-neutral-100">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-50 rounded-lg">
                            <FileSpreadsheet size={20} className="text-blue-600" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-neutral-900">통장내역 가져오기</h2>
                            <p className="text-xs text-neutral-500">은행 엑셀 파일로 수납 자동 등록</p>
                        </div>
                    </div>
                    <button onClick={onClose} className="p-2 hover:bg-neutral-100 rounded-lg transition-colors">
                        <X size={18} />
                    </button>
                </div>

                {/* Content */}
                <div className="flex-1 overflow-y-auto p-6">
                    {step === 'upload' && (
                        <div className="space-y-4">
                            <div
                                className="border-2 border-dashed border-neutral-200 rounded-xl p-10 text-center cursor-pointer hover:border-blue-400 hover:bg-blue-50/50 transition-all"
                                onClick={() => fileRef.current?.click()}
                                onDragOver={e => e.preventDefault()}
                                onDrop={e => {
                                    e.preventDefault();
                                    const file = e.dataTransfer.files[0];
                                    if (file) handleFile(file);
                                }}
                            >
                                <Upload size={36} className="mx-auto mb-3 text-neutral-300" />
                                <p className="font-semibold text-neutral-700">엑셀 파일을 드래그하거나 클릭하세요</p>
                                <p className="text-sm text-neutral-400 mt-1">신한, 국민, 기업, 우리, 하나은행 엑셀 지원</p>
                                <input
                                    ref={fileRef}
                                    type="file"
                                    accept=".xlsx,.xls,.csv"
                                    className="hidden"
                                    onChange={e => {
                                        const file = e.target.files?.[0];
                                        if (file) handleFile(file);
                                    }}
                                />
                            </div>

                            {/* 은행별 다운로드 안내 */}
                            <div className="bg-neutral-50 rounded-xl p-4 text-sm text-neutral-600 space-y-1">
                                <p className="font-semibold mb-2">📋 은행별 엑셀 다운로드 경로</p>
                                <p>• <strong>신한</strong>: 인터넷뱅킹 → 조회 → 거래내역 → 엑셀 다운로드</p>
                                <p>• <strong>국민</strong>: KB스타뱅킹 → 계좌 → 거래내역 → 내보내기</p>
                                <p>• <strong>기업</strong>: i-ONE뱅킹 → 입출금내역 → 엑셀저장</p>
                                <p>• <strong>우리</strong>: 우리WON뱅킹 → 거래내역 → 엑셀</p>
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'review' && (
                        <div className="space-y-4">
                            {/* 요약 */}
                            <div className="grid grid-cols-3 gap-3">
                                <div className="bg-blue-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-blue-700">{rows.length}</p>
                                    <p className="text-xs text-blue-600">전체 입금</p>
                                </div>
                                <div className="bg-emerald-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-emerald-700">{matchedCount}</p>
                                    <p className="text-xs text-emerald-600">자동 매칭</p>
                                </div>
                                <div className="bg-amber-50 rounded-xl p-3 text-center">
                                    <p className="text-2xl font-bold text-amber-700">{unmatchedCount}</p>
                                    <p className="text-xs text-amber-600">미매칭 (수동 필요)</p>
                                </div>
                            </div>

                            {/* 목록 */}
                            <div className="space-y-2">
                                {rows.map((row, i) => (
                                    <div
                                        key={i}
                                        className={`border rounded-xl p-3 transition-all ${row.selected
                                            ? 'border-emerald-300 bg-emerald-50/50'
                                            : 'border-neutral-200 bg-white'
                                            }`}
                                    >
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                checked={row.selected}
                                                disabled={!row.matchedRoom}
                                                onChange={e => {
                                                    const updated = [...rows];
                                                    updated[i].selected = e.target.checked;
                                                    setRows(updated);
                                                }}
                                                className="w-4 h-4 accent-emerald-600"
                                            />
                                            <div className="flex-1 min-w-0">
                                                {/* 내용 (적요) — 크고 굵게 */}
                                                <p className={`text-sm font-semibold truncate ${row.description ? 'text-neutral-900' : 'text-neutral-300 italic'}`}>
                                                    {row.description || '(적요 없음)'}
                                                </p>
                                                {/* 금액 + 날짜 */}
                                                <div className="flex items-center gap-2 mt-0.5">
                                                    <span className="text-sm font-bold text-blue-600">
                                                        ₩{row.amount.toLocaleString()}
                                                    </span>
                                                    <span className="text-xs text-neutral-400">{row.date}</span>
                                                </div>
                                            </div>
                                            <div className="text-right flex-shrink-0">
                                                {row.matchedRoom ? (
                                                    <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full font-bold">
                                                        {row.matchedRoom.name}
                                                    </span>
                                                ) : (
                                                    <div className="flex items-center gap-1">
                                                        <select
                                                            className="text-xs border border-neutral-200 rounded-lg px-2 py-1 outline-none focus:border-blue-400"
                                                            value=""
                                                            onChange={e => {
                                                                const room = rooms.find(r => r.id === e.target.value) || null;
                                                                const updated = [...rows];
                                                                updated[i].matchedRoom = room;
                                                                updated[i].selected = !!room;
                                                                setRows(updated);
                                                            }}
                                                        >
                                                            <option value="">호실 선택</option>
                                                            {rooms.map(r => (
                                                                <option key={r.id} value={r.id}>{r.name} — {r.tenant?.name}</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        {/* 대상 월 수정 */}
                                        {row.selected && row.matchedRoom && (
                                            <div className="mt-2 pl-7 flex items-center gap-2">
                                                <span className="text-xs text-neutral-500">대상 월:</span>
                                                <input
                                                    type="month"
                                                    value={row.month}
                                                    className="text-xs border border-neutral-200 rounded px-2 py-0.5 outline-none focus:border-blue-400"
                                                    onChange={e => {
                                                        const updated = [...rows];
                                                        updated[i].month = e.target.value;
                                                        setRows(updated);
                                                    }}
                                                />
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>

                            {error && (
                                <div className="flex items-center gap-2 p-3 bg-rose-50 text-rose-700 rounded-lg text-sm">
                                    <AlertCircle size={16} />
                                    {error}
                                </div>
                            )}
                        </div>
                    )}

                    {step === 'done' && (
                        <div className="flex flex-col items-center justify-center py-12 gap-4">
                            <CheckCircle2 size={56} className="text-emerald-500" />
                            <p className="text-xl font-bold text-neutral-900">수납 등록 완료!</p>
                            <p className="text-neutral-500 text-sm">{matchedCount}건이 수납 현황에 반영되었습니다.</p>
                        </div>
                    )}
                </div>

                {/* Footer */}
                {step !== 'done' && (
                    <div className="p-6 border-t border-neutral-100 flex gap-3">
                        <button
                            onClick={step === 'review' ? () => setStep('upload') : onClose}
                            className="flex-1 py-2.5 border border-neutral-200 rounded-xl text-sm font-bold text-neutral-600 hover:bg-neutral-50 transition-colors"
                        >
                            {step === 'review' ? '← 다시 업로드' : '취소'}
                        </button>
                        {step === 'review' && (
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || matchedCount === 0}
                                className="flex-1 py-2.5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-sm font-bold disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                {isSubmitting
                                    ? <><Loader2 size={16} className="animate-spin" /> 등록 중...</>
                                    : `${matchedCount}건 수납 등록`
                                }
                            </button>
                        )}
                    </div>
                )}

                {step === 'done' && (
                    <div className="p-6 border-t border-neutral-100">
                        <button
                            onClick={onClose}
                            className="w-full py-2.5 bg-neutral-900 text-white rounded-xl text-sm font-bold"
                        >
                            닫기
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
}
