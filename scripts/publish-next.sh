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
#
# 검증할 때는 반드시 --dry-run 을 붙인다:
#     ./scripts/publish-next.sh --dry-run
# 실제 푸시 없이 "어느 커밋을 고르는지"까지만 확인한다.
# (2026-08-17: 드라이런 없이 상한 가드를 우회해 검증하다가 글 한 편이
#  예정보다 하루 일찍 실제 발행된 일이 있었다. 그래서 이 모드를 넣었다)

set -uo pipefail

DRY=0
[ "${1:-}" = "--dry-run" ] && DRY=1

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
# 상한은 애드센스 방어선이다. 사람이 고칠 수 있는 파일 하나에 의존하면 안 된다.
# 그래서 **git 사실**에서 센다 — 오늘 0시의 origin/main 부터 지금까지
# 실제로 원격에 올라간 글 커밋 수. 상태 파일은 참고용 보조 지표일 뿐이다.
# (2026-08-17: 검증하느라 상태 파일을 덮어썼더니 가드가 뚫려 글 한 편이
#  하루 일찍 발행된 일이 있었다. 그 뒤로 이 방식으로 바꿨다)
git fetch -q origin 2>/dev/null || log "WARN fetch 실패 — 상한 계산이 부정확할 수 있음"

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
  git push origin "$LAST:main" >> "$LOG" 2>&1 || fail "문서 커밋 푸시 실패"
  log "OK 문서 커밋 푸시 완료"
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
  log "DRY-RUN 검증만 수행 → $SUBJECT"
  exit 0
fi

log "PUSH 시작 → $SUBJECT"
git push origin "$TARGET:main" >> "$LOG" 2>&1 || fail "푸시 실패: $SUBJECT"

PUSHED=$(changed_files "$TARGET" | grep -c '^src/content/posts/.*\.md$')
echo "$TODAY $((COUNT + PUSHED))" > "$STATE"
log "OK 푸시 완료 (오늘 $((COUNT + PUSHED))/3편, 이번 ${PUSHED}편) → $SUBJECT"

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
