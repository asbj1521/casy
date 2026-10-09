/**
 * A stand-in for Casy's Edge Functions: each function and action answered
 * from the made-up world (world.ts), the way the real one answers. Actions
 * that change something change the world, so the next list shows it, as on
 * the live site. Anything it doesn't know is reported, and fails the test
 * (fixtures.ts), rather than quietly answering nothing.
 */
import type { EventResponse, SuggestedEvent } from "@/api/events";
import type { PlanAnswer } from "@/api/planAi";
import type { AiPlan } from "@/lib/aiPlan";
import { groupBusy, ME, myData, myOverview, NOW, type World } from "./world";

export interface FunctionCall {
  name: string;
  params: URLSearchParams;
  body: Record<string, unknown>;
}

export type Answer = { status: number; json: unknown };

const ok = (json: unknown): Answer => ({ status: 200, json });
const fail = (status: number, error: string): Answer => ({ status, json: { error } });

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
      case "calendar-set-purpose":
        return ok({});
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
      case "oauth-google-start":
      case "oauth-outlook-start":
        return ok({ url: `https://consent.test/${name}` });
      case "account":
        if (action === "data") return ok(myData(w));
        if (action === "export") return ok({ ...myData(w), busyTimes: [] });
        if (action === "delete") return ok({});
        return undefined;
      case "admin":
        if (action === "status") return ok({ isAdmin: false });
        return undefined;
      case "plan-ai":
        return this.planAi(body);
      default:
        return undefined;
    }
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
        return ok({ name: w.name });
      case "set-name":
        w.name = String(body.name);
        return ok({ name: w.name });
      case "rename":
        if (!group) return fail(404, "Group not found");
        group.name = String(body.name);
        this.changed();
        return ok({ groups: w.groups });
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
      case "respond": {
        if (!event.currentDate || !me)
          return fail(409, "That event is no longer waiting for answers.");
        if (body.response === "accepted") {
          me.response = "accepted";
          if (event.invitees.every((i) => i.response === "accepted")) event.status = "scheduled";
        } else {
          event.declinedDates.push({ ...event.currentDate, declinedBy: ME.name });
          const next = body.next as { start: string; end: string } | null;
          event.currentDate = next ? { id: `${event.id}-next`, ...next } : null;
          if (!next) event.status = "no_date";
          for (const i of event.invitees) i.response = null;
        }
        this.changed();
        return ok({ ...list(), outcome: event.status === "scheduled" ? "scheduled" : "answered" });
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
      settings: body.settings as SuggestedEvent["settings"],
      status: "pending",
      mode: "vote",
      answerBy: "2026-10-10T08:00:00.000Z",
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
  private decideVote(event: SuggestedEvent): "answered" | "scheduled" | "undecided" {
    const everyone = event.invitees.map((i) => i.profileId);
    const upcoming = event.candidates.filter((c) => c.start > NOW);
    const done = upcoming.every((c) => everyone.every((id) => c.answers[id] !== undefined));
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
