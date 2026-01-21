import { google } from "googleapis";
import { getGoogleOAuthClient } from "@/server/integrations/google/oauth";

export type SheetValues = string[][];

function buildRange(sheetTab: string, startRow: number, endRow: number): string {
  const safeTab = sheetTab.replace(/'/g, "''");
  return `'${safeTab}'!A${startRow}:ZZ${endRow}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer headers (fila 1)
// ─────────────────────────────────────────────────────────────────────────────
export async function getSheetHeader(options: {
  googleAccountId: string;
  spreadsheetId: string;
  sheetTab: string;
}): Promise<string[]> {
  const { googleAccountId, spreadsheetId, sheetTab } = options;
  const oauth2Client = await getGoogleOAuthClient(googleAccountId);
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildRange(sheetTab, 1, 1),
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });

  const rows = (data.values ?? []) as SheetValues;
  return rows[0]?.map((cell) => String(cell)) ?? [];
}

// ─────────────────────────────────────────────────────────────────────────────
// Leer filas por rango
// ─────────────────────────────────────────────────────────────────────────────
export async function getSheetRows(options: {
  googleAccountId: string;
  spreadsheetId: string;
  sheetTab: string;
  startRow: number;
  endRow: number;
}): Promise<SheetValues> {
  const { googleAccountId, spreadsheetId, sheetTab, startRow, endRow } = options;
  const oauth2Client = await getGoogleOAuthClient(googleAccountId);
  const sheets = google.sheets({ version: "v4", auth: oauth2Client });

  const { data } = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: buildRange(sheetTab, startRow, endRow),
    majorDimension: "ROWS",
    valueRenderOption: "FORMATTED_VALUE",
  });

  return (data.values ?? []) as SheetValues;
}
