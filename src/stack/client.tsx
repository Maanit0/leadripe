import { StackClientApp } from "@stackframe/stack";

export const stackClientApp = new StackClientApp({
  tokenStore: "cookie", // Changed from "nextjs-cookie" to work in iframes
  urls: {
    afterSignIn: "/",
    afterSignOut: "/",
  },
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