// ── 호실 ──────────────────────────────────────────────
export type RoomStatus = 'PAID' | 'UNPAID' | 'VACANT'

export interface Room {
  id:           string
  owner_id:     string
  name:         string
  status:       RoomStatus
  tenant_name:  string | null
  tenant_phone: string | null
  tenant_email: string | null
  monthly_rent: number
  payment_day?: number    // 정기 납부일 (1~31)
  deposit:      number
  lease_start:  string | null
  lease_end:    string | null
  memo:                   string | null
  virtual_account_number: string | null
  created_at:             string
  updated_at:             string
}

// ── 청구서 ─────────────────────────────────────────────
export type InvoiceStatus = 'ready' | 'paid' | 'overdue'

export interface Invoice {
  id:          string
  owner_id:    string
  room_id:     string
  year:        number
  month:       number
  amount:      number
  paid_amount: number
  status:      InvoiceStatus
  due_date:    string | null
  paid_at:     string | null
  created_at:  string
  // PortOne V2 가상계좌
  portone_payment_id:     string | null
  virtual_account_number: string | null
  virtual_account_bank:   string | null
  virtual_account_due:    string | null
}

// ── 결제 로그 ──────────────────────────────────────────
export interface Payment {
  id:                 string
  owner_id:           string
  invoice_id:         string | null
  room_id:            string
  portone_payment_id: string | null
  amount:             number
  paid_at:            string
  note:               string | null
  created_at:         string
}

// ── 전자계약 ───────────────────────────────────────────
export type ContractStatus = 'draft' | 'sent' | 'signed' | 'expired'

export interface Contract {
  id:                    string
  owner_id:              string
  room_id:               string
  tenant_name:           string | null
  tenant_phone:          string | null
  tenant_email:          string | null
  address:               string | null
  monthly_rent:          number
  deposit:               number
  lease_start:           string | null
  lease_end:             string | null
  special_terms:         string | null
  status:                ContractStatus
  sign_token:            string | null
  sign_token_expires_at: string | null
  content_hash:          string | null
  signer_ip:             string | null
  signed_at:             string | null
  signature_data_url:    string | null
  contract_snapshot:     Record<string, string | number> | null
  created_at:            string
}

// ── 알림톡 발송 내역 ────────────────────────────────────
export interface NotificationLog {
  id:              string
  owner_id:        string | null
  room_id:         string | null
  template_key:    string
  recipient_name:  string | null
  recipient_phone: string | null
  status:          'success' | 'failed'
  created_at:      string
}

// ── 대시보드 KPI ───────────────────────────────────────
export interface DashboardKpi {
  totalCollected:  number   // 이번 달 수납 완료 금액
  totalUnpaid:     number   // 이번 달 미납 금액
  occupancyRate:   number   // 입주율 (%)
  paidRooms:       number   // 수납 완료 세대 수
  unpaidRooms:     number   // 미납 세대 수
  vacantRooms:     number   // 공실 수
  expiringContracts: number // 30일 내 만료 계약 수
}
