import { createCipheriv, createDecipheriv, randomBytes } from "crypto";

// ─────────────────────────────────────────────────────────────────────────────
// Cifrado AES-256-GCM para credenciales sensibles (passwords IMAP/SMTP)
// ─────────────────────────────────────────────────────────────────────────────

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12; // 96 bits recomendado para GCM
const TAG_LENGTH = 16; // 128 bits auth tag

function getEncryptionKey(): Buffer {
  const keyBase64 = process.env.TOKEN_ENCRYPTION_KEY;
  if (!keyBase64) {
    throw new Error(
      "TOKEN_ENCRYPTION_KEY no está configurado. Es necesario para cifrar credenciales."
    );
  }

  const key = Buffer.from(keyBase64, "base64");
  if (key.length !== 32) {
    throw new Error(
      `TOKEN_ENCRYPTION_KEY debe ser de 32 bytes (256 bits). Actual: ${key.length} bytes. ` +
      "Generá una nueva con: openssl rand -base64 32"
    );
  }

  return key;
}

/**
 * Cifra un texto plano usando AES-256-GCM.
 * Retorna un string en formato: iv:ciphertext:tag (todo en hex).
 */
export function encryptCredential(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });

  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);

  const tag = cipher.getAuthTag();

  // Formato: iv:ciphertext:tag (hex)
  return `${iv.toString("hex")}:${encrypted.toString("hex")}:${tag.toString("hex")}`;
}

/**
 * Descifra un texto cifrado con AES-256-GCM.
 * Espera formato: iv:ciphertext:tag (hex).
 */
export function decryptCredential(ciphertext: string): string {
  const key = getEncryptionKey();

  const parts = ciphertext.split(":");
  if (parts.length !== 3) {
    throw new Error("Formato de credencial cifrada inválido (se esperan 3 partes separadas por ':')");
  }

  const iv = Buffer.from(parts[0], "hex");
  const encrypted = Buffer.from(parts[1], "hex");
  const tag = Buffer.from(parts[2], "hex");

  if (iv.length !== IV_LENGTH) {
    throw new Error(`IV inválido: se esperan ${IV_LENGTH} bytes, recibido ${iv.length}`);
  }

  if (tag.length !== TAG_LENGTH) {
    throw new Error(`Auth tag inválido: se esperan ${TAG_LENGTH} bytes, recibido ${tag.length}`);
  }

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: TAG_LENGTH });
  decipher.setAuthTag(tag);

  const decrypted = Buffer.concat([
    decipher.update(encrypted),
    decipher.final(),
  ]);

  return decrypted.toString("utf8");
}
