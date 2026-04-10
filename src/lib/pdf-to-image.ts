/**
 * PDF 파일을 단일 PNG 이미지(여러 페이지를 세로로 합침)로 변환한다.
 * - 클라이언트 전용 (브라우저에서만 호출)
 * - pdfjs-dist v5 사용
 *
 * 전자계약 양식 업로드 시 사용:
 *   PDF는 iframe에서만 미리보기 가능하고 인쇄 시 캡처되지 않음.
 *   업로드 시점에 PNG로 변환해 두면 미리보기/인쇄 모두 동작.
 */

const SCALE   = 2     // 렌더 배율 (2 = 2x DPI, 선명함)
const QUALITY = 0.92  // (PNG는 무손실이라 무시되지만 명시)

export interface PdfConversionResult {
  blob:       Blob
  pageCount:  number
  width:      number
  height:     number
}

export async function convertPdfToPngBlob(file: File): Promise<PdfConversionResult> {
  if (typeof window === 'undefined') {
    throw new Error('convertPdfToPngBlob은 브라우저에서만 호출할 수 있습니다.')
  }

  // 동적 import (서버 번들 영향 없이)
  const pdfjs = await import('pdfjs-dist')

  // 워커 설정 (CDN — 번들러 의존 없음)
  if (!pdfjs.GlobalWorkerOptions.workerSrc) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`
  }

  const buf  = await file.arrayBuffer()
  const pdf  = await pdfjs.getDocument({ data: buf }).promise
  const pages: HTMLCanvasElement[] = []

  let totalHeight = 0
  let maxWidth    = 0

  for (let i = 1; i <= pdf.numPages; i++) {
    const page     = await pdf.getPage(i)
    const viewport = page.getViewport({ scale: SCALE })
    const canvas   = document.createElement('canvas')
    canvas.width   = Math.ceil(viewport.width)
    canvas.height  = Math.ceil(viewport.height)
    const ctx      = canvas.getContext('2d')!
    // 흰 배경
    ctx.fillStyle = 'white'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    // pdfjs v5는 canvasContext가 아닌 canvas를 받는다
    await page.render({
      canvas,
      canvasContext: ctx,
      viewport,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      intent: 'print' as any,
    }).promise
    pages.push(canvas)
    totalHeight += canvas.height
    if (canvas.width > maxWidth) maxWidth = canvas.width
  }

  // 모든 페이지를 세로로 합친 단일 캔버스 생성
  const combined = document.createElement('canvas')
  combined.width  = maxWidth
  combined.height = totalHeight
  const cctx = combined.getContext('2d')!
  cctx.fillStyle = 'white'
  cctx.fillRect(0, 0, combined.width, combined.height)

  let y = 0
  for (const c of pages) {
    cctx.drawImage(c, Math.floor((maxWidth - c.width) / 2), y)
    y += c.height
  }

  const blob = await new Promise<Blob | null>(resolve =>
    combined.toBlob(resolve, 'image/png', QUALITY))
  if (!blob) throw new Error('PDF → PNG 변환 실패')

  return {
    blob,
    pageCount: pdf.numPages,
    width:     combined.width,
    height:    combined.height,
  }
}
