/**
 * Solapi SDK를 사용한 카카오 알림톡 발송 유틸리티
 */
import { SolapiMessageService } from 'solapi'

const apiKey    = process.env.SOLAPI_API_KEY    ?? ''
const apiSecret = process.env.SOLAPI_API_SECRET ?? ''
const channelId = process.env.SOLAPI_CHANNEL_ID ?? ''

export const TEMPLATES = {
  DAILY_BRIEFING:  process.env.SOLAPI_TEMPLATE_DAILY_BRIEFING  ?? '',
  UNPAID_REMINDER: process.env.SOLAPI_TEMPLATE_UNPAID_REMINDER ?? '',
  PAYMENT_DONE:    process.env.SOLAPI_TEMPLATE_PAYMENT_DONE    ?? '',
  PAYMENT_REQUEST: process.env.SOLAPI_TEMPLATE_PAYMENT_REQUEST ?? '',
  CONTRACT_EXPIRY: process.env.SOLAPI_TEMPLATE_CONTRACT_EXPIRY ?? '',
} as const

export type TemplateKey = keyof typeof TEMPLATES

export interface AlimtalkPayload {
  /** 수신 전화번호 */
  to: string
  /** 템플릿 변수 맵 (#{변수명}: 값) */
  variables?: Record<string, string>
  /**
   * 템플릿 코드 직접 지정 (templateKey보다 우선)
   */
  templateCode?: string
  /**
   * TEMPLATES 키 이름으로 지정
   */
  templateKey?: string
}

export async function sendKakaoAlimtalk(payload: AlimtalkPayload): Promise<boolean> {
  const { to, variables = {}, templateCode, templateKey } = payload

  const resolvedCode = templateCode
    ?? (templateKey ? TEMPLATES[templateKey as TemplateKey] : undefined)

  if (!resolvedCode) {
    console.warn('[alimtalk] templateCode 또는 templateKey가 필요합니다.')
    return false
  }

  // 채널 ID 미설정 시 Mock 출력
  if (!channelId) {
    console.log('[MOCK 알림톡]', { to, templateCode: resolvedCode, variables })
    return true
  }

  if (!apiKey || !apiSecret) {
    console.error('[alimtalk] SOLAPI 키가 설정되지 않았습니다.')
    return false
  }

  try {
    const messageService = new SolapiMessageService(apiKey, apiSecret)
    await messageService.send({
      to,
      kakaoOptions: {
        pfId: channelId,
        templateId: resolvedCode,
        variables,
      },
    })
    console.log(`✅ 알림톡 발송 성공: ${to} / ${resolvedCode}`)
    return true
  } catch (error: unknown) {
    const err = error as { message?: string; failedMessageList?: unknown[] }
    console.error(`❌ 알림톡 발송 실패: ${err.message}`)
    return false
  }
}
