/**
 * Solapi SDK v5를 사용한 카카오 알림톡 발송 유틸리티
 *
 * ⚠️ variables 키는 Solapi 대시보드에 등록된 템플릿 변수명과 반드시 일치해야 합니다.
 *    예: 템플릿에 #{이름} 이 있으면 → variables: { '#{이름}': '홍길동' }
 *
 * 현재 사용 템플릿:
 *   UNPAID_REMINDER : 미납 독촉 (KA01TP260302200441583wMOcyLIy71M)
 *   PAYMENT_DONE    : 수납 완료 (KA01TP2603022005171505KORmx0Qpva)
 *   DAILY_BRIEFING  : 일일 브리핑 (KA01TP260302200255741jxhgbrVAp1l)
 */
import { SolapiMessageService } from 'solapi'

const apiKey    = process.env.SOLAPI_API_KEY    ?? ''
const apiSecret = process.env.SOLAPI_API_SECRET ?? ''
const channelId = process.env.SOLAPI_CHANNEL_ID ?? ''

export const TEMPLATES = {
  /** 미납 독촉 알림 */
  UNPAID_REMINDER: process.env.SOLAPI_TEMPLATE_UNPAID_REMINDER ?? '',
  /** 수납 완료 안내 */
  PAYMENT_DONE:    process.env.SOLAPI_TEMPLATE_PAYMENT_DONE    ?? '',
  /** 일일 브리핑 (Gemini AI) */
  DAILY_BRIEFING:  process.env.SOLAPI_TEMPLATE_DAILY_BRIEFING  ?? '',
  /** 청구서 발행 안내 (결제 링크 포함) */
  INVOICE_ISSUED:  process.env.SOLAPI_TEMPLATE_INVOICE_ISSUED  ?? '',
} as const

export type TemplateKey = keyof typeof TEMPLATES

export interface AlimtalkPayload {
  /** 수신 전화번호 (하이픈 제거 후 010XXXXXXXX) */
  to: string
  /** 템플릿 변수 맵 — Solapi 대시보드의 변수명과 일치해야 함 */
  variables?: Record<string, string>
  /** TEMPLATES 키 이름으로 지정 (templateCode보다 낮은 우선순위) */
  templateKey?: TemplateKey
  /** 템플릿 코드 직접 지정 (우선순위 높음) */
  templateCode?: string
}

export async function sendKakaoAlimtalk(payload: AlimtalkPayload): Promise<boolean> {
  const { to, variables = {}, templateCode, templateKey } = payload

  const resolvedCode = templateCode
    ?? (templateKey ? TEMPLATES[templateKey] : undefined)

  if (!resolvedCode) {
    console.warn('[alimtalk] templateCode 또는 templateKey가 필요합니다.')
    return false
  }

  if (!apiKey || !apiSecret) {
    console.error('[alimtalk] SOLAPI API 키가 설정되지 않았습니다.')
    return false
  }

  // channelId 미설정 시 Mock 출력 (개발/테스트용)
  if (!channelId) {
    console.log('[MOCK 알림톡]', { to, templateCode: resolvedCode, variables })
    return true
  }

  try {
    const messageService = new SolapiMessageService(apiKey, apiSecret)
    await messageService.send({
      to,
      kakaoOptions: {
        pfId:       channelId,
        templateId: resolvedCode,
        variables,
      },
    })
    console.log(`✅ 알림톡 발송 성공: ${to} / ${resolvedCode}`)
    return true
  } catch (error: unknown) {
    const err = error as { message?: string; failedMessageList?: unknown[] }
    console.error(`❌ 알림톡 발송 실패: ${err.message}`, err.failedMessageList)
    return false
  }
}

/**
 * 전화번호 정규화 유틸 (하이픈, 공백 제거)
 */
export function normalizePhone(phone: string): string {
  return phone.replace(/[\s\-]/g, '')
}
