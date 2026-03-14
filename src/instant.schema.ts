// Docs: https://www.instantdb.com/docs/modeling-data

import { i } from "@instantdb/react";

const schema = i.schema({
  entities: {
    $users: i.entity({
      email: i.any().unique().indexed(),
    }),

    // User profile: stores integration tokens and sync metadata
    profiles: i.entity({
      hubspotAccessToken: i.string().optional(), // Personal access token (pasted by user)
      hubspotLastSynced: i.number().optional().indexed(), // epoch ms
      gmailAccessToken: i.string().optional(), // Synced from Stack Auth Google OAuth
      lastHistoryId: i.string().optional(), // Gmail Pub/Sub history cursor
      notionAccessToken: i.string().optional(),
      calendlyLink: i.string().optional(),
      createdAt: i.number().indexed(),
    }),

    // Deals synced from HubSpot
    deals: i.entity({
      hubspotDealId: i.string().unique().indexed(),
      contactName: i.string(),
      contactEmail: i.string().optional(),
      contactRole: i.string().optional(),
      companyName: i.string(),
      stage: i.string().indexed(), // new_lead, outreach_sent, replied_interested, discovery_scheduled, discovery_done, follow_up, demo_scheduled, paid_client, gone_silent, not_a_fit
      lastTouchSummary: i.string().optional(),
      daysSinceLastTouch: i.number(),
      notionContext: i.string().optional(),
      hsLastModifiedDate: i.string().optional(),
      flaggedForReview: i.any().optional().indexed(), // boolean - flagged by intent classifier
      flagReason: i.string().optional(),
      createdAt: i.number().indexed(),
      updatedAt: i.number().indexed(),
    }),

    // Messages (outbound drafts and inbound replies)
    messages: i.entity({
      body: i.string(),
      tone: i.string().optional(), // warm, short, bold
      sentAt: i.number().optional(),
      direction: i.string().indexed(), // outbound, inbound
      intentClassification: i.string().optional(),
      gmailMessageId: i.string().optional(), // Gmail API message ID
      gmailThreadId: i.string().optional().indexed(), // Gmail thread ID for reply tracking
      createdAt: i.number().indexed(),
    }),
  },
  links: {
    // Profile belongs to a user (1:1)
    profileUser: {
      forward: { on: "profiles", has: "one", label: "user" },
      reverse: { on: "$users", has: "one", label: "profile" },
    },
    // Deal belongs to a user (many:1)
    dealUser: {
      forward: { on: "deals", has: "one", label: "user" },
      reverse: { on: "$users", has: "many", label: "deals" },
    },
    // Message belongs to a deal (many:1)
    messageDeal: {
      forward: { on: "messages", has: "one", label: "deal" },
      reverse: { on: "deals", has: "many", label: "messages" },
    },
  },
  rooms: {},
});

// This helps Typescript display nicer intellisense
export type AppSchema = typeof schema;
export default schema;
