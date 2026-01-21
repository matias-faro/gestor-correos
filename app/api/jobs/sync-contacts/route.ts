import { NextRequest, NextResponse } from "next/server";
import { verifyQStashSignature } from "@/server/integrations/qstash/verify";
import { syncContactsPayloadSchema } from "@/server/contracts/contact-sources";
import { processContactSync } from "@/server/services/ContactSyncService";

// ─────────────────────────────────────────────────────────────────────────────
// POST /api/jobs/sync-contacts - Sync de contactos (llamado por QStash)
// ─────────────────────────────────────────────────────────────────────────────
export async function POST(request: NextRequest) {
  const bodyText = await request.text();

  const signature = request.headers.get("upstash-signature");
  if (!signature) {
    console.error("[sync-contacts] Missing QStash signature");
    return NextResponse.json({ error: "Missing signature" }, { status: 401 });
  }

  const isValid = await verifyQStashSignature({
    signature,
    body: bodyText,
  });

  if (!isValid) {
    console.error("[sync-contacts] Invalid QStash signature");
    return NextResponse.json({ error: "Invalid signature" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = JSON.parse(bodyText);
  } catch {
    console.error("[sync-contacts] Invalid JSON body");
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = syncContactsPayloadSchema.safeParse(body);
  if (!parsed.success) {
    console.error("[sync-contacts] Invalid payload:", parsed.error.format());
    return NextResponse.json(
      { error: "Invalid payload", details: parsed.error.format() },
      { status: 400 }
    );
  }

  try {
    const result = await processContactSync(parsed.data);

    console.log(`[sync-contacts] Source ${parsed.data.sourceId}:`, result);
    return NextResponse.json({ success: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    console.error("[sync-contacts] Error:", message);
    return NextResponse.json({ success: false, error: message });
  }
}
