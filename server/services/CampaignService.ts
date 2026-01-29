import {
  getCampaignById,
  createCampaign as createCampaignRepo,
  setCampaignGoogleAccountId,
  updateCampaignStatus,
  acquireCampaignLock,
  releaseCampaignLock,
} from "@/server/integrations/db/campaigns-repo";
import {
  countDraftItems,
  deleteDraftItemsForCampaign,
  createDraftItemsBatch,
  findDraftItemByEmail,
  createDraftItem,
  excludeDraftItem as excludeDraftItemRepo,
  includeDraftItem as includeDraftItemRepo,
  createTestSendEvent,
  getNextPendingDraftItem,
  markDraftItemAsSent,
  markDraftItemAsFailed,
} from "@/server/integrations/db/draft-items-repo";
import {
  listContactsForSnapshot,
  getContactById,
} from "@/server/integrations/db/contacts-repo";
import { getTemplateById } from "@/server/integrations/db/templates-repo";
import { getSettings } from "@/server/integrations/db/settings-repo";
import { getGoogleAccountByUserId } from "@/server/integrations/db/google-accounts-repo";
import {
  createSendRun,
  getActiveSendRun,
  getLatestSendRun,
  getSendRunById,
  updateSendRunStatus,
  updateSendRunNextTick,
} from "@/server/integrations/db/send-runs-repo";
import {
  createSendEventSuccess,
  createSendEventFailure,
  countTodaySendEvents,
} from "@/server/integrations/db/send-events-repo";
import {
  renderHandlebarsTemplate,
  TemplatingError,
} from "@/server/domain/templating";
import { calculateNextTick } from "@/server/domain/scheduler";
import { createUnsubscribeToken } from "@/server/domain/unsubscribe-token";
import { sendEmail } from "@/server/integrations/gmail/send";
import {
  scheduleSendTick,
  scheduleSendTickAt,
} from "@/server/integrations/qstash/client";
import type {
  CreateCampaignInput,
  CampaignResponse,
  DraftItemResponse,
  TestSendEventResponse,
  CampaignFilters,
  SendRunResponse,
} from "@/server/contracts/campaigns";

// ─────────────────────────────────────────────────────────────────────────────
// Constantes
// ─────────────────────────────────────────────────────────────────────────────
function getSiteUrl(): string {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (!siteUrl) {
    throw new Error(
      "Falta configurar NEXT_PUBLIC_SITE_URL (necesario para generar links públicos)"
    );
  }
  return siteUrl.replace(/\/+$/, "");
}

function buildUnsubscribeUrl(input: {
  contactId: string;
  email: string;
  campaignId: string;
}): string {
  const token = createUnsubscribeToken({
    contactId: input.contactId,
    email: input.email,
    campaignId: input.campaignId,
  });
  return `${getSiteUrl()}/u/${encodeURIComponent(token)}`;
}

// ─────────────────────────────────────────────────────────────────────────────
// Crear campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function createCampaign(
  input: CreateCampaignInput,
  userId?: string
): Promise<CampaignResponse> {
  // Verificar que el template existe
  const template = await getTemplateById(input.templateId);
  if (!template) {
    throw new Error("La plantilla seleccionada no existe");
  }

  const googleAccountId =
    userId ? (await getGoogleAccountByUserId(userId))?.id ?? null : null;

  return createCampaignRepo(input, {
    createdByUserId: userId,
    googleAccountId,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Generar snapshot
// ─────────────────────────────────────────────────────────────────────────────
export type GenerateSnapshotResult = {
  created: number;
  capped: boolean;
};

export async function generateSnapshot(
  campaignId: string,
  options: { force?: boolean } = {}
): Promise<GenerateSnapshotResult> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "draft" && campaign.status !== "ready") {
    throw new Error(
      "Solo se puede generar snapshot en campañas en borrador o listas"
    );
  }

  // Obtener template
  if (!campaign.templateId) {
    throw new Error("La campaña no tiene plantilla asignada");
  }

  const template = await getTemplateById(campaign.templateId);
  if (!template) {
    throw new Error("La plantilla de la campaña no existe");
  }

  // Verificar si ya hay drafts
  const existingCount = await countDraftItems(campaignId);
  if (existingCount > 0 && !options.force) {
    throw new Error(
      `Ya existen ${existingCount} drafts. Usa force=true para regenerar.`
    );
  }

  // Si force, eliminar los existentes
  if (existingCount > 0 && options.force) {
    await deleteDraftItemsForCampaign(campaignId);
  }

  // Obtener contactos del segmento
  const filters: CampaignFilters = campaign.filtersSnapshot ?? {};
  const settings = await getSettings();
  const { contacts, capped } = await listContactsForSnapshot({
    query: filters.query,
    company: filters.company,
    position: filters.position,
    tagIds: filters.tagIds,
    sourceId: settings.activeContactSourceId ?? undefined,
  });

  if (contacts.length === 0) {
    throw new Error(
      "No hay contactos que coincidan con los filtros de la campaña"
    );
  }

  // Renderizar cada contacto
  const draftItems: Array<{
    campaignId: string;
    contactId: string | null;
    toEmail: string;
    renderedSubject: string;
    renderedHtml: string;
  }> = [];

  const errors: Array<{ email: string; error: string }> = [];

  for (const contact of contacts) {
    try {
      const unsubscribeUrl = buildUnsubscribeUrl({
        contactId: contact.id,
        email: contact.email,
        campaignId,
      });
      const result = renderHandlebarsTemplate(
        {
          subjectTpl: template.subjectTpl,
          htmlTpl: template.htmlTpl,
        },
        {
          FirstName: contact.firstName,
          LastName: contact.lastName,
          Company: contact.company,
          UnsubscribeUrl: unsubscribeUrl,
        }
      );

      draftItems.push({
        campaignId,
        contactId: contact.id,
        toEmail: contact.email,
        renderedSubject: result.subject,
        renderedHtml: result.html,
      });
    } catch (err) {
      const message =
        err instanceof TemplatingError
          ? err.message
          : err instanceof Error
            ? err.message
            : "Error desconocido";
      errors.push({ email: contact.email, error: message });
    }
  }

  // Insertar en batch
  const created = await createDraftItemsBatch(draftItems);

  // Actualizar estado de la campaña a ready
  await updateCampaignStatus(campaignId, "ready");

  // Si hubo errores, los logueamos pero no fallaremos
  if (errors.length > 0) {
    console.warn(
      `[CampaignService] ${errors.length} contactos con errores de render:`,
      errors.slice(0, 5)
    );
  }

  return { created, capped };
}

// ─────────────────────────────────────────────────────────────────────────────
// Incluir contacto manualmente
// ─────────────────────────────────────────────────────────────────────────────
export async function includeContactManually(
  campaignId: string,
  contactId: string
): Promise<DraftItemResponse> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "draft" && campaign.status !== "ready") {
    throw new Error(
      "Solo se puede incluir contactos en campañas en borrador o listas"
    );
  }

  // Obtener template
  if (!campaign.templateId) {
    throw new Error("La campaña no tiene plantilla asignada");
  }

  const template = await getTemplateById(campaign.templateId);
  if (!template) {
    throw new Error("La plantilla de la campaña no existe");
  }

  // Obtener contacto
  const contact = await getContactById(contactId);
  if (!contact) {
    throw new Error("Contacto no encontrado");
  }

  // Verificar si ya existe un draft para este email
  const existing = await findDraftItemByEmail(campaignId, contact.email);
  if (existing) {
    // Si está excluido, rehabilitarlo
    if (existing.state === "excluded") {
      return includeDraftItemRepo(existing.id);
    }
    throw new Error("Este contacto ya tiene un draft en esta campaña");
  }

  // Renderizar
  const unsubscribeUrl = buildUnsubscribeUrl({
    contactId: contact.id,
    email: contact.email,
    campaignId,
  });
  const result = renderHandlebarsTemplate(
    {
      subjectTpl: template.subjectTpl,
      htmlTpl: template.htmlTpl,
    },
    {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Company: contact.company,
      UnsubscribeUrl: unsubscribeUrl,
    }
  );

  // Crear draft item marcado como manual
  return createDraftItem({
    campaignId,
    contactId: contact.id,
    toEmail: contact.email,
    renderedSubject: result.subject,
    renderedHtml: result.html,
    includedManually: true,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Excluir draft item
// ─────────────────────────────────────────────────────────────────────────────
export async function excludeDraftItem(
  draftItemId: string
): Promise<DraftItemResponse> {
  return excludeDraftItemRepo(draftItemId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Incluir draft item (rehabilitar uno excluido)
// ─────────────────────────────────────────────────────────────────────────────
export async function includeDraftItem(
  draftItemId: string
): Promise<DraftItemResponse> {
  return includeDraftItemRepo(draftItemId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Enviar prueba simulada
// ─────────────────────────────────────────────────────────────────────────────
export async function sendTestSimulated(
  campaignId: string,
  contactId: string
): Promise<TestSendEventResponse> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Obtener template
  if (!campaign.templateId) {
    throw new Error("La campaña no tiene plantilla asignada");
  }

  const template = await getTemplateById(campaign.templateId);
  if (!template) {
    throw new Error("La plantilla de la campaña no existe");
  }

  // Obtener contacto
  const contact = await getContactById(contactId);
  if (!contact) {
    throw new Error("Contacto no encontrado");
  }

  // Renderizar
  const result = renderHandlebarsTemplate(
    {
      subjectTpl: template.subjectTpl,
      htmlTpl: template.htmlTpl,
    },
    {
      FirstName: contact.firstName,
      LastName: contact.lastName,
      Company: contact.company,
      UnsubscribeUrl: buildUnsubscribeUrl({
        contactId: contact.id,
        email: contact.email,
        campaignId,
      }),
    }
  );

  // Crear evento de test
  return createTestSendEvent({
    campaignId,
    contactId: contact.id,
    toEmail: contact.email,
    renderedSubject: result.subject,
    renderedHtml: result.html,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Enviar prueba REAL (envía email de verdad)
// ─────────────────────────────────────────────────────────────────────────────
export type SendTestRealResult = {
  success: boolean;
  toEmail: string;
  subject: string;
  gmailMessageId?: string;
  gmailPermalink?: string;
};

export async function sendTestReal(
  campaignId: string,
  toEmail: string,
  contactId: string | undefined,
  userId: string
): Promise<SendTestRealResult> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Obtener template
  if (!campaign.templateId) {
    throw new Error("La campaña no tiene plantilla asignada");
  }

  const template = await getTemplateById(campaign.templateId);
  if (!template) {
    throw new Error("La plantilla de la campaña no existe");
  }

  // Obtener datos del contacto si se provee
  let contactData = {
    firstName: "Test",
    lastName: "User",
    company: "Test Company",
  };

  if (contactId) {
    const contact = await getContactById(contactId);
    if (contact) {
      contactData = {
        firstName: contact.firstName ?? "Test",
        lastName: contact.lastName ?? "User",
        company: contact.company ?? "Test Company",
      };
    }
  }

  // Renderizar
  const result = renderHandlebarsTemplate(
    {
      subjectTpl: template.subjectTpl,
      htmlTpl: template.htmlTpl,
    },
    {
      FirstName: contactData.firstName,
      LastName: contactData.lastName,
      Company: contactData.company,
      UnsubscribeUrl: `${getSiteUrl()}/u/test-unsubscribe`,
    }
  );

  // Resolver cuenta de Gmail para esta campaña (persistida en DB).
  // Fallback legacy: si no está seteada, usar la del usuario que ejecuta el test y persistirla.
  let googleAccountId = campaign.googleAccountId;
  if (!googleAccountId) {
    const googleAccount = await getGoogleAccountByUserId(userId);
    if (!googleAccount) {
      throw new Error(
        "No hay cuenta de Gmail conectada para este usuario. Iniciá sesión con Google."
      );
    }
    googleAccountId = googleAccount.id;
    await setCampaignGoogleAccountId({ campaignId, googleAccountId });
  }

  // Enviar el email real
  const sendResult = await sendEmail({
    googleAccountId,
    to: toEmail,
    subject: `[TEST] ${result.subject}`,
    html: result.html,
    fromAlias: campaign.fromAlias,
  });

  // Guardar registro del test
  await createTestSendEvent({
    campaignId,
    contactId: contactId ?? null,
    toEmail,
    renderedSubject: `[TEST] ${result.subject}`,
    renderedHtml: result.html,
  });

  return {
    success: true,
    toEmail,
    subject: result.subject,
    gmailMessageId: sendResult.messageId,
    gmailPermalink: sendResult.permalink,
  };
}

// ─────────────────────────────────────────────────────────────────────────────
// Iniciar campaña (tomar lock + crear run + programar primer tick)
// ─────────────────────────────────────────────────────────────────────────────
export async function startCampaign(
  campaignId: string,
  userId: string
): Promise<SendRunResponse> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "ready") {
    throw new Error(
      "Solo se pueden iniciar campañas en estado 'ready'. Genera el snapshot primero."
    );
  }

  // Verificar que hay drafts pendientes
  const pendingCount = await countDraftItems(campaignId);
  if (pendingCount === 0) {
    throw new Error("No hay emails pendientes para enviar");
  }

  // Resolver cuenta de Gmail para esta campaña (persistida en DB).
  // Fallback legacy: si no está seteada, usar la del usuario que inicia la campaña y persistirla.
  if (!campaign.googleAccountId) {
    const googleAccount = await getGoogleAccountByUserId(userId);
    if (!googleAccount) {
      throw new Error(
        "No hay cuenta de Gmail conectada para este usuario. Iniciá sesión con Google (la cuenta desde la cual se enviará)."
      );
    }
    await setCampaignGoogleAccountId({
      campaignId,
      googleAccountId: googleAccount.id,
    });
  }

  // Intentar tomar el lock global
  const lockAcquired = await acquireCampaignLock(campaignId);
  if (!lockAcquired) {
    throw new Error(
      "Ya hay otra campaña en envío. Solo puede haber una campaña activa a la vez."
    );
  }

  // Crear send run
  const sendRun = await createSendRun(campaignId);

  try {
    // Programar el primer tick ANTES de actualizar el estado
    // Así si QStash falla, la campaña no queda en "sending" sin tick programado
    await scheduleSendTick({
      campaignId,
      sendRunId: sendRun.id,
      delaySeconds: 0,
    });
  } catch (err) {
    // Si falla el scheduling (ej: QStash rechaza la URL), liberar lock y dar error claro
    await releaseCampaignLock(campaignId);
    
    const errorMessage = err instanceof Error ? err.message : String(err);
    
    // Detectar errores comunes de QStash para dar mensajes accionables
    if (errorMessage.includes("loopback") || errorMessage.includes("localhost") || errorMessage.includes("::1")) {
      throw new Error(
        `Error de configuración: La URL del sitio (NEXT_PUBLIC_SITE_URL) apunta a localhost. ` +
        `Configurá una URL pública en las variables de entorno de Vercel. Error original: ${errorMessage}`
      );
    }
    
    if (errorMessage.includes("invalid destination")) {
      throw new Error(
        `Error al programar el envío: La URL destino no es válida. ` +
        `Verificá NEXT_PUBLIC_SITE_URL en las variables de entorno. Error original: ${errorMessage}`
      );
    }
    
    throw new Error(`Error al programar el primer tick de envío: ${errorMessage}`);
  }

  try {
    // Una vez el tick está programado, actualizar el estado
    await updateCampaignStatus(campaignId, "sending");
    return sendRun;
  } catch (err) {
    // Si falla actualizar el estado, igual liberar lock (el tick puede fallar en el próximo intento)
    await releaseCampaignLock(campaignId);
    throw err;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Reprogramar envío (útil cuando la campaña está atascada en "sending")
// ─────────────────────────────────────────────────────────────────────────────
export async function retryStuckCampaign(campaignId: string): Promise<void> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Solo para campañas en sending
  if (campaign.status !== "sending") {
    throw new Error("Esta función es solo para campañas en estado 'sending' que están atascadas");
  }

  // Verificar que tiene el lock
  if (!campaign.activeLock) {
    throw new Error("La campaña no tiene el lock activo. Intentá cancelar y volver a iniciar.");
  }

  // Obtener el send run activo
  const sendRun = await getLatestSendRun(campaignId);
  if (!sendRun) {
    throw new Error("No se encontró un send run activo. Intentá cancelar y volver a iniciar.");
  }

  // Asegurar que el send run está en running
  if (sendRun.status !== "running") {
    await updateSendRunStatus(sendRun.id, "running");
  }

  // Reprogramar tick inmediatamente
  await scheduleSendTick({
    campaignId,
    sendRunId: sendRun.id,
    delaySeconds: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Pausar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function pauseCampaign(campaignId: string): Promise<void> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "sending") {
    throw new Error("Solo se pueden pausar campañas en envío");
  }

  // Obtener send run activo
  const sendRun = await getActiveSendRun(campaignId);
  if (sendRun) {
    await updateSendRunStatus(sendRun.id, "paused");
  }

  // Actualizar estado de la campaña
  await updateCampaignStatus(campaignId, "paused");

  // Nota: El tick de QStash seguirá ejecutándose, pero verá que
  // la campaña está pausada y no hará nada
}

// ─────────────────────────────────────────────────────────────────────────────
// Reanudar campaña pausada
// ─────────────────────────────────────────────────────────────────────────────
export async function resumeCampaign(campaignId: string): Promise<void> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "paused") {
    throw new Error("Solo se pueden reanudar campañas pausadas");
  }

  // Verificar que tiene el lock
  if (!campaign.activeLock) {
    throw new Error("La campaña no tiene el lock activo");
  }

  // Obtener el send run más reciente (puede estar pausado)
  const sendRun = await getLatestSendRun(campaignId);

  if (!sendRun) {
    throw new Error("No se encontró un send run para reanudar. Intentá cancelar y volver a iniciar la campaña.");
  }

  // Actualizar estado del send run a running
  await updateSendRunStatus(sendRun.id, "running");

  // Actualizar estado de la campaña
  await updateCampaignStatus(campaignId, "sending");

  // Reprogramar tick
  await scheduleSendTick({
    campaignId,
    sendRunId: sendRun.id,
    delaySeconds: 0,
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// Cancelar campaña
// ─────────────────────────────────────────────────────────────────────────────
export async function cancelCampaign(campaignId: string): Promise<void> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    throw new Error("Campaña no encontrada");
  }

  // Verificar estado
  if (campaign.status !== "sending" && campaign.status !== "paused") {
    throw new Error("Solo se pueden cancelar campañas en envío o pausadas");
  }

  // Obtener send run activo
  const sendRun = await getActiveSendRun(campaignId);
  if (sendRun) {
    await updateSendRunStatus(sendRun.id, "cancelled", new Date().toISOString());
  }

  // Actualizar estado de la campaña
  await updateCampaignStatus(campaignId, "cancelled");

  // Liberar lock
  await releaseCampaignLock(campaignId);
}

// ─────────────────────────────────────────────────────────────────────────────
// Procesar tick de envío (llamado por QStash)
// ─────────────────────────────────────────────────────────────────────────────
export type ProcessSendTickResult =
  | { action: "sent"; draftItemId: string; toEmail: string }
  | { action: "scheduled"; reason: string; nextTickAt: string }
  | { action: "completed"; totalSent: number }
  | { action: "skipped"; reason: string };

export async function processSendTick(
  campaignId: string,
  sendRunId: string
): Promise<ProcessSendTickResult> {
  // Obtener campaña
  const campaign = await getCampaignById(campaignId);
  if (!campaign) {
    return { action: "skipped", reason: "Campaña no encontrada" };
  }

  // Verificar que la campaña está en envío
  if (campaign.status !== "sending") {
    return {
      action: "skipped",
      reason: `Campaña no está en envío (estado: ${campaign.status})`,
    };
  }

  // Verificar send run
  const sendRun = await getSendRunById(sendRunId);
  if (!sendRun || sendRun.status !== "running") {
    return {
      action: "skipped",
      reason: "Send run no está activo",
    };
  }

  // Obtener próximo draft pendiente
  const draftItem = await getNextPendingDraftItem(campaignId);
  if (!draftItem) {
    // No hay más drafts, completar campaña
    await updateSendRunStatus(sendRunId, "completed", new Date().toISOString());
    await updateCampaignStatus(campaignId, "completed");
    await releaseCampaignLock(campaignId);

    // Contar total enviados
    const stats = await countDraftItems(campaignId);

    return {
      action: "completed",
      totalSent: stats,
    };
  }

  // Obtener configuración
  const settings = await getSettings();

  // Contar envíos del día
  const todaySentCount = await countTodaySendEvents(settings.timezone);

  // Calcular próximo tick
  const pendingCount = await countDraftItems(campaignId);
  const nextTick = calculateNextTick(settings, pendingCount, todaySentCount);

  // Si no es inmediato, programar para después
  if (nextTick.type === "next_window" || nextTick.type === "quota_exceeded") {
    await updateSendRunNextTick(sendRunId, nextTick.notBefore.toISOString());

    await scheduleSendTickAt({
      campaignId,
      sendRunId,
      notBefore: nextTick.notBefore,
    });

    return {
      action: "scheduled",
      reason: nextTick.reason,
      nextTickAt: nextTick.notBefore.toISOString(),
    };
  }

  // Obtener cuenta de Gmail asociada a la campaña (sólido: campaigns.google_account_id).
  // Fallback legacy: usar la cuenta del creador si existe y persistirla.
  let googleAccountId = campaign.googleAccountId;
  if (!googleAccountId && campaign.createdBy) {
    googleAccountId = (await getGoogleAccountByUserId(campaign.createdBy))?.id ?? null;
    if (googleAccountId) {
      await setCampaignGoogleAccountId({ campaignId, googleAccountId });
    }
  }

  if (!googleAccountId) {
    // Pausar la campaña si no hay cuenta
    await pauseCampaign(campaignId);
    return {
      action: "skipped",
      reason: "No hay cuenta de Gmail asociada a esta campaña",
    };
  }

  // Enviar el email
  try {
    const sendResult = await sendEmail({
      googleAccountId,
      to: draftItem.toEmail,
      subject: draftItem.renderedSubject,
      html: draftItem.renderedHtml,
      fromAlias: campaign.fromAlias,
    });

    // Marcar draft como enviado
    await markDraftItemAsSent(draftItem.id);

    // Guardar evento de envío
    await createSendEventSuccess({
      campaignId,
      draftItemId: draftItem.id,
      gmailMessageId: sendResult.messageId,
      gmailThreadId: sendResult.threadId,
      gmailPermalink: sendResult.permalink,
    });

    // Verificar si quedan más emails pendientes
    const nextPending = await getNextPendingDraftItem(campaignId);
    
    if (!nextPending) {
      // No hay más pendientes, completar la campaña inmediatamente
      await updateSendRunStatus(sendRunId, "completed", new Date().toISOString());
      await updateCampaignStatus(campaignId, "completed");
      await releaseCampaignLock(campaignId);

      console.log(`[CampaignService] Campaign ${campaignId} completed after sending to ${draftItem.toEmail}`);

      return {
        action: "sent",
        draftItemId: draftItem.id,
        toEmail: draftItem.toEmail,
      };
    }

    // Hay más pendientes, programar siguiente tick
    const nextTickTime = new Date(Date.now() + nextTick.delaySeconds * 1000);
    await updateSendRunNextTick(sendRunId, nextTickTime.toISOString());

    await scheduleSendTick({
      campaignId,
      sendRunId,
      delaySeconds: nextTick.delaySeconds,
    });

    return {
      action: "sent",
      draftItemId: draftItem.id,
      toEmail: draftItem.toEmail,
    };
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : "Error desconocido";

    // Marcar draft como fallido
    await markDraftItemAsFailed(draftItem.id, errorMessage);

    // Guardar evento de fallo
    await createSendEventFailure({
      campaignId,
      draftItemId: draftItem.id,
      error: errorMessage,
    });

    // Log del error
    console.error(
      `[CampaignService] Error enviando a ${draftItem.toEmail}:`,
      errorMessage
    );

    // Verificar si quedan más emails pendientes después del fallo
    const nextPending = await getNextPendingDraftItem(campaignId);
    
    if (!nextPending) {
      // No hay más pendientes (todos enviados o fallidos), completar la campaña
      await updateSendRunStatus(sendRunId, "completed", new Date().toISOString());
      await updateCampaignStatus(campaignId, "completed");
      await releaseCampaignLock(campaignId);

      console.log(`[CampaignService] Campaign ${campaignId} completed (last item failed)`);

      return {
        action: "sent",
        draftItemId: draftItem.id,
        toEmail: draftItem.toEmail,
      };
    }

    // Continuar con el siguiente (programar tick)
    await scheduleSendTick({
      campaignId,
      sendRunId,
      delaySeconds: settings.minDelaySeconds,
    });

    return {
      action: "sent",
      draftItemId: draftItem.id,
      toEmail: draftItem.toEmail,
    };
  }
}
