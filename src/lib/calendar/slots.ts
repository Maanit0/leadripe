import "server-only";

import { stackServerApp } from "@/stack/server";

interface FreeBusyBusy {
  start: string;
  end: string;
}

interface FreeBusyResponse {
  calendars: {
    primary: {
      busy: FreeBusyBusy[];
    };
  };
}

/**
 * Gets the Google OAuth access token for the current Stack Auth user.
 * Returns null if unavailable.
 */
export async function getGoogleAccessToken(): Promise<string | null> {
  try {
    const user = await stackServerApp.getUser();
    if (!user) return null;

    const account = await user.getConnectedAccount("google", {
      or: "return-null",
    });
    if (!account) return null;

    const { accessToken } = await account.getAccessToken();
    return accessToken ?? null;
  } catch {
    return null;
  }
}

/**
 * Returns 2-3 available 30-minute slots over the next 5 business days
 * between 9am-6pm in the user's timezone.
 */
export async function getAvailableSlots(
  userId: string
): Promise<string[]> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return [];

  const now = new Date();
  const timeMin = now.toISOString();

  // Calculate +5 business days
  const endDate = new Date(now);
  let businessDays = 0;
  while (businessDays < 5) {
    endDate.setDate(endDate.getDate() + 1);
    const day = endDate.getDay();
    if (day !== 0 && day !== 6) businessDays++;
  }
  endDate.setHours(18, 0, 0, 0);
  const timeMax = endDate.toISOString();

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/freeBusy",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          timeMin,
          timeMax,
          timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          items: [{ id: "primary" }],
        }),
      }
    );

    if (!res.ok) return [];

    const data: FreeBusyResponse = await res.json();
    const busySlots = data.calendars?.primary?.busy ?? [];

    return findOpenSlots(now, endDate, busySlots);
  } catch {
    return [];
  }
}

function findOpenSlots(
  start: Date,
  end: Date,
  busy: FreeBusyBusy[]
): string[] {
  const slots: string[] = [];
  const current = new Date(start);

  // Move to next hour boundary
  current.setMinutes(0, 0, 0);
  current.setHours(current.getHours() + 1);

  while (current < end && slots.length < 3) {
    const day = current.getDay();
    const hour = current.getHours();

    // Skip weekends
    if (day === 0 || day === 6) {
      current.setDate(current.getDate() + 1);
      current.setHours(9, 0, 0, 0);
      continue;
    }

    // Only consider 9am-5:30pm (last slot starts at 5:30 for 30 min)
    if (hour < 9) {
      current.setHours(9, 0, 0, 0);
      continue;
    }
    if (hour >= 18) {
      current.setDate(current.getDate() + 1);
      current.setHours(9, 0, 0, 0);
      continue;
    }

    const slotEnd = new Date(current.getTime() + 30 * 60 * 1000);

    // Check if slot overlaps with any busy period
    const isBusy = busy.some((b) => {
      const busyStart = new Date(b.start);
      const busyEnd = new Date(b.end);
      return current < busyEnd && slotEnd > busyStart;
    });

    if (!isBusy) {
      slots.push(formatSlot(current));
    }

    // Move to next 30-min window
    current.setMinutes(current.getMinutes() + 30);
  }

  return slots;
}

function formatSlot(date: Date): string {
  const days = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const months = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];

  const dayName = days[date.getDay()];
  const monthName = months[date.getMonth()];
  const dayOfMonth = date.getDate();

  let hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12 || 12;

  const timeStr =
    minutes === 0 ? `${hours}:00${ampm}` : `${hours}:${String(minutes).padStart(2, "0")}${ampm}`;

  return `${dayName} ${monthName} ${dayOfMonth} at ${timeStr}`;
}
