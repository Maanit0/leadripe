import { adminDb } from "@/lib/db-admin";
import { id } from "@instantdb/admin";
import { getHubspotAccessToken } from "./token";
import { getNotionContext } from "@/lib/notion/context";
import type { ClassifyReplyOutput } from "@/lib/ai/types";

// Map HubSpot pipeline stage IDs/labels to our internal stage names.
const STAGE_MAP: Record<string, string> = {
  // HubSpot stage labels (normalized: lowercase, no spaces/dashes/underscores)
  newlead: "new_lead",
  outreachsent: "outreach_sent",
  repliedinterested: "replied_interested",
  discoveryscheduled: "discovery_scheduled",
  discoverydone: "discovery_done",
  followup: "follow_up",
  demoscheduled: "demo_scheduled",
  paidclient: "paid_client",
  gonesilent: "gone_silent",
  notafit: "not_a_fit",
  // Also accept our internal names directly
  new_lead: "new_lead",
  outreach_sent: "outreach_sent",
  replied_interested: "replied_interested",
  discovery_scheduled: "discovery_scheduled",
  discovery_done: "discovery_done",
  follow_up: "follow_up",
  demo_scheduled: "demo_scheduled",
  paid_client: "paid_client",
  gone_silent: "gone_silent",
  not_a_fit: "not_a_fit",
  // Legacy HubSpot default stages
  appointmentscheduled: "discovery_scheduled",
  qualifiedtobuy: "replied_interested",
  presentationscheduled: "demo_scheduled",
  decisionmakerboughtin: "discovery_done",
  contractsent: "paid_client",
  closedwon: "paid_client",
  closedlost: "not_a_fit",
};

function mapStage(hubspotStage: string): string {
  const normalized = hubspotStage.toLowerCase().replace(/[\s_-]/g, "");
  return STAGE_MAP[normalized] ?? "gone_silent";
}

function daysBetween(dateStr: string): number {
  const then = new Date(dateStr).getTime();
  const now = Date.now();
  return Math.max(0, Math.floor((now - then) / (1000 * 60 * 60 * 24)));
}

interface HubSpotDeal {
  id: string;
  properties: {
    dealname?: string;
    dealstage?: string;
    closedate?: string;
    hs_lastmodifieddate?: string;
    [key: string]: string | undefined;
  };
}

interface HubSpotContact {
  properties: {
    firstname?: string;
    lastname?: string;
    email?: string;
    jobtitle?: string;
    company?: string;
    [key: string]: string | undefined;
  };
}

async function fetchWithAuth(url: string, accessToken: string) {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!res.ok) {
    throw new Error(`HubSpot API error ${res.status}: ${await res.text()}`);
  }
  return res.json();
}

async function getAssociatedContact(
  dealId: string,
  accessToken: string
): Promise<HubSpotContact | null> {
  try {
    const assocData = await fetchWithAuth(
      `https://api.hubapi.com/crm/v3/objects/deals/${dealId}/associations/contacts`,
      accessToken
    );

    if (!assocData.results || assocData.results.length === 0) return null;

    const contactId = assocData.results[0].id;

    const contact = await fetchWithAuth(
      `https://api.hubapi.com/crm/v3/objects/contacts/${contactId}?properties=firstname,lastname,email,jobtitle,company`,
      accessToken
    );

    return contact as HubSpotContact;
  } catch {
    return null;
  }
}

export async function syncHubspotDeals(userId: string): Promise<{
  synced: number;
  errors: number;
}> {
  const accessToken = await getHubspotAccessToken(userId);

  // Fetch deals from HubSpot
  const dealsData = await fetchWithAuth(
    `https://api.hubapi.com/crm/v3/objects/deals?limit=100&properties=dealname,dealstage,closedate,hs_lastmodifieddate`,
    accessToken
  );

  const deals: HubSpotDeal[] = dealsData.results ?? [];
  let synced = 0;
  let errors = 0;

  for (const deal of deals) {
    try {
      const props = deal.properties;
      const contact = await getAssociatedContact(deal.id, accessToken);

      const contactName = contact
        ? [contact.properties.firstname, contact.properties.lastname]
            .filter(Boolean)
            .join(" ") || "Unknown"
        : props.dealname ?? "Unknown";

      const stage = mapStage(props.dealstage ?? "");
      const daysSince = props.hs_lastmodifieddate
        ? daysBetween(props.hs_lastmodifieddate)
        : 0;

      // Check if deal already exists
      const { deals: existingDeals } = await adminDb.query({
        deals: {
          $: { where: { hubspotDealId: deal.id } },
        },
      });

      const dealData = {
        hubspotDealId: deal.id,
        contactName,
        contactEmail: contact?.properties.email ?? "",
        contactRole: contact?.properties.jobtitle ?? "",
        companyName: contact?.properties.company ?? props.dealname ?? "",
        stage,
        daysSinceLastTouch: daysSince,
        hsLastModifiedDate: props.hs_lastmodifieddate ?? "",
        updatedAt: Date.now(),
      };

      // Fetch Notion context for this deal
      let notionContext: string | null = null;
      try {
        notionContext = await getNotionContext(userId, dealData.companyName, contactName);
      } catch {
        // Non-fatal
      }

      if (notionContext) {
        (dealData as Record<string, unknown>).notionContext = notionContext;
      }

      if (existingDeals.length > 0) {
        await adminDb.transact(
          adminDb.tx.deals[existingDeals[0].id]!.update(dealData)
        );
      } else {
        const dealId = id();
        await adminDb.transact(
          adminDb.tx.deals[dealId]!
            .update({
              ...dealData,
              createdAt: Date.now(),
            })
            .link({ user: userId })
        );
      }

      synced++;
    } catch (error) {
      console.error(`Failed to sync deal ${deal.id}:`, error);
      errors++;
    }
  }

  // Update last synced timestamp
  const { profiles } = await adminDb.query({
    profiles: { $: { where: { "user.id": userId } } },
  });
  if (profiles.length > 0) {
    await adminDb.transact(
      adminDb.tx.profiles[profiles[0].id]!.update({
        hubspotLastSynced: Date.now(),
      })
    );
  }

  return { synced, errors };
}

// Reverse map: our internal stage -> HubSpot default stage ID
const REVERSE_STAGE_MAP: Record<string, string> = {
  new_lead: "newlead",
  outreach_sent: "outreachsent",
  replied_interested: "repliedinterested",
  discovery_scheduled: "discoveryscheduled",
  discovery_done: "discoverydone",
  follow_up: "followup",
  demo_scheduled: "demoscheduled",
  paid_client: "paidclient",
  gone_silent: "gonesilent",
  not_a_fit: "notafit",
};

/**
 * Updates a deal in InstantDB and HubSpot based on AI intent classification.
 */
export async function updateDealFromClassification(
  dealId: string,
  classification: ClassifyReplyOutput
): Promise<void> {
  const { deals } = await adminDb.query({
    deals: {
      $: { where: { id: dealId } },
      user: {},
    },
  });

  const deal = deals[0];
  if (!deal) {
    throw new Error(`Deal ${dealId} not found`);
  }

  // Build InstantDB update
  const dealUpdate: Record<string, unknown> = {
    updatedAt: Date.now(),
    lastTouchSummary: `Inbound reply: ${classification.one_line_summary}`,
    daysSinceLastTouch: 0,
  };

  if (classification.suggested_stage !== "no_change") {
    dealUpdate.stage = classification.suggested_stage;
  }

  if (classification.flag_for_human) {
    dealUpdate.flaggedForReview = true;
    dealUpdate.flagReason = classification.flag_reason ?? "Flagged by intent classifier";
  }

  await adminDb.transact(
    adminDb.tx.deals[dealId]!.update(dealUpdate)
  );

  // Write stage back to HubSpot if it changed
  if (classification.suggested_stage !== "no_change" && deal.hubspotDealId) {
    try {
      const userId = (deal as unknown as { user: { id: string }[] }).user?.[0]?.id;
      if (userId) {
        const accessToken = await getHubspotAccessToken(userId);

        const hubspotStage =
          REVERSE_STAGE_MAP[classification.suggested_stage] ??
          classification.suggested_stage;

        await fetch(
          `https://api.hubapi.com/crm/v3/objects/deals/${deal.hubspotDealId}`,
          {
            method: "PATCH",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              properties: { dealstage: hubspotStage },
            }),
          }
        );
      }
    } catch (error) {
      console.error("HubSpot stage update failed (non-fatal):", error);
    }
  }

  if (classification.send_calendar_invite) {
    await adminDb.transact(
      adminDb.tx.deals[dealId]!.update({
        flaggedForReview: true,
        flagReason: classification.suggested_slot
          ? `Lead wants to meet: ${classification.suggested_slot}. Calendar invite pending.`
          : "Lead wants to meet. Calendar invite pending.",
      })
    );
  }
}
