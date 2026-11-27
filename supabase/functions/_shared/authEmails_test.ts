import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";

import { emailLang, emailLinkUrl, renderAuthEmails, type EmailData } from "./authEmails.ts";

const SITES = ["https://casy.app", "http://localhost:8080"];
const user = { id: "u1", email: "anna@example.com" };
const back = (lang?: string) =>
  `https://casy.app/sign-in?${lang ? `lang=${lang}&` : ""}next=%2Fjoin%2Fabc`;
const data = (type: string, more: Partial<EmailData> = {}): EmailData => ({
  email_action_type: type,
  token: "123456",
  token_hash: "hash-abc",
  redirect_to: back("da"),
  site_url: "https://casy.app",
  ...more,
});

/** Every kind of email Auth can ask for. */
const TYPES = [
  "signup",
  "magiclink",
  "recovery",
  "reauthentication",
  "email_change",
  "password_changed_notification",
  "email_changed_notification",
  "identity_linked_notification",
  "identity_unlinked_notification",
  "mfa_factor_enrolled_notification",
  "mfa_factor_unenrolled_notification",
  "phone_changed_notification",
  "invite",
  "email",
];

Deno.test("language: the page's, then the account's, then Danish", () => {
  assertEquals(emailLang(user, data("magiclink", { redirect_to: back("en") })), "en");
  assertEquals(emailLang(user, data("magiclink", { redirect_to: back("da") })), "da");
  const savedEn = { ...user, user_metadata: { lang: "en" } };
  assertEquals(emailLang(savedEn, data("reauthentication", { redirect_to: undefined })), "en");
  assertEquals(emailLang(savedEn, data("magiclink", { redirect_to: back() })), "en");
  // The page wins over the account: whoever asked was reading Danish.
  assertEquals(emailLang(savedEn, data("magiclink", { redirect_to: back("da") })), "da");
  assertEquals(emailLang(user, data("magiclink", { redirect_to: back() })), "da");
  assertEquals(emailLang(user, data("magiclink", { redirect_to: back("fr") })), "da");
  assertEquals(emailLang(user, data("magiclink", { redirect_to: "not a url" })), "da");
});

Deno.test("the link goes straight to our sign-in page with the token's hash (#202)", () => {
  const link = new URL(emailLinkUrl("hash-abc", "magiclink", back("da"), SITES));
  assertEquals(link.origin + link.pathname, "https://casy.app/sign-in");
  assertEquals(link.searchParams.get("token_hash"), "hash-abc");
  assertEquals(link.searchParams.get("type"), "magiclink");
  // What the page asked to come back with is kept: its language, where to go next.
  assertEquals(link.searchParams.get("lang"), "da");
  assertEquals(link.searchParams.get("next"), "/join/abc");
  const [email] = renderAuthEmails(user, data("magiclink"), SITES);
  assertStringIncludes(email.text, link.toString());
});

Deno.test("the link stays on our own sites, on the sign-in page", () => {
  // Another site never gets the hash: it signs whoever holds it in.
  const elsewhere = new URL(
    emailLinkUrl("h", "recovery", "https://evil.example/sign-in?lang=en", SITES),
  );
  assertEquals(elsewhere.origin, "https://casy.app");
  assertEquals(elsewhere.searchParams.get("lang"), null);
  assertEquals(new URL(emailLinkUrl("h", "signup", "not a url", SITES)).origin, "https://casy.app");
  // An allowed site keeps its own address (a test on localhost), always on /sign-in.
  const local = new URL(emailLinkUrl("h", "signup", "http://localhost:8080/?lang=en", SITES));
  assertEquals(local.origin + local.pathname, "http://localhost:8080/sign-in");
  assertEquals(local.searchParams.get("lang"), "en");
});

Deno.test("signs in in Danish or English, subject included", () => {
  const [da] = renderAuthEmails(user, data("magiclink"), SITES);
  assertEquals(da.to, "anna@example.com");
  assertEquals(da.subject, "Dit login-link");
  assertStringIncludes(da.html, '<html lang="da">');
  assertStringIncludes(da.html, "Log ind");

  const [en] = renderAuthEmails(user, data("magiclink", { redirect_to: back("en") }), SITES);
  assertEquals(en.subject, "Your sign-in link");
  assertStringIncludes(en.html, '<html lang="en">');
});

Deno.test("the security code shows the code and no link", () => {
  const [email] = renderAuthEmails(
    user,
    data("reauthentication", { redirect_to: undefined }),
    SITES,
  );
  assertEquals(email.subject, "Din sikkerhedskode");
  assertStringIncludes(email.html, "123456");
  assertFalse(email.html.includes("token_hash="));
});

Deno.test("a notice names the account and has no link or code", () => {
  const [email] = renderAuthEmails(
    { ...user, user_metadata: { lang: "en" } },
    data("password_changed_notification", { redirect_to: undefined }),
    SITES,
  );
  assertEquals(email.subject, "Your password was changed");
  assertStringIncludes(email.text, "(anna@example.com)");
  assertFalse(email.html.includes("123456"));
  assertFalse(email.html.includes("token_hash="));
});

Deno.test("a secure email change sends one link to each address, Auth's way round", () => {
  const emails = renderAuthEmails(
    { ...user, new_email: "anna@new.example" },
    data("email_change", { token_hash: "to-new", token_hash_new: "to-current" }),
    SITES,
  );
  assertEquals(
    emails.map((e) => [
      e.to,
      e.text.includes("token_hash=to-current"),
      e.text.includes("token_hash=to-new"),
    ]),
    [
      ["anna@example.com", true, false],
      ["anna@new.example", false, true],
    ],
  );
});

Deno.test("an unknown kind still sends something, with its link", () => {
  const [email] = renderAuthEmails(user, data("something_new"), SITES);
  assertEquals(email.subject, "En besked fra os");
  assertStringIncludes(email.text, "token_hash=hash-abc");
});

Deno.test("no address, no email (and the hook reports a failure)", () => {
  assertEquals(renderAuthEmails({ id: "u1" }, data("magiclink"), SITES), []);
});

Deno.test("what people typed or Auth sent is escaped in the HTML", () => {
  const [email] = renderAuthEmails(
    { ...user, email: 'x"><script>alert(1)</script>@example.com' },
    data("password_changed_notification"),
    SITES,
  );
  assertFalse(email.html.includes("<script>"));
  assertStringIncludes(email.html, "&lt;script&gt;");
});

Deno.test("every kind, in both languages: complete, and no emojis or long dashes", () => {
  for (const type of TYPES) {
    for (const lang of ["da", "en"]) {
      const emails = renderAuthEmails(
        { ...user, new_email: "anna@new.example" },
        data(type, { redirect_to: back(lang), token_hash_new: "hash-new" }),
        SITES,
      );
      assert(emails.length > 0, `${type} ${lang} sends nothing`);
      for (const e of emails) {
        const all = `${e.subject}\n${e.html}\n${e.text}`;
        assert(e.subject.length > 0, `${type} ${lang} has no subject`);
        assertStringIncludes(e.html, `<html lang="${lang}">`);
        assertFalse(/[–—]/.test(all), `${type} ${lang} has a long dash`);
        assertFalse(/\p{Extended_Pictographic}/u.test(all), `${type} ${lang} has an emoji`);
        assertFalse(all.includes("{{"), `${type} ${lang} has a template left in`);
        assertFalse(/iCloud/.test(all), `${type} ${lang} says iCloud`);
      }
    }
  }
});
