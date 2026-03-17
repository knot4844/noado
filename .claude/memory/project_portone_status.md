---
name: 노아도 주요 기능 완료 현황
description: PortOne V2 가상계좌 결제 및 카카오 로그인 재연동 완료 현황 (2026-03-15)
type: project
---

2026-03-15 기준 주요 기능 모두 완료.

**Why:** PortOne 가상계좌 엔드포인트 오류 수정 + Nabido→Noado 앱 이름 변경으로 카카오 키 재연동 필요했음.

**How to apply:** 다음 세션에서 이 기능들은 완료된 것으로 간주하고 새 작업 시작.

## PortOne V2 가상계좌

완료 상태. 주요 설정값:
- 엔드포인트: `POST /payments/{id}/instant`
- 채널키: `channel-key-dd35dbea-35f9-4013-868a-18609fb251c9` (KG이니시스 API 타입)
- 웹훅 Endpoint: `https://www.noado.kr/api/webhook/portone`
- 응답 파싱: `detailBody.method.accountNumber`
- 테스트 MID(`INIpayTest`)는 신한은행만 지원, 실 연동 시 전 은행 정상

## 카카오 로그인

완료 상태. 주요 설정값:
- 카카오 디벨로퍼스 앱 ID: 1396403 (노아도)
- REST API Key: `a33d3146adb1dcccb373c67292910a69`
- Client Secret: `aQ58wm8ASxOuDU0S3qAC3lJLzLfsc0sr` (활성화 ON)
- Redirect URI: `https://zswazaviqcaikefpkxee.supabase.co/auth/v1/callback`
- Supabase Provider: Kakao Enabled, 위 키 값들 입력 완료 ✅
