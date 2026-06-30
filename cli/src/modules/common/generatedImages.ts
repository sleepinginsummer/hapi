import { basename, join } from 'path'
import { mkdirSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { homedir } from 'os'

export type GeneratedImageMetadata = {
    id: string
    fileName: string
    content: Buffer
    mimeType: string
    createdAt: number
}

const MAX_GENERATED_IMAGE_BYTES = 25 * 1024 * 1024
const MAX_GENERATED_IMAGE_TOTAL_BYTES = 100 * 1024 * 1024
const MAX_GENERATED_IMAGE_COUNT = 100
const GENERATED_IMAGE_CACHE_DIR = join(process.env.CODEX_HOME ?? join(homedir(), '.codex'), 'generated-images')

const generatedImages = new Map<string, GeneratedImageMetadata>()
let generatedImageBytes = 0

export function detectImageMimeType(bytes: Uint8Array): string | null {
    if (bytes.length >= 8
        && bytes[0] === 0x89
        && bytes[1] === 0x50
        && bytes[2] === 0x4e
        && bytes[3] === 0x47
        && bytes[4] === 0x0d
        && bytes[5] === 0x0a
        && bytes[6] === 0x1a
        && bytes[7] === 0x0a) {
        return 'image/png'
    }

    if (bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) {
        return 'image/jpeg'
    }

    if (bytes.length >= 6) {
        const header = ascii(bytes, 0, 6)
        if (header === 'GIF87a' || header === 'GIF89a') {
            return 'image/gif'
        }
    }

    if (bytes.length >= 12 && ascii(bytes, 0, 4) === 'RIFF' && ascii(bytes, 8, 12) === 'WEBP') {
        return 'image/webp'
    }

    if (bytes.length >= 12
        && bytes[0] === 0x00
        && bytes[1] === 0x00
        && bytes[2] === 0x00
        && ascii(bytes, 4, 8) === 'ftyp'
        && (ascii(bytes, 8, 12) === 'avif' || ascii(bytes, 8, 12) === 'avis')) {
        return 'image/avif'
    }

    return null
}

function ascii(bytes: Uint8Array, start: number, end: number): string {
    return String.fromCharCode(...bytes.subarray(start, end))
}

export function registerGeneratedImage(args: { id: string; path: string; mimeType: string; bytes: Uint8Array; fileName?: string | null }): GeneratedImageMetadata {
    const content = Buffer.from(args.bytes)
    if (content.byteLength > MAX_GENERATED_IMAGE_BYTES) {
        throw new Error('Image is too large to display inline')
    }

    const previous = generatedImages.get(args.id)
    if (previous) {
        generatedImageBytes -= previous.content.byteLength
    }

    const metadata: GeneratedImageMetadata = {
        id: args.id,
        fileName: args.fileName || basename(args.path) || `${args.id}.png`,
        content,
        mimeType: args.mimeType,
        createdAt: Date.now()
    }
    generatedImages.set(args.id, metadata)
    generatedImageBytes += content.byteLength
    persistGeneratedImage(metadata)

    evictOldGeneratedImages()

    return metadata
}

function evictOldGeneratedImages(): void {
    while (generatedImages.size > MAX_GENERATED_IMAGE_COUNT || generatedImageBytes > MAX_GENERATED_IMAGE_TOTAL_BYTES) {
        const oldestId = generatedImages.keys().next().value
        if (!oldestId) break
        const oldest = generatedImages.get(oldestId)
        if (oldest) {
            generatedImageBytes -= oldest.content.byteLength
        }
        generatedImages.delete(oldestId)
        try {
            rmSync(join(GENERATED_IMAGE_CACHE_DIR, `${oldestId}.bin`), { force: true })
            rmSync(join(GENERATED_IMAGE_CACHE_DIR, `${oldestId}.json`), { force: true })
        } catch {
            // ponytail: cache cleanup best-effort; stale files only waste disk.
        }
    }
}

export function getGeneratedImage(id: string): GeneratedImageMetadata | null {
    const cached = generatedImages.get(id)
    if (cached) return cached
    return loadPersistedGeneratedImage(id)
}

export function clearGeneratedImages(): void {
    generatedImages.clear()
    generatedImageBytes = 0
}

function persistGeneratedImage(image: GeneratedImageMetadata): void {
    try {
        mkdirSync(GENERATED_IMAGE_CACHE_DIR, { recursive: true })
        writeFileSync(join(GENERATED_IMAGE_CACHE_DIR, `${image.id}.bin`), image.content)
        writeFileSync(join(GENERATED_IMAGE_CACHE_DIR, `${image.id}.json`), JSON.stringify({
            id: image.id,
            fileName: image.fileName,
            mimeType: image.mimeType,
            createdAt: image.createdAt
        }))
    } catch {
        // ponytail: cache only; if disk write fails, fall back to in-memory behavior.
    }
}

function loadPersistedGeneratedImage(id: string): GeneratedImageMetadata | null {
    try {
        const content = readFileSync(join(GENERATED_IMAGE_CACHE_DIR, `${id}.bin`))
        const meta = JSON.parse(readFileSync(join(GENERATED_IMAGE_CACHE_DIR, `${id}.json`), 'utf8')) as { fileName?: string; mimeType?: string; createdAt?: number }
        return {
            id,
            fileName: meta.fileName ?? `${id}.png`,
            content,
            mimeType: meta.mimeType ?? 'application/octet-stream',
            createdAt: meta.createdAt ?? Date.now()
        }
    } catch {
        return null
    }
}
