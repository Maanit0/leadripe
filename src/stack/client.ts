import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  // Next.js auto-detects NEXT_PUBLIC_STACK_PROJECT_ID and
  // NEXT_PUBLIC_STACK_PUBLISHABLE_CLIENT_KEY from env vars
  tokenStore: "nextjs-cookie",
  oauthScopesOnSignIn: {
    google: [
      "https://www.googleapis.com/auth/gmail.send",
      "https://www.googleapis.com/auth/gmail.readonly",
      "https://www.googleapis.com/auth/gmail.modify",
      "https://www.googleapis.com/auth/calendar.readonly",
      "https://www.googleapis.com/auth/calendar.events",
    ],
  },
});
