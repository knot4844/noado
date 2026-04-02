'use client'

export const dynamic = 'force-dynamic'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import {
  MessageSquare, Send, CheckCircle2, AlertCircle,
  Loader2, X, Phone, RefreshCw,
} from 'lucide-react'
import { formatDate, formatPhone } from '@/lib/utils'
import type { NotificationLog, Room } from '@/types'

/* ─── 알림톡 템플릿 (env에 있는 3개) ─── */
const TEMPLATES = {
  UNPAID_REMINDER: {
    key:     'UNPAID_REMINDER',
    label:   '미납 독촉',
    desc:    '납부 기한 초과 알림',
    preview: (tenantName: string, roomName: string, amount: string) =>
      `[noado] 안녕하세요, ${tenantName}님.\n${roomName} 이번 달 월세 ${amount}원이 아직 납부되지 않았습니다.\n빠른 납부 부탁드립니다.\n\n문의: noado 관리자`,
  },
  PAYMENT_DONE: {
    key:     'PAYMENT_DONE',
    label:   '수납 완료',
    desc:    '입금 확인 완료 알림',
    preview: (tenantName: string, roomName: string, amount: string) =>
      `[noado] 안녕하세요, ${tenantName}님.\n${roomName} 이번 달 월세 ${amount}원 수납이 확인되었습니다.\n감사합니다.`,
  },
  DAILY_BRIEFING: {
    key:     'DAILY_BRIEFING',
    label:   '일일 브리핑',
    desc:    '오늘의 수납 현황 요약 (AI 생성)',
    preview: (_: string, __: string, ___: string) =>
      `[noado] 오늘의 관리 현황 브리핑\n\n수납 완료: 12건 / 15건\n미납 알림 발송 예정: 3건\n\n※ 실제 발송 시 AI가 현황을 요약합니다.`,
  },
} as const

type TemplateKey = keyof typeof TEMPLATES

/* ─── 메인 ─── */
export default function NotificationsPage() {
  const supabase = useMemo(() => createClient(), [])

  const [logs, setLogs]       = useState<NotificationLog[]>([])
  const [rooms, setRooms]     = useState<Room[]>([])
  const [loading, setLoading] = useState(true)
  const [sending, setSending] = useState(false)
  const [toast, setToast]     = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // 발송 폼
  const [showForm, setShowForm]               = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateKey>('UNPAID_REMINDER')
  const [selectedRooms, setSelectedRooms]       = useState<Set<string>>(new Set())

  const load = useCallback(async () => {
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) { setLoading(false); return }

    const [{ data: logData }, { data: roomData }] = await Promise.all([
      supabase
        .from('notification_logs')
        .select('*')
        .eq('owner_id', user.id)
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('rooms')
        .select('*')
        .eq('owner_id', user.id)
        .neq('status', 'VACANT')
        .order('name'),
    ])

    setLogs(logData || [])
    setRooms(roomData || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { setTimeout(() => load(), 0) }, [load])

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg }); setTimeout(() => setToast(null), 3500)
  }

  /* ─── 발송 ─── */
  const handleSend = async () => {
    if (selectedRooms.size === 0) return showToast('error', '발송할 입주사를 선택해주세요.')
    setSending(true)

    const targetRooms = rooms.filter(r => selectedRooms.has(r.id))
    const results = await Promise.all(
      targetRooms.map(async r => {
        if (!r.tenant_phone) return { room: r, ok: false, reason: '연락처 없음' }

        const res = await fetch('/api/alimtalk', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            templateKey: selectedTemplate,
            phone:       r.tenant_phone,
            roomName:    r.name,
            tenantName:  r.tenant_name  ?? '입주사',
            amount:      String(r.monthly_rent),
            dueDate:     '매월 10일',
            roomId:      r.id,
          }),
        })
        return { room: r, ok: res.ok }
      })
    )

    const successCount = results.filter(r => r.ok).length
    const failCount    = results.length - successCount
    const noPhone      = results.filter(r => !r.ok && (r as { reason?: string }).reason === '연락처 없음').length

    if (noPhone > 0) showToast('error', `연락처 없음 ${noPhone}건 제외, ${successCount}건 발송 완료`)
    else if (failCount === 0) showToast('success', `${successCount}건 발송 완료`)
    else showToast('error', `${successCount}건 성공, ${failCount}건 실패`)

    setShowForm(false)
    setSelectedRooms(new Set())
    load()
    setSending(false)
  }

  /* ─── 통계 ─── */
  const stats = {
    total:   logs.length,
    success: logs.filter(l => l.status === 'success').length,
    failed:  logs.filter(l => l.status === 'failed').length,
  }

  const tpl    = TEMPLATES[selectedTemplate]
  const sample = rooms.find(r => selectedRooms.has(r.id)) ?? rooms[0]

  const TEMPLATE_KEYS = Object.keys(TEMPLATES) as TemplateKey[]

  return (
    <div className="p-3 sm:p-6 max-w-[1200px]">
      {/* Toast */}
      {toast && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-2 px-4 py-3 rounded-xl shadow-lg text-sm font-medium text-white"
             style={{ background: toast.type === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
          {toast.type === 'success' ? <CheckCircle2 size={16} /> : <AlertCircle size={16} />}
          {toast.msg}
        </div>
      )}

      {/* 헤더 */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
            알림톡
          </h1>
          <p className="text-sm mt-0.5" style={{ color: 'var(--color-muted)' }}>
            카카오 알림톡 템플릿 발송 및 이력 관리
          </p>
        </div>
        <button onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold text-white"
          style={{ background: 'var(--color-primary)' }}>
          <Send size={16} /> 알림톡 발송
        </button>
      </div>

      {/* 통계 */}
      <div className="grid grid-cols-3 gap-4 mb-6">
        {[
          { label: '총 발송',  value: stats.total,   color: 'var(--color-primary)' },
          { label: '성공',     value: stats.success, color: 'var(--color-success)' },
          { label: '실패',     value: stats.failed,  color: 'var(--color-danger)'  },
        ].map(k => (
          <div key={k.label} className="rounded-2xl p-5"
               style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
            <p className="text-xs mb-1 font-medium" style={{ color: 'var(--color-muted)' }}>{k.label}</p>
            <p className="text-3xl font-bold" style={{ color: k.color, fontFamily: 'var(--font-display)' }}>
              {k.value}
            </p>
          </div>
        ))}
      </div>

      {/* 발송 이력 */}
      <div className="rounded-2xl overflow-hidden" style={{ background: 'var(--color-surface)', boxShadow: 'var(--shadow-soft)' }}>
        <div className="px-5 py-4 border-b flex items-center justify-between" style={{ borderColor: 'var(--color-border)' }}>
          <h2 className="text-sm font-semibold" style={{ color: 'var(--color-primary)' }}>발송 이력</h2>
          <button onClick={load} style={{ color: 'var(--color-muted)' }}><RefreshCw size={15} /></button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 size={24} className="animate-spin" style={{ color: 'var(--color-primary)' }} />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-sm" style={{ color: 'var(--color-muted)' }}>
            <MessageSquare size={28} className="mb-2 opacity-30" />
            발송 이력이 없습니다.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--color-border)' }}>
                {['발송일시', '수신자', '연락처', '템플릿', '상태'].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold"
                      style={{ color: 'var(--color-muted)', background: 'var(--color-muted-bg)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {logs.map((log, i) => (
                <tr key={log.id} style={{ borderBottom: i < logs.length-1 ? '1px solid var(--color-border)' : 'none' }}>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {formatDate(log.created_at)}
                  </td>
                  <td className="px-4 py-3" style={{ color: 'var(--color-text)' }}>
                    {log.recipient_name ?? '—'}
                  </td>
                  <td className="px-4 py-3 text-xs" style={{ color: 'var(--color-muted)' }}>
                    {log.recipient_phone ? formatPhone(log.recipient_phone) : '—'}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="px-2 py-0.5 rounded-full"
                          style={{ background: 'rgba(168,218,220,0.15)', color: 'var(--color-accent-dark)' }}>
                      {TEMPLATES[log.template_key as TemplateKey]?.label ?? log.template_key}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span className="flex items-center gap-1 text-xs font-medium"
                          style={{ color: log.status === 'success' ? 'var(--color-success)' : 'var(--color-danger)' }}>
                      {log.status === 'success'
                        ? <><CheckCircle2 size={11} /> 성공</>
                        : <><AlertCircle size={11} /> 실패</>
                      }
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 발송 모달 */}
      {showForm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4"
             style={{ background: 'rgba(0,0,0,0.4)' }}
             onClick={e => e.target === e.currentTarget && setShowForm(false)}>
          <div className="w-full max-w-3xl rounded-2xl overflow-hidden"
               style={{ background: 'var(--color-surface)', boxShadow: '0 20px 60px rgba(29,53,87,0.2)' }}>
            {/* 헤더 */}
            <div className="flex items-center justify-between px-6 py-4 border-b" style={{ borderColor: 'var(--color-border)' }}>
              <h2 className="text-base font-bold" style={{ fontFamily: 'var(--font-display)', color: 'var(--color-primary)' }}>
                알림톡 발송
              </h2>
              <button onClick={() => setShowForm(false)} style={{ color: 'var(--color-muted)' }}><X size={18} /></button>
            </div>

            <div className="flex divide-x" style={{ borderColor: 'var(--color-border)' }}>
              {/* 왼쪽: 설정 */}
              <div className="flex-1 px-6 py-5 space-y-5 max-h-[60vh] overflow-y-auto">
                {/* 템플릿 선택 */}
                <div>
                  <label className="block text-xs font-medium mb-2" style={{ color: 'var(--color-muted)' }}>템플릿</label>
                  <div className="space-y-2">
                    {TEMPLATE_KEYS.map(key => {
                      const t = TEMPLATES[key]
                      return (
                        <button key={key} onClick={() => setSelectedTemplate(key)}
                          className="w-full text-left px-3 py-2.5 rounded-xl border transition-all"
                          style={{
                            borderColor: selectedTemplate === key ? 'var(--color-primary)' : 'var(--color-border)',
                            background:  selectedTemplate === key ? 'rgba(29,53,87,0.05)' : 'var(--color-background)',
                          }}>
                          <p className="text-sm font-medium" style={{ color: 'var(--color-primary)' }}>{t.label}</p>
                          <p className="text-xs mt-0.5" style={{ color: 'var(--color-muted)' }}>{t.desc}</p>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* 수신자 선택 */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-medium" style={{ color: 'var(--color-muted)' }}>수신자 선택</label>
                    <button onClick={() => {
                      if (selectedRooms.size === rooms.length) setSelectedRooms(new Set())
                      else setSelectedRooms(new Set(rooms.map(r => r.id)))
                    }} className="text-xs" style={{ color: 'var(--color-accent-dark)' }}>
                      {selectedRooms.size === rooms.length ? '전체 해제' : '전체 선택'}
                    </button>
                  </div>
                  <div className="space-y-1.5 max-h-40 overflow-y-auto">
                    {rooms.length === 0 ? (
                      <p className="text-xs text-center py-4" style={{ color: 'var(--color-muted)' }}>입주 중인 호실이 없습니다.</p>
                    ) : rooms.map(r => (
                      <label key={r.id} className="flex items-center gap-2.5 px-3 py-2 rounded-lg cursor-pointer"
                             style={{
                               background: selectedRooms.has(r.id) ? 'rgba(29,53,87,0.05)' : 'var(--color-background)',
                               border: `1px solid ${selectedRooms.has(r.id) ? 'var(--color-primary)' : 'var(--color-border)'}`,
                             }}>
                        <input type="checkbox" checked={selectedRooms.has(r.id)}
                          onChange={() => {
                            const next = new Set(selectedRooms)
                            if (next.has(r.id)) next.delete(r.id)
                            else next.add(r.id)
                            setSelectedRooms(next)
                          }} className="accent-blue-700" />
                        <span className="text-sm flex-1" style={{ color: 'var(--color-text)' }}>
                          {r.name}
                          {r.tenant_name && <span className="ml-1 text-xs" style={{ color: 'var(--color-muted)' }}>({r.tenant_name})</span>}
                        </span>
                        <span className="text-xs flex items-center gap-0.5" style={{ color: r.tenant_phone ? 'var(--color-muted)' : 'var(--color-danger)' }}>
                          <Phone size={10} /> {r.tenant_phone ? formatPhone(r.tenant_phone) : '연락처 없음'}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>

              {/* 오른쪽: 미리보기 */}
              <div className="w-56 shrink-0 px-5 py-5 flex flex-col items-center"
                   style={{ background: 'var(--color-muted-bg)' }}>
                <p className="text-xs font-medium mb-3 self-start" style={{ color: 'var(--color-muted)' }}>미리보기</p>
                {/* 카카오톡 말풍선 */}
                <div className="w-full rounded-2xl overflow-hidden shadow-md"
                     style={{ background: '#FAE100', padding: '2px' }}>
                  <div className="rounded-[14px] overflow-hidden" style={{ background: 'white' }}>
                    <div className="px-3 py-2 text-xs font-bold" style={{ background: '#FAE100', color: '#3A2100' }}>
                      kakao
                    </div>
                    <div className="px-3 py-3 whitespace-pre-wrap"
                         style={{ color: '#1A1A1A', fontSize: '10px', lineHeight: 1.6 }}>
                      {sample
                        ? tpl.preview(
                            sample.tenant_name ?? '입주사',
                            sample.name,
                            (sample.monthly_rent ?? 0).toLocaleString()
                          )
                        : tpl.preview('입주사', '101호', '500,000')}
                    </div>
                  </div>
                </div>
                <p className="text-xs mt-3 text-center" style={{ color: 'var(--color-muted)' }}>
                  {selectedRooms.size}명에게 발송
                </p>
                {selectedRooms.size > 0 && rooms.filter(r => selectedRooms.has(r.id) && !r.tenant_phone).length > 0 && (
                  <p className="text-xs mt-1 text-center" style={{ color: 'var(--color-danger)' }}>
                    ⚠️ 연락처 없는 {rooms.filter(r => selectedRooms.has(r.id) && !r.tenant_phone).length}건 제외됨
                  </p>
                )}
              </div>
            </div>

            {/* 푸터 */}
            <div className="flex gap-2 px-6 py-4 border-t" style={{ borderColor: 'var(--color-border)' }}>
              <button onClick={() => setShowForm(false)}
                className="flex-1 py-2.5 rounded-lg text-sm font-medium border"
                style={{ borderColor: 'var(--color-border)', color: 'var(--color-muted)' }}>
                취소
              </button>
              <button onClick={handleSend} disabled={sending || selectedRooms.size === 0}
                className="flex-1 py-2.5 rounded-lg text-sm font-semibold text-white flex items-center justify-center gap-2 disabled:opacity-60"
                style={{ background: 'var(--color-primary)' }}>
                {sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                {selectedRooms.size}건 발송
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
