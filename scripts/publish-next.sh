#!/bin/bash
# noado.kr 예약 발행 — 대기 중인 글 커밋을 하나씩 푸시한다.
#
# 이것은 "AI 자동 글 생성·발행"이 아니다. 그건 애드센스 재승인 전까지 금지다.
# 이 스크립트가 하는 일은 **사람이 이미 쓰고 1차 출처로 검증해 커밋해 둔 글**을
# 정해진 시각에 하나씩 내보내는 것뿐이다. 새 글을 만들지 않는다.
#
# 실행: cron 09:00 / 12:00 / 15:00 (3시간 간격, 하루 3편)
# 규칙: 23:00~07:00 발행 금지, 하루 3편 상한
#
# 자동화는 시끄럽게 실패해야 한다. 실패하면 로그에 남기고 맥 알림을 띄운다.

set -uo pipefail

REPO="/Users/dyl/antigravity/noado-blog"
LOG="$REPO/scripts/publish.log"
STATE="$REPO/scripts/.publish-state"

cd "$REPO" || { echo "$(date '+%F %T') FATAL 저장소 없음: $REPO" >> "$LOG"; exit 1; }

log()  { echo "$(date '+%F %T') $*" >> "$LOG"; }
# 한글 파일명이 이스케이프되지 않도록 quotepath 를 끄고 전체 경로를 받는다
changed_files() { git -c core.quotepath=false diff-tree --no-commit-id --name-only -r "$1"; }
fail() {
  log "FAIL $*"
  osascript -e "display notification \"$*\" with title \"noado 발행 실패\"" 2>/dev/null
  exit 1
}

HOUR=$(date '+%-H')
TODAY=$(date '+%F')

# ── 1. 발행 금지 시간대 ────────────────────────────────────────────
if [ "$HOUR" -lt 7 ] || [ "$HOUR" -ge 23 ]; then
  log "SKIP 발행 금지 시간대 (${HOUR}시). 07:00~23:00 에만 푸시한다"
  exit 0
fi

# ── 2. 하루 3편 상한 ──────────────────────────────────────────────
COUNT=0
if [ -f "$STATE" ]; then
  SAVED_DATE=$(cut -d' ' -f1 "$STATE")
  [ "$SAVED_DATE" = "$TODAY" ] && COUNT=$(cut -d' ' -f2 "$STATE")
fi
if [ "$COUNT" -ge 3 ]; then
  log "SKIP 오늘 이미 ${COUNT}편 발행. 하루 3편 상한"
  exit 0
fi

# ── 3. 대기 중인 커밋 확인 ────────────────────────────────────────
git fetch -q origin 2>/dev/null || log "WARN fetch 실패 — 로컬 기준으로 진행"
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
  log "INFO 남은 것은 문서 커밋뿐. 일괄 푸시: $(git log -1 --format='%h %s' "$LAST")"
  git push origin "$LAST:main" >> "$LOG" 2>&1 || fail "문서 커밋 푸시 실패"
  log "OK 문서 커밋 푸시 완료"
  exit 0
fi

SUBJECT=$(git log -1 --format='%h %s' "$TARGET")
SLUG=$(changed_files "$TARGET" | grep '^src/content/posts/.*\.md$' | head -1 \
        | sed 's|src/content/posts/||;s|\.md$||')

# ── 4. 푸시 ───────────────────────────────────────────────────────
log "PUSH 시작 → $SUBJECT"
git push origin "$TARGET:main" >> "$LOG" 2>&1 || fail "푸시 실패: $SUBJECT"

echo "$TODAY $((COUNT + 1))" > "$STATE"
log "OK 푸시 완료 (오늘 $((COUNT + 1))/3편) → $SUBJECT"

# ── 5. 라이브 검증 — 조용히 성공한 척하지 않는다 ──────────────────
[ -z "$SLUG" ] && { log "WARN 슬러그를 못 찾아 라이브 검증 생략"; exit 0; }

ENC=$(/usr/bin/python3 -c "import urllib.parse,sys;print(urllib.parse.quote(sys.argv[1]))" "$SLUG")
URL="https://noado.kr/posts/$ENC/"

for i in $(seq 1 20); do          # Vercel 빌드 대기 (최대 약 5분)
  CODE=$(curl -s -o /dev/null -w '%{http_code}' -m 20 "$URL")
  [ "$CODE" = "200" ] && { log "LIVE 확인됨 ($URL)"; exit 0; }
  sleep 15
done

fail "푸시는 됐으나 5분 내 라이브 확인 실패: $URL (코드 $CODE)"
