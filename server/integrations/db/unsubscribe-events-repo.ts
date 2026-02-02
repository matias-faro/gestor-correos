import { createServiceClient } from "@/lib/supabase/server";

export async function hasUnsubscribeEventByTokenHash(
  tokenHash: string
): Promise<boolean> {
  const supabase = await createServiceClient();

  const { count, error } = await supabase
    .from("unsubscribe_events")
    .select("id", { count: "exact", head: true })
    .eq("token_hash", tokenHash);

  if (error) {
    throw new Error(`Error al verificar unsubscribe_events: ${error.message}`);
  }

  return (count ?? 0) > 0;
}

export async function insertUnsubscribeEvent(input: {
  contactId: string;
  campaignId?: string | null;
  tokenHash: string;
}): Promise<void> {
  const supabase = await createServiceClient();

  const { error } = await supabase.from("unsubscribe_events").insert({
    contact_id: input.contactId,
    campaign_id: input.campaignId ?? null,
    token_hash: input.tokenHash,
  });

  if (error) {
    if (error.code === "23505") return;
    throw new Error(`Error al insertar unsubscribe_event: ${error.message}`);
  }
}

