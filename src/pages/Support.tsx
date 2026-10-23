import { Link } from "react-router-dom";

import LegalPage, { ContactEmail, type LegalCopy } from "@/components/LegalPage";
import { useLang } from "@/i18n/lang";

/**
 * Help and contact (/support, #146): the page App Store Connect's support URL
 * points to, and the profile's "Hjælp". Plain answers to what people ask, with
 * the way to write to the person who runs Casy. It points to the privacy
 * policy and the terms for anything about data and rules instead of repeating
 * them, and its date moves with a change to either text.
 */

const mail = <ContactEmail />;

const link = (to: string, label: string) => (
  <Link to={to} className="font-medium text-foreground underline underline-offset-2">
    {label}
  </Link>
);

const da: LegalCopy = {
  title: "Hjælp og kontakt",
  updated: "Senest opdateret 23. oktober 2026",
  sections: [
    {
      title: "Skriv til os",
      body: (
        <p>
          Casy drives af én person, og du kan altid skrive til {mail}. Fortæl, hvad du prøvede, og
          hvad der skete i stedet, gerne med et skærmbillede. Jeg svarer så hurtigt, jeg kan,
          normalt inden for et par dage. I appen finder du også Send feedback under Profil.
        </p>
      ),
    },
    {
      title: "Min kalender er tom",
      body: (
        <p>
          I appen skal Casy have lov til at læse telefonens kalendere. Tryk Importér min kalender på
          Min kalender, og sig ja, når iPhonen spørger. Sagde du nej, kan det ændres under
          Indstillinger, Casy, Kalendere. Casy læser alle de kalendere, der ligger på telefonen,
          også dem fra Google eller Outlook, hvis du har lagt dem ind i iPhonen. Mangler en enkelt
          kalender, så tjek, at den er sat til under Kalendere øverst til venstre på Min kalender.
          På hjemmesiden kan du også forbinde en Apple-kalender eller et kalenderlink: se{" "}
          {link("/help/connect-icloud", "hjælp til Apple-kalender")} og{" "}
          {link("/help/connect-ics", "til kalenderlink")}.
        </p>
      ),
    },
    {
      title: "Casy finder ingen dato",
      body: (
        <p>
          Prøv at gøre søgningen bredere: flere ugedage, et andet tidspunkt på dagen, en kortere
          aftale eller flere måneder. Når Casy ikke kan finde en dato, foreslår den selv, hvad der
          vil give en. Står nogen som optaget hele tiden, kan de sætte en kalender til at kunne
          springes over under Kalendere.
        </p>
      ),
    },
    {
      title: "Invitationer og grupper",
      body: (
        <p>
          Du kan invitere fra dine kontakter, med et link eller med en QR-kode, som du finder under
          Invitér folk i gruppen. Et link virker i 7 dage. Åbner et link i Safari i stedet for i
          appen, kan du blive medlem på siden, og gruppen er i appen, når du er logget ind med den
          samme konto. Forlader du en gruppe, holder de andre op med at se noget om dig med det
          samme.
        </p>
      ),
    },
    {
      title: "Hvad kan de andre se?",
      body: (
        <p>
          Dem i dine grupper kan se dit navn og hvornår du er optaget, aldrig hvad dine aftaler
          hedder, og aldrig din e-mailadresse. Alt om, hvad Casy gemmer, står i{" "}
          {link("/privacy", "privatlivspolitikken")}, og under Profil, Dine data kan du se det og
          hente en kopi.
        </p>
      ),
    },
    {
      title: "Rapportér og bloker",
      body: (
        <p>
          Er der noget i en gruppe eller en aftale, som ikke er i orden, så brug Rapportér eller
          bloker i gruppen eller Rapportér på aftalen. Den, du rapporterer, får ikke at vide, at det
          var dig. Du kan blokere en person, så de ikke kan invitere dig til flere grupper, og
          fjerne blokeringen igen under Dine data.
        </p>
      ),
    },
    {
      title: "Slet min konto",
      body: (
        <p>
          Under Profil, Slet konto sletter du din konto og alt, der hører til den, med det samme.
          Hvad der bliver slettet, og hvor længe Casy gemmer resten, står i{" "}
          {link("/privacy", "privatlivspolitikken")}.
        </p>
      ),
    },
    {
      title: "Mere",
      body: (
        <p>
          {link("/how-it-works", "Sådan virker det")}, {link("/terms", "vilkårene")} og{" "}
          {link("/privacy", "privatlivspolitikken")}.
        </p>
      ),
    },
  ],
};

const en: LegalCopy = {
  title: "Help and contact",
  updated: "Last updated 23 October 2026",
  sections: [
    {
      title: "Write to us",
      body: (
        <p>
          Casy is run by one person, and you can always write to {mail}. Tell me what you tried and
          what happened instead, with a screenshot if you can. I reply as soon as I can, usually
          within a couple of days. In the app you will also find Send feedback under Profile.
        </p>
      ),
    },
    {
      title: "My calendar is empty",
      body: (
        <p>
          In the app, Casy needs permission to read the phone&apos;s calendars. Tap Import my
          calendar on My calendar, and say yes when the iPhone asks. If you said no, you can change
          it under Settings, Casy, Calendars. Casy reads every calendar on the phone, including ones
          from Google or Outlook if you have added them to the iPhone. If a single calendar is
          missing, check that it is ticked under Calendars at the top left of My calendar. On the
          website you can also connect an Apple Calendar or a calendar link: see{" "}
          {link("/help/connect-icloud", "help with Apple Calendar")} and{" "}
          {link("/help/connect-ics", "with a calendar link")}.
        </p>
      ),
    },
    {
      title: "Casy finds no date",
      body: (
        <p>
          Try widening the search: more weekdays, another time of day, a shorter event or more
          months. When Casy can&apos;t find a date, it suggests what would give one. If someone
          always shows as busy, they can set a calendar to be skippable under Calendars.
        </p>
      ),
    },
    {
      title: "Invitations and groups",
      body: (
        <p>
          You can invite from your contacts, with a link or with a QR code, which you find under
          Invite people in the group. A link works for 7 days. If a link opens in Safari instead of
          the app, you can join on the page, and the group is in the app when you are signed in with
          the same account. If you leave a group, the others stop seeing anything about you straight
          away.
        </p>
      ),
    },
    {
      title: "What can the others see?",
      body: (
        <p>
          People in your groups can see your name and when you are busy, never what your events are
          called, and never your email address. Everything about what Casy stores is in the{" "}
          {link("/privacy", "privacy policy")}, and under Profile, Your data you can see it and
          download a copy.
        </p>
      ),
    },
    {
      title: "Report and block",
      body: (
        <p>
          If something in a group or an event isn&apos;t right, use Report or block in the group, or
          Report on the event. Whoever you report is not told it was you. You can block a person so
          they can&apos;t invite you to more groups, and remove the block again under Your data.
        </p>
      ),
    },
    {
      title: "Delete my account",
      body: (
        <p>
          Under Profile, Delete account you delete your account and everything that belongs to it,
          straight away. What is deleted, and how long Casy keeps the rest, is in the{" "}
          {link("/privacy", "privacy policy")}.
        </p>
      ),
    },
    {
      title: "More",
      body: (
        <p>
          {link("/how-it-works", "How it works")}, the {link("/terms", "terms")} and the{" "}
          {link("/privacy", "privacy policy")}.
        </p>
      ),
    },
  ],
};

export default function Support() {
  const { lang } = useLang();
  return <LegalPage copy={lang === "da" ? da : en} />;
}
