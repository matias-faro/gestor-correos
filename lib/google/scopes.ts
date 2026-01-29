export const GOOGLE_OAUTH_SCOPES = [
  "https://www.googleapis.com/auth/gmail.send",
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
  "https://www.googleapis.com/auth/spreadsheets.readonly",
  // `drive.metadata.readonly` suele alcanzar para listar, pero `drive.readonly`
  // evita casos donde la API responde "insufficient authentication scopes".
  "https://www.googleapis.com/auth/drive.readonly",
] as const;

export const GOOGLE_OAUTH_SCOPE_STRING = GOOGLE_OAUTH_SCOPES.join(" ");

