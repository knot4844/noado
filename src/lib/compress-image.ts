/**
 * 브라우저에서 이미지 파일을 자동 압축
 *
 * - 임계값(기본 3MB) 초과 시: 최대 변(기본 2200px)으로 리사이즈 + JPEG 품질 78
 * - PDF/임계값 이하: 원본 그대로 반환
 *
 * 30MB 스캔 사진을 ~0.2MB로 줄이면서 인쇄 화질은 충분히 보존됨 (2200px 기준)
 */

export interface CompressOptions {
  thresholdBytes?: number   // 이 크기 이하면 압축 안 함 (기본 3MB)
  maxDimension?: number     // 최대 가로/세로 픽셀 (기본 2200)
  jpegQuality?: number      // 0~1 (기본 0.78)
}

const DEFAULTS: Required<CompressOptions> = {
  thresholdBytes: 3 * 1024 * 1024,
  maxDimension: 2200,
  jpegQuality: 0.78,
}

/** 이미지 File을 자동 압축. 압축 불필요/실패 시 원본 반환. */
export async function compressImageFile(file: File, opts: CompressOptions = {}): Promise<File> {
  const { thresholdBytes, maxDimension, jpegQuality } = { ...DEFAULTS, ...opts }

  /* PDF는 호출부에서 별도 처리 */
  if (file.type === 'application/pdf') return file

  /* 작은 파일은 그대로 */
  if (file.size <= thresholdBytes) return file

  /* 이미지 타입이 아니면 그대로 (안전망) */
  if (!file.type.startsWith('image/')) return file

  try {
    const bitmap = await loadBitmap(file)
    const { width, height } = bitmap

    /* 리사이즈 비율 계산 — 가로·세로 중 큰 쪽이 maxDimension에 맞도록 */
    let targetW = width
    let targetH = height
    if (width > maxDimension || height > maxDimension) {
      const scale = Math.min(maxDimension / width, maxDimension / height)
      targetW = Math.round(width * scale)
      targetH = Math.round(height * scale)
    }

    const canvas = document.createElement('canvas')
    canvas.width = targetW
    canvas.height = targetH
    const ctx = canvas.getContext('2d')
    if (!ctx) return file

    /* 흰 배경 깔기 (PNG 투명 → JPEG 변환 시 검정 배경 방지) */
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, targetW, targetH)
    ctx.drawImage(bitmap, 0, 0, targetW, targetH)

    /* JPEG 로 변환 (모든 브라우저 지원, 가장 작음) */
    const blob: Blob | null = await new Promise(resolve =>
      canvas.toBlob(b => resolve(b), 'image/jpeg', jpegQuality),
    )
    if (!blob) return file

    /* 압축 결과가 더 크면 (드물지만 가능) 원본 사용 */
    if (blob.size >= file.size) return file

    const newName = file.name.replace(/\.(png|jpe?g|webp|heic|heif)$/i, '') + '.jpg'
    return new File([blob], newName, { type: 'image/jpeg', lastModified: Date.now() })
  } catch {
    /* 어떤 이유로든 실패하면 원본 그대로 */
    return file
  }
}

/** File → ImageBitmap (createImageBitmap 우선, 폴백은 <img>) */
async function loadBitmap(file: File): Promise<ImageBitmap | HTMLImageElement> {
  if (typeof createImageBitmap === 'function') {
    try { return await createImageBitmap(file) } catch { /* 폴백 */ }
  }
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    const url = URL.createObjectURL(file)
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = (e) => { URL.revokeObjectURL(url); reject(e) }
    img.src = url
  })
}
