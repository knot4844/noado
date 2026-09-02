#!/bin/bash
# noado.kr 예약 발행 — 대기 중인 글 커밋을 하나씩 푸시한다.
#
# 이것은 "AI 자동 글 생성·발행"이 아니다. 그건 애드센스 재승인 전까지 금지다.
# 이 스크립트가 하는 일은 **사람이 이미 쓰고 1차 출처로 검증해 커밋해 둔 글**을
# 정해진 시각에 하나씩 내보내는 것뿐이다. 새 글을 만들지 않는다.
#
# 실행: launchd 09:00 / 12:00 / 15:00 (3시간 간격, 하루 3편)
# 규칙: 23:00~07:00 발행 금지, 하루 3편 상한
#
# 자동화는 시끄럽게 실패해야 한다. 실패하면 로그에 남기고 사람에게 닿을 때까지
# 매 슬롯 반복해서 알린다. (2026-09-02 보강 — 아래 "실패 경로" 참조)
#
# 검증할 때는 반드시 --dry-run 을 붙인다:
#     ./scripts/publish-next.sh --dry-run
# 실제 푸시 없이 "어느 커밋을 고르는지"까지만 확인한다.
# (2026-08-17: 드라이런 없이 상한 가드를 우회해 검증하다가 글 한 편이
#  예정보다 하루 일찍 실제 발행된 일이 있었다. 그래서 이 모드를 넣었다)
#
# ── 실패 경로 (2026-09-02 오씨 점검 요청 3건 반영) ────────────────────
# ① 사람에게 닿는 경로: 맥 알림은 8/19 에 잠든 화면에 묻혀 아무도 못 봤다.
#    "로그에 FAIL 이 남았다"와 "사람이 알게 됐다"는 다르다. 그래서 실패하면
#    ★해제 표식 파일★ 을 남기고, 그것이 남아 있는 한 ★매 슬롯마다 다시 알린다.★
#    알림 + 화면에 남는 모달 + 사람이 읽는 PUBLISH-ALERT.md 3중이다.
# ② 재시도는 ★연결 실패(호스트 해석 불가·연결 타임아웃)에만.★ 서버가 응답한
#    오류(인증 거부·non-fast-forward 등)는 재시도해도 같은 답이 오고,
#    HTTP API 였다면 중복 게시 위험이 있다. 응답이 온 오류는 즉시 실패 처리한다.
# ③ launchd 는 ★DarkWake(맥이 반쯤 깬 상태)에도 발화한다.★ 그때 네트워크가
#    아직 안 붙어 있다. 그래서 푸시 전에 ★네트워크가 살아날 때까지 기다린다.★
#    (8/19 12:09·15:11 에 "Could not resolve host: github.com" 로 2편이 죽었다)
# ④ fetch 가 실패하면 ★상한을 못 센다.★ 상한은 애드센스 방어선이므로
#    눈먼 채로 푸시하지 않는다. 한 슬롯 거르는 것이 초과 발행보다 낫다.

set -uo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

REPO="/Users/dyl/antigravity/noado-blog"
LOG="$REPO/scripts/publish.log"
STATE="$REPO/scripts/.publish-state"
ALERT="$REPO/scripts/.publish-alert"          # 미해결 실패 표식 (있으면 매 슬롯 재알림)
ALERT_DOC="$REPO/scripts/PUBLISH-ALERT.md"    # 사람이 읽는 실패 안내

cd "$REPO" || { echo "$(date '+%F %T') FATAL 저장소 없음: $REPO" >> "$LOG"; exit 1; }

log()  { echo "$(date '+%F %T') $*" >> "$LOG"; }
# 한글 파일명이 이스케이프되지 않도록 quotepath 를 끄고 전체 경로를 받는다
changed_files() { git -c core.quotepath=false diff-tree --no-commit-id --name-only -r "$1"; }

# ── 사람에게 닿는 경로 ────────────────────────────────────────────────
# 맥 알림 하나만 믿지 않는다. 8/19 에 그걸 믿었다가 하루를 날렸다.
notify() {
  local msg="$1"
  # 1) 배너 — 깨어 있으면 바로 보인다
  osascript -e "display notification \"${msg//\"/\'}\" with title \"noado 발행 실패\" sound name \"Basso\"" 2>/dev/null
  # 2) 모달 — 배너와 달리 ★누를 때까지 화면에 남는다.★ 자고 일어나도 그대로다
  #    스크립트를 붙잡지 않도록 떼어내 띄운다
  nohup osascript -e "display alert \"noado 발행 실패\" message \"${msg//\"/\'}\" as critical" \
    >/dev/null 2>&1 &
  disown 2>/dev/null
}

raise_alert() {   # 실패를 표식으로 남긴다 — 해제될 때까지 매 슬롯 다시 운다
  local msg="$1"
  echo "$(date '+%F %T') $msg" >> "$ALERT"
  cat > "$ALERT_DOC" <<EOF
<!-- 이 파일은 scripts/publish-next.sh 가 자동으로 덮어쓴다. 사람이 쓰지 마라. -->
<!-- 해결했으면 scripts/.publish-alert 를 지워라. 그래야 알림이 멈춘다. -->

# ⛔ noado 발행 실패 — 미해결

마지막 실패: **$(date '+%F %T')**

\`\`\`
$msg
\`\`\`

## 확인 순서

1. \`tail -30 scripts/publish.log\`
2. 네트워크 확인 → \`./scripts/publish-next.sh --dry-run\`
3. 고쳤으면 표식을 지운다 → \`rm scripts/.publish-alert\`

**표식이 남아 있는 한 09/12/15시마다 알림이 다시 뜬다.** 조용해지지 않는다.

## 실패 이력

$(tail -20 "$ALERT" 2>/dev/null | sed 's/^/- /')
EOF
  notify "$msg"
}

clear_alert() {
  [ -f "$ALERT" ] || return 0
  rm -f "$ALERT" "$ALERT_DOC"
  log "ALERT 해제 — 발행이 정상으로 돌아왔다"
}

fail() {
  log "FAIL $*"
  raise_alert "$*"
  exit 1
}

# ── 네트워크가 살아날 때까지 기다린다 (③ DarkWake 대책) ──────────────
# launchd 는 크론과 달리 DarkWake 에도 발화한다. 그때는 아직 DNS 가 안 뜬다.
# "차단을 이기지 말고 차단당할 이유를 없앤다" — 알림을 키우기 전에 원인을 없앤다.
wait_for_network() {
  local tries=${1:-24}   # 24 × 15초 = 최대 6분
  local i
  for i in $(seq 1 "$tries"); do
    if curl -s -o /dev/null -m 10 https://github.com/ 2>/dev/null; then
      [ "$i" -gt 1 ] && log "NET ${i}회차에 네트워크 확인됨 (DarkWake 추정, $(( (i-1) * 15 ))초 대기)"
      return 0
    fi
    sleep 15
  done
  return 1
}

# ── 연결 실패인지 서버 응답 오류인지 가른다 (② 재시도 범위) ───────────
# 연결 실패 = 요청이 서버에 닿지도 못한 것 → 다시 보내도 안전하다.
# 서버 응답 오류 = 서버가 판단해서 거절한 것 → 다시 보내도 같은 답이고,
#                 HTTP API 였다면 중복 게시 위험이 있다. 재시도하지 않는다.
is_connection_error() {
  grep -qiE 'could not resolve host|failed to connect|connection timed out|connection reset|operation timed out|network is unreachable|temporary failure in name resolution|ssl_read|recv failure' <<< "$1"
}

# 연결 실패에만 재시도하는 푸시
push_with_retry() {
  local refspec="$1" label="$2"
  local attempt out
  for attempt in 1 2 3; do
    if out=$(git push origin "$refspec" 2>&1); then
      echo "$out" >> "$LOG"
      return 0
    fi
    echo "$out" >> "$LOG"
    if ! is_connection_error "$out"; then
      log "NORETRY 서버가 응답한 오류다 — 재시도하지 않는다 (중복 발행 방지)"
      return 1
    fi
    if [ "$attempt" -lt 3 ]; then
      log "RETRY 연결 실패 ${attempt}/3 — $((attempt * 30))초 뒤 다시 시도 ($label)"
      sleep $((attempt * 30))
      wait_for_network 8 || log "WARN 재시도 전 네트워크 확인 실패"
    fi
  done
  return 1
}

HOUR=$(date '+%-H')
TODAY=$(date '+%F')

# ── 0. 미해결 실패가 남아 있으면 먼저 다시 운다 (① 사람에게 닿기) ────
# 한 번 울고 마는 알림은 자는 사이에 묻힌다. 해제될 때까지 매 슬롯 반복한다.
if [ -f "$ALERT" ] && [ "$DRY" = "0" ]; then
  LAST_ALERT=$(tail -1 "$ALERT")
  log "ALERT 미해결 실패가 남아 있다 → $LAST_ALERT"
  notify "미해결: $LAST_ALERT  (고쳤으면 scripts/.publish-alert 를 지우세요)"
fi

# ── 1. 발행 금지 시간대 ────────────────────────────────────────────
if [ "$HOUR" -lt 7 ] || [ "$HOUR" -ge 23 ]; then
  log "SKIP 발행 금지 시간대 (${HOUR}시). 07:00~23:00 에만 푸시한다"
  exit 0
fi

# ── 2. 하루 3편 상한 ──────────────────────────────────────────────
# 상한은 애드센스 방어선이다. 사람이 고칠 수 있는 파일 하나에 의존하면 안 된다.
# 그래서 **git 사실**에서 센다 — 오늘 0시의 origin/main 부터 지금까지
# 실제로 원격에 올라간 글 커밋 수. 상태 파일은 참고용 보조 지표일 뿐이다.
# (2026-08-17: 검증하느라 상태 파일을 덮어썼더니 가드가 뚫려 글 한 편이
#  하루 일찍 발행된 일이 있었다. 그 뒤로 이 방식으로 바꿨다)
if ! git fetch -q origin 2>/dev/null; then
  # DarkWake 로 아직 네트워크가 없을 수 있다. 기다렸다 한 번 더.
  log "WARN fetch 실패 — 네트워크 대기 후 재시도"
  if wait_for_network && git fetch -q origin 2>/dev/null; then
    log "NET 네트워크 복구 후 fetch 성공"
  else
    # ④ 상한을 못 세면 푸시하지 않는다. 한 슬롯 거르는 것이 초과 발행보다 낫다.
    fail "fetch 실패로 하루 3편 상한을 실측할 수 없다 — 눈먼 발행을 막기 위해 이번 슬롯을 거른다"
  fi
fi

COUNT=0
BASE=$(git rev-parse "origin/main@{$TODAY 00:00:00}" 2>/dev/null || echo "")
if [ -n "$BASE" ]; then
  # 커밋 개수가 아니라 **글 파일 개수**를 센다.
  # 한 커밋에 글이 여러 편 들어 있으면 그만큼 발행된 것이다.
  # (2026-08-18: 10편이 한 커밋에 묶여 있어 상한이 무력화될 뻔했다)
  for SHA in $(git log "$BASE..origin/main" --format='%H' 2>/dev/null); do
    N=$(changed_files "$SHA" | grep -c '^src/content/posts/.*\.md$')
    COUNT=$((COUNT + N))
  done
else
  # reflog 에 오늘 기준점이 없으면(오늘 첫 실행 등) 상태 파일로 대체한다
  if [ -f "$STATE" ] && [ "$(cut -d' ' -f1 "$STATE")" = "$TODAY" ]; then
    COUNT=$(cut -d' ' -f2 "$STATE")
    log "INFO reflog 기준점 없음 — 상태 파일 기준 ${COUNT}편"
  fi
fi

if [ "$COUNT" -ge 3 ]; then
  log "SKIP 오늘 이미 ${COUNT}편 발행(git 실측). 하루 3편 상한"
  exit 0
fi

# ── 3. 대기 중인 커밋 확인 ────────────────────────────────────────
PENDING=$(git log origin/main..main --format='%H' --reverse)
[ -z "$PENDING" ] && { log "IDLE 대기 중인 커밋 없음"; exit 0; }

# 새 글이 들어 있는 첫 커밋을 찾는다 (문서만 바뀐 커밋은 글로 세지 않는다)
TARGET=""
for SHA in $PENDING; do
  if changed_files "$SHA" | grep -q '^src/content/posts/.*\.md$'; then
    TARGET="$SHA"; break
  fi
done

# 글 커밋이 더 없으면 남은 문서 커밋을 한 번에 정리하고 끝낸다
if [ -z "$TARGET" ]; then
  LAST=$(echo "$PENDING" | tail -1)
  if [ "$DRY" = "1" ]; then
    echo "[DRY-RUN] 글 커밋 없음. 문서 커밋 일괄 대상: $(git log -1 --format='%h %s' "$LAST")"
    exit 0
  fi
  log "INFO 남은 것은 문서 커밋뿐. 일괄 푸시: $(git log -1 --format='%h %s' "$LAST")"
  push_with_retry "$LAST:main" "문서 커밋" || fail "문서 커밋 푸시 실패"
  log "OK 문서 커밋 푸시 완료"
  clear_alert
  exit 0
fi

# 한 커밋에 글이 여러 편 묶여 있으면 상한을 넘길 수 있다. 남은 여유보다 많으면 멈춘다.
INCOMING=$(changed_files "$TARGET" | grep -c '^src/content/posts/.*\.md$')
REMAIN=$((3 - COUNT))
if [ "$INCOMING" -gt "$REMAIN" ]; then
  fail "커밋 하나에 글 ${INCOMING}편이 묶여 있어 오늘 남은 ${REMAIN}편을 넘긴다. 커밋을 글 단위로 쪼갠 뒤 다시 시도할 것: $(git log -1 --format='%h %s' "$TARGET")"
fi

SUBJECT=$(git log -1 --format='%h %s' "$TARGET")
SLUG=$(changed_files "$TARGET" | grep '^src/content/posts/.*\.md$' | head -1 \
        | sed 's|src/content/posts/||;s|\.md$||')

# ── 4. 푸시 ───────────────────────────────────────────────────────
if [ "$DRY" = "1" ]; then
  echo "[DRY-RUN] 실제 푸시 안 함"
  echo "[DRY-RUN] 고른 커밋 : $SUBJECT"
  echo "[DRY-RUN] 글 슬러그 : $SLUG"
  echo "[DRY-RUN] 오늘 발행 : ${COUNT}/3편"
  [ -f "$ALERT" ] && echo "[DRY-RUN] ⚠️ 미해결 실패 표식이 남아 있다: $(tail -1 "$ALERT")"
  log "DRY-RUN 검증만 수행 → $SUBJECT"
  exit 0
fi

# ③ DarkWake 대책 — 네트워크가 붙은 뒤에 푸시한다
if ! wait_for_network; then
  fail "네트워크가 6분 동안 살아나지 않았다 (DarkWake 추정) — 이번 슬롯 포기: $SUBJECT"
fi

log "PUSH 시작 → $SUBJECT"
push_with_retry "$TARGET:main" "$SUBJECT" || fail "푸시 실패: $SUBJECT"

PUSHED=$(changed_files "$TARGET" | grep -c '^src/content/posts/.*\.md$')
echo "$TODAY $((COUNT + PUSHED))" > "$STATE"
log "OK 푸시 완료 (오늘 $((COUNT + PUSHED))/3편, 이번 ${PUSHED}편) → $SUBJECT"

# ── 5. 라이브 검증 — 조용히 성공한 척하지 않는다 ──────────────────
[ -z "$SLUG" ] && { log "WARN 슬러그를 못 찾아 라이브 검증 생략"; clear_alert; exit 0; }

ENC=$(/usr/bin/python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$SLUG")
URL="https://noado.kr/posts/$ENC/"

for i in $(seq 1 20); do          # Vercel 빌드 대기 (최대 약 5분)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$URL")
  [ "$CODE" = "200" ] && { log "LIVE 확인됨 ($URL)"; clear_alert; exit 0; }
  sleep 15
done

fail "푸시는 됐으나 5분 내 라이브 확인 실패: $URL (코드 $CODE)"
