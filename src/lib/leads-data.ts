export type PipelineStage = "Gone silent" | "Demo done" | "Proposal sent" | "Replied / interested";

export interface Deal {
  id: string;
  name: string;
  role: string;
  company: string;
  stage: PipelineStage;
  daysSince: number;
  lastTouchSummary: string;
  goal: string;
  email: string;
  drafts: {
    warm: string;
    shorter: string;
    bolder: string;
  };
}

export const DEALS: Deal[] = [
  {
    id: "sarah-chen",
    name: "Sarah Chen",
    role: "Head of Growth",
    company: "Acme AI",
    stage: "Gone silent",
    daysSince: 18,
    lastTouchSummary: "Sent a proposal on March 12. No reply since.",
    goal: "Get a yes on scheduling a final review call",
    email: "sarah@acmeai.com",
    drafts: {
      warm: `Hi Sarah,

Hope you've had a good few weeks. I wanted to circle back on the proposal I sent over — I know things get busy and it can be easy for these to slip.

We've had two other teams in your space start using LeadRipe this month and the early results have been really encouraging. I'd love to share what we're seeing.

Would a 20-minute call this week or next work for you? Happy to work around your schedule.

Best,
Alex`,
      shorter: `Hi Sarah,

Just following up on the proposal from March 12 — wanted to make sure it didn't get buried.

Worth a quick call this week to discuss?

Best,
Alex`,
      bolder: `Hi Sarah,

I'll be direct — I think LeadRipe is a strong fit for Acme AI and I don't want this to fall through the cracks.

The proposal I sent covers exactly what your team needs. Can we get 20 minutes on the calendar this week to close the loop?

Alex`,
    },
  },
  {
    id: "david-park",
    name: "David Park",
    role: "CEO",
    company: "Nimbus Labs",
    stage: "Gone silent",
    daysSince: 12,
    lastTouchSummary: "Had a demo call on March 18. He said he'd loop in his CTO.",
    goal: "Get intro to CTO and confirm next steps",
    email: "david@nimbuslabs.io",
    drafts: {
      warm: `Hi David,

Great speaking with you last week — I really enjoyed learning more about what Nimbus Labs is building.

I wanted to follow up on looping in your CTO. Even a quick 15-minute intro call would be really valuable so we can make sure the technical fit is there.

Let me know if you'd like me to send a calendar invite or if it's easier for you to make the intro over email.

Looking forward to it,
Alex`,
      shorter: `Hi David,

Following up from our demo — did you get a chance to loop in your CTO?

Happy to send a calendar invite if that makes it easier.

Alex`,
      bolder: `Hi David,

We spoke two weeks ago and you mentioned looping in your CTO. I want to make sure this doesn't stall.

Can you make the intro this week? I'll take it from there.

Alex`,
    },
  },
  {
    id: "maria-alvarez",
    name: "Maria Alvarez",
    role: "VP of Sales",
    company: "Orbit Analytics",
    stage: "Proposal sent",
    daysSince: 7,
    lastTouchSummary: "Sent a detailed proposal on March 23. She acknowledged receipt.",
    goal: "Get a decision or surface any blockers",
    email: "maria@orbitanalytics.com",
    drafts: {
      warm: `Hi Maria,

Thanks again for taking the time to review the proposal. I wanted to check in and see if you had any questions or if there's anything I can clarify.

We're happy to adjust the scope or pricing if needed — just want to make sure it's the right fit for your team.

Let me know how you're feeling about it.

Best,
Alex`,
      shorter: `Hi Maria,

Just checking in on the proposal — any questions or blockers I can help with?

Alex`,
      bolder: `Hi Maria,

The proposal has been with you for a week. I'd love to get a decision or at least understand where things stand.

What's the main thing holding you back right now?

Alex`,
    },
  },
  {
    id: "james-patel",
    name: "James Patel",
    role: "Co-founder",
    company: "VectorFlow",
    stage: "Demo done",
    daysSince: 5,
    lastTouchSummary: "Ran a live demo on March 25. He was engaged and asked about pricing.",
    goal: "Send a proposal and get a follow-up call booked",
    email: "james@vectorflow.ai",
    drafts: {
      warm: `Hi James,

Really enjoyed the demo session — it was great to see how VectorFlow is thinking about the problem.

As promised, I'm putting together a proposal tailored to your team's needs. I'll have it over to you by end of week.

In the meantime, feel free to book a slot on my Calendly if you want to talk through pricing or anything else: https://calendly.com/alex/30min

Talk soon,
Alex`,
      shorter: `Hi James,

Great demo last week. Proposal coming your way by Friday.

Want to book a follow-up call in the meantime? https://calendly.com/alex/30min

Alex`,
      bolder: `Hi James,

You asked about pricing on the demo — I'm ready to put a number in front of you.

Proposal lands Friday. Book a call now so we can walk through it together: https://calendly.com/alex/30min

Alex`,
    },
  },
  {
    id: "priya-nair",
    name: "Priya Nair",
    role: "Director of Ops",
    company: "Stackline",
    stage: "Replied / interested",
    daysSince: 3,
    lastTouchSummary: "She replied saying she's interested but needs to check budget with her CFO.",
    goal: "Keep momentum and offer to join the CFO call",
    email: "priya@stackline.com",
    drafts: {
      warm: `Hi Priya,

Thanks so much for the update — really glad to hear there's interest on your end.

I completely understand the budget conversation needs to happen first. If it would help, I'm happy to join a quick call with you and your CFO to answer any questions directly and make the case for the ROI.

Just let me know and I'll make myself available.

Best,
Alex`,
      shorter: `Hi Priya,

Thanks for the update. Happy to join a call with your CFO if that would help move things along.

Just say the word.

Alex`,
      bolder: `Hi Priya,

Budget conversations move faster when I'm in the room. Let me join the CFO call — I can answer questions on the spot and we can get to a decision faster.

When are you planning to have that conversation?

Alex`,
    },
  },
];

export const STAGE_CONFIG: Record<PipelineStage, { color: string; bg: string; dot: string }> = {
  "Gone silent": {
    color: "text-red-700",
    bg: "bg-red-50 border-red-200",
    dot: "bg-red-500",
  },
  "Demo done": {
    color: "text-blue-700",
    bg: "bg-blue-50 border-blue-200",
    dot: "bg-blue-500",
  },
  "Proposal sent": {
    color: "text-amber-700",
    bg: "bg-amber-50 border-amber-200",
    dot: "bg-amber-500",
  },
  "Replied / interested": {
    color: "text-green-700",
    bg: "bg-green-50 border-green-200",
    dot: "bg-green-500",
  },
};

export function sortDealsByUrgency(deals: Deal[]): Deal[] {
  const stageOrder: Record<PipelineStage, number> = {
    "Gone silent": 0,
    "Proposal sent": 1,
    "Demo done": 2,
    "Replied / interested": 3,
  };
  return [...deals].sort((a, b) => {
    const stageDiff = stageOrder[a.stage] - stageOrder[b.stage];
    if (stageDiff !== 0) return stageDiff;
    return b.daysSince - a.daysSince;
  });
}
