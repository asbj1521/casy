/**
 * Rebuild the App Review demo world (#142) on the live project: three
 * made-up accounts (plan.ts), each with a sample calendar link, one group,
 * one vote waiting for the reviewer and one event already agreed. Run by the
 * owner before each submission, since reviewers delete accounts, vote and
 * leave groups, and every update is reviewed again:
 *
 *   read -rsp "Alex's password: " REVIEW_PASSWORD && echo && export REVIEW_PASSWORD && npm run review-demo -- owner@gmail.com
 *
 * The emails are plus-aliases of the given address (demoEmail), so anything
 * Casy sends them reaches the owner. Only Alex's password is kept (it goes in
 * App Store Connect, never in this repo); Sara's and Jonas's are random and
 * thrown away. The feeds must already be live on casy.app (public/review/).
 *
 * It goes through the same Edge Functions the app calls, signed in as each
 * person, so the demo is made the way a real one would be. The Auth admin
 * API (service role key, from .env.local) only creates the accounts, and
 * resets an earlier demo account's password so it can delete itself through
 * `account`; the AI switch is the one row written directly, as admin mode's
 * setAiAccess does. Nothing is touched but accounts whose email is exactly
 * one of the three demo addresses.
 */
import {
  AGREED,
  agreedDate,
  demoEmail,
  feedUrl,
  GROUP,
  PEOPLE,
  type PersonKey,
  VOTE,
  voteDates,
} from "./plan.ts";

const MISSING_KEY =
  "This action requires a key that isn't in your `.env.local`. You may not have access to this part of the project. Reach out to the project owner to get the correct credentials.";

interface Env {
  url: string;
  anonKey: string;
  serviceKey: string;
}

interface Person {
  key: PersonKey;
  name: string;
  email: string;
  password: string;
  id?: string;
  token?: string;
}

class DemoError extends Error {}

async function readEnv(): Promise<Env> {
  const text = await Deno.readTextFile(new URL("../../.env.local", import.meta.url)).catch(
    () => "",
  );
  const value = (name: string) => {
    const line = text.split("\n").find((l) => l.startsWith(`${name}=`));
    return (
      line
        ?.slice(name.length + 1)
        .trim()
        .replace(/^["']|["']$/g, "") ?? ""
    );
  };
  const env = {
    url: value("VITE_SUPABASE_URL").replace(/\/$/, ""),
    anonKey: value("VITE_SUPABASE_ANON_KEY"),
    serviceKey: value("SUPABASE_SERVICE_ROLE_KEY"),
  };
  if (!env.url || !env.anonKey || !env.serviceKey) throw new DemoError(MISSING_KEY);
  return env;
}

/** A password Supabase Auth takes (8+, letters and digits) and nobody needs to know. */
function randomPassword(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(18));
  return `${btoa(String.fromCharCode(...bytes)).replace(/[^A-Za-z0-9]/g, "")}a1`;
}

function checkReviewPassword(password: string | undefined): string {
  if (!password) {
    throw new DemoError(
      "REVIEW_PASSWORD is empty. Run the command from docs/app-store-listing.md, which asks for it, and type the password before pressing Enter.",
    );
  }
  if (password.length < 12 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
    throw new DemoError("REVIEW_PASSWORD needs 12 or more characters, with letters and digits.");
  }
  return password;
}

async function call<T>(res: Promise<Response>, what: string): Promise<T> {
  const r = await res;
  const text = await r.text();
  if (!r.ok) throw new DemoError(`${what} failed (HTTP ${r.status}): ${text.slice(0, 300)}`);
  return (text ? JSON.parse(text) : {}) as T;
}

function admin(env: Env) {
  const headers = {
    apikey: env.serviceKey,
    Authorization: `Bearer ${env.serviceKey}`,
    "Content-Type": "application/json",
  };
  return {
    /** The id of the account with exactly this email, if there is one. */
    async findUser(email: string): Promise<string | null> {
      for (let page = 1; page < 50; page++) {
        const { users } = await call<{ users: { id: string; email?: string }[] }>(
          fetch(`${env.url}/auth/v1/admin/users?page=${page}&per_page=200`, { headers }),
          "Listing accounts",
        );
        const found = users.find((u) => u.email?.toLowerCase() === email);
        if (found) return found.id;
        if (users.length < 200) return null;
      }
      return null;
    },
    setPassword: (id: string, password: string) =>
      call(
        fetch(`${env.url}/auth/v1/admin/users/${id}`, {
          method: "PUT",
          headers,
          body: JSON.stringify({ password }),
        }),
        "Resetting a demo password",
      ),
    createUser: (p: Person) =>
      call<{ id: string }>(
        fetch(`${env.url}/auth/v1/admin/users`, {
          method: "POST",
          headers,
          body: JSON.stringify({
            email: p.email,
            password: p.password,
            email_confirm: true,
            user_metadata: { full_name: p.name, lang: "en" },
          }),
        }),
        `Creating ${p.name}`,
      ),
    allowAi: (id: string) =>
      call(
        fetch(`${env.url}/rest/v1/ai_access`, {
          method: "POST",
          headers: { ...headers, Prefer: "resolution=merge-duplicates,return=minimal" },
          body: JSON.stringify({ profile_id: id }),
        }),
        "Switching AI on",
      ),
  };
}

async function signIn(env: Env, email: string, password: string): Promise<string> {
  const { access_token } = await call<{ access_token: string }>(
    fetch(`${env.url}/auth/v1/token?grant_type=password`, {
      method: "POST",
      headers: { apikey: env.anonKey, "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    }),
    `Signing in as ${email}`,
  );
  return access_token;
}

/** One Edge Function call, as the app makes it, signed in as `p`. */
function fn<T>(env: Env, p: Person, name: string, body: Record<string, unknown>): Promise<T> {
  return call<T>(
    fetch(`${env.url}/functions/v1/${name}`, {
      method: "POST",
      headers: {
        apikey: env.anonKey,
        Authorization: `Bearer ${p.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    }),
    `${p.name}: ${name} ${body.action ?? ""}`.trim(),
  );
}

interface EventsAnswer {
  createdId?: string;
  outcome?: string;
  events: {
    id: string;
    status: string;
    candidates: { id: string; start: string }[];
  }[];
}

async function main() {
  const ownerEmail = Deno.args[0];
  if (!ownerEmail) {
    throw new DemoError("Give your own email: npm run review-demo -- owner@gmail.com");
  }
  const reviewPassword = checkReviewPassword(Deno.env.get("REVIEW_PASSWORD"));
  const env = await readEnv();
  const auth = admin(env);

  const people: Record<PersonKey, Person> = {} as Record<PersonKey, Person>;
  for (const p of PEOPLE) {
    const email = demoEmail(ownerEmail, p.alias);
    if (!email) throw new DemoError(`"${ownerEmail}" isn't an email address.`);
    people[p.key] = {
      key: p.key,
      name: p.name,
      email,
      password: p.key === "alex" ? reviewPassword : randomPassword(),
    };
  }
  const { alex, sara, jonas } = people;

  // 1. The earlier demo, if any, deletes itself the way a person would.
  for (const p of Object.values(people)) {
    const id = await auth.findUser(p.email);
    if (!id) continue;
    await auth.setPassword(id, p.password);
    p.token = await signIn(env, p.email, p.password);
    await fn(env, p, "account", { action: "delete", confirm: true });
    console.log(`Deleted the earlier ${p.name} (${p.email})`);
  }

  // 2. Three confirmed accounts, each with its own sample calendar.
  for (const p of Object.values(people)) {
    p.id = (await auth.createUser(p)).id;
    p.token = await signIn(env, p.email, p.password);
    await fn(env, p, "groups", { action: "set-name", name: p.name });
    const ics = await fn<{ busyBlocks: number }>(env, p, "calendar-add-ics", {
      url: feedUrl(p.key),
    });
    console.log(`Made ${p.name} (${p.email}), calendar with ${ics.busyBlocks} busy blocks`);
  }

  // 3. Alex's group; Sara and Jonas join by its link.
  const group = await fn<{ createdId: string }>(env, alex, "groups", {
    action: "create",
    name: GROUP.name,
    description: GROUP.description,
  });
  const invite = await fn<{ url: string }>(env, alex, "groups", {
    action: "invite",
    groupId: group.createdId,
    app: true,
  });
  const token = invite.url.split("/join/")[1];
  if (!token) throw new DemoError(`The invite link looks wrong: ${invite.url}`);
  for (const p of [sara, jonas]) await fn(env, p, "groups", { action: "join", token });
  console.log(`Made the group "${GROUP.name}" with all three`);

  const now = Date.now();

  // 4. Sara's vote, with her own answers and no deadline; Jonas answers too,
  // so Alex (the reviewer) is the one it waits for.
  const vote = await fn<EventsAnswer>(env, sara, "events", {
    action: "suggest",
    groupId: group.createdId,
    title: VOTE.title,
    place: VOTE.place,
    settings: VOTE.settings,
    dates: voteDates(now).map((d) => ({ ...d, answer: "accepted" })),
    answerDays: null,
  });
  const voteEvent = vote.events.find((e) => e.id === vote.createdId);
  if (!voteEvent || voteEvent.candidates.length !== 3) {
    throw new DemoError("The vote came back without its three dates.");
  }
  const jonasAnswers = ["accepted", "maybe", "accepted"] as const;
  for (const [i, c] of voteEvent.candidates.entries()) {
    await fn(env, jonas, "events", {
      action: "answer",
      proposalId: voteEvent.id,
      dateId: c.id,
      response: jonasAnswers[i],
    });
  }
  console.log(`Sara suggested "${VOTE.title}"; it waits for Alex`);

  // 5. Jonas's brunch, accepted by everyone, so it is agreed.
  const brunch = await fn<EventsAnswer>(env, jonas, "events", {
    action: "suggest",
    groupId: group.createdId,
    title: AGREED.title,
    place: AGREED.place,
    settings: AGREED.settings,
    dates: [{ ...agreedDate(now), answer: "accepted" }],
    answerDays: null,
  });
  const brunchEvent = brunch.events.find((e) => e.id === brunch.createdId);
  const brunchDate = brunchEvent?.candidates[0];
  if (!brunchEvent || !brunchDate) throw new DemoError("The brunch came back without its date.");
  let outcome = "";
  for (const p of [alex, sara]) {
    const answer = await fn<EventsAnswer>(env, p, "events", {
      action: "answer",
      proposalId: brunchEvent.id,
      dateId: brunchDate.id,
      response: "accepted",
    });
    outcome = answer.outcome ?? "";
  }
  if (outcome !== "scheduled") {
    throw new DemoError(
      `The brunch should be agreed by now, but the last answer said "${outcome}".`,
    );
  }
  console.log(`"${AGREED.title}" is agreed for everyone`);

  // 6. The AI features for the reviewer.
  await auth.allowAi(alex.id!);
  console.log("AI is on for Alex");

  console.log(`\nDone. The reviewer signs in with ${alex.email} and REVIEW_PASSWORD.`);
}

if (import.meta.main) {
  try {
    await main();
  } catch (err) {
    console.error(err instanceof DemoError ? err.message : err);
    Deno.exit(1);
  }
}
