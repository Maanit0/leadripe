import { adminDb } from "@/lib/db-admin";

/**
 * Gets the HubSpot access token for a user.
 * Reads from the user's InstantDB profile (pasted personal access token).
 * Falls back to HUBSPOT_ACCESS_TOKEN env var.
 */
export async function getHubspotAccessToken(
  userId: string
): Promise<string> {
  // Check user's profile first
  const { profiles } = await adminDb.query({
    profiles: {
      $: { where: { "user.id": userId } },
    },
  });

  const profileToken = profiles[0]?.hubspotAccessToken;
  if (profileToken) return profileToken;

  // Fall back to env var
  const envToken = process.env.HUBSPOT_ACCESS_TOKEN;
  if (envToken) return envToken;

  throw new Error("HubSpot is not connected. Add your access token in Settings.");
}
