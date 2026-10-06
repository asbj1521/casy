import { Link } from "react-router-dom";

import LegalPage, { ContactEmail, Term, type LegalCopy } from "@/components/LegalPage";
import { useLang } from "@/i18n/lang";

/**
 * The public privacy policy. Google links to it from the consent screen, so
 * it must describe what the code actually does; update it whenever what is
 * stored or who can see it changes. Both languages say the same thing: change
 * one and you change the other. /privacy?lang=en always opens the English one.
 */

const mail = <ContactEmail />;

const googlePolicyLink = (label: string) => (
  <a
    href="https://developers.google.com/terms/api-services-user-data-policy"
    className="font-medium text-foreground underline underline-offset-2"
  >
    {label}
  </a>
);

const da: LegalCopy = {
  title: "Privatlivspolitik",
  updated: "Senest opdateret 6. oktober 2026",
  sections: [
    {
      title: "Kort fortalt",
      body: (
        <p>
          Casy (en forkortelse af Calendar Syncing) hjælper en gruppe med at finde et tidspunkt, der
          passer alle. For at gøre det læser Casy, hvornår du er optaget, og intet andet: aldrig
          titler, steder, noter eller gæster i dine aftaler. Casy skriver kun i din kalender, når du
          beder om det: så lægger den aftaler, din gruppe er blevet enige om, i den kalender, du har
          valgt som primær. Dine data bliver ikke solgt, ikke brugt til reklamer og ikke delt med
          nogen uden for tjenesten.
        </p>
      ),
    },
    {
      title: "Det gemmer Casy",
      body: (
        <>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Term>Din konto:</Term> din e-mailadresse og dit navn, hvis du logger ind med Google,
              eller et navn, du selv vælger på din profil. Logger du ind med din e-mail og ikke har
              valgt et navn, bruger Casy delen af din e-mailadresse før @. Og det sprog, du bruger
              Casy på, så e-mails fra Casy kommer på det sprog.
            </li>
            <li>
              <Term>Forbundne kalendere:</Term> hvilke konti du har forbundet (for eksempel
              e-mailadressen på en Google-konto), navnene på deres kalendere og et navn, du selv
              giver en af dem, den kategori og prioritet, du giver hver af dem (arbejde, skole,
              privat, andet; kan springes over, normal, spring aldrig over), om den tæller med,
              hvilken der er din primære kalender, og om Casy må tilføje aftaler automatisk.
            </li>
            <li>
              <Term>Optagede tidsrum:</Term> start og slut på hvert tidsrum, hvor du er optaget, for
              cirka de næste tolv måneder. Aftaler, der overlapper, bliver slået sammen til ét
              tidsrum. Titler, beskrivelser, steder og deltagere bliver aldrig gemt. Google og
              Microsoft bliver aldrig spurgt om dem. Apple og kalenderlinks sender altid hele
              aftaler, så de oplysninger fjernes, før noget gemmes.
            </li>
            <li>
              <Term>Grupper:</Term> navnet på hver gruppe, du er med i, hvem der ellers er med, hvem
              der lavede den, og de invitationslinks, der er lavet til den. Invitationslinks gemmes
              som et fingeraftryk, der ikke kan laves om til et link, der virker. Invitationer til
              grupper: hvem der inviterede hvem, og om invitationen stadig er åben eller blev
              afslået. Slår du en e-mailadresse op for at invitere nogen, noterer Casy kun, at du
              gjorde det, så der kan sættes en grænse for, hvor mange du kan slå op om dagen.
              Adressen gemmes ikke.
            </li>
            <li>
              <Term>Foreslåede aftaler:</Term> aftaler foreslået i dine grupper: hvilken slags
              aftale det er, de datoer, der er tilbudt, hvem der foreslog den, og hvem der har sagt
              ja eller nej til hver dato.
            </li>
            <li>
              <Term>Aftaler i din kalender:</Term> hvilke aftaler Casy har lagt i din primære
              kalender, så den kan fjerne dem igen, hvis en aftale bliver aflyst.
            </li>
            <li>
              <Term>Adgangsoplysninger:</Term> det, der skal til for at holde dine kalendere
              opdateret: adgangsnøgler fra Google eller Microsoft, en app-specifik adgangskode til
              din Apple-konto eller et kalenderlink. De krypteres, før de gemmes, og nøglen
              opbevares adskilt fra databasen.
            </li>
          </ul>
          <p className="mt-3">
            Er du logget ind, kan du se alt dette om dig selv og hente en kopi under{" "}
            <Link to="/profile/data" className="underline underline-offset-2">
              Profil, Dine data
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      title: "Sådan bruges det",
      body: (
        <>
          <p>
            Optagede tidsrum bruges kun til at vise, hvornår du og dine grupper er ledige, og til at
            foreslå tidspunkter. Casy opdaterer dem cirka en gang i timen, så de passer.
          </p>
          <p>
            Har du valgt en primær kalender, bruger Casy din adgang til den til at lægge aftaler, I
            er blevet enige om, i den: når du trykker Tilføj til min kalender, eller af sig selv,
            hvis du har slået Tilføj automatisk til. Aftalen får aftalens navn, gruppens navn og
            navnene på de andre, der er med. Bliver aftalen aflyst, fjerner Casy den igen. Casy
            ændrer eller sletter aldrig andre aftaler i din kalender. Indtil videre kan det kun lade
            sig gøre med Apple-kalendere.
          </p>
          <p>
            Når du vælger en adgangskode, eller logger ind med en, tjekker din browser den mod Have
            I Been Pwned, en offentlig liste over adgangskoder fra kendte datalæk, så en
            adgangskode, der er let at gætte, bliver opdaget. Kun de første 5 tegn af en hashværdi
            af adgangskoden bliver sendt, og selve adgangskoden forlader aldrig din browser.
          </p>
          <p>
            Casys brug og overførsel af oplysninger fra Googles API&apos;er følger{" "}
            {googlePolicyLink("Google API Services User Data Policy")}, herunder kravene om
            begrænset brug (Limited Use).
          </p>
        </>
      ),
    },
    {
      title: "Det kan de andre i dine grupper se",
      body: (
        <>
          <p>
            Når du er med i en gruppe, kan de andre medlemmer se dit navn, og hvornår du er optaget.
            Det er hele pointen med en gruppe: Casy kan ikke finde et tidspunkt, der passer alle,
            uden det. Optagede tidsrum vises som tidsintervaller og om et tidsrum kom fra en
            kalender, du har markeret som arbejde eller skole, eller som en, du kan springe over
            eller aldrig springer over. Det er det, der lader Casy skelne mellem "kunne tage fri" og
            "ikke muligt".
          </p>
          <p>
            Medlemmer kan ikke se din e-mailadresse, navnene på dine kalendere (heller ikke dem, du
            selv har givet dem), hvilke konti du har forbundet eller hvad dine aftaler hedder. Casy
            gemmer slet ikke titler på aftaler, så der er intet at afsløre. Én undtagelse: har du
            logget ind med din e-mail og ikke valgt et navn på din profil, er det navn, medlemmer
            ser, delen af din e-mailadresse før @ (for eksempel "anna.jensen" for
            anna.jensen@example.com). Resten af adressen vises aldrig.
          </p>
          <p>
            Alle, der har en gruppes invitationslink, kan se gruppens navn, og hvor mange medlemmer
            den har, og kan blive medlem, i de syv dage linket virker. Behandl et invitationslink
            som en adresse, du kun sender til dem, du vil have med i gruppen. Når du forlader en
            gruppe, holder de andre medlemmer op med at se noget om dig fra da af. Den, der lavede
            en gruppe, kan slette den, hvilket fjerner den for alle medlemmer på én gang.
          </p>
          <p>
            Andre kan også invitere dig til en gruppe inde i Casy: folk, du allerede er i en gruppe
            med, og alle, der kender den e-mailadresse, du bruger til Casy. Du bliver kun medlem,
            hvis du selv siger ja under Mine aftaler. Den, der inviterer dig med e-mail, får ikke at
            vide, om adressen har en konto hos Casy, og ser ikke dit navn, før du har sagt ja.
            Medlemmer af gruppen, der allerede er i en anden gruppe med dig, kan se, at du er
            inviteret. Siger du nej tak, får ingen besked, og du kan ikke blive inviteret til den
            gruppe igen, men du kan stadig blive medlem med et link.
          </p>
          <p>
            Når nogen foreslår en aftale, kan alle i gruppen se den, den dato, der er tilbudt, og
            hvem der har sagt ja eller nej. Siger du nej, kan de andre se, at du ikke kunne den
            dato, og Casy tilbyder den næste dato, der passer, i stedet.
          </p>
        </>
      ),
    },
    {
      title: "Det kan den, der driver Casy, se",
      body: (
        <>
          <p>
            Casy drives af én person, som har en admin-visning for at holde tjenesten kørende og
            hjælpe folk, der tager kontakt. Den viser alles navne, hvornår de oprettede sig og sidst
            loggede ind, hvor mange grupper og kalendere de har, alle grupper med deres medlemmer,
            og hvilke kalendertjenester hver person har forbundet, og om de synkroniserer. Den viser
            ikke e-mailadresser, optagede tidsrum eller noget om dine aftaler.
          </p>
          <p>
            Derfra kan vedkommende slette en gruppe, fjerne nogen fra en gruppe, slette en konto
            eller opdatere en kalender, der er holdt op med at synkronisere. Som den, der driver
            tjenesten, kan vedkommende også tilgå databasen direkte, når det er nødvendigt for at
            drive eller reparere tjenesten. Vedkommende kigger ikke på dine data af andre grunde.
          </p>
        </>
      ),
    },
    {
      title: "Hvor det opbevares",
      body: (
        <p>
          Data gemmes hos Casys databaseudbyder, Supabase, og hjemmesiden leveres af Vercel.
          Login-e-mails sendes af Resend, som får din e-mailadresse for at kunne sende dem. Alle tre
          fører almindelige tekniske logfiler for at drive deres tjenester. Login-siden bruger
          Cloudflare Turnstile til at tjekke, at du ikke er en robot, og Cloudflare ser tekniske
          oplysninger som din IP-adresse og browser for at gøre det. Casy bruger ingen analyse-
          eller reklamesporing. Din browser gemmer din login-session, så du forbliver logget ind,
          det sprog, du har valgt, og en kopi af din egen gruppeliste, dine kalenderforbindelser og
          om du har admin-adgang, så siderne åbner med det samme. Kopien slettes, når du logger ud,
          og gemmes aldrig i mere end en uge. Intet om andres kalendere gemmes i din browser.
        </p>
      ),
    },
    {
      title: "Sletning af dine data",
      body: (
        <>
          <p>
            Fjerner du en kalenderkonto under Forbundne kalendere, slettes dens optagede tidsrum og
            adgangsoplysninger fra Casy med det samme. For også at stoppe det hos udbyderen skal du
            fjerne Casys adgang i indstillingerne for din Google- eller Microsoft-konto eller slette
            den app-specifikke adgangskode på account.apple.com/account/manage.
          </p>
          <p>
            Forlader du en gruppe, bliver du fjernet med det samme, og de andre medlemmer holder op
            med at se noget om dig. Var du det sidste medlem, bliver gruppen slettet sammen med dig.
          </p>
          <p>
            Vil du slette din Casy-konto helt, så gør det under Slet konto på din profil, eller
            skriv til {mail}. Alt, der hører til den, bliver slettet med det samme: dine kalendere,
            optagede tidsrum, adgangsoplysninger og gruppemedlemskaber. Grupper, hvor du var det
            eneste medlem, bliver også slettet. Grupper med andre medlemmer fortsætter uden dig.
          </p>
        </>
      ),
    },
    {
      title: "Kontakt",
      body: <p>Spørgsmål om denne politik eller dine data: {mail}.</p>,
    },
  ],
};

const en: LegalCopy = {
  title: "Privacy policy",
  updated: "Last updated 6 October 2026",
  sections: [
    {
      title: "In short",
      body: (
        <p>
          Casy (short for Calendar Syncing) helps a group find a time that works for everyone. To do
          that it reads when you are busy, and nothing else: never the titles, places, notes or
          guests of your events. Casy only writes to your calendar when you ask it to: it then adds
          events your group has agreed on to the calendar you chose as your primary calendar. Your
          data is not sold, not used for advertising, and not shared with anyone outside the
          service.
        </p>
      ),
    },
    {
      title: "What Casy stores",
      body: (
        <>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <Term>Your account:</Term> your email address, and your name if you sign in with
              Google, or a name you choose on your profile. If you sign in with your email and have
              not chosen a name, Casy uses the part of your email address before the @. And the
              language you use Casy in, so emails from Casy come in that language.
            </li>
            <li>
              <Term>Connected calendars:</Term> which accounts you connected (for example the email
              address of a Google account), the names of their calendars and any name you give one
              yourself, the category and priority you give each one (work, school, personal, other;
              can skip, normal, never skip), whether it counts, which one is your primary calendar,
              and whether Casy may add events automatically.
            </li>
            <li>
              <Term>Busy times:</Term> the start and end of each busy period, for roughly the next
              twelve months. Overlapping events are merged into one period. Event titles,
              descriptions, locations and attendees are never stored. Google and Microsoft are never
              asked for them. Apple and calendar links always send whole events, so those details
              are removed before anything is saved.
            </li>
            <li>
              <Term>Groups:</Term> the name of each group you are in, who else is in it, who made
              it, and the invite links made for it. Invite links are stored as a fingerprint that
              cannot be turned back into a working link. Invitations to groups: who invited whom,
              and whether the invitation is still open or was declined. When you look up an email
              address to invite someone, Casy only notes that you did, so it can limit how many you
              can look up in a day. The address is not stored.
            </li>
            <li>
              <Term>Suggested events:</Term> events suggested in your groups: what kind of event it
              is, the dates offered, who suggested it, and who accepted or declined each date.
            </li>
            <li>
              <Term>Events in your calendar:</Term> which events Casy added to your primary
              calendar, so it can take them out again if an event is cancelled.
            </li>
            <li>
              <Term>Access credentials:</Term> what is needed to keep your calendars up to date:
              access tokens from Google or Microsoft, an app-specific password for your Apple
              account, or a calendar link. These are encrypted before they are stored, and the key
              is kept separately from the database.
            </li>
          </ul>
          <p className="mt-3">
            Signed in, you can see all of this about yourself, and download a copy, under{" "}
            <Link to="/profile/data" className="underline underline-offset-2">
              Profile, Your data
            </Link>
            .
          </p>
        </>
      ),
    },
    {
      title: "How it is used",
      body: (
        <>
          <p>
            Busy times are used only to show when you and your groups are free and to suggest times.
            Casy refreshes them about once an hour so they stay current.
          </p>
          <p>
            If you chose a primary calendar, Casy uses your access to it to add the events you agree
            on: when you press Add to my calendar, or on its own if you switched on Add
            automatically. The entry holds the event&apos;s name, the group&apos;s name and the
            names of the others taking part. If the event is cancelled, Casy takes it out again.
            Casy never changes or deletes any other event in your calendar. For now this works with
            Apple calendars only.
          </p>
          <p>
            When you choose a password, or sign in with one, your browser checks it against Have I
            Been Pwned, a public list of passwords from known data leaks, so a password that is easy
            to guess gets caught. Only the first 5 characters of a hash of the password are sent,
            and the password itself never leaves your browser.
          </p>
          <p>
            Casy&apos;s use and transfer of information received from Google APIs adheres to the{" "}
            {googlePolicyLink("Google API Services User Data Policy")}, including the Limited Use
            requirements.
          </p>
        </>
      ),
    },
    {
      title: "What other people in your groups can see",
      body: (
        <>
          <p>
            Joining a group means the other members can see your name and when you are busy. That is
            the whole point of a group: Casy cannot find a time that works for everyone without it.
            Busy periods are shown as time ranges, plus whether a range came from a calendar you
            marked as work or school, or as one you can skip or never skip, which is what lets Casy
            tell "could take time off" apart from "not possible".
          </p>
          <p>
            Members do not see your email address, the names of your calendars (including names you
            gave them), which accounts you connected, or what any of your events are called. Casy
            never stores event titles at all, so there is nothing there to reveal. One exception to
            keep in mind: if you signed in with your email and have not chosen a name on your
            profile, the name members see is the part of your email address before the @ (for
            example "anna.jensen" for anna.jensen@example.com). The rest of the address is never
            shown.
          </p>
          <p>
            Anyone holding a group&apos;s invite link can see the group&apos;s name and how many
            members it has, and can join it, for the seven days the link works. Treat an invite link
            like an address you would only send to people you want in the group. Leaving a group
            stops the other members seeing anything about you from then on. The person who made a
            group can delete it, which removes it for every member at once.
          </p>
          <p>
            People can also invite you to a group from inside Casy: anyone you already share a group
            with, and anyone who knows the email address you use for Casy. You only join if you say
            yes yourself, on My events. Someone inviting you by email is not told whether the
            address has a Casy account, and doesn&apos;t see your name until you say yes. Members of
            that group who already share another group with you can see that you were invited. If
            you say no thanks, nobody is told, and you can&apos;t be invited to that group again,
            though you can still join with a link.
          </p>
          <p>
            When someone suggests an event, everyone in the group sees it, the date on offer, and
            who has accepted or declined. If you decline, the others see that you could not make
            that date, and Casy offers the next date that works instead.
          </p>
        </>
      ),
    },
    {
      title: "What the person running Casy can see",
      body: (
        <>
          <p>
            Casy is run by one person, who has an admin view to keep the service working and to help
            people who get in touch. It shows everyone&apos;s name, when they signed up and last
            signed in, how many groups and calendars they have, every group with its members, and
            which calendar services each person connected and whether they are syncing. It does not
            show email addresses, busy times or anything about your events.
          </p>
          <p>
            From that view they can delete a group, remove someone from a group, delete an account,
            or refresh a calendar that has stopped syncing. As the operator they can also reach the
            database directly when that is needed to run or repair the service. They do not look at
            your data for any other reason.
          </p>
        </>
      ),
    },
    {
      title: "Where it is kept",
      body: (
        <p>
          Data is stored with Casy&apos;s database provider, Supabase, and the website is served by
          Vercel. Sign-in emails are delivered by Resend, which receives your email address in order
          to send them. All three keep standard technical logs to run their services. The sign-in
          page uses Cloudflare Turnstile to check that you are not a robot, and Cloudflare sees
          technical details such as your IP address and browser to do so. Casy uses no analytics or
          advertising trackers. Your browser keeps your login session so you stay signed in, the
          language you picked, and a copy of your own group list, your calendar connections and
          whether you have admin access, so pages open instantly. That copy is deleted when you sign
          out and is never kept for more than a week. Nothing about other people&apos;s calendars is
          stored in your browser.
        </p>
      ),
    },
    {
      title: "Removing your data",
      body: (
        <>
          <p>
            Removing a calendar account under Connected calendars deletes its busy times and
            credentials from Casy immediately. To stop the provider&apos;s side as well, remove
            Casy&apos;s access in your Google or Microsoft account settings, or delete the
            app-specific password at account.apple.com/account/manage.
          </p>
          <p>
            Leaving a group removes you from it straight away, and the other members stop seeing
            anything about you. If you were the last member, the group is deleted with you.
          </p>
          <p>
            To delete your Casy account entirely, use Delete account on your profile, or email
            {mail}. Everything connected to it is deleted straight away: your calendars, busy times,
            credentials and group memberships. Groups where you were the only member are deleted
            too; groups with other members carry on without you.
          </p>
        </>
      ),
    },
    {
      title: "Contact",
      body: <p>Questions about this policy or your data: {mail}.</p>,
    },
  ],
};

export default function Privacy() {
  const { lang } = useLang();
  return <LegalPage copy={lang === "da" ? da : en} />;
}
