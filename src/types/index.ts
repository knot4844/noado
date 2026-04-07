// ── 호실 ──────────────────────────────────────────────
export type RoomStatus = 'PAID' | 'UNPAID' | 'VACANT'

export interface Room {
  id:         string
  owner_id:   string
  business_id?: string | null
  name:       string
  status:     RoomStatus
  building:   string | null   // 건물/구역 (ex: A동, B동)
  area:       number | null   // 면적 (m²)
  memo:       string | null
  created_at: string
  updated_at: string
  // ─── @deprecated: leases 테이블로 이전됨 (하위호환용, DB 컬럼 없음) ───
  /** @deprecated use leases.tenant_id → tenants.name */
  tenant_name?:           string | null
  /** @deprecated use leases.tenant_id → tenants.phone */
  tenant_phone?:          string | null
  /** @deprecated use leases.tenant_id → tenants.email */
  tenant_email?:          string | null
  /** @deprecated use leases.monthly_rent */
  monthly_rent?:          number
  /** @deprecated use leases.payment_day */
  payment_day?:           number
  /** @deprecated use deposits.amount */
  deposit?:               number
  /** @deprecated use leases.lease_start */
  lease_start?:           string | null
  /** @deprecated use leases.lease_end */
  lease_end?:             string | null
  /** @deprecated use invoices.virtual_account_number */
  virtual_account_number?: string | null
}

// ── 입주사 ────────────────────────────────────────────────
export interface Tenant {
  id:             string
  owner_id:       string
  name:           string
  phone:          string | null
  email:          string | null
  // 사업자 정보
  business_no:    string | null   // 사업자등록번호
  representative: string | null   // 대표자
  birth_date:     string | null   // 생년월일 (주민번호 대신)
  biz_type:       string | null   // 업태
  biz_item:       string | null   // 종목
  id_card_file:   string | null   // 신분증 파일 경로 (암호화)
  memo:           string | null
  created_at:     string
  // ─── @deprecated: leases 테이블로 이전됨 (하위호환용, DB 컬럼 없음) ───
  /** @deprecated use leases.room_id */
  room_id?:       string
  /** @deprecated use leases.monthly_rent */
  monthly_rent?:  number
  /** @deprecated use deposits.amount */
  deposit?:       number
  /** @deprecated use leases.lease_start */
  lease_start?:   string | null
  /** @deprecated use leases.lease_end */
  lease_end?:     string | null
}

// ── 계약 (핵심 연결 테이블) ────────────────────────────────
export type ContractType = 'OCCUPANCY' | 'BIZ_ONLY' | 'STORAGE'
// OCCUPANCY = 전용좌석 (일반 입주)
// BIZ_ONLY  = 공용좌석 (비즈니스 주소만)
// STORAGE   = 보관 창고

export type RateType = 'MONTHLY' | 'DAILY'
export type VatType  = 'VAT_INVOICE' | 'CASH_RECEIPT' | 'NONE'
export type LeaseStatus = 'RESERVED' | 'ACTIVE' | 'TERMINATED'

export interface Lease {
  id:             string
  owner_id:       string
  room_id:        string
  tenant_id:      string
  contract_type:  ContractType
  rate_type:      RateType
  monthly_rent:   number        // 사용료 + 관리비 포함 (all-in)
  daily_rate:     number | null // 일일 요금 (DAILY 타입)
  pledge_amount:  number        // 예치금 (보증금 X)
  lease_start:    string        // 입주일
  lease_end:      string | null // 퇴실일 (null = 진행 중)
  payment_day:    number        // 정기 납부일 (1~31)
  vat_type:       VatType
  status:         LeaseStatus
  memo:           string | null
  created_at:     string
  updated_at:     string
  // 조인 데이터 (선택적)
  room?:   Room
  tenant?: Tenant
}

// ── 추가 실비 청구 항목 ────────────────────────────────────
export type BillingItemType  = 'PARKING' | 'INTERNET' | 'ELECTRICITY' | 'CUSTOM'
export type BillingCycleType = 'MONTHLY' | 'ACTUAL'

export interface BillingItem {
  id:            string
  owner_id:      string
  lease_id:      string
  item_type:     BillingItemType
  name:          string        // 항목명
  billing_cycle: BillingCycleType
  amount:        number | null // 고정 금액 (MONTHLY)
  unit_price:    number | null // 단가 (ACTUAL 실비)
  is_active:     boolean
  memo:          string | null
  created_at:    string
}

// ── 예치금·선납·예약금 ─────────────────────────────────────
export type DepositType = 'PLEDGE' | 'PREPAY' | 'RESERVE'
// PLEDGE  = 예치금 (입주 시)
// PREPAY  = 선납 (월세 선불)
// RESERVE = 예약금 (계약 전)

export interface Deposit {
  id:          string
  owner_id:    string
  lease_id:    string
  type:        DepositType
  amount:      number
  received_at: string | null
  refunded_at: string | null
  note:        string | null
  created_at:  string
}

// ── 세금계산서 ─────────────────────────────────────────────
export type TaxInvoiceStatus = 'DRAFT' | 'ISSUED' | 'CANCELLED'

export interface TaxInvoice {
  id:             string
  owner_id:       string
  lease_id:       string | null
  invoice_id:     string | null
  issue_date:     string | null
  supply_amount:  number   // 공급가액
  vat_amount:     number   // 세액
  total_amount:   number   // 합계금액
  status:         TaxInvoiceStatus
  ntax_id:        string | null  // 국세청 승인번호
  created_at:     string
  updated_at:     string
}

// ── 청구서 ─────────────────────────────────────────────────
export type InvoiceStatus = 'ready' | 'paid' | 'overdue'

export interface Invoice {
  id:           string
  owner_id:     string
  room_id:      string
  lease_id:     string | null   // 연결된 계약
  tenant_id:    string | null   // 청구 시점 입주사
  year:         number
  month:        number
  base_amount:  number          // 기본 임대료 (lease.monthly_rent)
  extra_amount: number          // 추가 실비 합계
  amount:       number          // 총 청구액 (base + extra)
  paid_amount:  number
  status:       InvoiceStatus
  due_date:     string | null
  paid_at:      string | null
  created_at:   string
  // PortOne V2 가상계좌
  portone_payment_id:     string | null
  virtual_account_number: string | null
  virtual_account_bank:   string | null
  virtual_account_due:    string | null
  // 납부 요청 시 연결된 계약서
  contract_id:            string | null
}

// ── 결제 로그 ──────────────────────────────────────────────
export interface Payment {
  id:                 string
  owner_id:           string
  invoice_id:         string | null
  lease_id:           string | null
  room_id:            string
  portone_payment_id: string | null
  amount:             number
  paid_at:            string
  note:               string | null
  created_at:         string
}

// ── 전자계약 ───────────────────────────────────────────────
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
  template_url:          string | null
  template_name:         string | null
  template_mime:         string | null
  created_at:            string
}

// ── 알림톡 발송 내역 ────────────────────────────────────────
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

// ── 대시보드 KPI ───────────────────────────────────────────
export interface DashboardKpi {
  totalCollected:    number   // 이번 달 수납 완료 금액
  totalUnpaid:       number   // 이번 달 미납 금액
  occupancyRate:     number   // 입주율 (%)
  paidRooms:         number   // 수납 완료 세대 수
  unpaidRooms:       number   // 미납 세대 수
  vacantRooms:       number   // 공실 수
  expiringContracts: number   // 30일 내 만료 계약 수
}
