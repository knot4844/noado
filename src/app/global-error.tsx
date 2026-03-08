'use client'

export const dynamic = 'force-dynamic'

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div>
          <h2>오류가 발생했습니다</h2>
          <button type="button" onClick={reset}>다시 시도</button>
        </div>
      </body>
    </html>
  )
}
