'use client'

export const dynamic = 'force-dynamic'

import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Loader2, Database, Trash2, CheckCircle2, AlertCircle } from 'lucide-react'

export default function SeedDemoPage() {
  const supabase = createClient()
  const [loading, setLoading] = useState(false)
  const [result, setResult]   = useState<{ message: string; results?: { room: string; status: string }[] } | null>(null)
  const [error, setError]     = useState<string | null>(null)

  const callApi = async (method: 'POST' | 'DELETE') => {
    setLoading(true)
    setResult(null)
    setError(null)
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) { setError('로그인이 필요합니다.'); setLoading(false); return }

      const res = await fetch('/api/seed-demo', {
        method,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session.access_token}`,
        },
      })
      const data = await res.json()
      if (!res.ok) setError(data.error ?? 'API 오류')
      else setResult(data)
    } catch (e) {
      setError(String(e))
    }
    setLoading(false)
  }

  return (
    <div className="p-8 max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-neutral-900 mb-2">🌱 샘플 데이터 생성</h1>
        <p className="text-sm text-neutral-500">
          테스트용 입주사 10명 (청구서 + 계약서 + 입금내역 포함)을 한 번에 생성합니다.
        </p>
      </div>

      <div className="bg-white rounded-2xl border border-neutral-200 p-6 mb-6 space-y-3">
        <h2 className="font-semibold text-neutral-700 mb-4">생성될 샘플 데이터</h2>
        <div className="grid grid-cols-2 gap-2 text-sm text-neutral-600">
          {[
            ['101호 김민준', '보증금 50만 / 월세 40만'],
            ['102호 이서연', '보증금 30만 / 월세 30만'],
            ['103호 박지훈', '보증금 80만 / 월세 45만'],
            ['104호 최수아', '보증금 100만 / 월세 50만'],
            ['105호 정도현', '보증금 60만 / 월세 38만'],
            ['201호 한지민', '보증금 40만 / 월세 32만'],
            ['202호 오세훈', '보증금 70만 / 월세 42만'],
            ['203호 윤아름', '보증금 50만 / 월세 35만'],
            ['204호 임태양', '보증금 90만 / 월세 48만'],
            ['205호 강나리', '보증금 30만 / 월세 30만'],
          ].map(([name, info]) => (
            <div key={name} className="bg-neutral-50 rounded-lg p-2.5">
              <p className="font-medium text-neutral-800">{name}</p>
              <p className="text-xs text-neutral-500 mt-0.5">{info}</p>
            </div>
          ))}
        </div>
        <p className="text-xs text-neutral-400 pt-2">
          ✅ 완납(7명) + ❌ 미납(3명) / 계약서 서명완료(5개) + 발송됨(5개)
        </p>
      </div>

      <div className="flex gap-3 mb-6">
        <button
          onClick={() => callApi('POST')}
          disabled={loading}
          className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl font-semibold text-white disabled:opacity-60"
          style={{ background: '#1D3557' }}>
          {loading ? <Loader2 size={18} className="animate-spin" /> : <Database size={18} />}
          샘플 데이터 생성
        </button>
        <button
          onClick={() => callApi('DELETE')}
          disabled={loading}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-semibold border border-red-200 text-red-600 hover:bg-red-50 disabled:opacity-60">
          <Trash2 size={18} />
          초기화
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2 p-4 rounded-xl bg-red-50 border border-red-200 text-red-700 text-sm mb-4">
          <AlertCircle size={16} className="shrink-0 mt-0.5" />
          {error}
        </div>
      )}

      {result && (
        <div className="p-4 rounded-xl bg-green-50 border border-green-200">
          <div className="flex items-center gap-2 mb-3">
            <CheckCircle2 size={18} className="text-green-600" />
            <p className="font-semibold text-green-800">{result.message}</p>
          </div>
          {result.results && (
            <div className="space-y-1">
              {result.results.map(r => (
                <div key={r.room} className="flex justify-between text-sm text-green-700">
                  <span>{r.room}</span>
                  <span className="font-medium">{r.status}</span>
                </div>
              ))}
            </div>
          )}
          <div className="mt-4 pt-3 border-t border-green-200">
            <p className="text-xs text-green-600">생성 완료! 아래 페이지에서 확인하세요:</p>
            <div className="flex gap-2 mt-2">
              {[
                ['입주사 관리', '/tenants'],
                ['수납 매칭', '/payments'],
                ['전자계약', '/contracts'],
                ['보고서', '/reports'],
              ].map(([label, href]) => (
                <a key={href} href={href}
                   className="px-3 py-1.5 text-xs font-medium rounded-lg bg-green-700 text-white hover:bg-green-800">
                  {label}
                </a>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
