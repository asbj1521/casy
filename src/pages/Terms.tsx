import { Link } from "react-router-dom";

import LegalPage, { ContactEmail, type LegalCopy } from "@/components/LegalPage";
import { useLang } from "@/i18n/lang";

/**
 * The terms of service (/terms), next to the privacy policy. Both languages say
 * the same thing: change one and you change the other, and the date at the
 * top with them.
 *
 * Written to outlast what is planned, so it needs no rewrite when that lands:
 * the iPhone app (and its App Store section, which lets these terms stand as
 * the app's licence), other ways to sign in and to connect calendars, emails
 * and notifications people can switch off, and paid features (the core stays
 * free; prices, billing and refunds get their own section here before
 * anything costs money). It never repeats what the privacy policy says about
 * data, only points to it, so the two can't disagree.
 */

const mail = <ContactEmail />;

const link = (to: string, label: string) => (
  <Link to={to} className="font-medium text-foreground underline underline-offset-2">
    {label}
  </Link>
);

const da: LegalCopy = {
  title: "Vilkår for brug",
  updated: "Senest opdateret 6. oktober 2026",
  sections: [
    {
      title: "Kort fortalt",
      body: (
        <p>
          Casy hjælper grupper af venner med at finde en dato, der passer alle. Når du opretter en
          konto eller logger ind, accepterer du disse vilkår. Sammen med{" "}
          {link("/privacy", "privatlivspolitikken")} er de hele aftalen mellem dig og Casy. De er
          skrevet, så de er til at læse.
        </p>
      ),
    },
    {
      title: "Hvem står bag",
      body: (
        <p>
          Casy drives af en privatperson i Danmark. Du kan altid skrive til {mail}. Casy findes som
          hjemmeside på casy.app og som app, og vilkårene gælder for dem alle.
        </p>
      ),
    },
    {
      title: "Din konto",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>Du skal være mindst 13 år for at bruge Casy.</li>
          <li>
            En konto er til én person, og den er til dig selv. Brug et navn, dine venner kan kende,
            og giv dig ikke ud for at være en anden.
          </li>
          <li>
            Hold din adgangskode og alt andet, du logger ind med, som koder og enheder, for dig
            selv. Tror du, at en anden har brugt din konto, så skriv til {mail}.
          </li>
          <li>Du står selv for det, der sker fra din konto.</li>
        </ul>
      ),
    },
    {
      title: "Dine kalendere",
      body: (
        <>
          <p>
            Casy læser kun, hvornår du er optaget, fra de kalendere, du forbinder eller lader appen
            læse, og skriver kun i en kalender, når du beder om det. Privatlivspolitikken beskriver
            præcis hvad.
          </p>
          <p>
            Forbind kun kalendere, du må dele dine optagede tider fra. En kalender fra arbejde eller
            skole kan have sine egne regler. At forbinde en kalender afhænger af den, der leverer
            den, som Google, Microsoft eller Apple. Deres vilkår gælder også, og ændrer eller
            begrænser de adgangen, kan en forbindelse holde op med at virke.
          </p>
        </>
      ),
    },
    {
      title: "Grupper, aftaler og det, du skriver",
      body: (
        <p>
          Du skriver selv navne på grupper og aftaler og dit eget navn. Hold dem venlige og lovlige,
          og skriv ikke andres private oplysninger i dem. Det, du skriver, kan ses af dem, det er
          til, som de andre i gruppen. Du ejer stadig det, du skriver. Du giver Casy lov til at
          gemme og vise det til dem, det er til, og kun for at drive tjenesten.
        </p>
      ),
    },
    {
      title: "Brug Casy ordentligt",
      body: (
        <>
          <p>Du må ikke:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              sende invitationer eller aftaler til folk, der ikke vil have dem, eller bruge Casy til
              at chikanere, true eller narre nogen;
            </li>
            <li>
              slå e-mailadresser op for at finde ud af, hvem der bruger Casy, eller invitere folk i
              stor stil;
            </li>
            <li>
              prøve at komme til data, der ikke er dine, ødelægge eller overbelaste tjenesten eller
              komme uden om dens grænser, som hvor mange du kan invitere om dagen;
            </li>
            <li>bruge automatiske værktøjer til at bruge Casy eller kopiere indhold fra den;</li>
            <li>bryde loven med Casy.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Datoer er forslag",
      body: (
        <>
          <p>
            Casy foreslår datoer ud fra de kalendere, folk har forbundet, og de svar, de har givet.
            Kalendere kan være forældede (Casy opdaterer dem cirka en gang i timen, og når nogen
            planlægger noget), mangle noget eller være forkerte, og meget af det, folk laver, står
            ikke i nogen kalender.
          </p>
          <p>
            En foreslået dato er derfor et forslag og ikke et løfte om, at alle kan. Tjek den selv,
            før du regner med den, og især før du bestiller eller betaler noget. Tider står i den
            tidszone, siden viser, som er dansk tid, medmindre der står andet. Casy er ikke
            ansvarlig for en aftale, der bliver misset, dobbeltbooket eller aflyst.
          </p>
        </>
      ),
    },
    {
      title: "Beskeder fra Casy",
      body: (
        <p>
          Casy sender dig de e-mails, tjenesten har brug for, som links til at logge ind og beskeder
          om sikkerhed. Sender Casy dig andre beskeder, som påmindelser om dine grupper og aftaler,
          vælger du selv hvilke, og du kan slå dem fra.
        </p>
      ),
    },
    {
      title: "Pris",
      body: (
        <>
          <p>
            Casy er gratis. At finde en dato med din gruppe og at være med i en bliver ved med at
            være gratis.
          </p>
          <p>
            Casy kan senere få valgfrie funktioner, der koster penge. Før noget koster penge, bliver
            disse vilkår opdateret med pris, betaling, opsigelse og tilbagebetaling, og du ser
            prisen, før du køber. Køb i en app fra en appbutik håndteres af appbutikken og dens
            vilkår.
          </p>
        </>
      ),
    },
    {
      title: "Andre tjenester",
      body: (
        <p>
          Casy kan linke til eller arbejde sammen med andre tjenester, som kalenderudbydere og
          appbutikker. De drives af andre efter deres egne vilkår, og Casy er ikke ansvarlig for dem
          eller for det, de tilbyder.
        </p>
      ),
    },
    {
      title: "Ændringer i Casy",
      body: (
        <p>
          Casy er en lille tjeneste, der hele tiden bliver udviklet. Funktioner kan blive ændret,
          tilføjet eller fjernet, og Casy kan være utilgængelig i perioder, for eksempel ved
          vedligeholdelse eller fejl. Lukker Casy, får du besked mindst 30 dage før, så du kan nå at
          hente dine data under {link("/profile/data", "Profil, Dine data")}.
        </p>
      ),
    },
    {
      title: "Når en konto slutter",
      body: (
        <>
          <p>
            Du kan slette din konto når som helst under Slet konto på din profil. Hvad der så bliver
            slettet, står i privatlivspolitikken.
          </p>
          <p>
            Casy kan fjerne en gruppe eller en aftale, fjerne nogen fra en gruppe eller lukke en
            konto, der bryder disse vilkår eller er til fare for andre eller for tjenesten.
            Medmindre det haster, eller loven forhindrer det, får du at vide hvorfor og kan svare.
          </p>
        </>
      ),
    },
    {
      title: "Ansvar",
      body: (
        <p>
          Casy er gratis og leveres, som den er, uden løfter om, at den altid virker eller er uden
          fejl. Så vidt loven tillader det, er Casy ikke ansvarlig for indirekte tab, som udgifter
          til en misset aftale, en bestilling eller tabt tid. Intet i vilkårene begrænser et ansvar,
          loven ikke tillader at begrænse, som for forsæt eller grov uagtsomhed, og intet tager de
          rettigheder fra dig, du har som forbruger efter ufravigelige regler.
        </p>
      ),
    },
    {
      title: "Apps fra en appbutik",
      body: (
        <>
          <p>Har du hentet Casys app i Apples App Store, gælder også dette:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Vilkårene er en aftale mellem dig og Casy, ikke Apple. Apple er ikke ansvarlig for
              appen eller dens indhold og har ingen pligt til at yde support eller vedligeholde den.
            </li>
            <li>
              Lever appen ikke op til en garanti, der gælder for den, kan du give Apple besked, og
              Apple refunderer så en eventuel købspris. Ud over det har Apple ingen pligter efter en
              garanti.
            </li>
            <li>
              Casy, ikke Apple, tager sig af krav om appen: om ansvar for produktet, om at den ikke
              lever op til lovkrav, efter forbrugerbeskyttelsesregler eller fra andre, der mener, at
              appen krænker deres rettigheder.
            </li>
            <li>
              Du bekræfter, at du ikke er i et land, USA har embargo mod, og ikke står på en
              amerikansk liste over personer, der er forbudt eller begrænset.
            </li>
            <li>Du skal også følge App Stores regler for brug af apps.</li>
            <li>
              Apple og Apples datterselskaber er tredjemand, der kan håndhæve disse vilkår over for
              dig.
            </li>
          </ul>
          <p>Det samme gælder for andre appbutikker, hvor de kræver det.</p>
        </>
      ),
    },
    {
      title: "Lov og uenigheder",
      body: (
        <p>
          Vilkårene følger dansk lov, og uenigheder afgøres ved de danske domstole. Bor du som
          forbruger i et andet EU-land, beholder du beskyttelsen i dit lands ufravigelige regler og
          kan også gå til domstolene der. Skriv gerne til {mail} først. Det meste kan klares sådan.
        </p>
      ),
    },
    {
      title: "Ændringer i vilkårene",
      body: (
        <p>
          Ændres vilkårene, ændres datoen øverst også. Ændringer, der betyder noget for dig, får du
          at vide i Casy eller på e-mail mindst 30 dage før, de gælder. Vil du ikke acceptere dem,
          kan du slette din konto inden da. Bruger du Casy, efter de er trådt i kraft, accepterer du
          dem. Små rettelser og ændringer til din fordel kan gælde med det samme.
        </p>
      ),
    },
    {
      title: "Kontakt",
      body: (
        <p>
          Spørgsmål om vilkårene: {mail}. Det, Casy gemmer om dig, og hvem der kan se det, står i{" "}
          {link("/privacy", "privatlivspolitikken")}.
        </p>
      ),
    },
  ],
};

const en: LegalCopy = {
  title: "Terms of service",
  updated: "Last updated 6 October 2026",
  sections: [
    {
      title: "In short",
      body: (
        <p>
          Casy helps groups of friends find a date that works for everyone. By creating an account
          or signing in, you accept these terms. Together with the{" "}
          {link("/privacy", "privacy policy")}, they are the whole agreement between you and Casy.
          They are written to be read.
        </p>
      ),
    },
    {
      title: "Who runs Casy",
      body: (
        <p>
          Casy is run by a private person in Denmark. You can always write to {mail}. Casy is
          available as a website at casy.app and as an app, and these terms cover all of them.
        </p>
      ),
    },
    {
      title: "Your account",
      body: (
        <ul className="list-disc space-y-2 pl-5">
          <li>You must be at least 13 years old to use Casy.</li>
          <li>
            An account is for one person, and it is for yourself. Use a name your friends will
            recognise, and do not pretend to be someone else.
          </li>
          <li>
            Keep your password, and anything else you sign in with, such as codes and devices, to
            yourself. If you think someone else used your account, write to {mail}.
          </li>
          <li>You are responsible for what happens from your account.</li>
        </ul>
      ),
    },
    {
      title: "Your calendars",
      body: (
        <>
          <p>
            Casy only reads when you are busy, from the calendars you connect or let the app read,
            and only writes to a calendar when you ask it to. The privacy policy describes exactly
            what.
          </p>
          <p>
            Only connect calendars you are allowed to share your busy times from. A work or school
            calendar may have its own rules. Connecting a calendar depends on whoever provides it,
            such as Google, Microsoft or Apple. Their terms apply too, and if they change or limit
            access, a connection may stop working.
          </p>
        </>
      ),
    },
    {
      title: "Groups, events and what you write",
      body: (
        <p>
          You write the names of groups and events, and your own name. Keep them friendly and
          lawful, and do not put other people&apos;s private information in them. What you write can
          be seen by the people it is for, such as the others in the group. You still own what you
          write. You allow Casy to store it and show it to the people it is for, only to run the
          service.
        </p>
      ),
    },
    {
      title: "Use Casy fairly",
      body: (
        <>
          <p>You may not:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              send invitations or events to people who do not want them, or use Casy to harass,
              threaten or deceive anyone;
            </li>
            <li>look up email addresses to find out who uses Casy, or invite people in bulk;</li>
            <li>
              try to get at data that is not yours, break or overload the service, or get around its
              limits, such as how many people you can invite in a day;
            </li>
            <li>use automated tools to use Casy or copy content from it;</li>
            <li>break the law with Casy.</li>
          </ul>
        </>
      ),
    },
    {
      title: "Dates are suggestions",
      body: (
        <>
          <p>
            Casy suggests dates from the calendars people connected and the answers they gave.
            Calendars can be out of date (Casy refreshes them about once an hour, and when someone
            plans something), incomplete or wrong, and much of what people do is not in any
            calendar.
          </p>
          <p>
            So a suggested date is a suggestion, not a promise that everyone can make it. Check it
            yourself before you rely on it, and especially before you book or pay for anything.
            Times are in the time zone the page shows, which is Danish time unless it says
            otherwise. Casy is not responsible for an event that is missed, double booked or
            cancelled.
          </p>
        </>
      ),
    },
    {
      title: "Messages from Casy",
      body: (
        <p>
          Casy sends you the emails the service needs, such as sign-in links and security messages.
          If Casy sends you other messages, such as reminders about your groups and events, you
          choose which ones, and you can switch them off.
        </p>
      ),
    },
    {
      title: "Price",
      body: (
        <>
          <p>
            Casy is free. Finding a date with your group, and taking part in one, will stay free.
          </p>
          <p>
            Casy may later offer optional features that cost money. Before anything costs money,
            these terms will be updated with the price, payment, cancellation and refunds, and you
            will see the price before you buy. Purchases in an app from an app store are handled by
            that store and its terms.
          </p>
        </>
      ),
    },
    {
      title: "Other services",
      body: (
        <p>
          Casy may link to or work with other services, such as calendar providers and app stores.
          They are run by others under their own terms, and Casy is not responsible for them or for
          what they offer.
        </p>
      ),
    },
    {
      title: "Changes to Casy",
      body: (
        <p>
          Casy is a small service that keeps being developed. Features may be changed, added or
          removed, and Casy may be unavailable at times, for example for maintenance or because of a
          fault. If Casy closes, you will be told at least 30 days before, so you have time to
          download your data under {link("/profile/data", "Profile, Your data")}.
        </p>
      ),
    },
    {
      title: "When an account ends",
      body: (
        <>
          <p>
            You can delete your account at any time with Delete account on your profile. What is
            deleted then is set out in the privacy policy.
          </p>
          <p>
            Casy may remove a group or an event, remove someone from a group, or close an account
            that breaks these terms or puts other people or the service at risk. Unless it is urgent
            or the law prevents it, you will be told why and can reply.
          </p>
        </>
      ),
    },
    {
      title: "Liability",
      body: (
        <p>
          Casy is free and provided as it is, without promises that it always works or is free of
          errors. As far as the law allows, Casy is not liable for indirect losses, such as the cost
          of a missed event, a booking or lost time. Nothing in these terms limits a liability the
          law does not allow to be limited, such as for intent or gross negligence, and nothing
          takes away the rights you have as a consumer under mandatory rules.
        </p>
      ),
    },
    {
      title: "Apps from an app store",
      body: (
        <>
          <p>If you got the Casy app from Apple&apos;s App Store, this applies too:</p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              These terms are an agreement between you and Casy, not Apple. Apple is not responsible
              for the app or its content and has no duty to provide support for it or maintain it.
            </li>
            <li>
              If the app fails to meet a warranty that applies to it, you can tell Apple, and Apple
              will then refund any purchase price. Beyond that, Apple has no warranty obligations.
            </li>
            <li>
              Casy, not Apple, deals with claims about the app: product liability, the app not
              meeting legal requirements, consumer protection, or others claiming the app infringes
              their rights.
            </li>
            <li>
              You confirm that you are not in a country under a United States embargo and not on a
              United States list of prohibited or restricted parties.
            </li>
            <li>You must also follow the App Store&apos;s rules for using apps.</li>
            <li>
              Apple and its subsidiaries are third parties who may enforce these terms against you.
            </li>
          </ul>
          <p>The same applies to other app stores where they require it.</p>
        </>
      ),
    },
    {
      title: "Law and disputes",
      body: (
        <p>
          These terms follow Danish law, and disputes are settled by the Danish courts. If you live
          in another EU country as a consumer, you keep the protection of your country&apos;s
          mandatory rules and can also go to the courts there. Please write to {mail} first: most
          things can be sorted out that way.
        </p>
      ),
    },
    {
      title: "Changes to these terms",
      body: (
        <p>
          When these terms change, so does the date at the top. Changes that matter to you are
          announced in Casy or by email at least 30 days before they apply. If you do not accept
          them, you can delete your account before then. Using Casy after they apply means you
          accept them. Small corrections and changes in your favour can apply straight away.
        </p>
      ),
    },
    {
      title: "Contact",
      body: (
        <p>
          Questions about these terms: {mail}. What Casy stores about you, and who can see it, is in
          the {link("/privacy", "privacy policy")}.
        </p>
      ),
    },
  ],
};

export default function Terms() {
  const { lang } = useLang();
  return <LegalPage copy={lang === "da" ? da : en} />;
}
