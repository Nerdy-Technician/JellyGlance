const { parentPort } = require("worker_threads");
const { axios } = require("../classes/axios");
const { getIntegrations, getIntegrationData, saveIntegrationData } = require("../classes/integration-store");
const WebhookManager = require("../classes/webhook-manager");

function cleanUrl(url = "") {
  return String(url).trim().replace(/\/+$/, "");
}

function isWizarrIntegration(integration) {
  const name = String(integration?.name || integration?.slug || "").toLowerCase();
  return name === "wizarr" || name.includes("wizarr");
}

function getWizarrHeaders(integration) {
  const apiKey = integration?.values?.secret;
  return {
    Accept: "application/json",
    ...(apiKey ? { "X-API-Key": apiKey } : {}),
  };
}

function normalizeInviteUrl(value, sourceUrl, code) {
  const raw = value || (code ? `/j/${encodeURIComponent(code)}` : "");
  if (!raw) return "";
  const text = String(raw).trim();
  if (/^https?:\/\//i.test(text)) return text;
  const baseUrl = cleanUrl(sourceUrl);
  if (!baseUrl) return text;

  try {
    return new URL(text.startsWith("/") ? text : `/${text}`, `${baseUrl}/`).toString();
  } catch {
    return `${baseUrl}/${text.replace(/^\/+/, "")}`;
  }
}

function normalizeInvite(invitation, source) {
  const code = invitation.code || invitation.token || invitation.invite_code || "";
  const status = String(invitation.status || (invitation.used_at || invitation.used ? "used" : "pending")).toLowerCase();
  return {
    id: `${source.instanceId || source.name}-${invitation.id || code}`,
    sourceId: source.instanceId,
    sourceName: source.name,
    code,
    url: normalizeInviteUrl(invitation.url || invitation.invite_url || invitation.link, source.url, code),
    status,
    created: invitation.created || invitation.created_at || null,
    expires: invitation.expires || invitation.expires_at || null,
  };
}

async function fetchWizarrInvites(integration) {
  const url = cleanUrl(integration.values?.url);
  if (!url || !integration.values?.secret) {
    return { source: integration.name || "Wizarr", items: [], error: "Missing URL or API key" };
  }

  const response = await axios.get(`${url}/api/invitations`, {
    timeout: 12000,
    headers: getWizarrHeaders(integration),
  });
  const invitations = Array.isArray(response.data?.invitations) ? response.data.invitations : Array.isArray(response.data) ? response.data : [];
  const source = {
    name: integration.name || "Wizarr",
    instanceId: integration.instanceId,
    url,
  };
  return {
    source: source.name,
    instanceId: source.instanceId,
    items: invitations.map((invite) => normalizeInvite(invite, source)),
  };
}

async function runInviteSyncTask() {
  try {
    const integrations = await getIntegrations();
    const integrationData = await getIntegrationData();
    const sources = (integrations.thirdParty || []).filter((integration) => integration.connected && isWizarrIntegration(integration));
    const results = await Promise.allSettled(sources.map((integration) => fetchWizarrInvites(integration)));
    const syncedAt = new Date().toISOString();
    const items = results.flatMap((result) => (result.status === "fulfilled" ? result.value.items || [] : []));
    const sourceSummaries = sources.map((source, index) => {
      const result = results[index];
      const value = result.status === "fulfilled" ? result.value : null;
      const sourceItems = value?.items || [];
      return {
        name: source.name || "Wizarr",
        slug: source.slug,
        instanceId: source.instanceId,
        connected: result.status === "fulfilled",
        itemCount: sourceItems.length,
        activeCount: sourceItems.filter((invite) => invite.status !== "used" && invite.status !== "expired").length,
        message: result.status === "fulfilled" ? "Online" : result.reason?.message || "Invite sync failed",
      };
    });

    await saveIntegrationData({
      invites: {
        ...integrationData.invites,
        sources: sourceSummaries,
        items,
        syncedAt,
      },
    });

    const webhookManager = new WebhookManager();
    await webhookManager.triggerEventWebhooks("invite_links_refreshed", {
      integrationEvent: "invite links refreshed",
      sourceCount: sources.length,
      inviteCount: items.length,
      activeCount: items.filter((invite) => invite.status !== "used" && invite.status !== "expired").length,
      message: `Invite sync refreshed ${items.length} invite link${items.length === 1 ? "" : "s"}.`,
    });

    parentPort.postMessage({ status: "complete" });
  } catch (error) {
    parentPort.postMessage({ status: "error", message: error.message });
  }
}

parentPort.on("message", async (message) => {
  if (message.command === "start") {
    await runInviteSyncTask(message.triggertype);
    process.exit(0);
  }
});
