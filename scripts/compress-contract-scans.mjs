/**
 * compress-contract-scans.mjs
 * 특정 입주사 계약서의 스캔 파일을 다운로드 → 압축 → 재업로드 → DB 업데이트
 *
 * 실행: node scripts/compress-contract-scans.mjs [tenant-name-keyword]
 *   예: node scripts/compress-contract-scans.mjs "손옥발|김종우"
 */

import { createClient } from '@supabase/supabase-js'
import sharp from 'sharp'
import { Buffer } from 'node:buffer'

const SUPABASE_URL = 'https://zswazaviqcaikefpkxee.supabase.co'
const SERVICE_ROLE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inpzd2F6YXZpcWNhaWtlZnBreGVlIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3Mjg5MTUxMCwiZXhwIjoyMDg4NDY3NTEwfQ.ES_d7JNqg3laQHvZ6d6sEpPuJ2srkHjW-UKGG1DFxXA'
const BUCKET = 'contract-templates'

const sb = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const SIZE_THRESHOLD = 3 * 1024 * 1024  // 3MB 초과 시 압축
const MAX_DIMENSION = 2200               // 최대 가로/세로 픽셀
const JPEG_QUALITY = 78                  // JPEG 품질
const NAMES = (process.argv[2] || '손옥발|김종우').split('|').map(s => s.trim()).filter(Boolean)

console.log(`🔍 대상 입주사 키워드: ${NAMES.join(', ')}`)
console.log(`📏 압축 기준: ${SIZE_THRESHOLD / 1024 / 1024}MB 초과, 최대 ${MAX_DIMENSION}px, JPEG ${JPEG_QUALITY}\n`)

/* 스토리지 경로 추출: https://.../contract-templates/{owner_id}/{file} → {owner_id}/{file} */
function urlToStoragePath(url) {
  const m = url.match(/\/contract-templates\/(.+?)(?:\?|$)/)
  return m ? decodeURIComponent(m[1]) : null
}

async function downloadFile(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`다운로드 실패 ${res.status}: ${url}`)
  const buf = Buffer.from(await res.arrayBuffer())
  return buf
}

async function compressImage(buf, mime) {
  const meta = await sharp(buf).metadata()
  const { width = 0, height = 0, format } = meta

  let pipe = sharp(buf, { failOn: 'none' })
  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    pipe = pipe.resize({
      width: width >= height ? MAX_DIMENSION : undefined,
      height: height > width ? MAX_DIMENSION : undefined,
      withoutEnlargement: true,
    })
  }

  /* 알파 채널이 있는 PNG는 PNG로 유지하되 강한 압축, 아니면 JPEG */
  let outBuf, outMime, outExt
  if (format === 'png' && (await sharp(buf).stats()).isOpaque === false) {
    outBuf = await pipe.png({ compressionLevel: 9, palette: true }).toBuffer()
    outMime = 'image/png'
    outExt  = 'png'
  } else {
    outBuf = await pipe.jpeg({ quality: JPEG_QUALITY, mozjpeg: true }).toBuffer()
    outMime = 'image/jpeg'
    outExt  = 'jpg'
  }
  return { buf: outBuf, mime: outMime, ext: outExt, origDim: `${width}x${height}` }
}

async function processOneFile(originalUrl, ownerId) {
  const storagePath = urlToStoragePath(originalUrl)
  if (!storagePath) {
    console.log(`   ⚠️  경로 추출 실패: ${originalUrl.slice(0, 80)}...`)
    return { newUrl: originalUrl, changed: false }
  }
  const buf = await downloadFile(originalUrl)
  const origMb = (buf.length / 1024 / 1024).toFixed(2)
  if (buf.length <= SIZE_THRESHOLD) {
    console.log(`   ✓ 작아서 스킵 (${origMb}MB): ${storagePath.split('/').pop()}`)
    return { newUrl: originalUrl, changed: false }
  }

  /* 이미지 헤더 검사 — PDF면 스킵 (sharp가 PDF 처리 못함) */
  const header = buf.slice(0, 4).toString('ascii')
  if (header.startsWith('%PDF')) {
    console.log(`   ⚠️  PDF는 압축 스킵 (${origMb}MB): ${storagePath.split('/').pop()}`)
    return { newUrl: originalUrl, changed: false }
  }

  const { buf: outBuf, mime, ext, origDim } = await compressImage(buf)
  const newMb = (outBuf.length / 1024 / 1024).toFixed(2)
  const newPath = `${ownerId}/compressed-${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`

  const { error: upErr } = await sb.storage.from(BUCKET).upload(newPath, outBuf, {
    contentType: mime,
    cacheControl: '3600',
    upsert: false,
  })
  if (upErr) {
    console.log(`   ❌ 업로드 실패: ${upErr.message}`)
    return { newUrl: originalUrl, changed: false }
  }

  const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(newPath)

  console.log(`   📦 ${origMb}MB (${origDim}) → ${newMb}MB  ${storagePath.split('/').pop()} → ${newPath.split('/').pop()}`)

  /* 기존 파일 삭제 (선택적 — 안전하게 보존하려면 주석 처리) */
  await sb.storage.from(BUCKET).remove([storagePath]).catch(() => {})

  return { newUrl: pub.publicUrl, newMime: mime, changed: true }
}

async function main() {
  /* 대상 계약서 조회: tenant_name LIKE 키워드 */
  const orFilter = NAMES.map(n => `tenant_name.ilike.%${n}%`).join(',')
  const { data: contracts, error } = await sb
    .from('contracts')
    .select('id, owner_id, tenant_name, template_url, template_mime, contract_snapshot, room:rooms!contracts_room_id_fkey(name)')
    .or(orFilter)
    .order('created_at', { ascending: false })

  if (error) { console.error('❌ 계약서 조회 실패:', error.message); process.exit(1) }
  if (!contracts || contracts.length === 0) {
    console.log('대상 계약서 없음.')
    process.exit(0)
  }

  console.log(`📄 대상 계약서 ${contracts.length}건\n`)

  for (const c of contracts) {
    const roomName = c.room?.name ?? '—'
    console.log(`▶ ${roomName} ${c.tenant_name} (계약 ID: ${c.id.slice(0, 8)})`)

    const snap = c.contract_snapshot || {}
    const oldScanUrls = Array.isArray(snap.scan_urls) ? snap.scan_urls : (c.template_url ? [c.template_url] : [])
    if (oldScanUrls.length === 0) {
      console.log('   (스캔 파일 없음)')
      continue
    }

    const newScanUrls = []
    let anyChange = false
    let firstNewUrl = null
    let firstNewMime = c.template_mime

    for (const url of oldScanUrls) {
      const result = await processOneFile(url, c.owner_id)
      newScanUrls.push(result.newUrl)
      if (result.changed) {
        anyChange = true
        if (!firstNewUrl) {
          firstNewUrl = result.newUrl
          firstNewMime = result.newMime
        }
      }
    }

    if (!anyChange) continue

    /* DB 업데이트 */
    const newSnap = { ...snap, scan_urls: newScanUrls }
    const update = {
      contract_snapshot: newSnap,
      template_url: firstNewUrl ?? newScanUrls[0],
      template_mime: firstNewMime,
    }
    const { error: uErr } = await sb.from('contracts').update(update).eq('id', c.id)
    if (uErr) console.log(`   ❌ DB 업데이트 실패: ${uErr.message}`)
    else console.log(`   ✅ DB 업데이트 완료\n`)
  }

  console.log('🎉 완료')
}

main().catch(e => { console.error(e); process.exit(1) })
