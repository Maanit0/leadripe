import "server-only";

import { getGoogleAccessToken, getAvailableSlots } from "./slots";

interface CalendarDeal {
  contactName: string;
  contactEmail: string;
}

interface CreatedEvent {
  eventId: string;
  dateTime: string;
}

/**
 * Creates a Google Calendar event with the lead as an attendee.
 *
 * If suggestedSlot is provided, resolves it to a real datetime by checking
 * freebusy around that time. If null, uses the first available slot.
 */
export async function createCalendarInvite(
  userId: string,
  deal: CalendarDeal,
  suggestedSlot: string | null
): Promise<CreatedEvent | null> {
  const accessToken = await getGoogleAccessToken();
  if (!accessToken) return null;

  let startTime: Date | null = null;

  if (suggestedSlot) {
    startTime = await resolveSlot(accessToken, suggestedSlot);
  }

  if (!startTime) {
    // Fall back to first available slot
    const slots = await getAvailableSlots(userId);
    if (slots.length === 0) return null;
    startTime = parseSlotString(slots[0]);
    if (!startTime) return null;
  }

  const endTime = new Date(startTime.getTime() + 30 * 60 * 1000);

  // Get sender's name from the calendar owner
  const senderFirstName = await getSenderFirstName(accessToken);

  const summary = `LeadRipe: ${deal.contactName} x ${senderFirstName}`;

  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary,
          start: {
            dateTime: startTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          end: {
            dateTime: endTime.toISOString(),
            timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          },
          attendees: [{ email: deal.contactEmail }],
          reminders: {
            useDefault: false,
            overrides: [{ method: "popup", minutes: 10 }],
          },
        }),
      }
    );

    if (!res.ok) {
      console.error("Calendar event creation failed:", await res.text());
      return null;
    }

    const event = await res.json();
    return {
      eventId: event.id,
      dateTime: startTime.toISOString(),
    };
  } catch (error) {
    console.error("Calendar invite error:", error);
    return null;
  }
}

/**
 * Resolves a natural-language suggested slot (e.g. "Thursday afternoon")
 * to a real available datetime by checking freebusy around that time.
 */
async function resolveSlot(
  accessToken: string,
  suggestedSlot: string
): Promise<Date | null> {
  const target = parseSuggestedSlot(suggestedSlot);
  if (!target) return null;

  // Check a 4-hour window around the target time
  const windowStart = new Date(target.getTime() - 2 * 60 * 60 * 1000);
  const windowEnd = new Date(target.getTime() + 2 * 60 * 60 * 1000);

  // Clamp to business hours (9am-6pm)
  if (windowStart.getHours() < 9) windowStart.setHours(9, 0, 0, 0);
  if (windowEnd.getHours() > 18) windowEnd.setHours(18, 0, 0, 0);

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
          timeMin: windowStart.toISOString(),
          timeMax: windowEnd.toISOString(),
          items: [{ id: "primary" }],
        }),
      }
    );

    if (!res.ok) return null;

    const data = await res.json();
    const busy: Array<{ start: string; end: string }> =
      data.calendars?.primary?.busy ?? [];

    // Try the exact target time first
    const slotEnd = new Date(target.getTime() + 30 * 60 * 1000);
    const targetBusy = busy.some((b) => {
      const bs = new Date(b.start);
      const be = new Date(b.end);
      return target < be && slotEnd > bs;
    });

    if (!targetBusy) return target;

    // Try every 30-min slot in the window
    const cursor = new Date(windowStart);
    while (cursor < windowEnd) {
      const cursorEnd = new Date(cursor.getTime() + 30 * 60 * 1000);
      const isBusy = busy.some((b) => {
        const bs = new Date(b.start);
        const be = new Date(b.end);
        return cursor < be && cursorEnd > bs;
      });

      if (!isBusy && cursor.getHours() >= 9 && cursor.getHours() < 18) {
        return new Date(cursor);
      }
      cursor.setMinutes(cursor.getMinutes() + 30);
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Parses a natural-language slot like "Thursday afternoon" or "Monday at 2pm"
 * into a Date for the next occurrence of that day/time.
 */
function parseSuggestedSlot(slot: string): Date | null {
  const lower = slot.toLowerCase();
  const now = new Date();

  const dayNames: Record<string, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  // Find the target day
  let targetDay: number | null = null;
  for (const [name, num] of Object.entries(dayNames)) {
    if (lower.includes(name)) {
      targetDay = num;
      break;
    }
  }

  const result = new Date(now);

  if (targetDay !== null) {
    // Move to next occurrence of that day
    const currentDay = now.getDay();
    let daysAhead = targetDay - currentDay;
    if (daysAhead <= 0) daysAhead += 7;
    result.setDate(result.getDate() + daysAhead);
  } else {
    // Default to tomorrow
    result.setDate(result.getDate() + 1);
  }

  // Parse time
  const timeMatch = lower.match(/(\d{1,2})(?::(\d{2}))?\s*(am|pm)/);
  if (timeMatch) {
    let hours = parseInt(timeMatch[1], 10);
    const minutes = timeMatch[2] ? parseInt(timeMatch[2], 10) : 0;
    if (timeMatch[3] === "pm" && hours !== 12) hours += 12;
    if (timeMatch[3] === "am" && hours === 12) hours = 0;
    result.setHours(hours, minutes, 0, 0);
  } else if (lower.includes("morning")) {
    result.setHours(10, 0, 0, 0);
  } else if (lower.includes("afternoon")) {
    result.setHours(14, 0, 0, 0);
  } else if (lower.includes("evening")) {
    result.setHours(17, 0, 0, 0);
  } else {
    // Default to 10am
    result.setHours(10, 0, 0, 0);
  }

  // Don't schedule in the past
  if (result <= now) return null;

  return result;
}

/**
 * Parse a formatted slot string (from getAvailableSlots) back to a Date.
 * e.g. "Tuesday March 18 at 2:00pm"
 */
function parseSlotString(slot: string): Date | null {
  try {
    const match = slot.match(
      /\w+ (\w+) (\d+) at (\d{1,2}):(\d{2})(am|pm)/
    );
    if (!match) return null;

    const [, monthName, day, hourStr, minuteStr, ampm] = match;

    const months: Record<string, number> = {
      january: 0, february: 1, march: 2, april: 3,
      may: 4, june: 5, july: 6, august: 7,
      september: 8, october: 9, november: 10, december: 11,
    };

    const month = months[monthName.toLowerCase()];
    if (month === undefined) return null;

    let hours = parseInt(hourStr, 10);
    const minutes = parseInt(minuteStr, 10);
    if (ampm === "pm" && hours !== 12) hours += 12;
    if (ampm === "am" && hours === 12) hours = 0;

    const now = new Date();
    const year = now.getFullYear();
    const result = new Date(year, month, parseInt(day, 10), hours, minutes, 0, 0);

    // If the date is in the past, it might be next year
    if (result < now) {
      result.setFullYear(year + 1);
    }

    return result;
  } catch {
    return null;
  }
}

async function getSenderFirstName(accessToken: string): Promise<string> {
  try {
    const res = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary",
      { headers: { Authorization: `Bearer ${accessToken}` } }
    );
    if (!res.ok) return "Me";
    const cal = await res.json();
    const summary: string = cal.summary ?? "";
    return summary.split(" ")[0] || "Me";
  } catch {
    return "Me";
  }
}
