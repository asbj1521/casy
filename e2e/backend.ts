/**
 * A stand-in for Casy's Edge Functions: each function and action answered
 * from the made-up world (world.ts), the way the real one answers. Actions
 * that change something change the world, so the next list shows it, as on
 * the live site. Anything it doesn't know is reported, and fails the test
 * (fixtures.ts), rather than quietly answering nothing.
 */
import type { EventResponse, SuggestedEvent } from "@/api/events";
import type { PlanAnswer } from "@/api/planAi";
import type { EntriesProposal } from "@/api/entries";
import type { AiPlan } from "@/lib/aiPlan";
import type { CasyEntry } from "@/lib/casyEntries";
import { adminOverview, groupBusy, ME, myData, myOverview, NOW, type World } from "./world";

export interface FunctionCall {
  name: string;
  params: URLSearchParams;
  body: Record<string, unknown>;
}

export type Answer = { status: number; json: unknown };

const ok = (json: unknown): Answer => ({ status: 200, json });
const fail = (status: number, error: string): Answer => ({ status, json: { error } });

/** A vote's deadline as the server sets it (#179): none for null, 3 days for an older app. */
function answerBy(days: unknown): string | null {
  if (days === null) return null;
  const n = typeof days === "number" ? days : 3;
  return new Date(Date.parse(NOW) + n * 24 * 60 * 60 * 1000).toISOString();
}

export class FakeBackend {
  /** Calls nobody answers, as "function action": the test fails if any. */
  readonly unknown: string[] = [];
  /** Every call made, in order, for tests that check what the page sent. */
  readonly calls: FunctionCall[] = [];

  readonly world: World;

  constructor(world: World) {
    this.world = world;
  }

  answer(call: FunctionCall): Answer {
    this.calls.push(call);
    const action = typeof call.body.action === "string" ? call.body.action : "";
    const answer = this.route(call, action);
    if (!answer) {
      this.unknown.push(`${call.name} ${action}`.trim());
      return fail(404, `The test backend doesn't know ${call.name} ${action}`);
    }
    return answer;
  }

  private changed() {
    this.world.version++;
  }

  private route({ name, params, body }: FunctionCall, action: string): Answer | undefined {
    const w = this.world;
    switch (name) {
      case "groups":
        return this.groups(action, body);
      case "events":
        return this.events(action, body);
      case "calendar-status":
        return ok({ connections: w.connections });
      case "calendar-busy":
        return ok(myOverview(w, params.get("from") ?? NOW, params.get("to") ?? NOW));
      case "calendar-primary":
        if (action === "get") return ok({ primary: w.primary });
        if (action === "set") {
          const id = body.calendarId as string | null;
          w.primary = id ? { calendarId: id, autoAdd: w.primary?.autoAdd ?? false } : null;
          return ok({ primary: w.primary });
        }
        if (action === "auto-add" && w.primary) {
          w.primary = { ...w.primary, autoAdd: body.autoAdd === true };
          return ok({ primary: w.primary });
        }
        return undefined;
      case "calendar-set-purpose": {
        // A category picked or cleared by hand is the owner's for good (#118).
        const source = w.connections
          .flatMap((c) => c.calendar_sources)
          .find((s) => s.id === body.calendarId);
        if (source && "purpose" in body) {
          source.purpose = body.purpose as typeof source.purpose;
          source.purpose_source = "user";
          this.changed();
        }
        return ok({});
      }
      case "calendar-categorize": {
        // As the real one, without the AI: every untouched calendar in a
        // connected account becomes "school", guessed.
        const categorized = w.connections
          .filter((c) => c.status === "connected")
          .flatMap((c) => c.calendar_sources)
          .filter((s) => s.purpose === null && s.purpose_source === null)
          .map((s) => {
            s.purpose = "school";
            s.purpose_source = "ai";
            return { calendarId: s.id, purpose: s.purpose };
          });
        if (categorized.length > 0) this.changed();
        return ok({ categorized });
      }
      case "event-profile":
        // As the real one, without the AI: every event an evening out.
        return ok({
          profile: {
            v: 1,
            effects: ["alcohol"],
            runsLate: true,
            strain: "moderate",
            recoveryDays: 0,
            outdoors: false,
            daylight: false,
            confidence: "medium",
            reason: "",
          },
          left: 39,
        });
      case "calendar-label": {
        // Only the iPhone app labels events, which the browser tests can't
        // be; answered as the real one would, every event an ordinary one.
        const events = Array.isArray(body.events) ? body.events : [];
        const labels = events.map(() => ({
          kind: "other",
          importance: "normal",
          prepDays: 0,
          avoidBefore: [],
          recoveryDays: 0,
          strain: "light",
          confidence: "low",
          reason: "",
        }));
        return ok({ labels, left: 19 });
      }
      case "app-version":
        return ok({
          minVersion: w.minAppVersion,
          storeUrl: "https://apps.apple.com/dk/app/casy/id0000000000",
        });
      case "calendar-sync":
        return ok({ results: w.connections.map(() => ({ ok: true })) });
      case "calendar-disconnect":
        w.connections = w.connections.filter((c) => c.id !== body.connectionId);
        if (
          !w.connections.some((c) => c.calendar_sources.some((s) => s.id === w.primary?.calendarId))
        )
          w.primary = null;
        this.changed();
        return ok({});
      case "calendar-phone":
        // Only the iPhone app sends the phone's calendars. A plain update is
        // answered as for a phone whose connection was removed; connecting
        // (the app, a test faking it) makes one.
        return body.create === true
          ? ok({ connectionId: "c-phone", calendars: 1, busyBlocks: 0 })
          : ok({ gone: true });
      case "oauth-google-start":
      case "oauth-outlook-start":
        return ok({ url: `https://consent.test/${name}` });
      case "account":
        if (action === "data") return ok(myData(w));
        if (action === "export") return ok({ ...myData(w), busyTimes: [] });
        if (action === "ai-consent") {
          w.aiConsent = body.on === true;
          // Withdrawing takes the corrections sent for review with it (#122).
          if (!w.aiConsent) w.corrections = [];
          return ok({ outcome: w.aiConsent ? "given" : "withdrawn" });
        }
        if (action === "ai-share") {
          if (!w.aiConsent) return fail(400, "Say yes to the AI using your calendar first.");
          w.aiShare = body.on === true;
          return ok({ outcome: w.aiShare ? "sharing" : "not sharing" });
        }
        if (action === "apple-token") return ok({ outcome: "saved" });
        if (action === "push-register") return ok({ outcome: "registered" });
        if (action === "push-unregister") return ok({ outcome: "unregistered" });
        if (action === "push-settings") return ok({ off: w.pushOff, devices: 1 });
        if (action === "push-set") {
          w.pushOff =
            body.on === true
              ? w.pushOff.filter((k) => k !== body.kind)
              : [...new Set([...w.pushOff, String(body.kind)])];
          return ok({ off: w.pushOff });
        }
        if (action === "corrections-delete") {
          w.corrections = [];
          return ok({ outcome: "deleted" });
        }
        if (action === "delete") return ok({});
        return undefined;
      case "ai-feedback":
        // As the real one: only from someone who said yes and shares (#122).
        if (!w.aiConsent || !w.aiShare) return fail(403, "Sharing is switched off.");
        w.corrections.unshift({
          id: `corr-${w.corrections.length + 1}`,
          kind: body.kind as "label" | "plan",
          data: body.data,
          createdAt: NOW,
        });
        return ok({ stored: true });
      case "admin":
        if (action === "status") return ok({ isAdmin: w.admin !== false });
        if (!w.admin) return fail(403, "Kun for administratorer.");
        if (action === "corrections") return ok({ corrections: w.corrections });
        if (action === "correctionHandled") {
          w.corrections = w.corrections.filter((c) => c.id !== body.id);
          return ok({ outcome: "handled" });
        }
        if (action === "pushTest") return ok({ sent: 1, failed: [] });
        if (action === "reports") return ok({ reports: w.reports });
        if (action === "reportHandled") {
          w.reports = w.reports.filter((r) => r.id !== body.id);
          return ok({ outcome: "handled" });
        }
        if (action === "overview") return ok(adminOverview(w));
        if (action === "setAiAccess") {
          const id = String(body.profileId);
          if (body.allowed) w.aiAccess.add(id);
          else {
            w.aiAccess.delete(id);
            w.testers.delete(id);
          }
          return ok({ ai: body.allowed ? "allowed" : "off" });
        }
        if (action === "setAiTester") {
          const id = String(body.profileId);
          if (!w.aiAccess.has(id)) return fail(400, "Slå AI til for personen først.");
          if (body.allowed) w.testers.add(id);
          else w.testers.delete(id);
          return ok({ tester: body.allowed === true });
        }
        return undefined;
      case "plan-ai":
        return this.planAi(body);
      case "entries-ai":
        return this.entriesAi(body);
      case "calendar-entries":
        return this.calendarEntries(action, body);
      case "plan-presets":
        return this.planPresets(action, body);
      case "pictures":
        return this.pictures(action, body);
      default:
        return undefined;
    }
  }

  /**
   * Tell Casy (#116), always the same proposals: a first description is a
   * week away in October (whole days); more details add a course one evening.
   */
  private entriesAi(body: Record<string, unknown>): Answer {
    if (body.text === "bare noget vrøvl") {
      return fail(
        422,
        "Casy kunne ikke få en kalenderpost ud af det. Prøv at sige det på en anden måde.",
      );
    }
    const trip: CasyEntry = {
      kind: "away",
      label: "Rejse",
      start: "2026-10-11T22:00:00.000Z", // Monday 12 October 00:00, Danish time
      end: "2026-10-19T22:00:00.000Z", // Tuesday 20 October 00:00
      allDay: true,
    };
    const course: CasyEntry = {
      kind: "busy",
      label: "Kursus",
      start: "2026-10-22T16:00:00.000Z", // Thursday 22 October 18:00
      end: "2026-10-22T20:00:00.000Z", // 22:00
      allDay: false,
    };
    const current = Array.isArray(body.current) ? (body.current as CasyEntry[]) : null;
    const proposal: EntriesProposal = {
      entries: current ? [...current, course] : [trip],
      message: null,
      left: 29,
    };
    return ok(proposal);
  }

  /** Entries kept and deleted again, as calendar-entries does. */
  private calendarEntries(action: string, body: Record<string, unknown>): Answer | undefined {
    const w = this.world;
    if (action === "add") {
      const saved = (body.entries as CasyEntry[]).map((e, i) => ({
        ...e,
        id: `entry-${w.entries.length + i + 1}`,
      }));
      w.entries.push(...saved);
      this.changed();
      return ok({ entries: saved });
    }
    if (action === "delete") {
      const before = w.entries.length;
      w.entries = w.entries.filter((e) => e.id !== body.id);
      this.changed();
      return ok({ deleted: w.entries.length < before });
    }
    return undefined;
  }

  /**
   * Profile pictures (#187), as the pictures function keeps them: the JPEG
   * the page made, shown back as a data link (the real one is a signed link
   * to storage), on Mia in every group as well.
   */
  private pictures(action: string, body: Record<string, unknown>): Answer | undefined {
    const w = this.world;
    const mine = (avatarUrl: string | null) => {
      w.avatarUrl = avatarUrl;
      for (const g of w.groups) {
        for (const m of g.members) if (m.isYou) m.avatarUrl = avatarUrl;
      }
      this.changed();
      return ok({ avatarUrl });
    };
    if (action === "set-avatar") {
      const image = String(body.image ?? "");
      // A JPEG starts FF D8 FF, which is "/9j/" in base64.
      if (!image.startsWith("/9j/"))
        return fail(400, "Det billede kan ikke bruges. Prøv et andet.");
      return mine(`data:image/jpeg;base64,${image}`);
    }
    if (action === "remove-avatar") return mine(null);
    return undefined;
  }

  /** Genveje (#175), kept and changed as plan-presets does. */
  private planPresets(action: string, body: Record<string, unknown>): Answer | undefined {
    const w = this.world;
    if (action === "list") return ok({ presets: w.presets });
    if (action === "save") {
      const fields = {
        name: String(body.name).trim(),
        plan: body.plan,
        updatedAt: NOW,
      };
      let savedId = body.id as string | null;
      if (savedId) {
        const preset = w.presets.find((p) => p.id === savedId);
        if (!preset) return fail(404, "Genvejen findes ikke længere.");
        Object.assign(preset, fields);
      } else {
        if (w.presets.length >= 6) return fail(400, "Du kan højst have 6 genveje. Slet en først.");
        savedId = `00000000-0000-4000-8000-${String(w.presets.length + 1).padStart(12, "0")}`;
        w.presets.push({ id: savedId, ...fields });
      }
      return ok({ presets: w.presets, savedId });
    }
    if (action === "delete") {
      w.presets = w.presets.filter((p) => p.id !== body.id);
      return ok({ presets: w.presets });
    }
    return undefined;
  }

  /**
   * Planning with AI (#100), always the same plans: a first description is a
   * Friday dinner in November without Jonas (and a Peter nobody in the group
   * is), with a question about the time; more details move it to December.
   */
  private planAi(body: Record<string, unknown>): Answer {
    // Text that isn't about an event, as the real function answers it.
    if (body.text === "bare noget vrøvl") {
      return fail(
        422,
        "Casy kunne ikke få en aftale ud af det. Prøv at sige det på en anden måde.",
      );
    }
    const nothing: AiPlan = {
      kind: null,
      startHour: null,
      anyTime: null,
      startWindow: null,
      durationMinutes: null,
      weekdays: null,
      days: null,
      startWeekday: null,
      months: null,
      title: null,
      place: null,
      note: null,
      people: { without: [], optional: [], required: [] },
      atLeast: null,
      assumed: [],
      questions: [],
    };
    const evening = (startHour: number) => ({ ...nothing, startHour, anyTime: false });
    // Three questions at once: more than any box has room for, so the panel
    // must reach over the chart whatever the fonts measure (#124).
    if (body.text === "mange spørgsmål") {
      const meeting = (startHour: number) => ({
        ...nothing,
        kind: "meeting" as const,
        startHour,
        anyTime: false,
        durationMinutes: 120,
      });
      const ask = (question: string) => ({
        question,
        options: [
          { label: "Om eftermiddagen", patch: meeting(15) },
          { label: "Om aftenen", patch: meeting(19) },
          { label: "Sent om aftenen", patch: meeting(21) },
        ],
      });
      const answer: PlanAnswer = {
        plan: {
          ...meeting(15),
          title: "Noget",
          assumed: ["startHour"],
          questions: [ask("Hvornår?"), ask("Hvornår helst?"), ask("Hvornår ellers?")],
        },
        left: 21,
      };
      return ok(answer);
    }
    // No time said, so a window of starts, guessed (#133).
    if (body.text === "middag så tidligt som muligt") {
      const answer: PlanAnswer = {
        plan: {
          ...nothing,
          kind: "meeting",
          startHour: 18,
          anyTime: false,
          startWindow: { from: 18 * 60, to: 21 * 60 },
          durationMinutes: 180,
          title: "Middag",
          assumed: ["startHour", "startWindow", "durationMinutes"],
        },
        left: 41,
      };
      return ok(answer);
    }
    // Weekday mornings in October, when everyone works: no date at all, but
    // an evening or a weekend would do (#135).
    if (body.text === "møde om formiddagen på hverdage i oktober") {
      const answer: PlanAnswer = {
        plan: {
          ...nothing,
          kind: "meeting",
          startHour: 10,
          anyTime: false,
          durationMinutes: 120,
          weekdays: [1, 2, 3, 4, 5],
          months: { from: "2026-10", to: "2026-10" },
          title: "Møde",
        },
        left: 41,
      };
      return ok(answer);
    }
    // A date that bounds it: from today until 5 November, exact days (#134).
    if (body.text === "tivoli før halloween slutter den 5. november") {
      const answer: PlanAnswer = {
        plan: {
          ...nothing,
          kind: "meeting",
          startHour: 18,
          anyTime: false,
          startWindow: { from: 18 * 60, to: 21 * 60 },
          durationMinutes: 180,
          months: { from: "2026-10-07", to: "2026-11-05", days: true },
          title: "Tivoli",
          assumed: ["startHour", "startWindow", "durationMinutes"],
        },
        left: 41,
      };
      return ok(answer);
    }
    // A question whose options are long enough to wrap: what the box must
    // still fit beside the answer (#124).
    if (body.text === "te hos mormor og morfar") {
      const meeting = (startHour: number, durationMinutes: number) => ({
        ...nothing,
        kind: "meeting" as const,
        startHour,
        anyTime: false,
        durationMinutes,
      });
      const answer: PlanAnswer = {
        plan: {
          ...meeting(15, 90),
          title: "Te hos mormor og morfar",
          assumed: ["startHour", "durationMinutes"],
          questions: [
            {
              question: "Hvad for en plan er det?",
              options: [
                { label: "Te og kage en eftermiddag", patch: meeting(15, 90) },
                { label: "En hyggeaften", patch: meeting(18, 180) },
                {
                  label: "En hel weekend der",
                  patch: { ...nothing, kind: "trip", days: 2, startWeekday: 6 },
                },
              ],
            },
          ],
        },
        left: 21,
      };
      return ok(answer);
    }
    const plan: AiPlan =
      body.current === null
        ? {
            ...nothing,
            kind: "meeting",
            startHour: 18,
            anyTime: false,
            durationMinutes: 180,
            weekdays: [5],
            months: { from: "2026-11", to: "2026-11" },
            title: "Middag",
            people: { without: ["Jonas", "Peter"], optional: [], required: [] },
            assumed: ["startHour"],
            questions: [
              {
                question: "Hvornår på aftenen?",
                options: [
                  { label: "Kl. 18", patch: evening(18) },
                  { label: "Kl. 19", patch: evening(19) },
                ],
              },
            ],
          }
        : { ...nothing, months: { from: "2026-12", to: "2026-12" } };
    const answer: PlanAnswer = { plan, left: 41 };
    return ok(answer);
  }

  private groups(action: string, body: Record<string, unknown>): Answer | undefined {
    const w = this.world;
    const group = w.groups.find((g) => g.id === body.groupId);
    const whoami = () => ({
      name: w.name,
      aiAllowed: w.aiAllowed,
      aiTester: w.aiTester || w.admin !== false,
      aiConsent: w.aiConsent,
      aiShare: w.aiConsent && w.aiShare,
      avatarUrl: w.avatarUrl,
    });
    switch (action) {
      case "list":
        return ok({ groups: w.groups });
      case "busy":
        return ok(groupBusy(w, body.groupId as string, body.from as string, body.to as string));
      case "refresh":
        return ok({ complete: true, synced: false });
      case "invitations":
        return ok({ invitations: w.invitations });
      case "pulse":
        return ok({ pulse: `v${w.version}` });
      case "whoami":
        return ok(whoami());
      // Everything a page asks for as it opens, in one answer (#158).
      case "start":
        return ok({
          whoami: whoami(),
          groups: w.groups,
          invitations: w.invitations,
          connections: w.connections,
          pulse: `v${w.version}`,
        });
      case "set-name":
        w.name = String(body.name);
        return ok({ name: w.name });
      case "rename":
        if (!group) return fail(404, "Group not found");
        group.name = String(body.name);
        this.changed();
        return ok({ groups: w.groups });
      case "describe":
        if (!group) return fail(404, "Group not found");
        group.description =
          String(body.description ?? "")
            .trim()
            .slice(0, 200) || null;
        this.changed();
        return ok({ groups: w.groups });
      case "create": {
        const id = `g-new-${w.groups.length}`;
        w.groups.push({
          id,
          name: String(body.name),
          description:
            String(body.description ?? "")
              .trim()
              .slice(0, 200) || null,
          createdAt: NOW,
          createdBy: ME.id,
          members: [{ profileId: ME.id, name: ME.name, isYou: true, joinedAt: NOW }],
          invited: [],
        });
        this.changed();
        return ok({ groups: w.groups, createdId: id });
      }
      case "invite":
        return ok({
          url: "https://casy.app/join/test-invite-token",
          expiresAt: "2026-10-14T08:00:00.000Z",
        });
      case "invite-members":
        return ok({ groups: w.groups });
      case "decline-invitation":
        w.invitations = w.invitations.filter((i) => i.groupId !== body.groupId);
        this.changed();
        return ok({ invitations: w.invitations });
      case "report": {
        if (!["spam", "offensive", "harassment", "other"].includes(String(body.reason)))
          return fail(400, "Vælg en grund.");
        const group = w.groups.find((g) => g.id === body.groupId);
        if (!group) return fail(403, "Du er ikke med i den gruppe.");
        const member = group.members.find((m) => m.profileId === body.memberId);
        const event = w.events.find((e) => e.id === body.eventId);
        w.reports.push({
          id: `r-${w.reports.length + 1}`,
          kind: body.kind as "group" | "event" | "member",
          reason: String(body.reason),
          note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
          content: {
            groupName: group.name,
            ...(member ? { memberName: member.name } : {}),
            ...(event ? { title: event.title ?? undefined } : {}),
          },
          groupId: group.id,
          createdAt: NOW,
        });
        return ok({ reported: true });
      }
      case "block": {
        let id: string;
        let name: string | null;
        if (typeof body.invitationGroupId === "string") {
          const invitation = w.invitations.find((i) => i.groupId === body.invitationGroupId);
          if (!invitation) return fail(404, "Invitationen er ikke længere åben.");
          w.invitations = w.invitations.filter((i) => i !== invitation);
          id = `p-${(invitation.invitedBy ?? "gone").toLowerCase()}`;
          name = invitation.invitedBy;
        } else {
          id = String(body.profileId);
          name = w.groups.flatMap((g) => g.members).find((m) => m.profileId === id)?.name ?? null;
        }
        if (!w.blocked.some((b) => b.profileId === id))
          w.blocked.unshift({ profileId: id, name, blockedAt: NOW });
        this.changed();
        return ok({ blocked: w.blocked, invitations: w.invitations });
      }
      case "unblock":
        w.blocked = w.blocked.filter((b) => b.profileId !== body.profileId);
        return ok({ blocked: w.blocked });
      case "blocked":
        return ok({ blocked: w.blocked });
      case "leave":
        w.groups = w.groups.filter((g) => g.id !== body.groupId);
        this.changed();
        return ok({ groups: w.groups, outcome: "left" });
      case "delete":
        w.groups = w.groups.filter((g) => g.id !== body.groupId);
        this.changed();
        return ok({ groups: w.groups, outcome: "deleted" });
      default:
        return undefined;
    }
  }

  private events(action: string, body: Record<string, unknown>): Answer | undefined {
    const w = this.world;
    const list = () => ({ events: w.events });
    if (action === "list") return ok(list());
    if (action === "suggest") return this.suggest(body);
    if (action === "rank-dates") {
      // As the real one: a score per date, 100 for any nobody's shared anything about.
      const dates = body.dates as { start: string }[];
      return ok({
        scores: dates.map((d) => w.dateScores[d.start] ?? 100),
        counted: Object.keys(w.dateScores).length > 0 ? 2 : 0,
      });
    }
    const event = w.events.find((e) => e.id === body.proposalId);
    if (!event) return fail(404, "Event not found");
    const me = event.invitees.find((i) => i.isYou);

    switch (action) {
      case "answer": {
        const date = event.candidates.find((c) => c.id === body.dateId);
        if (!date || !me) return fail(400, "Unknown date");
        date.answers[ME.id] = body.response as EventResponse;
        this.changed();
        return ok({ ...list(), outcome: this.decideVote(event) });
      }
      case "leave":
        w.events = w.events.filter((e) => e !== event);
        this.changed();
        return ok(list());
      case "edit": {
        if (!event.createdBy.isYou)
          return fail(403, "Only the person who suggested this event can change it.");
        const detail = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : null);
        event.place = detail(body.place);
        event.note = detail(body.note);
        this.changed();
        return ok(list());
      }
      case "cancel":
        event.status = "cancelled";
        this.changed();
        return ok(list());
      case "deadline":
      case "settle": {
        // As the real ones (#179): the suggester's open vote only.
        if (!event.createdBy.isYou)
          return fail(403, "Only the person who suggested this event can change its deadline.");
        if (event.status !== "pending")
          return fail(409, "That event is no longer waiting for answers.");
        event.answerBy = action === "settle" ? NOW : answerBy(body.answerDays);
        if (action === "settle") this.decideVote(event, true);
        this.changed();
        return ok(list());
      }
      case "choose": {
        const date = event.candidates.find((c) => c.id === body.dateId);
        if (!date) return fail(400, "Unknown date");
        this.schedule(event, date.id);
        this.changed();
        return ok(list());
      }
      case "add-to-calendar":
        event.myCalendar = { state: "added" };
        this.changed();
        return ok(list());
      case "ics":
        return ok({
          filename: "casy.ics",
          ics: "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nEND:VCALENDAR\r\n",
        });
      default:
        return undefined;
    }
  }

  /** A new vote, as the scheduler's "Suggest dates" sends it. */
  private suggest(body: Record<string, unknown>): Answer {
    const w = this.world;
    const group = w.groups.find((g) => g.id === body.groupId);
    if (!group) return fail(404, "Group not found");
    const dates = body.dates as { start: string; end: string; answer?: "accepted" | "maybe" }[];
    const id = `ev-new-${w.events.length}`;
    w.events.push({
      id,
      group: { id: group.id, name: group.name },
      title: String(body.title),
      place: typeof body.place === "string" && body.place.trim() ? body.place.trim() : null,
      note: typeof body.note === "string" && body.note.trim() ? body.note.trim() : null,
      impact: (body.impact as SuggestedEvent["impact"]) ?? null,
      settings: body.settings as SuggestedEvent["settings"],
      status: "pending",
      mode: "vote",
      answerBy: answerBy(body.answerDays),
      createdBy: { id: ME.id, name: w.name, isYou: true },
      createdAt: NOW,
      updatedAt: NOW,
      currentDate: null,
      invitees: group.members.map((m) => ({ ...m, response: null })),
      declinedDates: [],
      // The suggester's own answers, given before sending on a phone (#101).
      candidates: dates.map(({ answer, ...d }, i) => ({
        id: `${id}-d${i}`,
        ...d,
        // Scored only when someone has shared something (#119).
        matchScore: w.dateScores[d.start] ?? null,
        answers: answer ? { [ME.id]: answer } : {},
      })),
      myCalendar: null,
    });
    if (dates.some((d) => d.answer)) this.decideVote(w.events[w.events.length - 1]);
    this.changed();
    return ok({ events: w.events, createdId: id });
  }

  /**
   * The database's decide_vote, simplified: once everyone has answered every
   * date, the date nobody declined with the fewest "rather not" wins (the
   * earliest on a tie); if every date has a no, the suggester chooses.
   */
  private decideVote(event: SuggestedEvent, force = false): "answered" | "scheduled" | "undecided" {
    const everyone = event.invitees.map((i) => i.profileId);
    const upcoming = event.candidates.filter((c) => c.start > NOW);
    const done =
      force || upcoming.every((c) => everyone.every((id) => c.answers[id] !== undefined));
    if (!done) return "answered";
    const maybes = (c: (typeof upcoming)[number]) =>
      Object.values(c.answers).filter((a) => a === "maybe").length;
    const best = upcoming
      .filter((c) => !Object.values(c.answers).includes("declined"))
      .sort((a, b) => maybes(a) - maybes(b) || a.start.localeCompare(b.start))[0];
    if (!best) return "undecided";
    this.schedule(event, best.id);
    return "scheduled";
  }

  private schedule(event: SuggestedEvent, dateId: string) {
    const date = event.candidates.find((c) => c.id === dateId);
    if (!date) return;
    event.status = "scheduled";
    event.currentDate = { id: date.id, start: date.start, end: date.end };
    for (const i of event.invitees) i.response = date.answers[i.profileId] ?? null;
  }
}
