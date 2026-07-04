const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

export function makeId(prefix: string): string {
  return `${prefix}_${base64Url(crypto.getRandomValues(new Uint8Array(18)))}`;
}

export function makeClientSecret(): string {
  return `sk-router-${base64Url(crypto.getRandomValues(new Uint8Array(32)))}`;
}

export async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", textEncoder.encode(input));
  return [...new Uint8Array(digest)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let diff = 0;
  for (let i = 0; i < a.length; i += 1) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function encryptSecret(plaintext: string, encryptionKey: string): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await getAesKey(encryptionKey);
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, textEncoder.encode(plaintext));

  return `v1:${base64(iv)}:${base64(new Uint8Array(ciphertext))}`;
}

export async function decryptSecret(payload: string, encryptionKey: string): Promise<string> {
  const [version, ivValue, ciphertextValue] = payload.split(":");
  if (version !== "v1" || !ivValue || !ciphertextValue) {
    throw new Error("Unsupported encrypted secret format");
  }

  const key = await getAesKey(encryptionKey);
  const plaintext = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: toArrayBuffer(fromBase64(ivValue)) },
    key,
    toArrayBuffer(fromBase64(ciphertextValue))
  );
  return textDecoder.decode(plaintext);
}

async function getAesKey(encryptionKey: string): Promise<CryptoKey> {
  if (!encryptionKey) {
    throw new Error("ENCRYPTION_KEY is not configured");
  }

  const keyBytes = await crypto.subtle.digest("SHA-256", textEncoder.encode(encryptionKey));
  return crypto.subtle.importKey("raw", keyBytes, "AES-GCM", false, ["encrypt", "decrypt"]);
}

function base64(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary);
}

function fromBase64(value: string): Uint8Array {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

function base64Url(bytes: Uint8Array): string {
  return base64(bytes).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}
