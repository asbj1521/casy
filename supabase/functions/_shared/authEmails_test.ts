import { assert, assertEquals, assertFalse, assertStringIncludes } from "jsr:@std/assert@1";

import { emailLang, renderAuthEmails, verifyUrl, type EmailData } from "./authEmails.ts";

const SUPABASE = "https://example.supabase.co";
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

Deno.test("the link is Auth's verify endpoint, like Supabase's own ConfirmationURL", () => {
  assertEquals(
    verifyUrl(SUPABASE, "hash-abc", "magiclink", back("da")),
    `${SUPABASE}/auth/v1/verify?token=hash-abc&type=magiclink&redirect_to=${encodeURIComponent(back("da"))}`,
  );
  const [email] = renderAuthEmails(user, data("magiclink"), SUPABASE);
  assertStringIncludes(email.text, verifyUrl(SUPABASE, "hash-abc", "magiclink", back("da")));
});

Deno.test("signs in in Danish or English, subject included", () => {
  const [da] = renderAuthEmails(user, data("magiclink"), SUPABASE);
  assertEquals(da.to, "anna@example.com");
  assertEquals(da.subject, "Dit login-link til Casy");
  assertStringIncludes(da.html, '<html lang="da">');
  assertStringIncludes(da.html, "Log ind på Casy");

  const [en] = renderAuthEmails(user, data("magiclink", { redirect_to: back("en") }), SUPABASE);
  assertEquals(en.subject, "Your Casy sign-in link");
  assertStringIncludes(en.html, '<html lang="en">');
});

Deno.test("the security code shows the code and no link", () => {
  const [email] = renderAuthEmails(
    user,
    data("reauthentication", { redirect_to: undefined }),
    SUPABASE,
  );
  assertEquals(email.subject, "Din sikkerhedskode til Casy");
  assertStringIncludes(email.html, "123456");
  assertFalse(email.html.includes("/auth/v1/verify"));
});

Deno.test("a notice names the account and has no link or code", () => {
  const [email] = renderAuthEmails(
    { ...user, user_metadata: { lang: "en" } },
    data("password_changed_notification", { redirect_to: undefined }),
    SUPABASE,
  );
  assertEquals(email.subject, "Your Casy password was changed");
  assertStringIncludes(email.text, "(anna@example.com)");
  assertFalse(email.html.includes("123456"));
  assertFalse(email.html.includes("/auth/v1/verify"));
});

Deno.test("a secure email change sends one link to each address, Auth's way round", () => {
  const emails = renderAuthEmails(
    { ...user, new_email: "anna@new.example" },
    data("email_change", { token_hash: "to-new", token_hash_new: "to-current" }),
    SUPABASE,
  );
  assertEquals(
    emails.map((e) => [e.to, e.text.includes("token=to-current"), e.text.includes("token=to-new")]),
    [
      ["anna@example.com", true, false],
      ["anna@new.example", false, true],
    ],
  );
});

Deno.test("an unknown kind still sends something, with its link", () => {
  const [email] = renderAuthEmails(user, data("something_new"), SUPABASE);
  assertEquals(email.subject, "En besked fra Casy");
  assertStringIncludes(email.text, "token=hash-abc");
});

Deno.test("no address, no email (and the hook reports a failure)", () => {
  assertEquals(renderAuthEmails({ id: "u1" }, data("magiclink"), SUPABASE), []);
});

Deno.test("what people typed or Auth sent is escaped in the HTML", () => {
  const [email] = renderAuthEmails(
    { ...user, email: 'x"><script>alert(1)</script>@example.com' },
    data("password_changed_notification"),
    SUPABASE,
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
        SUPABASE,
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
