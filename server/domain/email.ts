const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeEmail(input: string): string {
  return input.trim();
}

export function assertValidEmail(input: string, label = "Email"): string {
  const normalized = normalizeEmail(input);
  if (!EMAIL_REGEX.test(normalized)) {
    throw new Error(`${label} inválido`);
  }
  return normalized;
}

export function sanitizeHeaderValue(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim();
}
