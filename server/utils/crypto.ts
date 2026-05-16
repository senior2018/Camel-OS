import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'node:crypto'

const ALGORITHM = 'aes-256-gcm'
const IV_LENGTH = 12
const TAG_LENGTH = 16

function getKey(): Buffer {
  const key = useRuntimeConfig().authEncryptionKey as string
  if (!key) throw new Error('NUXT_AUTH_ENCRYPTION_KEY is not set')
  const buf = Buffer.from(key, 'hex')
  if (buf.length !== 32) throw new Error('NUXT_AUTH_ENCRYPTION_KEY must be 64 hex chars (32 bytes)')
  return buf
}

export function encrypt(plaintext: string): string {
  const key = getKey()
  const iv = randomBytes(IV_LENGTH)
  const cipher = createCipheriv(ALGORITHM, key, iv)
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, encrypted]).toString('base64url')
}

export function decrypt(ciphertext: string): string {
  const key = getKey()
  const buf = Buffer.from(ciphertext, 'base64url')
  const iv = buf.subarray(0, IV_LENGTH)
  const tag = buf.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH)
  const encrypted = buf.subarray(IV_LENGTH + TAG_LENGTH)
  const decipher = createDecipheriv(ALGORITHM, key, iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8')
}

export function sha256(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}
