// Run with: deno test --node-modules-dir=none supabase/functions/_shared/
//
// Fixtures copy the *shape* of real iCloud responses (single-quoted
// attributes, an xmlns on nearly every element, subscribed calendars, the
// account root, inbox and reminder lists) with made-up names and ids.
import { assert, assertEquals, assertRejects, assertThrows } from "jsr:@std/assert@1";
import {
  assertIcloudUrl,
  CalDavError,
  CalDavLoginError,
  deleteEvent,
  discoverCalendars,
  fetchEventDocuments,
  mapPool,
  parseMultistatus,
  pickEventCalendars,
  putEvent,
} from "./caldav.ts";

const CREDS = { username: "me@example.com", password: "abcd-efgh-ijkl-mnop" };
const HOME = new URL("https://p48-caldav.icloud.com/111/calendars/");

const wrap = (responses: string) =>
  `<?xml version='1.0' encoding='UTF-8'?><multistatus xmlns="DAV:">${responses}</multistatus>`;

const collection = (href: string, name: string | null, type: string, comps: string[]) => `
  <response><href>${href}</href><propstat><prop>
    ${name === null ? "" : `<displayname xmlns="DAV:">${name}</displayname>`}
    <resourcetype xmlns="DAV:"><collection/>${type}</resourcetype>
    <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav">${comps
      .map((c) => `<comp name='${c}' xmlns='urn:ietf:params:xml:ns:caldav'/>`)
      .join("")}</supported-calendar-component-set>
  </prop><status>HTTP/1.1 200 OK</status></propstat></response>`;

const CAL = `<calendar xmlns="urn:ietf:params:xml:ns:caldav"/>`;
const SUBSCRIBED = `<subscribed xmlns="http://calendarserver.org/ns/"/>`;

const LISTING = wrap(
  [
    collection("/111/calendars/", "Account root", "", ["VEVENT", "VTODO"]),
    collection("/111/calendars/AAAA-1111/", "Work", CAL, ["VEVENT"]),
    collection("/111/calendars/BBBB-2222/", "Family & friends", CAL, ["VEVENT"]),
    collection("/111/calendars/CCCC-3333/", "University feed", SUBSCRIBED, ["VEVENT"]),
    collection("/111/calendars/DDDD-4444/", "Reminders", CAL, ["VTODO"]),
    collection(
      "/111/calendars/inbox/",
      null,
      `<schedule-inbox xmlns="urn:ietf:params:xml:ns:caldav"/>`,
      ["VEVENT"],
    ),
    collection(
      "/111/calendars/outbox/",
      null,
      `<schedule-outbox xmlns="urn:ietf:params:xml:ns:caldav"/>`,
      ["VEVENT"],
    ),
    collection(
      "/111/notification/",
      null,
      `<notification xmlns="http://calendarserver.org/ns/"/>`,
      [],
    ),
  ].join(""),
);

Deno.test("only real and subscribed event calendars are picked", () => {
  const found = pickEventCalendars(parseMultistatus(LISTING), HOME);
  assertEquals(
    found.map((c) => [c.id, c.name]),
    [
      ["AAAA-1111", "Work"],
      ["BBBB-2222", "Family & friends"], // entities decoded
      ["CCCC-3333", "University feed"], // subscribed calendars are included
    ],
  );
  assert(found[0].url.startsWith("https://p48-caldav.icloud.com/111/calendars/AAAA-1111"));
});

Deno.test("a subscription carries its feed's address; own calendars carry none", () => {
  const xml = wrap(`
    <response><href>/111/calendars/CCCC-3333/</href><propstat><prop>
      <displayname xmlns="DAV:">School</displayname>
      <resourcetype xmlns="DAV:"><collection/>${SUBSCRIBED}</resourcetype>
      <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name='VEVENT'/></supported-calendar-component-set>
      <source xmlns="http://calendarserver.org/ns/"><href xmlns="DAV:">webcal://school.example.com/feed.ics?k=1&amp;x=2</href></source>
    </prop><status>HTTP/1.1 200 OK</status></propstat></response>
    ${collection("/111/calendars/AAAA-1111/", "Work", CAL, ["VEVENT"])}`);
  const [school, work] = pickEventCalendars(parseMultistatus(xml), HOME);
  assertEquals(school.feedUrl, "webcal://school.example.com/feed.ics?k=1&x=2");
  assertEquals(work.feedUrl, null);
});

Deno.test("a subscription whose address iCloud doesn't give has no feed", () => {
  const found = pickEventCalendars(parseMultistatus(LISTING), HOME);
  assertEquals(found.find((c) => c.id === "CCCC-3333")!.feedUrl, null);
});

Deno.test("a calendar that doesn't list what it holds is kept (a shared calendar)", () => {
  // Shaped like a calendar shared into the account: the component set is
  // answered 404 rather than listed.
  const xml = wrap(`
    <response><href>/111/calendars/FFFF-6666/</href>
      <propstat><prop>
        <displayname xmlns="DAV:">Family</displayname>
        <resourcetype xmlns="DAV:"><collection/>${CAL}<shared xmlns="http://calendarserver.org/ns/"/></resourcetype>
      </prop><status>HTTP/1.1 200 OK</status></propstat>
      <propstat><prop><supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"/></prop><status>HTTP/1.1 404 Not Found</status></propstat>
    </response>
    ${collection("/111/calendars/DDDD-4444/", "Reminders", CAL, ["VTODO"])}`);
  assertEquals(
    pickEventCalendars(parseMultistatus(xml), HOME).map((c) => c.name),
    ["Family"],
  );
});

/** A calendar collection that also answers which privileges we hold on it. */
const withPrivileges = (href: string, type: string, privileges: string[] | null) =>
  wrap(`
  <response><href>${href}</href><propstat><prop>
    <displayname xmlns="DAV:">Shared</displayname>
    <resourcetype xmlns="DAV:"><collection/>${type}</resourcetype>
    <supported-calendar-component-set xmlns="urn:ietf:params:xml:ns:caldav"><comp name='VEVENT'/></supported-calendar-component-set>
    ${
      privileges === null
        ? ""
        : `<current-user-privilege-set xmlns="DAV:">${privileges
            .map((p) => `<privilege><${p}/></privilege>`)
            .join("")}</current-user-privilege-set>`
    }
  </prop><status>HTTP/1.1 200 OK</status></propstat></response>`);

Deno.test("an own calendar we may write to is writable", () => {
  const xml = withPrivileges("/111/calendars/AAAA-1111/", CAL, ["read", "write", "read-acl"]);
  assertEquals(pickEventCalendars(parseMultistatus(xml), HOME)[0].writable, true);
});

Deno.test("bind alone is enough to add events; all counts too", () => {
  for (const privilege of ["bind", "all"]) {
    const xml = withPrivileges("/111/calendars/AAAA-1111/", CAL, ["read", privilege]);
    assertEquals(pickEventCalendars(parseMultistatus(xml), HOME)[0].writable, true, privilege);
  }
});

Deno.test("a calendar shared view-only is not writable", () => {
  for (const privileges of [["read"], ["read", "read-current-user-privilege-set"], []]) {
    const xml = withPrivileges("/111/calendars/AAAA-1111/", CAL, privileges);
    assertEquals(
      pickEventCalendars(parseMultistatus(xml), HOME)[0].writable,
      false,
      privileges.join(),
    );
  }
});

Deno.test("a subscribed calendar is never writable, whatever it claims", () => {
  const xml = withPrivileges("/111/calendars/CCCC-3333/", SUBSCRIBED, ["read", "write"]);
  assertEquals(pickEventCalendars(parseMultistatus(xml), HOME)[0].writable, false);
});

Deno.test("an own calendar with no privilege answer is taken as writable", () => {
  const xml = withPrivileges("/111/calendars/AAAA-1111/", CAL, null);
  assertEquals(pickEventCalendars(parseMultistatus(xml), HOME)[0].writable, true);
});

Deno.test("a calendar without a name comes back with a null name", () => {
  const xml = wrap(collection("/111/calendars/EEEE-5555/", null, CAL, ["VEVENT"]));
  assertEquals(pickEventCalendars(parseMultistatus(xml), HOME)[0].name, null);
});

Deno.test("properties the server could not read (404) are ignored", () => {
  const xml = wrap(`<response><href>/x/</href>
    <propstat><prop><displayname>Good</displayname></prop><status>HTTP/1.1 200 OK</status></propstat>
    <propstat><prop><getetag>nope</getetag></prop><status>HTTP/1.1 404 Not Found</status></propstat>
  </response>`);
  const [r] = parseMultistatus(xml);
  assertEquals(r.prop["displayname"], "Good");
  assert(!("getetag" in r.prop));
});

Deno.test("garbage instead of XML is a friendly error", () => {
  assertThrows(() => parseMultistatus("<not closed"), CalDavError);
});

Deno.test("only https icloud.com URLs are accepted", () => {
  assertIcloudUrl("https://caldav.icloud.com/");
  assertIcloudUrl("https://p48-caldav.icloud.com:443/1/calendars/");
  for (const bad of [
    "http://caldav.icloud.com/",
    "https://evil.com/",
    "https://icloud.com.evil.com/",
    "https://evilicloud.com/",
    "https://user:pw@caldav.icloud.com/",
    "https://caldav.icloud.com:8443/",
    "not a url",
  ]) {
    assertThrows(() => assertIcloudUrl(bad), CalDavError, undefined, bad);
  }
});

/* ---- Discovery and event fetching against a stubbed network ---- */

type Handler = (req: Request) => Response | Promise<Response>;

async function withFetch(handler: Handler, body: () => Promise<void>) {
  const real = globalThis.fetch;
  globalThis.fetch = ((input: string | URL | Request, init?: RequestInit) =>
    Promise.resolve(handler(new Request(input, init)))) as typeof fetch;
  try {
    await body();
  } finally {
    globalThis.fetch = real;
  }
}

const xmlResponse = (body: string, status = 207) => new Response(body, { status });

const principalXml = wrap(
  `<response><href>/</href><propstat><prop><current-user-principal><href>/111/principal/</href></current-user-principal></prop><status>HTTP/1.1 200 OK</status></propstat></response>`,
);
const homeXml = (href: string) =>
  wrap(
    `<response><href>/111/principal/</href><propstat><prop><calendar-home-set xmlns="urn:ietf:params:xml:ns:caldav"><href xmlns="DAV:">${href}</href></calendar-home-set></prop><status>HTTP/1.1 200 OK</status></propstat></response>`,
  );

function icloud(homeHref = "https://p48-caldav.icloud.com:443/111/calendars/"): Handler {
  return (req) => {
    const url = new URL(req.url);
    if (url.host === "caldav.icloud.com" && url.pathname === "/") return xmlResponse(principalXml);
    if (url.pathname === "/111/principal/") return xmlResponse(homeXml(homeHref));
    if (url.pathname === "/111/calendars/") return xmlResponse(LISTING);
    return new Response("unexpected " + req.url, { status: 500 });
  };
}

Deno.test("discovery walks principal -> home -> calendars", async () => {
  await withFetch(icloud(), async () => {
    const cals = await discoverCalendars(CREDS);
    assertEquals(
      cals.map((c) => c.name),
      ["Work", "Family & friends", "University feed"],
    );
  });
});

Deno.test("the calendar listing asks for each subscription's feed address", async () => {
  let listingBody = "";
  await withFetch(
    async (req) => {
      if (new URL(req.url).pathname === "/111/calendars/") listingBody = await req.text();
      return icloud()(req);
    },
    () => discoverCalendars(CREDS).then(() => {}),
  );
  assert(listingBody.includes("<cs:source/>"));
  assert(listingBody.includes('xmlns:cs="http://calendarserver.org/ns/"'));
});

Deno.test("the login is sent as HTTP Basic, and only to icloud hosts", async () => {
  const seen: { host: string; auth: string | null }[] = [];
  await withFetch(
    (req) => {
      seen.push({ host: new URL(req.url).host, auth: req.headers.get("authorization") });
      return icloud()(req);
    },
    async () => {
      await discoverCalendars(CREDS);
    },
  );
  const expected = "Basic " + btoa("me@example.com:abcd-efgh-ijkl-mnop");
  assert(seen.length === 3);
  for (const s of seen) {
    assertEquals(s.auth, expected);
    assert(s.host.endsWith("icloud.com"));
  }
});

Deno.test("a wrong password gives the friendly login error", async () => {
  await withFetch(
    () => new Response("", { status: 401 }),
    async () => {
      await assertRejects(() => discoverCalendars(CREDS), CalDavError, "app-specific password");
    },
  );
});

Deno.test(
  "a calendar home on another host is refused, and the password never goes there",
  async () => {
    const hosts: string[] = [];
    await withFetch(
      (req) => {
        hosts.push(new URL(req.url).host);
        return icloud("https://evil.example.com/111/calendars/")(req);
      },
      async () => {
        await assertRejects(() => discoverCalendars(CREDS), CalDavError, "unexpected server");
      },
    );
    assert(!hosts.includes("evil.example.com"));
  },
);

Deno.test("a redirect to another host is refused", async () => {
  const hosts: string[] = [];
  await withFetch(
    (req) => {
      hosts.push(new URL(req.url).host);
      return new Response(null, {
        status: 302,
        headers: { location: "https://evil.example.com/" },
      });
    },
    async () => {
      await assertRejects(() => discoverCalendars(CREDS), CalDavError, "unexpected server");
    },
  );
  assertEquals(hosts, ["caldav.icloud.com"]);
});

Deno.test("a redirect within icloud.com is followed", async () => {
  let hops = 0;
  await withFetch(
    (req) => {
      const url = new URL(req.url);
      // The very first request is bounced to another iCloud host, which then
      // answers as the account root would have.
      if (url.host === "caldav.icloud.com" && url.pathname === "/" && hops++ === 0) {
        return new Response(null, {
          status: 301,
          headers: { location: "https://p48-caldav.icloud.com/" },
        });
      }
      if (url.host === "p48-caldav.icloud.com" && url.pathname === "/")
        return xmlResponse(principalXml);
      return icloud()(req);
    },
    async () => {
      const cals = await discoverCalendars(CREDS);
      assertEquals(cals.length, 3);
    },
  );
});

Deno.test("event documents are pulled out, entities decoded, empty ones dropped", async () => {
  const ics =
    "BEGIN:VCALENDAR\r\nVERSION:2.0\r\nBEGIN:VEVENT\r\nUID:1\r\nDTSTART:20261001T100000Z\r\nDTEND:20261001T110000Z\r\nEND:VEVENT\r\nEND:VCALENDAR";
  const xml = wrap(`
    <response><href>/a.ics</href><propstat><prop><calendar-data xmlns="urn:ietf:params:xml:ns:caldav">${ics}</calendar-data></prop><status>HTTP/1.1 200 OK</status></propstat></response>
    <response><href>/b.ics</href><propstat><prop><getetag>x</getetag></prop><status>HTTP/1.1 200 OK</status></propstat></response>`);

  let requestBody = "";
  await withFetch(
    async (req) => {
      requestBody = await req.text();
      return xmlResponse(xml);
    },
    async () => {
      const docs = await fetchEventDocuments(
        CREDS,
        "https://p48-caldav.icloud.com/111/calendars/AAAA-1111/",
        new Date("2026-09-19T00:00:00Z"),
        new Date("2027-09-19T00:00:00Z"),
      );
      assertEquals(docs.length, 1);
      assert(docs[0].includes("UID:1"));
    },
  );
  // The request asks for timing properties only, and uses CalDAV's time format.
  assert(requestBody.includes('start="20260919T000000Z"'));
  assert(requestBody.includes('<c:prop name="DTSTART"/>'));
  for (const forbidden of ["SUMMARY", "DESCRIPTION", "LOCATION", "ATTENDEE"]) {
    assert(!requestBody.includes(forbidden), `request must not ask for ${forbidden}`);
  }
});

Deno.test("mapPool keeps order and respects the concurrency limit", async () => {
  let running = 0;
  let peak = 0;
  const out = await mapPool([1, 2, 3, 4, 5, 6, 7], 3, async (n) => {
    running++;
    peak = Math.max(peak, running);
    await new Promise((r) => setTimeout(r, 5 * (8 - n)));
    running--;
    return n * 10;
  });
  assertEquals(out, [10, 20, 30, 40, 50, 60, 70]);
  assert(peak <= 3, `peak concurrency was ${peak}`);
});

/* ---- Writing to the primary calendar ---- */

const CALENDAR_URL = "https://p48-caldav.icloud.com/111/calendars/AAAA-1111/";

Deno.test("an event is PUT once, never overwriting, as text/calendar", async () => {
  const seen: Request[] = [];
  await withFetch(
    (req) => {
      seen.push(req);
      return new Response(null, { status: 201 });
    },
    async () => {
      await putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n");
    },
  );
  assertEquals(seen.length, 1);
  assertEquals(seen[0].method, "PUT");
  assertEquals(seen[0].url, CALENDAR_URL + "casy-abc.ics");
  assertEquals(seen[0].headers.get("if-none-match"), "*");
  assert(seen[0].headers.get("content-type")?.startsWith("text/calendar"));
});

Deno.test("a changed event replaces the entry only if it is still there", async () => {
  const seen: Request[] = [];
  await withFetch(
    (req) => {
      seen.push(req);
      return new Response(null, { status: 204 });
    },
    () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x", { replace: true }),
  );
  assertEquals(seen[0].headers.get("if-match"), "*");
  assertEquals(seen[0].headers.get("if-none-match"), null);
  // Deleted by hand meanwhile: 412, and it isn't put back.
  await withFetch(
    () => new Response(null, { status: 412 }),
    () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x", { replace: true }),
  );
});

Deno.test("a calendar URL without a trailing slash still gets the file inside it", async () => {
  let url = "";
  await withFetch(
    (req) => {
      url = req.url;
      return new Response(null, { status: 201 });
    },
    () => putEvent(CREDS, CALENDAR_URL.slice(0, -1), "casy-abc.ics", "x"),
  );
  assertEquals(url, CALENDAR_URL + "casy-abc.ics");
});

Deno.test("an event that is already there counts as added (a retry)", async () => {
  await withFetch(
    () => new Response(null, { status: 412 }),
    () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x"),
  );
});

Deno.test("a refused write is a plain error, not a wrong password", async () => {
  await withFetch(
    () => new Response(null, { status: 403 }),
    async () => {
      const err = await assertRejects(
        () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x"),
        CalDavError,
      );
      assert(!(err instanceof CalDavLoginError));
    },
  );
});

Deno.test("a refused password on a write asks for reconnecting", async () => {
  await withFetch(
    () => new Response(null, { status: 401 }),
    async () => {
      await assertRejects(
        () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x"),
        CalDavLoginError,
      );
    },
  );
});

Deno.test("a write never follows a redirect off icloud.com", async () => {
  const hosts: string[] = [];
  await withFetch(
    (req) => {
      hosts.push(new URL(req.url).host);
      return new Response(null, {
        status: 307,
        headers: { location: "https://evil.example.com/x.ics" },
      });
    },
    async () => {
      await assertRejects(
        () => putEvent(CREDS, CALENDAR_URL, "casy-abc.ics", "x"),
        CalDavError,
        "unexpected server",
      );
    },
  );
  assertEquals(hosts, ["p48-caldav.icloud.com"]);
});

Deno.test("deleting an event that is already gone counts as done", async () => {
  for (const status of [204, 404, 410]) {
    await withFetch(
      () => new Response(null, { status }),
      () => deleteEvent(CREDS, CALENDAR_URL, "casy-abc.ics"),
    );
  }
});

Deno.test("a delete that fails for another reason says so", async () => {
  await withFetch(
    () => new Response(null, { status: 500 }),
    async () => {
      await assertRejects(
        () => deleteEvent(CREDS, CALENDAR_URL, "casy-abc.ics"),
        CalDavError,
        "HTTP 500",
      );
    },
  );
});
