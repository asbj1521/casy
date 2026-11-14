/**
 * Made-up reports and AI corrections for admin mode (#142, #122), so the app's
 * UI tests (`{ reviews: true }` on the fake server's reset) and the Swift
 * decoders' answers read the same ones. Never anything real: the repo is public.
 */
import type { AdminReport } from "@/api/admin";

import { NOW, type World } from "./world";

const label = (kind: string, importance: string) => ({
  kind,
  importance,
  prepDays: 3,
  avoidBefore: ["lateNight"],
  recoveryDays: 0,
  strain: "heavy",
  confidence: "high",
  reason: "",
});

const settings = {
  kind: "evening",
  startHour: 18,
  anyTime: false,
  startWindow: null,
  durationMinutes: 180,
  weekdays: [5, 6],
  days: null,
  startWeekday: null,
  months: null,
};

export function addReviews(w: World) {
  const reports: AdminReport[] = [
    {
      id: "r-1",
      kind: "group",
      reason: "spam",
      note: "Reklamer hele tiden",
      content: { groupName: "Gratis gaver", groupDescription: "Klik her" },
      pictureUrl: null,
      groupId: "g-badminton",
      createdAt: NOW,
    },
    {
      id: "r-2",
      kind: "member",
      reason: "offensive",
      note: null,
      content: { groupName: "Fredagsbar", memberName: "Kim", memberId: "p-kim" },
      pictureUrl: "https://example.com/kim.jpg",
      groupId: "g-badminton",
      createdAt: NOW,
    },
  ];
  w.reports = reports;
  w.corrections = [
    {
      id: "corr-plan-right",
      kind: "plan",
      data: {
        texts: ["Middag en fredag"],
        plan: { ...settings, title: "Middag", place: null, note: null, assumed: [] },
        overridden: [],
        final: settings,
      },
      createdAt: NOW,
    },
    {
      id: "corr-label",
      kind: "label",
      data: {
        title: "Eksamen i statistik",
        calendar: "Uni",
        previous: label("exam", "normal"),
        note: "Det er en mundtlig eksamen",
        label: label("exam", "critical"),
      },
      createdAt: NOW,
    },
    {
      id: "corr-plan",
      kind: "plan",
      data: {
        texts: ["Fredagsbar efter arbejde"],
        plan: { ...settings, title: "Fredagsbar", place: null, note: null, assumed: ["startHour"] },
        overridden: ["startHour"],
        final: { ...settings, startHour: 16 },
      },
      createdAt: NOW,
    },
  ];
}
