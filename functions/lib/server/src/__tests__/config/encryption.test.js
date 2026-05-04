"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const vitest_1 = require("vitest");
// Import the REAL encryption module (not the mock) for these tests
// We use vi.unmock or import directly before the mock is applied
// Since setup.ts mocks '../config/encryption' relative to agents/services,
// we test the real implementation by importing it directly here with vi.importActual
const vitest_2 = require("vitest");
// Temporarily bypass the mock for this test file
const encryptionModule = await vitest_2.vi.importActual('../../../config/encryption');
const { encrypt: realEncrypt, decrypt: realDecrypt } = encryptionModule;
(0, vitest_1.describe)('Encryption Service', () => {
    (0, vitest_1.it)('should encrypt and decrypt a string round-trip', () => {
        const original = 'my-secret-api-key-123';
        const encrypted = realEncrypt(original);
        const decrypted = realDecrypt(encrypted);
        (0, vitest_1.expect)(encrypted).not.toBe(original);
        (0, vitest_1.expect)(decrypted).toBe(original);
    });
    (0, vitest_1.it)('should produce a different ciphertext each time (random IV)', () => {
        const text = 'same-text-to-encrypt';
        const enc1 = realEncrypt(text);
        const enc2 = realEncrypt(text);
        // With random IV, ciphertexts should differ
        (0, vitest_1.expect)(enc1).not.toBe(enc2);
    });
    (0, vitest_1.it)('should handle an empty string', () => {
        const encrypted = realEncrypt('');
        const decrypted = realDecrypt(encrypted);
        (0, vitest_1.expect)(decrypted).toBe('');
    });
    (0, vitest_1.it)('should encrypt special characters', () => {
        const special = 'key!@#$%^&*()_+{}|:<>?';
        const encrypted = realEncrypt(special);
        const decrypted = realDecrypt(encrypted);
        (0, vitest_1.expect)(decrypted).toBe(special);
    });
    (0, vitest_1.it)('should encrypt long strings', () => {
        const long = 'x'.repeat(1000);
        const encrypted = realEncrypt(long);
        const decrypted = realDecrypt(encrypted);
        (0, vitest_1.expect)(decrypted).toBe(long);
    });
    (0, vitest_1.it)('should produce non-empty output for non-empty input', () => {
        const encrypted = realEncrypt('hello');
        (0, vitest_1.expect)(encrypted.length).toBeGreaterThan(0);
    });
    (0, vitest_1.it)('should encrypt unicode characters', () => {
        const unicode = 'Bonjour 🚀 ñoño こんにちは';
        const encrypted = realEncrypt(unicode);
        const decrypted = realDecrypt(encrypted);
        (0, vitest_1.expect)(decrypted).toBe(unicode);
    });
    (0, vitest_1.it)('should throw when decrypting invalid ciphertext', () => {
        (0, vitest_1.expect)(() => realDecrypt('not-valid-ciphertext')).toThrow();
    });
});
//# sourceMappingURL=encryption.test.js.map