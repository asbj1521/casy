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
  updated: "Senest opdateret 25. oktober 2026",
  sections: [
    {
      title: "Kort fortalt",
      body: (
        <p>
          Casy (en forkortelse af Calendar Syncing) hjælper en gruppe med at finde et tidspunkt, der
          passer alle. For at gøre det gemmer Casy kun, hvornår du er optaget: aldrig titler,
          steder, noter eller gæster i dine aftaler. I iPhone-appen kan du selv se dem i din
          kalender, men de bliver på telefonen. Casy skriver kun i din kalender, når du beder om
          det: så lægger den aftaler, din gruppe er blevet enige om, i den kalender, du har valgt
          som primær. Dine data bliver ikke solgt, ikke brugt til reklamer og ikke delt med nogen
          uden for tjenesten. Med dit ja kan Casys AI læse navnene på dine kalendere og, i
          iPhone-appen, titlerne på dine aftaler: de sendes til Anthropic, men gemmes ikke hos Casy
          (se AI i Casy). Casy gemmer kun, hvornår dine vigtige aftaler starter, og hvor vigtige de
          er, uden titel, så datoer kan rangeres for din gruppe. En rettelse, du skriver til AI'en,
          og de planer, du laver med AI, sendes til Casy til gennemsyn, medmindre du slår det fra.
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
              aftaler, så de oplysninger fjernes, før noget gemmes. I iPhone-appen viser Casy dine
              egne aftalers titler, steder og noter i din kalender, læst direkte fra telefonen. Kun
              tidspunkterne forlader telefonen.
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
              aftale det er, de datoer, der er tilbudt, hvem der foreslog den, et sted og en note,
              hvis den, der foreslog den, har skrevet dem, og hvad hver enkelt har svaret på hver
              dato: kan, kan men helst ikke, eller kan ikke. Er AI slået til for den, der foreslog
              den, også hvad Casys AI forventer, at aftalen indebærer (se AI i Casy).
            </li>
            <li>
              <Term>Aftaler i din kalender:</Term> hvilke aftaler Casy har lagt i din primære
              kalender, så den kan fjerne dem igen, hvis en aftale bliver aflyst.
            </li>
            <li>
              <Term>Det, du har fortalt Casy:</Term> tider, hvor du er væk eller optaget, som ikke
              står i en kalender, og som du har skrevet eller sagt til Casy: en kort overskrift,
              hvornår det starter og slutter, og om du er væk eller optaget. Den sætning, du skrev
              eller sagde, gemmes ikke (se AI i Casy). Dine grupper kan se, at du ikke kan i de
              tidsrum, men aldrig overskriften.
            </li>
            <li>
              <Term>Dit ja til AI:</Term> om du har sagt ja til, at Casys AI må læse i din kalender,
              hvornår, og hvilken version af teksten (se AI i Casy). Mærkater, som AI&apos;en laver
              af dine aftaler, gemmes kun på din telefon. Hvornår dine vigtige aftaler starter og
              hvor vigtige de er, uden titel, gemmes hos Casy, så datoer kan rangeres for din
              gruppe. Det gør de rettelser af AI'en, du har sendt til gennemsyn, og om du sender dem
              (se AI i Casy).
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
            foreslå tidspunkter. Casy opdaterer dem cirka en gang i timen, og igen, når nogen i en
            af dine grupper planlægger en aftale med gruppen, så de passer. Telefonens kalendere
            sender iPhone-appen selv, når du åbner den, når kalenderne ændrer sig, mens den er åben,
            og ind imellem i baggrunden, når iPhonen tillader det. Til det får telefonen sin egen
            nøgle, som kun kan opdatere telefonens optagede tidsrum.
          </p>
          <p>
            Har du valgt en primær kalender, bruger Casy din adgang til den til at lægge aftaler, I
            er blevet enige om, i den: når du trykker Tilføj til min kalender, eller af sig selv,
            hvis du har slået Tilføj automatisk til. Aftalen får aftalens navn, gruppens navn og
            navnene på de andre, der er med. Bliver aftalen aflyst, fjerner Casy den igen. Casy
            ændrer eller sletter aldrig andre aftaler i din kalender. Indtil videre kan det lade sig
            gøre med Apple-kalendere og med kalenderne på din telefon i iPhone-appen. Dem lægger
            appen selv aftalerne i, når den er åben eller arbejder i baggrunden, og hver aftale får
            et link tilbage til aftalen i Casy.
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
      id: "ai",
      title: "AI i Casy",
      body: (
        <>
          <p>
            Casys AI er Claude, en AI-model fra Anthropic. Noget sendes til Anthropic, fordi du selv
            beder om det. Andet sendes kun, hvis du har sagt ja til, at Casys AI må læse i din
            kalender. Indtil videre er AI kun slået til for en del af brugerne.
          </p>

          <p>
            <Term>Det, du selv skriver eller siger.</Term> Vælger du Planlæg med AI, sendes det, du
            skriver eller siger om aftalen, til Anthropic. Med det følger dagens dato, de måneder,
            der kan planlægges i, og det sprog, du bruger Casy på. Når du tilføjer detaljer, følger
            også det, du skrev før, og de indstillinger, aftalen har nu. Intet andet: ikke dine
            kalendere, ikke hvornår nogen er optaget, og ikke navnene på din gruppe eller dens
            medlemmer. Nævner du selv et navn, sendes det, som du skrev det, og Casy finder personen
            i gruppen i din browser. Anthropic svarer med indstillinger til aftalen, som du ser og
            kan rette, før noget bliver sendt til gruppen.
          </p>
          <p>
            <Term>Fortæl Casy.</Term> Vælger du Fortæl Casy, sendes det, du skriver eller siger om,
            hvornår du er væk eller optaget, til Anthropic. Med det følger dagens dato og det sprog,
            du bruger Casy på, og når du tilføjer detaljer, også det, du skrev før, og de tider, du
            ser på skærmen. Intet andet: ikke dine kalendere og ikke navne. Anthropic svarer med
            tider, som du ser og kan rette, før noget bliver gemt. Først når du trykker Gem, gemmer
            Casy tiderne (se Det gemmer Casy), og aldrig den sætning, du skrev eller sagde. Det
            kræver ikke dit ja til, at AI&apos;en må læse i din kalender, for den læser intet fra
            den.
          </p>
          <p>
            Foreslår du en aftale, beder Casy også Anthropic om at vurdere, hvad den typisk
            indebærer for dem, der kommer: en sen aften, alkohol, en lang rejse eller hård træning,
            hvor krævende den er, og om den er udendørs. Med det sendes aftalens navn, sted og note,
            som du skrev dem, og hvornår på dagen den er, og hvor længe den varer: ikke datoerne,
            ikke dine kalendere og ikke gruppen. Vurderingen gemmes med aftalen, så Casy kan advare
            de inviterede, hvis en dato ville gå ud over noget vigtigt for dem, og den slettes
            sammen med aftalen.
          </p>

          <p>
            <Term>Med dit ja: Casys AI læser i din kalender.</Term> Det er slået fra, indtil du selv
            slår det til. Casy spørger én gang på Min kalender, og du kan altid ændre det under
            Profil, Dine data. Er det slået til, sendes:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              navnene på dine kalendere, uden e-mailadresser og links, og hvilken slags konto de
              ligger i, når en kalender ingen kategori har, så Casy kan gætte den (arbejde, skole,
              privat eller andet). I iPhone-appen følger også et par af kalenderens aftaletitler
              med. Casy gemmer kun kategorien, markeret som gættet, til du selv vælger en. En
              kategori, du selv har valgt eller fjernet, bliver aldrig ændret;
            </li>
            <li>
              i iPhone-appen titlerne på dine aftaler, læst på telefonen, sammen med kalenderens
              navn, om aftalen varer hele dagen, hvornår på dagen den plejer at starte, hvor længe
              den varer og hvor ofte den kommer igen. AI&apos;en vurderer, hvad aftalen er, hvor
              vigtig den er, og hvad den ikke skal ligge lige efter, for eksempel at en eksamen er
              vigtig. Skriver du, at en vurdering er forkert, følger din forklaring med, og dine
              tidligere rettelser (aftalens titel, kalenderens navn, din forklaring og den nye
              vurdering) følger med de næste gange;
            </li>
            <li>
              i iPhone-appen, for de aftaler, AI&apos;en har vurderet som et fly eller en rejse:
              titlen, stedet, kalenderens navn og om aftalen varer hele dagen. AI&apos;en svarer, om
              det er et fly, et tog eller en bus, og mellem hvilke byer. Telefonen parrer turen ud
              med turen hjem og spørger dig om hver rejse, den finder, og om det, den ikke kan
              parre, for eksempel et fly ud uden et fly hjem. En rejse tæller først med, når du har
              sagt ja til den. Byerne og rejserne gemmes kun på din telefon;
            </li>
            <li>
              i iPhone-appen, for hver af dine vigtige aftaler: hvornår den starter, hvor vigtig den
              er, hvad du ikke skal gøre aftenen før, og hvor mange dage den kræver forberedelse.
              Uden titel, art eller begrundelse. Det gemmes hos Casy, så datoer i en afstemning kan
              rangeres for hele din gruppe.
            </li>
          </ul>
          <p className="mt-3">
            Aldrig noter, gæster eller datoer, steder kun for fly, tog og busser, og intet om de
            andre i dine grupper. Titler på aftaler kan afsløre private ting, for eksempel om
            helbred. Casy beder AI&apos;en om aldrig at gætte på helbred, men titlen sendes, som du
            har skrevet den. Derfor er ja frivilligt, og Casy virker også uden. Grundlaget er dit
            samtykke, og du kan trække det tilbage når som helst; det ændrer ikke det, der allerede
            er sket.
          </p>
          <p>
            Vurderingerne (mærkaterne) gemmes kun på din telefon, aldrig hos Casy. Casy bruger dem
            til at advare dig, når en dato ligger lige før noget vigtigt, for eksempel en eksamen.
            Det samme gælder rejserne og det, du har svaret om dem. Trækker du dit ja tilbage,
            slettes mærkaterne, rejserne og dine rettelser på telefonen med det samme. De slettes
            også, når du logger ud eller sletter appen, og de kommer ikke med i den kopi, du kan
            hente. Under Dine data kan du se, hvor mange mærkater telefonen har. Casy gemmer, at du
            har sagt ja, hvornår, og hvilken version af denne tekst du sagde ja til. Får Casys AI
            lov til mere med din kalender, spørger Casy dig igen.
          </p>
          <p>
            Det, der deles om dine vigtige aftaler, erstattes, hver gang appen sender det, så det,
            telefonen ikke længere nævner, forsvinder med det samme. Det slettes, når du trækker dit
            ja tilbage, når du sletter din konto, og 30 dage efter, at det sidst blev sendt. Casy
            bruger det kun til at give datoerne i en afstemning en score ud fra gruppens vigtige
            aftaler. De andre i gruppen ser kun scoren for hver dato, aldrig hvem eller hvad der
            påvirkede den; i en lille gruppe kan en lav score dog pege på en af dem.
          </p>

          <p>
            <Term>Rettelser, du sender til Casy.</Term> Skriver du, at AI&apos;ens vurdering af en
            aftale er forkert, sendes din rettelse også til Casy: aftalens titel, kalenderens navn
            (uden e-mailadresser og links), vurderingen AI&apos;en gav, det, du skrev, og den nye
            vurdering. Aldrig datoer, steder eller andre aftaler. Laver du en aftale med Planlæg med
            AI, sendes også det, du skrev eller sagde, det AI&apos;en gjorde ud af det, hvad du
            ændrede af dens gæt, og hvordan det endte, når aftalen sendes til gruppen; en plan, du
            sender, som AI&apos;en lavede den, tæller som rigtig. Aldrig gruppen eller dens
            medlemmer. Det er slået til, når du siger ja, og du kan slå det fra under Dine data uden
            at tage dit ja tilbage. Casy gemmer det, så den, der driver Casy, kan gøre en gentaget
            fejl til en skarpere regel i AI&apos;ens opgave og en ny, opfundet testsag; ingen model
            trænes. Vedkommende ser kun det, der er sendt, aldrig hvem der sendte det. Det slettes,
            når det er gennemgået, efter 90 dage, når du sletter dine rettelser under Dine data, når
            du trækker dit ja tilbage, eller når du sletter din konto.
          </p>

          <p>
            <Term>Hos Anthropic og hos Casy.</Term> Anthropic bruger ikke det, Casy sender, til at
            træne sine modeller, og sletter det normalt inden for 30 dage. Anthropic ligger i USA,
            så det bliver behandlet uden for EU. Casy gemmer ikke selv teksten, titlerne eller
            svarene, bortset fra de rettelser, du sender til gennemsyn (se ovenfor). Casy noterer
            kun, at et svar blev hentet, til hvem og til hvad (for eksempel Planlæg med AI), og hvor
            stort det var, så der kan sættes en grænse for, hvor mange svar hver person henter om
            dagen. Notatet slettes efter 30 dage, eller når du sletter din konto, og du kan se dit
            antal under Dine data.
          </p>
          <p>
            Trykker du på Tal, er det din browser, der gør din tale til tekst: Chrome sender lyden
            til Google, Edge til Microsoft, og Safari til Apple eller gør det på din enhed. I
            Casy-appen til iPhone er det Apples talegenkendelse, som kører på din telefon, hvor den
            kan, og ellers hos Apple. Casy får kun teksten. Vil du ikke det, kan du skrive i stedet.
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
            "ikke muligt". Er din kalender ikke blevet opdateret i to dage eller mere, kan de også
            se, hvornår den sidst blev det, så de ved, at noget kan have ændret sig.
          </p>
          <p>
            Medlemmer kan ikke se din e-mailadresse, navnene på dine kalendere (heller ikke dem, du
            selv har givet dem), hvilke konti du har forbundet eller hvad dine aftaler hedder. Casy
            gemmer slet ikke titler på aftaler i dine kalendere, så der er intet at afsløre. Én
            undtagelse: har du logget ind med din e-mail og ikke valgt et navn på din profil, er det
            navn, medlemmer ser, delen af din e-mailadresse før @ (for eksempel "anna.jensen" for
            anna.jensen@example.com). Resten af adressen vises aldrig.
          </p>
          <p>
            Har du sagt ja til, at Casys AI læser i din kalender, tæller dine vigtige aftaler med,
            når datoerne i en afstemning får en score. De andre i gruppen ser kun scoren for hver
            dato, aldrig dine aftaler eller hvem der påvirkede den. I en lille gruppe kan en lav
            score alligevel pege på en af medlemmerne.
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
            hvis du selv siger ja under Mine grupper. Den, der inviterer dig med e-mail, får ikke at
            vide, om adressen har en konto hos Casy, og ser ikke dit navn, før du har sagt ja.
            Medlemmer af gruppen, der allerede er i en anden gruppe med dig, kan se, at du er
            inviteret. Siger du nej tak, får ingen besked, og gruppen kan ikke invitere dig igen de
            næste seks måneder, men du kan stadig blive medlem med et link.
          </p>
          <p>
            Når nogen foreslår en aftale, kan alle i gruppen se den, de datoer, der er tilbudt, dens
            sted og note, og hvad hver enkelt har svaret på hver dato. Siger du nej til en dato, kan
            de andre se, at du ikke kunne den. Mens du svarer, viser Casy din egen kalender omkring
            hver dato, men kun for dig, og kun hvornår du er optaget og i hvilken af dine kalendere.
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
            ikke e-mailadresser, optagede tidsrum eller noget om dine aftaler. Dertil kommer de
            rettelser af AI'en, folk har sendt til gennemsyn (se AI i Casy): vedkommende ser dem,
            men aldrig, hvem der sendte dem.
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
          oplysninger som din IP-adresse og browser for at gøre det. AI i Casy går gennem Anthropic,
          som beskrevet ovenfor. Casy bruger ingen analyse- eller reklamesporing. Din browser gemmer
          din login-session, så du forbliver logget ind, det sprog, du har valgt, og en kopi af din
          egen gruppeliste, dine kalenderforbindelser og om du har admin-adgang, så siderne åbner
          med det samme. Kopien slettes, når du logger ud, og gemmes aldrig i mere end en uge. Intet
          om andres kalendere gemmes i din browser.
        </p>
      ),
    },
    {
      title: "Hvor længe Casy gemmer det",
      body: (
        <>
          <p>
            Casy gemmer kun dine oplysninger, så længe der er brug for dem. Hver nat sletter Casy:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              foreslåede aftaler 12 måneder efter, at deres sidste dato var slut, sammen med
              datoerne, svarene og hvem der var inviteret;
            </li>
            <li>
              aflyste aftaler og aftaler, der ikke fandt en dato, 30 dage efter de blev lukket (lidt
              senere, hvis Casy endnu ikke har fået fjernet en aflyst aftale fra nogens kalender);
            </li>
            <li>invitationslinks 30 dage efter, at de er holdt op med at virke;</li>
            <li>notatet om, at du har slået en e-mailadresse op, efter et døgn;</li>
            <li>notatet om dine AI-svar efter 30 dage;</li>
            <li>tider, du har fortalt Casy, 30 dage efter, at de er slut;</li>
            <li>rettelser af AI'en, du har sendt til gennemsyn, efter 90 dage;</li>
            <li>oplysningerne om dine vigtige aftaler 30 dage efter, at de sidst blev sendt;</li>
            <li>forsøg på at forbinde en kalender, der aldrig blev færdige, efter 7 dage;</li>
            <li>
              afslåede invitationer til en gruppe 6 måneder efter, at de blev sendt. Derefter kan
              gruppen invitere dig igen.
            </li>
          </ul>
          <p>
            Optagede tidsrum bliver erstattet, hver gang Casy opdaterer dine kalendere, og dækker
            kun fra en uge tilbage til tolv måneder frem. Alt andet, altså din konto, dine
            kalenderforbindelser og dine grupper, gemmes, indtil du selv sletter det eller sletter
            din konto.
          </p>
          <p>
            Dit ja til, at Casys AI må læse i din kalender, gemmes, så længe du har kontoen, eller
            til du trækker det tilbage. Mærkater og rettelser gemmes kun på din telefon, til du
            trækker dit ja tilbage, logger ud eller sletter appen.
          </p>
        </>
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
            den app-specifikke adgangskode på account.apple.com/account/manage. Telefonens kalendere
            holder appen op med at læse, når du fjerner telefonen, eller når du slår adgang til
            Kalendere fra under Casy i telefonens Indstillinger.
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
  updated: "Last updated 25 October 2026",
  sections: [
    {
      title: "In short",
      body: (
        <p>
          Casy (short for Calendar Syncing) helps a group find a time that works for everyone. To do
          that it stores only when you are busy: never the titles, places, notes or guests of your
          events. In the iPhone app you can see them yourself in your calendar, but they stay on the
          phone. Casy only writes to your calendar when you ask it to: it then adds events your
          group has agreed on to the calendar you chose as your primary calendar. Your data is not
          sold, not used for advertising, and not shared with anyone outside the service. With your
          yes, Casy&apos;s AI can read the names of your calendars and, in the iPhone app, the
          titles of your events: they are sent to Anthropic, but not stored by Casy (see AI in
          Casy). Casy stores only when your important events start and how important they are,
          without titles, so dates can be ranked for your group. A correction you write to the AI,
          and the plans you make with AI, are sent to Casy for review unless you switch that off.
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
              are removed before anything is saved. In the iPhone app, Casy shows your own
              events&apos; titles, places and notes in your calendar, read straight from the phone.
              Only the times leave the phone.
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
              is, the dates offered, who suggested it, a place and a note if whoever suggested it
              wrote them, and how each person answered each date: can, can but would rather not, or
              can't. If AI is on for whoever suggested it, also what Casy's AI expects the event to
              involve (see AI in Casy).
            </li>
            <li>
              <Term>Events in your calendar:</Term> which events Casy added to your primary
              calendar, so it can take them out again if an event is cancelled.
            </li>
            <li>
              <Term>What you have told Casy:</Term> times when you are away or busy that are not in
              a calendar, which you wrote or said to Casy: a short heading, when it starts and ends,
              and whether you are away or busy. The sentence you wrote or said is not kept (see AI
              in Casy). Your groups can see that you can&apos;t make those times, but never the
              heading.
            </li>
            <li>
              <Term>Your yes to AI:</Term> whether you said yes to Casy&apos;s AI reading your
              calendar, when, and which version of the text (see AI in Casy). Labels the AI makes of
              your events are kept only on your phone. When your important events start and how
              important they are, without titles, is stored by Casy, so dates can be ranked for your
              group. So are the corrections of the AI you sent for review, and whether you send them
              (see AI in Casy).
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
            Casy refreshes them about once an hour, and again when someone in one of your groups
            plans an event with the group, so they stay current. The iPhone app sends the
            phone&apos;s calendars itself, when you open it, when they change while it is open, and
            now and then in the background, when the iPhone allows it. For that the phone gets a key
            of its own, which can only update the phone&apos;s busy times.
          </p>
          <p>
            If you chose a primary calendar, Casy uses your access to it to add the events you agree
            on: when you press Add to my calendar, or on its own if you switched on Add
            automatically. The entry holds the event&apos;s name, the group&apos;s name and the
            names of the others taking part. If the event is cancelled, Casy takes it out again.
            Casy never changes or deletes any other event in your calendar. For now this works with
            Apple calendars, and with the calendars on your phone in the iPhone app. The app adds
            those entries itself, while it is open or working in the background, and each entry
            carries a link back to the event in Casy.
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
      id: "ai",
      title: "AI in Casy",
      body: (
        <>
          <p>
            Casy&apos;s AI is Claude, an AI model from Anthropic. Some things are sent to Anthropic
            because you ask for it. Others are sent only if you have said yes to Casy&apos;s AI
            reading your calendar. For now AI is switched on for only some of the users.
          </p>

          <p>
            <Term>What you write or say yourself.</Term> If you choose Plan with AI, what you write
            or say about the event is sent to Anthropic. With it go today&apos;s date, the months
            that can be planned in, and the language you use Casy in. When you add details, what you
            wrote before and the event&apos;s settings so far go too. Nothing else: not your
            calendars, not when anyone is busy, and not the names of your group or its members. If
            you name someone yourself, the name is sent as you wrote it, and Casy finds the person
            in the group in your browser. Anthropic answers with settings for the event, which you
            see and can change before anything is sent to the group.
          </p>
          <p>
            <Term>Tell Casy.</Term> If you choose Tell Casy, what you write or say about when you
            are away or busy is sent to Anthropic. With it go today&apos;s date and the language you
            use Casy in, and when you add details, what you wrote before and the times you see on
            screen. Nothing else: not your calendars and not names. Anthropic answers with times,
            which you see and can change before anything is kept. Only when you press Save does Casy
            keep the times (see What Casy stores), and never the sentence you wrote or said. It does
            not need your yes to the AI reading your calendar, since it reads nothing from it.
          </p>
          <p>
            When you suggest an event, Casy also asks Anthropic what it usually involves for the
            people going: a late night, alcohol, a long journey or hard exercise, how tiring it is,
            and whether it is outdoors. Only the event&apos;s name, place and note as you wrote them
            go with it, and the time of day and how long it lasts: not the dates, not your calendars
            and not the group. The answer is kept with the event, so Casy can warn the people
            invited when a date would get in the way of something important to them, and it is
            deleted with the event.
          </p>

          <p>
            <Term>With your yes: Casy&apos;s AI reads your calendar.</Term> It is off until you
            switch it on yourself. Casy asks once on My calendar, and you can always change it under
            Profile, Your data. When it is on, this is sent:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              the names of your calendars, without email addresses and links, and the kind of
              account they are in, when a calendar has no category, so Casy can guess it (work,
              school, personal or other). In the iPhone app a few of the calendar&apos;s event
              titles go along. Casy keeps only the category, marked as guessed until you pick one
              yourself. A category you picked or removed yourself is never changed;
            </li>
            <li>
              in the iPhone app, the titles of your events, read on the phone, together with the
              calendar&apos;s name, whether the event lasts all day, the time of day it usually
              starts, how long it lasts and how often it repeats. The AI judges what the event is,
              how important it is and what should not come right before it, for example that an exam
              is important. If you write that a judgement is wrong, your explanation goes along, and
              your earlier corrections (the event&apos;s title, the calendar&apos;s name, your
              explanation and the new judgement) go along with later ones;
            </li>
            <li>
              in the iPhone app, for the events the AI judged a flight or a journey: the title, the
              place, the calendar&apos;s name and whether the event lasts all day. The AI answers
              whether it is a flight, a train or a bus, and between which cities. The phone pairs
              the way out with the way home and asks you about every trip it finds, and about what
              it can&apos;t pair, such as a flight out with no flight home. A trip only counts once
              you have said yes to it. The cities and trips are kept only on your phone;
            </li>
            <li>
              in the iPhone app, for each of your important events: when it starts, how important it
              is, what you should not do the evening before, and how many days it needs to prepare.
              Without title, kind or reason. It is stored by Casy, so a vote&apos;s dates can be
              ranked for your whole group.
            </li>
          </ul>
          <p className="mt-3">
            Never notes, guests or dates, places only for flights, trains and buses, and nothing
            about the others in your groups. Event titles can reveal private things, for example
            about health. Casy tells the AI never to guess at health, but the title is sent as you
            wrote it. That is why yes is voluntary, and Casy works without it. The basis is your
            consent, and you can withdraw it at any time; that does not change what has already
            happened.
          </p>
          <p>
            The judgements (labels) are kept only on your phone, never by Casy. Casy uses them to
            warn you when a date falls right before something important, such as an exam. The same
            goes for the trips and what you answered about them. If you withdraw your yes, the
            labels, the trips and your corrections on the phone are deleted at once. They are also
            deleted when you sign out or delete the app, and they are not part of the copy you can
            download. Under Your data you can see how many labels the phone holds. Casy stores that
            you said yes, when, and which version of this text you said yes to. If Casy&apos;s AI is
            allowed to do more with your calendar, Casy asks you again.
          </p>
          <p>
            What is shared about your important events is replaced every time the app sends it, so
            what the phone no longer lists disappears at once. It is deleted when you withdraw your
            yes, when you delete your account, and 30 days after it was last sent. Casy uses it only
            to give the dates of a vote a score from the group&apos;s important events. The others
            in the group see only the score for each date, never who or what affected it; in a small
            group, though, a low score can point at one of them.
          </p>

          <p>
            <Term>Corrections you send to Casy.</Term> If you write that the AI&apos;s judgement of
            an event is wrong, your correction is also sent to Casy: the event&apos;s title, the
            calendar&apos;s name (without email addresses and links), the judgement the AI gave,
            what you wrote and the new judgement. Never dates, places or other events. If you make
            an event with Plan with AI, what you wrote or said, what the AI made of it, what you
            changed of its guesses and how it ended up when the event is sent to the group are sent
            too; a plan you send as the AI made it counts as right. Never the group or its members.
            It is on when you say yes, and you can turn it off under Your data without withdrawing
            your yes. Casy stores it so whoever runs Casy can turn a repeated mistake into a sharper
            rule in the AI&apos;s task and a new, made-up test case; no model is trained. They see
            only what was sent, never who sent it. It is deleted once it has been reviewed, after 90
            days, when you delete your corrections under Your data, when you withdraw your yes, or
            when you delete your account.
          </p>

          <p>
            <Term>At Anthropic and at Casy.</Term> Anthropic does not use what Casy sends to train
            its models, and normally deletes it within 30 days. Anthropic is in the United States,
            so it is processed outside the EU. Casy itself does not keep the text, the titles or the
            answers, apart from the corrections you send for review (see above). It only notes that
            an answer was fetched, for whom and for what (such as Plan with AI), and how large it
            was, so the number of answers each person fetches a day can be limited. The note is
            deleted after 30 days, or when you delete your account, and you can see your count under
            Your data.
          </p>
          <p>
            If you press Speak, your browser turns your speech into text: Chrome sends the sound to
            Google, Edge to Microsoft, and Safari to Apple or does it on your device. In the Casy
            app for iPhone it is Apple&apos;s speech recognition, which runs on your phone where it
            can, and otherwise at Apple. Casy only gets the text. If you would rather not, you can
            type instead.
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
            tell "could take time off" apart from "not possible". If your calendar hasn&apos;t been
            updated for two days or more, they also see when it last was, so they know something may
            have changed.
          </p>
          <p>
            Members do not see your email address, the names of your calendars (including names you
            gave them), which accounts you connected, or what any of your events are called. Casy
            never stores the titles of events in your calendars at all, so there is nothing there to
            reveal. One exception to keep in mind: if you signed in with your email and have not
            chosen a name on your profile, the name members see is the part of your email address
            before the @ (for example "anna.jensen" for anna.jensen@example.com). The rest of the
            address is never shown.
          </p>
          <p>
            If you said yes to Casy&apos;s AI reading your calendar, your important events count
            when the dates of a vote get a score. The others in the group see only the score for
            each date, never your events or who affected it. In a small group a low score can still
            point at one of the members.
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
            yes yourself, on My groups. Someone inviting you by email is not told whether the
            address has a Casy account, and doesn&apos;t see your name until you say yes. Members of
            that group who already share another group with you can see that you were invited. If
            you say no thanks, nobody is told, and that group can&apos;t invite you again for six
            months, though you can still join with a link.
          </p>
          <p>
            When someone suggests an event, everyone in the group sees it, the dates on offer, its
            place and note, and how each person answered each date. If you say you can't make a
            date, the others see that. While you answer, Casy shows your own calendar around each
            date, to you only, and only when you are busy and in which of your calendars.
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
            show email addresses, busy times or anything about your events. In addition there are
            the corrections of the AI people sent for review (see AI in Casy): they see them, but
            never who sent them.
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
          technical details such as your IP address and browser to do so. AI in Casy goes through
          Anthropic, as described above. Casy uses no analytics or advertising trackers. Your
          browser keeps your login session so you stay signed in, the language you picked, and a
          copy of your own group list, your calendar connections and whether you have admin access,
          so pages open instantly. That copy is deleted when you sign out and is never kept for more
          than a week. Nothing about other people&apos;s calendars is stored in your browser.
        </p>
      ),
    },
    {
      title: "How long Casy keeps things",
      body: (
        <>
          <p>
            Casy keeps your information only as long as it is needed. Every night, Casy deletes:
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              suggested events 12 months after their last date ended, along with their dates, the
              answers and who was invited;
            </li>
            <li>
              cancelled events, and events that found no date, 30 days after they closed (a little
              later if Casy has not yet managed to take a cancelled event out of someone&apos;s
              calendar);
            </li>
            <li>invite links 30 days after they stopped working;</li>
            <li>the note that you looked up an email address, after a day;</li>
            <li>the note about your AI answers after 30 days;</li>
            <li>times you told Casy, 30 days after they end;</li>
            <li>corrections of the AI you sent for review after 90 days;</li>
            <li>the information about your important events 30 days after it was last sent;</li>
            <li>attempts to connect a calendar that never finished, after 7 days;</li>
            <li>
              declined group invitations 6 months after they were sent. The group can then invite
              you again.
            </li>
          </ul>
          <p>
            Busy times are replaced every time Casy updates your calendars, and only ever cover a
            week back to twelve months ahead. Everything else, meaning your account, your calendar
            connections and your groups, is kept until you remove it or delete your account.
          </p>
          <p>
            Your yes to Casy&apos;s AI reading your calendar is kept as long as you have the
            account, or until you withdraw it. Labels and corrections are kept only on your phone,
            until you withdraw your yes, sign out or delete the app.
          </p>
        </>
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
            app-specific password at account.apple.com/account/manage. The app stops reading the
            phone&apos;s calendars when you remove the phone, or when you turn off Calendars under
            Casy in the phone&apos;s Settings.
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
