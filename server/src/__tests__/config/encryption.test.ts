import { describe, it, expect } from 'vitest';

// Import the REAL encryption module (not the mock) for these tests
// We use vi.unmock or import directly before the mock is applied
// Since setup.ts mocks '../config/encryption' relative to agents/services,
// we test the real implementation by importing it directly here with vi.importActual

import { vi } from 'vitest';

// Temporarily bypass the mock for this test file
const encryptionModule = await vi.importActual<{
  encrypt: (text: string) => string;
  decrypt: (text: string) => string;
}>('../../../config/encryption');

const { encrypt: realEncrypt, decrypt: realDecrypt } = encryptionModule;

describe('Encryption Service', () => {
  it('should encrypt and decrypt a string round-trip', () => {
    const original = 'my-secret-api-key-123';
    const encrypted = realEncrypt(original);
    const decrypted = realDecrypt(encrypted);

    expect(encrypted).not.toBe(original);
    expect(decrypted).toBe(original);
  });

  it('should produce a different ciphertext each time (random IV)', () => {
    const text = 'same-text-to-encrypt';
    const enc1 = realEncrypt(text);
    const enc2 = realEncrypt(text);

    // With random IV, ciphertexts should differ
    expect(enc1).not.toBe(enc2);
  });

  it('should handle an empty string', () => {
    const encrypted = realEncrypt('');
    const decrypted = realDecrypt(encrypted);
    expect(decrypted).toBe('');
  });

  it('should encrypt special characters', () => {
    const special = 'key!@#$%^&*()_+{}|:<>?';
    const encrypted = realEncrypt(special);
    const decrypted = realDecrypt(encrypted);
    expect(decrypted).toBe(special);
  });

  it('should encrypt long strings', () => {
    const long = 'x'.repeat(1000);
    const encrypted = realEncrypt(long);
    const decrypted = realDecrypt(encrypted);
    expect(decrypted).toBe(long);
  });

  it('should produce non-empty output for non-empty input', () => {
    const encrypted = realEncrypt('hello');
    expect(encrypted.length).toBeGreaterThan(0);
  });

  it('should encrypt unicode characters', () => {
    const unicode = 'Bonjour 🚀 ñoño こんにちは';
    const encrypted = realEncrypt(unicode);
    const decrypted = realDecrypt(encrypted);
    expect(decrypted).toBe(unicode);
  });

  it('should throw when decrypting invalid ciphertext', () => {
    expect(() => realDecrypt('not-valid-ciphertext')).toThrow();
  });
});
