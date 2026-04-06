// ─────────────────────────────────────────────────────────────────────────────
// Addy AI — Auth utilities (Web Crypto API — runs in Cloudflare Workers)
// ─────────────────────────────────────────────────────────────────────────────

// ── Base64url helpers ─────────────────────────────────────────────────────────
function toB64url(str) {
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
}
function fromB64url(str) {
  return atob(str.replace(/-/g, '+').replace(/_/g, '/'));
}

// ── Password hashing (PBKDF2) ─────────────────────────────────────────────────
export async function hashPassword(password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const keyMaterial = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt, iterations: 100000, hash: 'SHA-256' },
    keyMaterial, 256
  );
  return JSON.stringify({
    salt: Array.from(salt),
    hash: Array.from(new Uint8Array(bits)),
  });
}

export async function verifyPassword(password, stored) {
  try {
    const { salt, hash } = JSON.parse(stored);
    const keyMaterial = await crypto.subtle.importKey(
      'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']
    );
    const bits = await crypto.subtle.deriveBits(
      { name: 'PBKDF2', salt: new Uint8Array(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial, 256
    );
    const derived = Array.from(new Uint8Array(bits));
    return derived.length === hash.length && derived.every((b, i) => b === hash[i]);
  } catch {
    return false;
  }
}

// ── JWT (HS256) ───────────────────────────────────────────────────────────────
export async function createToken(payload, secret) {
  const header  = toB64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const claims  = toB64url(JSON.stringify({ ...payload, iat: Math.floor(Date.now() / 1000) }));
  const data    = `${header}.${claims}`;
  const key     = await importHmacKey(secret);
  const sigBuf  = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(data));
  const sig     = toB64url(String.fromCharCode(...new Uint8Array(sigBuf)));
  return `${data}.${sig}`;
}

export async function verifyToken(token, secret) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [header, claims, sig] = parts;
  try {
    const key      = await importHmacKey(secret);
    const sigBytes = Uint8Array.from(fromB64url(sig), c => c.charCodeAt(0));
    const valid    = await crypto.subtle.verify(
      'HMAC', key, sigBytes, new TextEncoder().encode(`${header}.${claims}`)
    );
    if (!valid) return null;
    const data = JSON.parse(fromB64url(claims));
    if (data.exp && data.exp < Math.floor(Date.now() / 1000)) return null;
    return data;
  } catch {
    return null;
  }
}

async function importHmacKey(secret) {
  return crypto.subtle.importKey(
    'raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']
  );
}

// ── Cookie helpers ────────────────────────────────────────────────────────────
export function getTokenFromRequest(request) {
  const cookie = request.headers.get('Cookie') || '';
  const match  = cookie.match(/addy_session=([^;]+)/);
  return match ? match[1] : null;
}

export function sessionCookie(token) {
  return `addy_session=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=86400`;
}

export function clearSessionCookie() {
  return `addy_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0`;
}

// ── Nano-ID for primary keys ──────────────────────────────────────────────────
export function nanoid(size = 21) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const bytes = crypto.getRandomValues(new Uint8Array(size));
  return Array.from(bytes, b => chars[b % chars.length]).join('');
}
