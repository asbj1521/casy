import type { ReactNode } from "react";

/**
 * Danish copy: the default language, and the shape the English file must
 * match key for key (see en.tsx). Website copy rules apply here too: no
 * emojis, and no em or en dashes.
 *
 * Sentences with a link in the middle take the link as an argument, so the
 * page decides where it goes and the sentence decides where it sits.
 */

const days = (n: number) => (n === 1 ? "1 dag" : `${n} dage`);
const hours = (n: number) => (n === 1 ? "1 time" : `${n} timer`);

export const da = {
  language: {
    switchLabel: "Sprog",
  },
  common: {
    cancel: "Annuller",
    save: "Gem",
    copy: "Kopiér",
    copied: "Kopieret",
    example: "Eksempel",
    loading: "Indlæser…",
    previousMonth: "Forrige måned",
    nextMonth: "Næste måned",
    days,
    hours,
    /** Short, for the duration picker: 30 -> "30 min", 90 -> "1½ t", 180 -> "3 t". */
    duration: (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} t`;
      if (m === 30) return `${h}½ t`;
      return `${h} t ${m} min`;
    },
    /** Marks you in a member list: "Asbjørn (dig)". */
    withYou: (name: string) => `${name} (dig)`,
  },
  /** Short weekday names indexed by day of week, 0 = Sunday. */
  weekdaysShort: ["Søn", "Man", "Tir", "Ons", "Tor", "Fre", "Lør"],
  eventTypes: {
    evening: "Aften",
    lunch: "Frokost",
    dinner: "Middag",
    gaming: "Gaming",
    nightout: "I byen",
    weekend: "Weekendtur",
    vacation: "Ferie",
  },
  examples: {
    you: "Dig",
    groups: {
      basketball: "Basketballholdet",
      highschool: "Gymnasievennerne",
      family: "Familien",
      bookclub: "Bogklubben",
      studygroup: "Læsegruppen",
      work: "Kollegerne",
      running: "Løbeklubben",
      band: "Bandet",
      neighbours: "Naboerne",
      oldfriends: "Gamle venner",
    },
  },
  nav: {
    scheduler: "Planlægning",
    schedulerShort: "Planlæg",
    events: "Mine aftaler",
    eventsShort: "Aftaler",
    calendar: "Min kalender",
    calendarShort: "Kalender",
    profile: "Profil",
    profileShort: "Profil",
    signIn: "Log ind",
    signOut: "Log ud",
    waitingForAnswer: (n: number) => `${n} venter på dit svar`,
  },
  footer: {
    howItWorks: "Sådan virker det",
    privacy: "Privatliv",
  },
  scheduler: {
    schedulingFor: "Planlægger for",
    whatKind: "Hvilken slags aftale",
    suggest: "Foreslå denne dato",
    suggested: "Foreslået",
    sent: (link: ReactNode) => <>Sendt til gruppen. {link}.</>,
    sentLink: "Følg svarene under Mine aftaler",
    hintSignIn: "Log ind og lav en gruppe for at foreslå aftaler.",
    hintExample: "Lav en gruppe for at foreslå aftaler til rigtige mennesker.",
    hintNoDate: "Ingen dato at foreslå med disse indstillinger. Prøv at ændre dem.",
    hintEveryone: "Alle i gruppen får den og kan sige ja eller nej.",
    hintAccept: "Godkend først, at du skal have fri, i feltet under kalenderen.",
    copyLink: "Kopiér link",
    copiedLink: "Kopieret!",
    findBest: "Find bedste tid",
    previousTime: "Forrige forslag",
    nextTime: "Næste forslag",
    fewerFree: "Færre ledige",
    moreFree: "Flere ledige",
    freeWithTimeOff: "kun ledig med fri",
    freeIfSkipping: "kun ledig ved at springe over",
    best: "Bedst",
    cellTitle: (free: number, total: number, needTimeOff: number) =>
      `${free} af ${total} kan${needTimeOff > 0 ? `, ${needTimeOff} skal have fri` : ""}`,
    cellTitleSkip: (free: number, total: number, skipping: number) =>
      `${free} af ${total} kan${skipping > 0 ? `, ${skipping} skal springe noget over` : ""}`,
    cellFree: " ledige",
    cellWork: (n: number) => ` · ${n} arbejde`,
    cellSkip: (n: number) => ` · ${n} afbud`,
    noVacation: (n: number) =>
      `Der er ingen periode på ${days(n)}, hvor hele gruppen kan. Prøv færre dage eller en anden gruppe.`,
    noTrip:
      "Ingen uge har et ledigt tidsrum til turen for hele gruppen. Prøv at ændre, hvilke dage turen dækker.",
    noSingle: (time: string) =>
      `Intet tidspunkt kl. ${time} på de valgte dage passer hele gruppen. Prøv et andet starttidspunkt, en anden varighed eller flere dage.`,
    needsApproval: "Kræver din godkendelse",
    selfConflict: (titles: string) =>
      `De tidligste mulige datoer, men du har ${titles} i din kalender.`,
    othersNeedTimeOff: (names: string) => ` ${names} skal også have fri.`,
    aCommitment: "en aftale",
    accept: "Godkend",
    underReview: "Datoerne afventer svar",
    // Danish verbs don't change with the count, so these ignore it; the type
    // keeps the count in the signature for English.
    othersMustApprove: ((names: string) =>
      `${names} har arbejde eller skole på de datoer og skal godkende dem.`) as (
      names: string,
      count: number,
    ) => string,
    youApprovedTimeOff: " Du har godkendt at tage fri.",
    worksForEveryone: "Passer alle",
    worksIfSkipping: "Passer, hvis der springes over",
    youSkip: (titles: string) => `Du springer ${titles} over. `,
    othersSkip: (names: string) => `${names} springer noget over. `,
    skipWhy: "Ingen dato inden for en uge passer uden.",
    youApprovedDates: "Du har godkendt at tage fri på de datoer.",
    suggestionFits: (requested: number, needsTimeOff: boolean, fits: number, span: string, extra: string) => (
      <>
        {days(requested)} {needsTimeOff ? "kræver fri" : "passer ikke"}, men{" "}
        <span className="font-semibold">{days(fits)} passer alle</span>: {span}
        {extra}.
      </>
    ),
    leaveAfterWork: ", med afgang efter arbejde den første dag",
    homeBeforeWork: ", hjemme igen før arbejdet starter",
    closestWorkaround: ((n: number, span: string, names: string) =>
      `Nærmeste løsning: ${days(n)}, ${span}, hvis ${names} tager fri.`) as (
      n: number,
      span: string,
      names: string,
      count: number,
    ) => string,
    useTheseDates: "Brug disse datoer",
    groupMembers: "Gruppens medlemmer",
    exampleSignedOut: (link: ReactNode) => (
      <>Alle her er eksempeldata. {link} for at bruge din egen kalender og lave en rigtig gruppe.</>
    ),
    exampleSignedOutLink: "Log ind",
    exampleCalendarsFailed: "Kunne ikke hente dine kalendere, så du vises også med eksempeldata.",
    exampleSignedIn: (link: ReactNode) => (
      <>De andre her er eksempeldata. {link} og lav en gruppe for at finde en dato med rigtige mennesker.</>
    ),
    exampleSignedInLink: "Forbind en kalender",
    busyFailed: "Kunne ikke hente gruppens kalendere, så tiderne er ufuldstændige.",
    busyLoading: "Henter alles kalendere…",
    realTimes:
      "Tiderne kommer fra hvert medlems egne kalendere. Ingen kan se, hvad dine aftaler hedder.",
  },
  groupSwitcher: {
    select: "Vælg gruppe",
    yourGroups: "Dine vennegrupper",
    newGroup: "Ny gruppe",
  },
  groupPanel: {
    noProfileTitle: "Har du ikke en profil endnu?",
    noProfileBody: "Opret en profil for at forbinde din egen kalender og lave en gruppe med rigtige mennesker.",
    signUp: "Opret profil",
    members: (n: number) => (n === 1 ? "1 medlem" : `${n} medlemmer`),
    whatMembersSee: "Hvad medlemmer kan se",
    whatMembersSeeBody:
      "Alle i en gruppe kan se hinandens navne, og hvornår de er optaget. Ingen kan se din e-mailadresse, navnene på dine kalendere eller hvad dine aftaler hedder. Casy gemmer slet ikke titler på aftaler.",
    noCalendarYet: "ingen kalender endnu",
    waitingOne: (name: string) =>
      `${name} har ikke forbundet en kalender endnu og er derfor ikke med i søgningen.`,
    waitingMany: (n: number) =>
      `${n} medlemmer har ikke forbundet en kalender endnu og er derfor ikke med i søgningen.`,
    waitingWhy: "Hvis de blev talt som ledige, ville alle datoer se bedre ud, end de er.",
    newInvite: "Nyt invitationslink",
    invite: "Invitér folk",
    inviteInfo: (expiry: string) =>
      `Alle med linket kan blive medlem af gruppen. Det virker i ${expiry} og kan bruges af alle, du sender det til.`,
    lastMember: (name: string) =>
      `Du er det sidste medlem. Hvis du forlader "${name}", bliver gruppen slettet for altid.`,
    leaveConfirm: (name: string) =>
      `Forlad "${name}"? Du skal have et nyt invitationslink for at komme ind igen.`,
    deleteGroup: "Slet gruppe",
    leaveGroup: "Forlad gruppe",
  },
  inviteExpiry: {
    expired: "udløbet",
    days,
    hours,
    underAnHour: "under en time",
  },
  newGroup: {
    title: "Ny gruppe",
    body: "Giv den et navn, og del så et invitationslink med dem, du vil have med.",
    nameLabel: "Gruppenavn",
    placeholder: "f.eks. Brætspilsaften",
    create: "Opret gruppe",
  },
  providers: {
    apple: { label: "Apple iCloud-kalender", help: "Få hjælp til at forbinde" },
    ics: { label: "Kalenderlink (ICS)", help: "Sådan finder du dit link" },
    google: { label: "Google Kalender", help: "Sådan virker det" },
    outlook: { label: "Outlook-kalender", help: "Sådan virker det" },
  },
  counts: {
    calendars: (n: number) => (n === 1 ? "1 kalender" : `${n} kalendere`),
    busyBlocks: (n: number) => (n === 1 ? "1 optaget tidsrum" : `${n} optagede tidsrum`),
    accounts: (n: number) => (n === 1 ? "1 konto" : `${n} konti`),
    members: (n: number) => (n === 1 ? "1 medlem" : `${n} medlemmer`),
    groups: (n: number) => (n === 1 ? "1 gruppe" : `${n} grupper`),
  },
  synced: {
    justNow: "Synkroniseret lige nu",
    minutes: (n: number) => `Synkroniseret for ${n} min siden`,
    hours: (n: number) => `Synkroniseret for ${n} t siden`,
    days: (n: number) => `Synkroniseret for ${days(n)} siden`,
  },
  profile: {
    adminEnter: "Skift til admin-tilstand",
    adminExit: "Forlad admin-tilstand",
    adminOpening: "Åbner admin-tilstand…",
    connected: (label: string) => `Forbundet til ${label}, og dine optagede tidsrum er hentet.`,
    yourCalendar: "din kalender",
    couldntConnect: (reason: string) => `Kunne ikke forbinde: ${reason}`,
    changeName: "Skift dit viste navn",
    statGroups: "Grupper",
    statCalendars: "Kalendere",
    statBusy: "Optaget",
    connectedCalendars: "Forbundne kalendere",
    syncing: "Synkroniserer",
    syncNow: "Synkronisér nu",
    syncAllFresh: "Alt blev synkroniseret inden for det sidste minut.",
    syncedAccounts: (n: number) =>
      `Synkroniserede ${n === 1 ? "1 konto" : `${n} konti`}.`,
    syncSomeFailed: (failed: number, n: number) =>
      `${failed} af ${n === 1 ? "1 konto" : `${n} konti`} kunne ikke synkroniseres. Se nedenfor.`,
    password: "Adgangskode",
    passwordSaved:
      "Adgangskoden er gemt. Du kan bruge den til at logge ind fra nu af, og du er logget ud på dine andre enheder.",
    codeSent: (email: string) =>
      `Du har ikke logget ind det seneste døgn, så vi har sendt en kode til ${email} for at være sikre på, at det er dig. Skriv den her for at gemme din nye adgangskode.`,
    codeLabel: "Kode fra mailen",
    codeResend: "Send en ny kode",
    codeResent: "Ny kode sendt",
    signOutEverywhere: "Log ud på alle enheder",
    signOutEverywhereHelp:
      "Logger dig ud overalt, også her. Brug den, hvis du har mistet en telefon eller har været logget ind på en andens computer.",
    signingOutEverywhere: "Logger ud",
    couldntSignOutEverywhere: "Kunne ikke logge ud på alle enheder. Prøv igen.",
    savePassword: "Gem adgangskode",
    saving: "Gemmer",
    setPassword: "Angiv eller skift din adgangskode",
    icsAdded: (label: string, blocks: number) =>
      `Tilføjede "${label}" med ${blocks === 1 ? "1 optaget tidsrum" : `${blocks} optagede tidsrum`}.`,
    appleConnected: (label: string, calendars: number, blocks: number, skipped: number) =>
      `Forbundet ${label}: ${calendars === 1 ? "1 kalender" : `${calendars} kalendere`}, ${blocks === 1 ? "1 optaget tidsrum" : `${blocks} optagede tidsrum`}.` +
      (skipped > 0
        ? ` ${skipped === 1 ? "1 aftale" : `${skipped} aftaler`} kunne ikke læses og blev sprunget over.`
        : ""),
    couldntRename: "Kunne ikke omdøbe gruppen",
    couldntInvite: "Kunne ikke lave et invitationslink",
    couldntLeave: "Kunne ikke forlade gruppen",
    couldntDelete: "Kunne ikke slette gruppen",
    couldntStartConnect: "Kunne ikke begynde at forbinde",
    couldntSync: "Kunne ikke synkronisere",
    couldntAddLink: "Kunne ikke tilføje linket",
    couldntRemove: "Kunne ikke fjerne kontoen",
    couldntIcloud: "Kunne ikke forbinde til iCloud",
    oauthErrors: {
      access_denied: "Du afbrød forbindelsen eller gav ikke adgang.",
      missing_code_or_state: "Svaret fra udbyderen manglede noget. Prøv igen.",
      invalid_state: "Forbindelsen udløb, før den blev færdig. Prøv igen.",
      server_misconfigured: "Den forbindelse er ikke sat op på serveren endnu.",
      db_error: "Kontoen blev forbundet, men kunne ikke gemmes. Prøv igen.",
      connect_failed: "Udbyderen afviste forbindelsen. Prøv igen.",
    } as Record<string, string>,
  },
  providerCard: {
    removeIcs: (label: string | null) =>
      `Fjern ${label ?? "dette link"}? De synkroniserede optagede tidsrum og det gemte link slettes fra Casy. Selve linket virker stadig hos kilden, indtil du laver et nyt der.`,
    removeApple: (label: string | null) =>
      `Fjern ${label ?? "denne konto"}? De synkroniserede optagede tidsrum og den gemte adgangskode slettes fra Casy. For også at tilbagekalde selve adgangskoden skal du slette den under App-specifikke adgangskoder på account.apple.com/account/manage.`,
    removeOauth: (label: string | null, company: string) =>
      `Fjern ${label ?? "denne konto"}? De synkroniserede optagede tidsrum slettes fra Casy. For også at fjerne Casys adgang skal du fjerne Casy under forbundne apps i din konto hos ${company}.`,
    unknownAccount: "ukendt konto",
    lastSyncFailed: "· sidste synkronisering fejlede, prøver igen",
    linkStopped: "Linket virker ikke længere. Fjern det, og tilføj det igen.",
    accessExpired: "Adgangen er udløbet. Forbind kontoen igen for at holde den synkroniseret.",
    reconnectTitle: "Forbind igen (vælg kontoen igen)",
    removeTitle: "Fjern denne konto",
    remove: "Fjern",
    checking: "Tjekker",
    connecting: "Forbinder",
    addLink: "Tilføj link",
    addAnother: "Tilføj endnu en",
    addShort: "Tilføj",
    tryAgain: "Prøv igen",
    connect: "Forbind",
    notConnected: "Ikke forbundet endnu.",
    lastFailed: (message: string) => `Sidste forsøg fejlede: ${message}`,
    unknownError: "ukendt fejl",
  },
  appleForm: {
    email: "Apple-konto (e-mail)",
    password: "App-specifik adgangskode",
    about: "Om app-specifikke adgangskoder",
    aboutBody:
      "Apple har ingen login med ét klik til kalendere. Gå til Login og sikkerhed på account.apple.com, åbn App-specifikke adgangskoder, og opret en til Casy. Casy ser aldrig adgangskoden til din Apple-konto. Casy spørger kun Apple om tidspunkter, aldrig titler, og gemmer adgangskoden krypteret. Du kan tilbagekalde den når som helst samme sted.",
    reading: "Læser kalendere",
    stepByStep: "Få hjælp trin for trin",
    noPasswordYet: (link: ReactNode) => <>Har du ikke en endnu? {link}</>,
    stuck: (link: ReactNode) => <>Sidder du fast? {link}</>,
    /** `example` is the shape itself, kept on one line. */
    looksWrong: (example: ReactNode) => (
      <>
        Det ligner ikke en app-specifik adgangskode. De ser sådan ud: {example}. Har du sat din
        almindelige Apple-adgangskode ind?
      </>
    ),
  },
  icsForm: {
    link: "Kalenderlink",
    about: "Om kalenderlinks",
    aboutBody:
      "Alle med linket kan læse kalenderen. Det gemmes privat og vises aldrig igen. Kun start- og sluttider gemmes. Titler, steder og deltagere fjernes, før noget gemmes.",
    likePassword: "Behandl linket som en adgangskode.",
    name: "Navn (valgfrit)",
    namePlaceholder: "f.eks. CBS-skema",
    reading: "Læser kalender",
  },
  passwordForm: {
    newPassword: "Ny adgangskode",
    confirm: "Bekræft adgangskode",
    mismatch: "Adgangskoderne er ikke ens.",
    ruleLength: (n: number) => `Mindst ${n} tegn`,
    ruleLettersDigits: "Både bogstaver og tal",
    ruleNotPersonal: "Ikke din e-mailadresse eller dit navn",
    rulesNotMet: "Adgangskoden opfylder ikke kravene under feltet.",
    checking: "Tjekker adgangskoden",
    leaked: (times: string) =>
      `Den adgangskode optræder ${times} gange i kendte datalæk, så den er let at gætte. Vælg en anden.`,
  },
  groupsSection: {
    title: "Dine grupper",
    makeGroup: "Lav en gruppe",
    loading: "Henter dine grupper…",
    loadFailed: "Kunne ikke hente dine grupper.",
    empty: (button: ReactNode) => <>Du er ikke i en gruppe endnu. {button} og invitér folk.</>,
    makeOne: "Lav en",
    made: (date: string) => `lavet ${date}`,
    renameTitle: "Omdøb gruppen",
    inviteTitle: "Få et invitationslink til gruppen",
    inviteLink: "Invitationslink",
    leaveTitle: "Forlad gruppen",
    deleteTitle: "Slet gruppen for alle",
    inviteShort: (expiry: string) => `Alle med linket kan blive medlem. Det virker i ${expiry}.`,
    done: "Færdig",
    makingLink: "Laver et link…",
    linkFailed: "Kunne ikke lave et invitationslink.",
    deleteConfirm: (name: string, members: number) =>
      `Slet "${name}" for alle? Alle ${members === 1 ? "1 medlem" : `${members} medlemmer`} mister adgangen med det samme.`,
    leaveSole: (name: string) =>
      `Forlad "${name}"? Du er det eneste medlem, så gruppen bliver slettet for altid.`,
  },
  authErrors: {
    invalidCredentials: "Forkert e-mail eller adgangskode.",
    weakPassword: "Adgangskoden er for svag. Brug mindst 8 tegn med både bogstaver og tal.",
    samePassword: "Den nye adgangskode skal være en anden end den gamle.",
    rateLimit: "For mange forsøg. Vent lidt, og prøv igen.",
    emailNotConfirmed: "Bekræft din e-mail først. Tjek din indbakke.",
    userExists: "Der findes allerede en konto med den e-mail.",
    codeInvalid: "Koden er forkert eller udløbet. Tjek mailen, eller få en ny kode.",
  },
  categories: {
    work: "Arbejde",
    school: "Skole",
    personal: "Privat",
    other: "Andet",
  },
  events: {
    title: "Mine aftaler",
    intro:
      "Aftaler foreslået i dine grupper. Når nogen siger nej, finder Casy den næste dato, der passer, og spørger alle igen.",
    loading: "Henter dine aftaler…",
    loadFailed: "Kunne ikke hente dine aftaler.",
    emptyTitle: "Ingen aftaler endnu",
    emptyBody:
      "Find en dato på planlægningssiden, og tryk på Foreslå denne dato. Den dukker op her for alle i gruppen.",
    findDate: "Find en dato",
    needsAnswer: "Venter på dit svar",
    cantMake: "Kan du ikke? Casy finder den næste dato, der passer gruppen, og spørger alle igen.",
    declineFind: "Afslå og find en ny dato",
    keepIt: "Behold den",
    accept: "Accepter",
    decline: "Afslå",
    waitingForOthers: "Venter på andre",
    waitingFor: (names: string) => `Venter på ${names}`,
    scheduled: "Planlagt",
    everyoneIn: "Alle kan.",
    pastClosed: "Tidligere og lukkede",
    noDate:
      "Ingen dato i det næste år passer alle længere. Foreslå den igen fra planlægningssiden.",
    happened: (date: string) => `Fandt sted: ${date}.`,
    passed: (date: string) => `Datoen gik, før alle havde svaret: ${date}.`,
    cancelConfirm: "Aflys aftalen for alle?",
    cancelEvent: "Aflys aftale",
    you: "Dig",
    youSuggested: "Du foreslog den",
    suggestedBy: (name: string) => `Foreslået af ${name}`,
    newDateBecause: (who: string, date: string) => `. Ny dato, fordi ${who} ikke kunne ${date}`,
  },
  calendarView: {
    back: "Tilbage til profil",
    somethingWrong: "Noget gik galt.",
    tryAgain: "Prøv igen",
    truncated: "Måneden har flere optagede tidsrum, end der kan vises, så nogle mangler.",
    noCalendars: (link: ReactNode) => (
      <>
        Ingen kalendere forbundet endnu. {link} for at se dine egne optagede tidsrum her. Danske
        helligdage vises allerede.
      </>
    ),
    noCalendarsLink: "Forbind en på din profil",
    today: "I dag",
    weekHeader: "uge",
    weekNumber: "Ugenummer",
    week: (n: number) => `Uge ${n}`,
    more: (n: number) => `+${n} mere`,
    nothingBusy: "Intet optaget denne dag i de viste kalendere.",
    couldntSave: "Kunne ikke gemme.",
    couldntSaveCategory: "Kunne ikke gemme kategorien",
    couldntSaveIncluded: "Kunne ikke gemme, om kalenderen tæller med",
    couldntLoad: "Kunne ikke hente dine kalendere",
    cellLabel: (date: string, busy: number, holidays: string) =>
      `${date}, ${busy === 1 ? "1 optaget tidsrum" : `${busy} optagede tidsrum`}${holidays ? `, ${holidays}` : ""}`,
    allDay: "Hele dagen",
    hourUnit: "t",
    publicHoliday: "Helligdag",
    observedDay: "Almindelig fridag",
    denmark: "Danmark",
    calendarFallback: "Kalender",
    noCategory: "Ingen kategori",
    holidayCategory: "Helligdag",
    holidayCalendar: "Danske helligdage",
    continuesBoth: "Fortsætter fra dagen før og ind i den næste",
    continuesBefore: "Fortsætter fra dagen før",
    continuesAfter: "Fortsætter ind i den næste dag",
    brands: {
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Særlige",
      builtin: "Indbygget",
    } as Record<string, string>,
    providerNames: {
      builtin: "Indbygget",
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Kalenderlink",
    } as Record<string, string>,
    listTitle: "Dine kalendere",
    listIntro:
      "Kun kalendere med flueben tæller med, når Casy finder datoer, og vises her. Åbn en gruppe for at give hver kalender en kategori, og sige hvor vigtig den er.",
    showAll: (brand: string) => `Tæl alle ${brand}-kalendere med`,
    show: (name: string) => `Tæl ${name} med`,
    inView: (n: number) => `${n} i denne visning`,
    builtInNoAccount: "Indbygget, kræver ingen konto",
    categoryFor: (name: string) => `Kategori for ${name}`,
    notCounted: (n: number) => `Tæller ikke med (${n})`,
    priorityFor: (name: string) => `Hvor vigtig er ${name}`,
    priorities: {
      skip: "Kan springes over",
      normal: "Normal",
      never: "Spring aldrig over",
    },
    priorityHelp:
      "Kan springes over: Casy må lægge aftaler oven i den, hvis ingen dato inden for en uge passer uden. Normal: optaget, men til ture og ferier kan du tage fri fra arbejde og skole. Spring aldrig over: optaget, også når der planlægges ture.",
    priorityHelpLabel: "Hvad betyder det?",
    couldntSavePriority: "Kunne ikke gemme, hvor vigtig kalenderen er",
    rename: (name: string) => `Omdøb ${name}`,
    originally: (name: string) => `Oprindeligt navn: ${name}`,
    useOriginalName: (name: string) => `Brug det oprindelige navn (${name})`,
    couldntSaveName: "Kunne ikke gemme navnet",
  },
  deleteAccount: {
    title: "Slet konto",
    intro:
      "Sletter din konto og alt, der hører til den: dine forbundne kalendere og Casys adgang til dem, dine optagede tidsrum og dit navn. Du forlader dine grupper, og grupper, hvor du er det eneste medlem, bliver slettet. Aftaler, Casy har lagt i din kalender, bliver liggende. Det kan ikke fortrydes.",
    button: "Slet min konto",
    word: "SLET",
    prompt: (word: string) => `Skriv ${word} for at bekræfte.`,
    confirmButton: "Slet kontoen for altid",
    deleting: "Sletter",
    failed: "Kunne ikke slette din konto. Prøv igen.",
  },
  weakPasswordNotice: {
    message: "Din adgangskode er nemmere at gætte, end Casy tillader nu.",
    action: "Vælg en ny",
    dismiss: "Luk",
  },
  addToCalendar: {
    button: "Tilføj til min kalender",
    goesInto: (name: string) => `Casy lægger den i ${name}.`,
    goesIntoFallback: "Casy lægger den i din primære kalender.",
    willAsk: "Du vælger, hvilken kalender den skal i.",
    asFile: "Du får en kalenderfil, som din kalender kan åbne.",
    added: (name: string) => `Lagt i ${name}`,
    addedFallback: "Lagt i din kalender",
    adding: "Casy lægger den i din kalender.",
    notYet: "Casy kunne ikke lægge den i din kalender endnu og prøver igen inden for en time.",
    tryAgain: "Prøv igen nu",
    gone: "Den er ikke i din kalender længere.",
    addAgain: "Tilføj igen",
    chooseTitle: "Hvilken kalender skal Casy lægge aftaler i?",
    chooseHelp: "Den bliver din primære kalender. Du kan skifte den på din profil.",
    useAndAdd: "Brug den og tilføj",
    downloadInstead: "Hent en kalenderfil i stedet",
  },
  primaryCalendar: {
    title: "Primær kalender",
    intro:
      "Casy lægger de aftaler, I bliver enige om, i denne kalender: når du beder om det, eller af sig selv, hvis Tilføj automatisk er slået til.",
    noWritable:
      "Forbind en iCloud-kalender herunder, så kan Casy lægge jeres aftaler direkte i den. Google og Outlook kommer senere.",
    waitingForSync:
      "Casy tjekker, hvilke af dine iCloud-kalendere den må lægge aftaler i. Tryk Synkronisér nu, eller vent op til en time.",
    selectLabel: "Vælg primær kalender",
    choose: "Vælg en kalender",
    noneOption: "Ingen (Casy lægger intet i dine kalendere)",
    confirmFirst: (name: string) =>
      `Gør ${name} til din primære kalender? Casy lægger kun aftaler i den, når du beder om det, eller når Tilføj automatisk er slået til.`,
    confirmChange: (name: string, current: string) =>
      `Gør ${name} til din primære kalender? Nye aftaler lægges i ${name}. Aftaler, der allerede er lagt i ${current}, bliver, hvor de er.`,
    confirmClear: (current: string) =>
      `Stop med at bruge ${current} som primær kalender? Så lægger Casy ingen aftaler i dine kalendere. Aftaler, der allerede er lagt der, bliver.`,
    yesChange: "Ja, skift",
    yesChoose: "Ja, brug den",
    yesStop: "Ja, stop",
    autoAdd: "Tilføj automatisk",
    autoAddHelp:
      "Når alle har sagt ja til en aftale, lægger Casy den i din primære kalender med det samme.",
    autoAddNeedsPrimary: "Vælg en primær kalender først.",
    badge: "Primær",
    makePrimary: "Gør til primær kalender",
    current: (name: string) => `Primær kalender: ${name}`,
    noneYet: "Ingen primær kalender valgt endnu.",
  },
  signIn: {
    title: "Log ind",
    intro: "Log ind for at forbinde dine kalendere og planlægge med dine grupper.",
    google: "Fortsæt med Google",
    or: "eller",
    linkSent: (email: ReactNode, button: ReactNode) => (
      <>
        Tjek din indbakke. Vi har sendt et login-link til {email}. Åbn det i denne browser for at
        logge ind. {button}
      </>
    ),
    otherEmail: "Brug en anden e-mail",
    confirmSent: (email: ReactNode, resend: ReactNode, other: ReactNode) => (
      <>
        Tjek din indbakke. Vi har sendt et link til {email}. Klik på det for at bekræfte din e-mail,
        så er din konto klar, og du er logget ind. Ingen mail? {resend} {other}
      </>
    ),
    confirmResend: "Send det igen",
    confirmResending: "Sender",
    confirmResent: "Sendt igen.",
    accountDeleted: "Din konto er slettet. Tak, fordi du brugte Casy.",
    captchaWait: "Et øjeblik: vi tjekker lige, at du ikke er en robot. Prøv igen om et par sekunder.",
    captchaFailed:
      "Vi kunne ikke tjekke, at du ikke er en robot. Genindlæs siden, slå en eventuel reklameblokering fra her, eller log ind med Google.",
    email: "E-mail",
    emailPlaceholder: "dig@eksempel.dk",
    sendingLink: "Sender link",
    sendLink: "Send mig et login-link",
    tabSignIn: "Log ind",
    tabSignUp: "Opret konto",
    resetSent: (email: ReactNode, button: ReactNode) => (
      <>
        Tjek din indbakke. Vi har sendt et link til at nulstille adgangskoden til {email}. {button}
      </>
    ),
    tryAgain: "Prøv igen",
    password: "Adgangskode",
    signingIn: "Logger ind",
    signInButton: "Log ind",
    sendingReset: "Sender link til nulstilling",
    forgot: "Glemt adgangskode?",
    createAccount: "Opret konto",
    creatingAccount: "Opretter konto",
    usePassword: "Brug en adgangskode i stedet",
    useLink: "Brug et e-mail-link i stedet",
    enterEmailFirst: "Skriv din e-mail ovenfor først.",
    newPasswordTitle: "Vælg en ny adgangskode",
    newPasswordIntro: "Næste gang kan du logge ind med den i stedet for et e-mail-link.",
  },
  join: {
    opening: "Åbner invitationen…",
    broken: "Invitationen virker ikke",
    brokenBody: (reason: string) =>
      `${reason} Invitationslinks virker i syv dage, så bed den, der sendte det, om et nyt.`,
    goToCasy: "Gå til Casy",
    invitedTo: "Du er inviteret til",
    membersSoFar: (n: number) => (n === 1 ? "1 medlem indtil videre" : `${n} medlemmer indtil videre`),
    privacy:
      "Medlemmer kan se hinandens navne, og hvornår de er optaget, så Casy kan finde et tidspunkt, der passer alle. Ingen kan se din e-mailadresse, navnene på dine kalendere eller hvad dine aftaler hedder.",
    alreadyIn: "Du er allerede med i gruppen.",
    findDate: "Find en dato",
    joinGroup: "Bliv medlem",
    signInToJoin: "Log ind for at blive medlem",
    comeBack: "Du kommer direkte tilbage hertil bagefter.",
  },
  api: {
    loadGroups: "Kunne ikke hente dine grupper",
    loadGroupCalendars: "Kunne ikke hente gruppens kalendere",
    createGroup: "Kunne ikke oprette gruppen",
    loadProfile: "Kunne ikke hente din profil",
    renameGroup: "Kunne ikke omdøbe gruppen",
    invite: "Kunne ikke lave et invitationslink",
    preview: "Kunne ikke åbne invitationen",
    joinGroup: "Kunne ikke blive medlem af gruppen",
    leaveGroup: "Kunne ikke forlade gruppen",
    deleteGroup: "Kunne ikke slette gruppen",
    setName: "Kunne ikke gemme dit navn",
    loadCalendars: "Kunne ikke hente dine kalendere",
    loadStatus: "Kunne ikke hente dine kalenderforbindelser",
    loadEvents: "Kunne ikke hente dine aftaler",
    suggestEvent: "Kunne ikke foreslå aftalen",
    cancelEvent: "Kunne ikke aflyse aftalen",
    acceptEvent: "Kunne ikke acceptere aftalen",
    declineEvent: "Kunne ikke afslå aftalen",
    noDateToAccept: "Aftalen har ingen dato at acceptere.",
    noDateToDecline: "Aftalen har ingen dato at afslå.",
    cantReschedule: "Aftalen kan ikke flyttes.",
    notInGroup: "Du er ikke længere med i gruppen.",
    checkAdmin: "Kunne ikke tjekke admin-adgang",
    loadAdmin: "Kunne ikke hente admin-oversigten",
    adminDeleteGroup: "Kunne ikke slette gruppen",
    adminRemoveMember: "Kunne ikke fjerne personen fra gruppen",
    adminDeleteAccount: "Kunne ikke slette kontoen",
    adminSync: "Kunne ikke synkronisere kontoen",
    loadPrimaryCalendar: "Kunne ikke hente din primære kalender",
    deleteAccount: "Kunne ikke slette din konto",
    setPrimaryCalendar: "Kunne ikke gemme din primære kalender",
    setAutoAdd: "Kunne ikke gemme Tilføj automatisk",
    addToCalendar: "Kunne ikke lægge aftalen i din kalender",
    downloadEvent: "Kunne ikke hente kalenderfilen",
    failed: (name: string, status: number) => `${name} fejlede (HTTP ${status})`,
  },
  admin: {
    title: "Admin",
    intro:
      "Hele Casy, kun for dig. Navne, datoer og synkroniseringsstatus, aldrig e-mails, optagede tidsrum eller detaljer om aftaler.",
    refresh: "Opdater",
    statUsers: "Brugere",
    statGroups: "Grupper",
    statAccounts: "Forbundne konti",
    statFailing: "Fejlende synkroniseringer",
    statBusy: "Gemte optagede tidsrum",
    dismiss: "Luk",
    tabGroups: "Grupper",
    tabUsers: "Brugere",
    tabCalendars: "Kalendersundhed",
    onlyNoCalendar: "Kun brugere uden kalender",
    onlyProblems: "Kun problemer",
    search: "Søg på navn",
    loading: "Henter alt…",
    noGroupMatch: "Ingen gruppe passer til det.",
    noGroups: "Ingen har lavet en gruppe endnu.",
    firstOnly: (n: string) => `Viser kun de første ${n} konti.`,
    noUserMatch: "Ingen bruger passer til det.",
    noProblems: "Ingen problemer. Alle konti synkroniserer.",
    noAccountMatch: "Ingen kalenderkonti passer til det.",
    groupMeta: (members: string, date: string, by: string | null) =>
      `${members} · lavet ${date}${by ? ` af ${by}` : ""}`,
    removeMemberTitle: (name: string, group: string) => `Fjern ${name} fra ${group}`,
    deleteGroupTitle: "Slet gruppen for alle",
    deleteGroupConfirm: (group: string, members: number) =>
      `Slet "${group}"? Alle ${members === 1 ? "1 medlem" : `${members} medlemmer`} mister den med det samme, sammen med dens invitationslinks. Det kan ikke fortrydes.`,
    deleteGroup: "Slet gruppe",
    removeLast: (name: string, group: string) =>
      `Fjern ${name}? Personen er det eneste medlem, så "${group}" bliver også slettet.`,
    removeMember: (name: string, group: string) =>
      `Fjern ${name} fra "${group}"? Personen skal have et nyt invitationslink for at komme ind igen.`,
    removeAndDelete: "Fjern og slet",
    remove: "Fjern",
    you: "Dig",
    joined: (date: string) => `Oprettet ${date}`,
    lastSignIn: (date: string) => ` · sidst logget ind ${date}`,
    groupsLabel: "grupper",
    calendarsLabel: "kalendere",
    deleteUserTitle: (name: string) => `Slet ${name}s konto`,
    impactAccounts: (n: number) => (n === 1 ? "1 kalenderkonto" : `${n} kalenderkonti`),
    impactNoGroups: "ingen grupper",
    impactGroups: (n: number) => (n === 1 ? "1 gruppemedlemskab" : `${n} gruppemedlemskaber`),
    impactSole: (n: number, sole: number) =>
      `${n === 1 ? "1 gruppemedlemskab" : `${n} gruppemedlemskaber`} (${sole === 1 ? "1 af dem en gruppe" : `${sole} af dem grupper`}, kun personen er med i, og som også slettes)`,
    deleteUserConfirm: (name: string, parts: string) =>
      `Slet ${name}s konto? Det fjerner personens ${parts} og alle optagede tidsrum, Casy har gemt for personen. Grupper med andre medlemmer fortsætter uden personen. Det kan ikke fortrydes, og det er ikke en udelukkelse: personen kan oprette sig igen.`,
    and: " og ",
    typeToConfirm: (name: ReactNode) => <>Skriv {name} for at bekræfte</>,
    deleteAccount: "Slet konto",
    neverSynced: "aldrig synkroniseret",
    connectingNeverFinished: "Forbindelsen blev aldrig færdig",
    connectingFailed: "Forbindelsen fejlede",
    needsReconnect: "Ejeren skal forbinde igen.",
    syncTitle: "Synkronisér kontoen nu",
    userDeleted: (who: string, groups: number) =>
      `${who} blev slettet` +
      (groups > 0 ? `, sammen med ${groups === 1 ? "1 gruppe" : `${groups} grupper`}, kun personen var med i.` : "."),
    theAccount: "Kontoen",
    syncedBlocks: (n: number) => `Synkroniseret: ${n === 1 ? "1 optaget tidsrum" : `${n} optagede tidsrum`}.`,
    syncFailed: "Synkroniseringen fejlede.",
    couldntDeleteGroup: "Kunne ikke slette gruppen",
    couldntRemove: "Kunne ikke fjerne personen",
    couldntDeleteAccount: "Kunne ikke slette kontoen",
    couldntLoad: "Kunne ikke hente admin-oversigten",
    providers: { google: "Google", outlook: "Outlook", apple: "iCloud", ics: "Kalenderlink" } as Record<
      string,
      string
    >,
  },
};

export type Messages = typeof da;
