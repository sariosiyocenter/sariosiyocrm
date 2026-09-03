import crypto from 'crypto';

/**
 * Encrypts the SMS credential stored in the Setting row.
 *
 * Threat model: a leaked database — a backup, a read-only connection string, an SQL
 * injection — should not hand over the Eskiz account, which can send SMS at the centre's
 * expense. The key lives in the environment, so this does nothing against an attacker who
 * already has env access; it is specifically about the database leaking on its own.
 *
 * Backward compatible in both directions: values written before this existed are read as
 * plaintext, and if SETTINGS_KEY is removed the app keeps working with whatever is
 * readable. Encryption only starts once SETTINGS_KEY is set.
 */
const PREFIX = 'enc:v1:';

function key() {
  const raw = process.env.SETTINGS_KEY;
  if (!raw) return null;
  // Any passphrase length is accepted; hashing gives the 32 bytes AES-256 needs.
  return crypto.createHash('sha256').update(raw).digest();
}

export function encryptSecret(plain) {
  if (plain === null || plain === undefined || plain === '') return plain;
  const k = key();
  if (!k) return plain;                       // not configured — store as before
  if (String(plain).startsWith(PREFIX)) return plain;   // already encrypted

  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', k, iv);
  const enc = Buffer.concat([cipher.update(String(plain), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return PREFIX + Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decryptSecret(stored) {
  if (!stored || typeof stored !== 'string') return stored;
  if (!stored.startsWith(PREFIX)) return stored;        // written before encryption existed

  const k = key();
  if (!k) {
    console.warn('[secrets] SETTINGS_KEY o\'rnatilmagan — shifrlangan qiymatni ochib bo\'lmadi');
    return '';
  }
  try {
    const raw = Buffer.from(stored.slice(PREFIX.length), 'base64');
    const iv = raw.subarray(0, 12);
    const tag = raw.subarray(12, 28);
    const data = raw.subarray(28);
    const decipher = crypto.createDecipheriv('aes-256-gcm', k, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(data), decipher.final()]).toString('utf8');
  } catch (err) {
    // A wrong or rotated key must not take SMS down silently in a confusing way.
    console.error('[secrets] Shifrni ochib bo\'lmadi — SETTINGS_KEY o\'zgarganmi?', err.message);
    return '';
  }
}

export const secretsEncryptionEnabled = () => !!process.env.SETTINGS_KEY;
