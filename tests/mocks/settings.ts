import type { Settings, SendWindows } from "@/server/integrations/db/settings-repo";

/**
 * Factory para crear settings de prueba con valores por defecto
 */
export function createMockSettings(overrides: Partial<Settings> = {}): Settings {
  const defaultWindows: SendWindows = {
    monday: [{ start: "09:00", end: "18:00" }],
    tuesday: [{ start: "09:00", end: "18:00" }],
    wednesday: [{ start: "09:00", end: "18:00" }],
    thursday: [{ start: "09:00", end: "18:00" }],
    friday: [{ start: "09:00", end: "18:00" }],
    saturday: [],
    sunday: [],
  };

  return {
    id: 1,
    timezone: "UTC",
    dailyQuota: 100,
    minDelaySeconds: 30,
    sendWindows: defaultWindows,
    signatureDefaultHtml: null,
    excludeKeywords: [],
    allowlistEmails: [],
    allowlistDomains: [],
    activeContactSourceId: null,
    ...overrides,
  };
}

/**
 * Settings con todas las ventanas abiertas 24/7 (útil para tests)
 */
export function createAlwaysOpenSettings(overrides: Partial<Settings> = {}): Settings {
  const alwaysOpenWindows: SendWindows = {
    monday: [{ start: "00:00", end: "23:59" }],
    tuesday: [{ start: "00:00", end: "23:59" }],
    wednesday: [{ start: "00:00", end: "23:59" }],
    thursday: [{ start: "00:00", end: "23:59" }],
    friday: [{ start: "00:00", end: "23:59" }],
    saturday: [{ start: "00:00", end: "23:59" }],
    sunday: [{ start: "00:00", end: "23:59" }],
  };

  return createMockSettings({
    sendWindows: alwaysOpenWindows,
    ...overrides,
  });
}

/**
 * Settings sin ninguna ventana de envío (siempre cerrado)
 */
export function createNoWindowsSettings(overrides: Partial<Settings> = {}): Settings {
  const noWindows: SendWindows = {
    monday: [],
    tuesday: [],
    wednesday: [],
    thursday: [],
    friday: [],
    saturday: [],
    sunday: [],
  };

  return createMockSettings({
    sendWindows: noWindows,
    ...overrides,
  });
}
