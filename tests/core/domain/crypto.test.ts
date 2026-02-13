import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("crypto", () => {
  const VALID_KEY_BASE64 = Buffer.from(
    "0123456789abcdef0123456789abcdef" // 32 bytes
  ).toString("base64");

  let encryptCredential: typeof import("@/server/domain/crypto").encryptCredential;
  let decryptCredential: typeof import("@/server/domain/crypto").decryptCredential;

  beforeEach(async () => {
    vi.stubEnv("TOKEN_ENCRYPTION_KEY", VALID_KEY_BASE64);
    // Dynamically import to pick up env var
    const mod = await import("@/server/domain/crypto");
    encryptCredential = mod.encryptCredential;
    decryptCredential = mod.decryptCredential;
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  describe("encryptCredential + decryptCredential (round-trip)", () => {
    it("cifra y descifra un texto plano correctamente", () => {
      const plaintext = "mi-password-super-secreto";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("cifra y descifra strings vacíos", () => {
      const plaintext = "";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("cifra y descifra caracteres unicode", () => {
      const plaintext = "contraseña con ñ y émojis 🔐🎉";
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });

    it("produce ciphertexts diferentes para el mismo plaintext", () => {
      const plaintext = "same-password";
      const encrypted1 = encryptCredential(plaintext);
      const encrypted2 = encryptCredential(plaintext);

      // IVs aleatorios → ciphertexts diferentes
      expect(encrypted1).not.toBe(encrypted2);

      // Pero ambos descifran al mismo texto
      expect(decryptCredential(encrypted1)).toBe(plaintext);
      expect(decryptCredential(encrypted2)).toBe(plaintext);
    });

    it("cifra un password largo", () => {
      const plaintext = "a".repeat(10000);
      const encrypted = encryptCredential(plaintext);
      const decrypted = decryptCredential(encrypted);

      expect(decrypted).toBe(plaintext);
    });
  });

  describe("formato del ciphertext", () => {
    it("tiene formato iv:ciphertext:tag (hex)", () => {
      const encrypted = encryptCredential("test");
      const parts = encrypted.split(":");

      expect(parts).toHaveLength(3);

      // IV: 12 bytes = 24 hex chars
      expect(parts[0]).toMatch(/^[0-9a-f]{24}$/);
      // Ciphertext: al menos algo
      expect(parts[1].length).toBeGreaterThan(0);
      expect(parts[1]).toMatch(/^[0-9a-f]+$/);
      // Tag: 16 bytes = 32 hex chars
      expect(parts[2]).toMatch(/^[0-9a-f]{32}$/);
    });
  });

  describe("errores", () => {
    it("falla al descifrar un ciphertext inválido (formato incorrecto)", () => {
      expect(() => decryptCredential("not-valid")).toThrow("inválido");
    });

    it("falla al descifrar un ciphertext con tag alterado", () => {
      const encrypted = encryptCredential("test");
      const parts = encrypted.split(":");
      // Alterar el tag
      const alteredTag = "a".repeat(32);
      const altered = `${parts[0]}:${parts[1]}:${alteredTag}`;

      expect(() => decryptCredential(altered)).toThrow();
    });

    it("falla al descifrar un ciphertext con datos alterados", () => {
      const encrypted = encryptCredential("test");
      const parts = encrypted.split(":");
      // Alterar el ciphertext
      const altered = `${parts[0]}:${"ff".repeat(parts[1].length / 2)}:${parts[2]}`;

      expect(() => decryptCredential(altered)).toThrow();
    });
  });
});
