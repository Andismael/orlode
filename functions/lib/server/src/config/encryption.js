"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
exports.isEncrypted = isEncrypted;
/**
 * AES-256-GCM encryption for tenant API keys.
 * Keys are encrypted before storage, decrypted only in-memory at request time.
 * In case of a server breach, encrypted blobs are useless without TENANT_ENCRYPTION_KEY.
 */
const crypto_1 = require("crypto");
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12; // 96-bit IV for GCM
const TAG_LENGTH = 16; // 128-bit auth tag
function getMasterKey() {
    const raw = process.env['TENANT_ENCRYPTION_KEY'] ?? 'corpmind-dev-key-CHANGE-IN-PRODUCTION!!';
    // Always produces 32 bytes regardless of input length
    return (0, crypto_1.createHash)('sha256').update(raw).digest();
}
/**
 * Encrypt plaintext → base64 blob: [iv(12) | authTag(16) | ciphertext]
 */
function encrypt(plaintext) {
    const key = getMasterKey();
    const iv = (0, crypto_1.randomBytes)(IV_LENGTH);
    const cipher = (0, crypto_1.createCipheriv)(ALGORITHM, key, iv);
    const encrypted = Buffer.concat([
        cipher.update(plaintext, 'utf8'),
        cipher.final(),
    ]);
    const tag = cipher.getAuthTag();
    return Buffer.concat([iv, tag, encrypted]).toString('base64');
}
/**
 * Decrypt base64 blob → plaintext. Throws if tampered.
 */
function decrypt(ciphertext) {
    const key = getMasterKey();
    const data = Buffer.from(ciphertext, 'base64');
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const encrypted = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = (0, crypto_1.createDecipheriv)(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf8');
}
/**
 * Returns true if the string looks like an encrypted blob (base64, 40+ chars).
 * Used to avoid double-encrypting.
 */
function isEncrypted(value) {
    return /^[A-Za-z0-9+/=]{40,}$/.test(value) && value.length % 4 === 0;
}
//# sourceMappingURL=encryption.js.map