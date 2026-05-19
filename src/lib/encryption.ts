const ALGORITHM = 'AES-CBC';
const KEY_LENGTH = 256;
const IV_LENGTH = 16;
const SALT_LENGTH = 32;
const PBKDF2_ITERATIONS = 100000;

export type ProfileForEncryption = {
  id: string;
  encryption_secret: string;
  enc_version: number;
};

// ── V1 (legacy) ──────────────────────────────────────────────────────────────
// Key derived from a deterministic password + hardcoded global salt.
// Kept only for decrypting old stored ciphertexts.

async function getKeyV1(password: string): Promise<CryptoKey> {
  const encoder = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    encoder.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: encoder.encode('pimpmycopy-salt-v1'),
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

async function decryptV1(ciphertext: string, userSecret: string): Promise<string> {
  const key = await getKeyV1(userSecret);
  const combined = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
  const iv = combined.slice(0, IV_LENGTH);
  const encrypted = combined.slice(IV_LENGTH);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, encrypted);
  return new TextDecoder().decode(decrypted);
}

// ── V2 ───────────────────────────────────────────────────────────────────────
// Key derived from per-user random secret (profiles.encryption_secret) +
// per-message random salt. No global salt. No key derivation from userId.

interface V2Payload {
  v: 2;
  iv: string;
  salt: string;
  ct: string;
}

async function getKeyV2(userSecretB64: string, saltBytes: Uint8Array): Promise<CryptoKey> {
  const secretBytes = Uint8Array.from(atob(userSecretB64), c => c.charCodeAt(0));
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    secretBytes,
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: saltBytes,
      iterations: PBKDF2_ITERATIONS,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: ALGORITHM, length: KEY_LENGTH },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptV2(plaintext: string, userSecretB64: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_LENGTH));
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const key = await getKeyV2(userSecretB64, salt);
  const encrypted = await crypto.subtle.encrypt(
    { name: ALGORITHM, iv },
    key,
    new TextEncoder().encode(plaintext)
  );
  const payload: V2Payload = {
    v: 2,
    iv: btoa(String.fromCharCode(...iv)),
    salt: btoa(String.fromCharCode(...salt)),
    ct: btoa(String.fromCharCode(...new Uint8Array(encrypted))),
  };
  return JSON.stringify(payload);
}

async function decryptV2(payloadStr: string, userSecretB64: string): Promise<string> {
  const payload: V2Payload = JSON.parse(payloadStr);
  const salt = Uint8Array.from(atob(payload.salt), c => c.charCodeAt(0));
  const iv = Uint8Array.from(atob(payload.iv), c => c.charCodeAt(0));
  const ct = Uint8Array.from(atob(payload.ct), c => c.charCodeAt(0));
  const key = await getKeyV2(userSecretB64, salt);
  const decrypted = await crypto.subtle.decrypt({ name: ALGORITHM, iv }, key, ct);
  return new TextDecoder().decode(decrypted);
}

// ── Public profile-based API ─────────────────────────────────────────────────

export async function encryptForUser(
  plaintext: string,
  profile: ProfileForEncryption
): Promise<string> {
  if (!profile?.encryption_secret) {
    throw new Error('MISSING_ENCRYPTION_SECRET');
  }
  return encryptV2(plaintext, profile.encryption_secret);
}

export async function decryptForUser(
  payloadStr: string,
  profile: ProfileForEncryption
): Promise<string> {
  if (!profile?.encryption_secret) {
    throw new Error('MISSING_ENCRYPTION_SECRET');
  }
  try {
    const parsed = JSON.parse(payloadStr);
    if (parsed?.v === 2) {
      return await decryptV2(payloadStr, profile.encryption_secret);
    }
  } catch {
    // not JSON — fall through to V1
  }
  // V1 fallback: secret was derived deterministically from userId
  return decryptV1(payloadStr, `user-secret-${profile.id}`);
}

// ── Legacy exports (kept so existing callers compile during migration) ────────

export async function encrypt(plaintext: string, userSecret: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await getKeyV1(userSecret);
  const iv = crypto.getRandomValues(new Uint8Array(IV_LENGTH));
  const encrypted = await crypto.subtle.encrypt({ name: ALGORITHM, iv }, key, encoder.encode(plaintext));
  const encArr = new Uint8Array(encrypted);
  const combined = new Uint8Array(iv.length + encArr.length);
  combined.set(iv);
  combined.set(encArr, iv.length);
  return btoa(String.fromCharCode(...combined));
}

export async function decrypt(ciphertext: string, userSecret: string): Promise<string> {
  try {
    return await decryptV1(ciphertext, userSecret);
  } catch {
    return '[Encrypted content]';
  }
}

export function getUserSecret(userId: string): string {
  return `user-secret-${userId}`;
}
