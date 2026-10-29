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
    title: "Sprog",
  },
  safety: {
    report: "Rapportér",
    reportOrBlock: "Rapportér eller bloker",
    reportOrBlockDetail: "Hvis noget i gruppen ikke er i orden",
    reportEvent: "Rapportér aftalen",
    title: "Rapportér",
    intro: "Rapporten går til Casy. Den, du rapporterer, får ikke at vide, hvem der sendte den.",
    what: "Hvad drejer det sig om?",
    targetGroup: (group: string) => `Gruppen ${group}`,
    targetEvent: (title: string) => `Aftalen ${title}`,
    why: "Hvorfor?",
    reasons: {
      spam: "Spam eller reklame",
      offensive: "Stødende eller upassende",
      harassment: "Chikane eller trusler",
      other: "Noget andet",
    },
    note: "Fortæl mere (valgfrit)",
    blockToo: (name: string) => `Bloker også ${name}`,
    blockHelp: (name: string) =>
      `${name} kan ikke invitere dig til flere grupper. I er stadig i de grupper, I deler, til en af jer forlader dem.`,
    leaveToo: (group: string) => `Forlad ${group}`,
    send: "Send",
    sent: "Tak. Casy kigger på det.",
    blockSender: "Bloker afsenderen",
    blockSenderConfirm: (name: string) =>
      `Bloker ${name}? Invitationen afvises, og du får ikke flere fra ${name}. ${name} får det ikke at vide.`,
    block: "Bloker",
    blockedTitle: "Blokerede personer",
    blockedFootnote:
      "Folk, du har blokeret, kan ikke invitere dig til grupper. De får ikke at vide, at du har blokeret dem.",
    blockedSince: (date: string) => `Blokeret ${date}`,
    unknownName: "En tidligere bruger",
    unblock: "Fjern blokering",
    admin: {
      title: "Rapporter",
      intro:
        "Hvad folk har rapporteret, nyeste først, med teksten som den var. Hvem der rapporterede, vises aldrig. En rapport, der er klaret, slettes.",
      none: "Ingen rapporter.",
      handled: "Klaret",
      deleteGroup: "Slet gruppen",
      deleteGroupConfirm: (group: string) =>
        `Slet ${group || "gruppen"} for alle i den? Det kan ikke fortrydes.`,
      kinds: { group: "Gruppe", event: "Aftale", member: "Medlem" } as Record<string, string>,
    },
  },
  welcome: {
    headline: "Find dagen, hvor alle kan.",
    body: "Casy lægger jeres kalendere oven på hinanden og finder de datoer, der passer alle.",
    start: "Kom i gang",
    allCan: (n: number) => `Alle ${n} kan`,
    back: "Tilbage",
    yourCalendar: "Din kalender",
    calendarOf: (name: string) => `${name}${name.endsWith("s") ? "'" : "s"} kalender`,
    you: "Dig",
    steps: {
      pile: "Jeres kalendere lægges oven på hinanden",
      list: "Casy finder de datoer, der passer alle",
      swipe: "Vennerne swiper ja eller nej",
      added: "Aftalen lander i alles kalendere",
    },
    event: "Brætspilsaften",
    at: (time: string) => `Kl. ${time}`,
    agreed: "Aftalt",
  },
  updateRequired: {
    title: "Opdater Casy",
    body: "Denne version af Casy er for gammel til at virke sammen med resten af Casy. Hent den nyeste version i App Store for at fortsætte.",
    button: "Åbn App Store",
  },
  // A page that crashed while drawing (CrashScreen).
  crash: {
    title: "Noget gik galt.",
    reload: "Indlæs siden igen",
  },
  common: {
    cancel: "Annuller",
    done: "Færdig",
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
    meeting: "Hyggetime",
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
    home: "Hjem",
    groups: "Mine grupper",
    groupsShort: "Grupper",
    profile: "Profil",
    profileShort: "Profil",
    signIn: "Log ind",
    signOut: "Log ud",
    waitingForAnswer: (n: number) => `${n} venter på dit svar`,
  },
  groupsPage: {
    title: "Grupper",
    you: "Dig",
    members: "Medlemmer",
    invitePeople: "Invitér folk",
    empty: "Du er ikke i en gruppe endnu. Lav en, og invitér folk.",
    intro:
      "De grupper, du planlægger med. Her laver du nye, inviterer folk og svarer på invitationer.",
  },
  calendarAccounts: {
    back: "Tilbage til kalendere",
    row: "Forbundne kalendere",
    rowDetail: "Tilføj konti, synkronisér og vælg primær kalender",
    accounts: "Dine konti",
    add: "Tilføj en kalender",
    help: "Hjælp til at forbinde:",
    more: "Andre måder at forbinde",
    moreDetail: "Apple-kalender eller et kalenderlink",
  },
  appearance: {
    title: "Udseende",
    system: "Følg systemet",
    light: "Lys",
    dark: "Mørk",
    chosen: "Valgt",
  },
  profileHub: {
    settings: "Indstillinger",
    admin: "Admin-tilstand",
    security: "Log ind og sikkerhed",
    feedback: "Send feedback",
    feedbackSubject: "Feedback på Casy",
    feedbackPrompt: "Skriv her, hvad du tænker, eller hvad der ikke virker:",
    share: "Del Casy",
    shareText: "Casy finder den første dag, hvor alle kan. Prøv den her:",
    version: (release: string, build: string) => `Casy ${release} · ${build}`,
  },
  footer: {
    howItWorks: "Sådan virker det",
    support: "Hjælp og kontakt",
    terms: "Vilkår",
    privacy: "Privatliv",
  },
  /** Shown only to someone whose clock isn't Danish time (lib/viewerTime.ts). */
  timeZone: {
    note: "Alle tider er dansk tid",
    yours: (time: string) => `${time} din tid`,
  },
  scheduler: {
    // When no date is found: ways to widen the search that would (#135).
    widen: {
      title: "Ingen dato passer. Det her ville virke:",
      time: {
        morning: "Om formiddagen",
        lunch: "Til frokost",
        afternoon: "Om eftermiddagen",
        evening: "Om aftenen",
        any: "Når som helst på dagen",
      },
      days: "Alle ugedage",
      startDay: "Start en anden dag",
      shorter: (length: string) => `Kortere, ${length}`,
      months: (period: string) => `Længere periode, ${period}`,
      people: (n: number, of: number) => `Mindst ${n} af ${of}`,
      without: (names: string) => `uden ${names}`,
    },
    // The settings bar (desktop) and the sentence (phone).
    group: "Gruppe",
    name: "Hvad skal I",
    namePlaceholder: "Fx fredagsbar eller brætspil",
    startsAt: "Fra kl.",
    anyTime: "Når som helst",
    // Planlæg med AI's start window (#133): "dinner" with no time said.
    startWindow: (from: string, to: string) => `Mellem ${from} og ${to}`,
    duration: "Varighed",
    dayLabel: "Dage",
    tripToggle: "Tur / ferie",
    tripToggleAria: "Tur eller ferie over flere dage",
    tripDays: "Antal dage",
    tripStarts: "Starter",
    anyDay: "Alle dage",
    shorter: "Kortere",
    longer: "Længere",
    fewerDays: "Færre dage",
    moreDays: "Flere dage",
    sentenceAt: "fra kl.",
    sentenceFor: "i",
    sentenceOn: "på",
    sentenceFrom: "fra",
    sentenceAnyDay: "hvilken som helst dag",
    // When the event should happen (#74): the months searched.
    when: "Hvornår",
    period: {
      any: "når som helst",
      one: (month: string) => `i ${month}`,
      range: (from: string, to: string) => `${from} til ${to}`,
      // Exact days, set by Planlæg med AI (#134).
      until: (day: string) => `til ${day}`,
      day: (day: string) => `den ${day}`,
      daysHint: (period: string) =>
        `Casy har sat datoerne: ${period}. Tryk på en måned for at vælge måneder selv.`,
      hint: "Tryk på de måneder, det kan være i. Tryk på en af de yderste igen for at fjerne den.",
      anyButton: "Når som helst",
      done: "Færdig",
    },
    dayList: { all: "alle dage", weekdays: "hverdage", weekends: "weekender" },
    // The answer on top, and the day by day chart under it.
    // Who the date is known to work for: everyone, everyone with a calendar
    // (the others check it themselves), or nobody has one (#82).
    kickerAll: (name: string, who: "all" | "withCalendar" | "nobody") => {
      const what =
        who === "all"
          ? "første dato hvor alle kan"
          : who === "withCalendar"
            ? "første dato for alle med kalender"
            : "første mulige dato";
      return name ? `${name}: ${what}` : what.charAt(0).toUpperCase() + what.slice(1);
    },
    // "At least N" (#89): the date enough can make, and who can't.
    kickerEnough: (name: string, n: number) =>
      name ? `${name}: første dato hvor mindst ${n} kan` : `Første dato hvor mindst ${n} kan`,
    absent: (names: string) => `${names} kan ikke.`,
    checkThemselves: (names: string) =>
      `${names} har ingen kalender i Casy og tjekker selv datoen.`,
    nobodyHasCalendar: "Ingen i gruppen har en kalender i Casy endnu, så alle tjekker selv datoen.",
    outdatedOne: (name: string, n: number) =>
      `Kalenderen for ${name} er ikke opdateret i ${days(n)}, så noget kan have ændret sig.`,
    outdatedMany: (names: string) =>
      `Kalenderne for ${names} er ikke opdateret i flere dage, så noget kan have ændret sig.`,
    inDays: (n: number) => (n <= 0 ? "i dag" : n === 1 ? "i morgen" : `om ${days(n)}`),
    timeRange: (start: string, end: string) => `${start} til ${end}`,
    tripTimes: (start: string, end: string) => `Afgang ${start}, hjem ${end}`,
    countCan: (n: number, total: number) => `${n} af ${total} kan`,
    nextOption: "Næste mulighed",
    nextShort: "Næste",
    suggestShort: "Foreslå",
    chartTitle: (month: string) => `${month}, dag for dag`,
    legendAll: "Alle kan",
    legendEnough: "Nok kan",
    legendFree: "Ledige",
    legendOff: "Ikke valgt",
    alsoPossible: "Også muligt",
    suggest: "Foreslå datoer",
    checking: "Tjekker kalendere…",
    checkingShort: "Tjekker…",
    refreshedDate: "Opdateret med de nyeste kalendere.",
    changedBeforeSending:
      "Nogens kalender er ændret, så datoen er opdateret. Se den igen, og foreslå den, hvis den passer.",
    suggested: "Foreslået",
    sent: (link: ReactNode) => <>Sendt til gruppen. {link}.</>,
    sentLink: "Følg svarene under Mine aftaler",
    hintSignIn: "Log ind og lav en gruppe for at foreslå aftaler.",
    hintExample: "Lav en gruppe for at foreslå aftaler til rigtige mennesker.",
    hintEveryone: (n: number) =>
      `Casy sender op til ${n} gode datoer, som alle swiper sig igennem.`,
    hintAccept: "Godkend først, at du skal have fri.",
    copyLink: "Kopiér link",
    copiedLink: "Kopieret!",
    previousTime: "Forrige forslag",
    freeWithTimeOff: "kun ledig med fri",
    freeIfSkipping: "kun ledig ved at springe over",
    cellTitle: (free: number, total: number, needTimeOff: number) =>
      `${free} af ${total} kan${needTimeOff > 0 ? `, ${needTimeOff} skal have fri` : ""}`,
    cellTitleSkip: (free: number, total: number, skipping: number) =>
      `${free} af ${total} kan${skipping > 0 ? `, ${skipping} skal springe noget over` : ""}`,
    noVacation: (n: number) =>
      `Der er ingen periode på ${days(n)}, hvor hele gruppen kan. Prøv færre dage eller en anden gruppe.`,
    noTrip:
      "Ingen uge har et ledigt tidsrum til turen for hele gruppen. Prøv at ændre, hvilke dage turen dækker.",
    noSingle: (time: string) =>
      `Intet tidspunkt kl. ${time} på de valgte dage passer hele gruppen. Prøv et andet starttidspunkt, en anden varighed eller flere dage.`,
    noSingleWindow: (from: string, to: string) =>
      `Ingen dag har et starttidspunkt mellem kl. ${from} og ${to}, som passer hele gruppen, på de valgte dage. Prøv et andet starttidspunkt, en anden varighed eller flere dage.`,
    noSingleAnyTime: (duration: string) =>
      `Ingen dag har ${duration} i træk mellem kl. 10 og 22, som passer hele gruppen, på de valgte dage. Prøv en anden varighed eller flere dage.`,
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
    worksIfSkipping: "Passer, hvis der springes over",
    youSkip: (titles: string) => `Du springer ${titles} over. `,
    othersSkip: (names: string) => `${names} springer noget over. `,
    skipWhy: "Ingen dato inden for en uge passer uden.",
    youApprovedDates: "Du har godkendt at tage fri på de datoer.",
    suggestionFits: (
      requested: number,
      needsTimeOff: boolean,
      fits: number,
      span: string,
      extra: string,
    ) => (
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
      <>
        De andre her er eksempeldata. {link} og lav en gruppe for at finde en dato med rigtige
        mennesker.
      </>
    ),
    exampleSignedInLink: "Forbind en kalender",
    busyFailed: "Kunne ikke hente gruppens kalendere, så tiderne er ufuldstændige.",
    noCalendars: "Ingen i gruppen har forbundet en kalender endnu, så der er ikke noget at søge i.",
    busyLoading: "Henter alles kalendere…",
    realTimes:
      "Tiderne kommer fra hvert medlems egne kalendere. Ingen kan se, hvad dine aftaler hedder.",
  },
  // The scheduling page's settings box on a computer (SettingsPanel), and
  // The settings box's tabs (#98), and Flere indstillinger on a tablet.
  settingsPanel: {
    tabsLabel: "Indstillinger for aftalen",
    tabs: {
      time: "Tidspunkt",
      people: "Deltagere",
      place: "Sted og note",
      vote: "Afstemning",
    },
    kind: "Slags aftale",
    meeting: "Møde",
    trip: "Tur / ferie",
    more: "Flere indstillinger",
    moreShort: "Mere",
    moreIntro: "Flere måder at beskrive aftalen på. Tidspunktet vælger du på planlægningssiden.",
    back: "Planlæg",
    // Deltagere (#89): who an event is for, and how many must be able to come.
    people: {
      intro: "Tryk på et navn: med, valgfri eller ikke med. Valgfri tæller ikke med i søgningen.",
      introRows: "Valgfri tæller ikke med i søgningen.",
      example: "Lav en gruppe for at vælge, hvem der skal med.",
      states: { required: "Med", optional: "Valgfri", out: "Ikke med" },
      stateLabel: (name: string, state: string) => `${name}: ${state}. Tryk for at skifte.`,
      howMany: "Hvor mange skal kunne",
      all: "Alle",
      atLeast: "Mindst",
      allMust: "Alle skal kunne",
      ofRequired: (n: number, of: number) => `${n} af ${of}`,
      fewer: "Færre",
      more: "Flere",
      meetingsOnly: "Mindst et antal gælder kun møder.",
    },
    place: {
      intro: "Skriv, hvor I mødes, og hvad de andre skal vide. Det vises sammen med datoerne.",
      where: "Sted",
      wherePlaceholder: "Fx hos Sara",
      note: "Note",
      notePlaceholder: "Fx tag et spil med",
    },
    vote: {
      intro: "Bestem, hvor længe de andre har til at svare, og hvor mange datoer de stemmer om.",
      deadline: "Svarfrist",
      dates: "Antal datoer",
      upTo: (n: number) => `Op til ${n}`,
    },
  },
  // The scheduling page on a phone (#101): four steps, one screen each.
  schedulerFlow: {
    // The Planlæg sheet's heading over the settings (#126).
    what: "Hvad og hvornår",
    newGroup: "Ny gruppe",
    newGroupDetail: "Inviter folk bagefter",
    examples: "Eksempler",
    // The details step's Deltagere row, and its sheet.
    peopleAll: (n: number) => `Alle ${n}`,
    peopleSome: (required: number, optional: number) =>
      `${required} med${optional > 0 ? `, ${optional} valgfri` : ""}`,
    peopleAtLeast: (n: number) => `, mindst ${n}`,
    done: "Færdig",
    // The suggest button: what pressing it does, in so many words.
    send: "Send datoer til afstemning",
    sent: "Sendt til afstemning",
    needSkip: (names: string) => `${names} springer noget over`,
    needTimeOff: (names: string) => `${names} skal have fri`,
  },
  // Planning with AI (#100): the event described in words or speech.
  aiPlan: {
    backToSettings: "Indstillinger",
    youWrote: "Det du skrev",
    kinds: { meeting: "Møde", trip: "Tur", holiday: "Ferie" },
    rows: {
      name: "Navn",
      kind: "Slags",
      time: "Tidspunkt",
      days: "Dage",
      when: "Hvornår",
      place: "Sted",
      note: "Note",
      people: "Deltagere",
    },
    tripFrom: (days: string, weekday: string) => `${days} fra ${weekday}`,
    without: (names: string) => `uden ${names}`,
    start: "Planlæg med AI",
    placeholder: "Fx middag en fredag aften i november, uden Peter",
    morePlaceholder: "Tilføj detaljer",
    send: "Lav planen",
    update: "Opdater planen",
    updateShort: "Opdater",
    thinking: "Casy tænker…",
    addDetails: "Tilføj detaljer",
    cancel: "Annuller",
    again: "Beskriv på ny",
    speak: "Tal",
    stopSpeaking: "Stop",
    listening: "Lytter…",
    micDenied: "Casy fik ikke lov at bruge mikrofonen. Du kan skrive i stedet.",
    micFailed: "Talegenkendelsen virkede ikke. Du kan skrive i stedet.",
    understood: "Sådan forstod Casy det",
    guessed: "gættet",
    guessedNote: "Det markerede har Casy gættet. Ret det, hvis det ikke passer.",
    other: "Andet",
    otherPlaceholder: "Skriv dit svar",
    answer: "Svar",
    whoIs: (name: string) => `Hvem er ${name}?`,
    noOneNamed: (name: string) => `Ingen i gruppen hedder ${name}. Hvem mener du?`,
    noneOfThem: "Ingen af dem",
    quickQuestion: "Lige et spørgsmål",
    left: (n: number) => (n === 1 ? "1 AI-svar tilbage i dag" : `${n} AI-svar tilbage i dag`),
  },
  // Tell Casy (#116): what is in no calendar, said or written and checked before it is kept.
  trips: {
    // Trip detection (#115): the bars on My calendar and the sheet a tap opens.
    barPending: (city: string) => `Rejse til ${city}?`,
    barAccepted: (city: string) => `Rejse til ${city}`,
    barReturn: (city: string) => `Hjem fra ${city}?`,
    barOutbound: (city: string) => `Afrejse til ${city}?`,
    title: (city: string) => `Rejse til ${city}`,
    found: "Casy fandt en rejse i din kalender:",
    away: (from: string, to: string) => `Du er væk fra ${from} til ${to}.`,
    acceptNote:
      "Siger du ja, står rejsen i din kalender som tid, du er væk. Du kan altid slette den igen.",
    accept: "Ja, det passer",
    decline: "Nej, det er ikke en rejse",
    acceptedNote: "Du har sagt ja til rejsen, så den står som tid, du er væk.",
    remove: "Slet rejsen",
    addToCalendar: "Læg i min kalender",
    adding: "Lægger i kalenderen",
    inCalendar: "Står i din kalender",
    addedTo: (calendar: string) => `Lagt i ${calendar}.`,
    calendarNote: "Lagt ind af Casy.",
    returnTitle: (city: string) => `Hvornår kommer du hjem fra ${city}?`,
    returnIntro:
      "Casy kan se, at du rejser ud, men ikke hvornår du kommer hjem. Måske kører du hjem, eller hjemrejsen står ikke i din kalender.",
    outboundTitle: (city: string) => `Hvornår tager du til ${city}?`,
    outboundIntro:
      "Casy kan se, at du rejser hjem, men ikke hvornår du tog af sted. Måske kørte du derud, eller udrejsen står ikke i din kalender.",
    pickDay: "Vælg dagen",
    confirmReturn: (day: string) => `Hjemme ${day}`,
    confirmOutbound: (day: string) => `Af sted ${day}`,
    previousMonth: "Forrige måned",
    nextMonth: "Næste måned",
    notATrip: "Det er ikke en rejse",
    homeTitle: "Hvor bor du?",
    homeIntro:
      "Casy fandt en rejse, men kan ikke se, hvilken ende der er hjemme. Svar én gang, så kan Casy se, hvornår du er væk.",
    noneOfThem: "Ingen af dem",
    route: (from: string, to: string) => `${from} til ${to}`,
    modes: { flight: "Fly", train: "Tog", bus: "Bus" },
    at: (date: string, time: string) => `${date} kl. ${time}`,
  },
  tellCasy: {
    title: "Fortæl Casy",
    button: "Fortæl Casy",
    rowDetail: "Rejser og andet, der ikke står i en kalender",
    done: "Færdig",
    placeholder: "Fx jeg rejser fra den 12. til den 19. oktober",
    morePlaceholder: "Tilføj detaljer, eller ret noget",
    send: "Tilføj til kalender",
    update: "Opdater",
    thinking: "Casy læser…",
    understood: "Sådan forstod Casy det",
    kinds: { away: "Væk", busy: "Optaget" },
    nothingFound: "Casy fandt ingen tider i det, du skrev. Prøv at sige det på en anden måde.",
    save: (n: number) => (n === 1 ? "Gem 1 post" : `Gem ${n} poster`),
    saving: "Gemmer…",
    addDetails: "Tilføj detaljer",
    again: "Start forfra",
    leaveOut: (label: string) => `Drop ${label}`,
    kept: "Det har du fortalt Casy",
    keptNote:
      "Det tæller med, når dine grupper finder en dato, og vises i din kalender. De andre ser kun, at du ikke kan, aldrig hvad du skrev eller sagde.",
    remove: (label: string) => `Slet ${label}`,
    failed: "Casy kunne ikke læse det lige nu. Prøv igen.",
    saveFailed: "Posterne blev ikke gemt. Prøv igen.",
    deleteFailed: "Posten blev ikke slettet. Prøv igen.",
  },
  // An event's place and note (#84), on My events and the swipe card.
  eventDetails: {
    place: "Sted",
    note: "Note",
    edit: "Ret sted og note",
    add: "Tilføj sted eller note",
    save: "Gem",
    saving: "Gemmer…",
    cancel: "Annuller",
  },
  groupSwitcher: {
    select: "Vælg gruppe",
    yourGroups: "Dine vennegrupper",
    newGroup: "Ny gruppe",
  },
  groupPanel: {
    noProfileTitle: "Har du ikke en profil endnu?",
    noProfileBody:
      "Opret en profil for at forbinde din egen kalender og lave en gruppe med rigtige mennesker.",
    signUp: "Opret profil",
    members: (n: number) => (n === 1 ? "1 medlem" : `${n} medlemmer`),
    whatMembersSee: "Hvad medlemmer kan se",
    whatMembersSeeBody:
      "Alle i en gruppe kan se hinandens navne, og hvornår de er optaget, og om en kalender ikke er opdateret i flere dage. Ingen kan se din e-mailadresse, navnene på dine kalendere eller hvad dine aftaler hedder. Casy gemmer slet ikke titler på aftaler i dine kalendere.",
    noCalendarYet: "tjekker selv",
    waitingOne: (name: string) =>
      `${name} har ingen kalender i Casy og tjekker selv de datoer, der bliver foreslået.`,
    waitingMany: (n: number) =>
      `${n} medlemmer har ingen kalender i Casy og tjekker selv de datoer, der bliver foreslået.`,
    waitingWhy: "Med en kalender bliver de talt med automatisk.",
    invite: "Invitér folk",
    lastMember: (name: string) =>
      `Du er det sidste medlem. Hvis du forlader "${name}", bliver gruppen slettet for altid.`,
    leaveConfirm: (name: string) => `Forlad "${name}"? Du skal inviteres igen for at komme ind.`,
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
    nameLabel: "Gruppenavn",
    next: "Næste",
    placeholder: "f.eks. Brætspilsaften",
    descriptionLabel: "Hvad er gruppen til? (valgfrit)",
    descriptionPlaceholder: "f.eks. Brætspil hver anden torsdag",
  },
  groupDescription: {
    add: "Tilføj en beskrivelse",
    change: "Ændr beskrivelsen",
    title: "Beskrivelse",
    label: "Hvad er gruppen til?",
    placeholder: "f.eks. Brætspil hver anden torsdag",
    footnote:
      "Alle i gruppen kan ændre beskrivelsen. Den vises i invitationer og på invitationslinkets side.",
  },
  invite: {
    title: (group: string) => `Invitér til ${group}`,
    people: "Folk fra dine grupper",
    peopleEmpty: "Når du er i en gruppe med nogen, kan du invitere dem herfra.",
    allIn: "Alle, du kender fra dine grupper, er allerede med.",
    from: (groups: string) => `Fra ${groups}`,
    filter: "Søg efter navn",
    noMatch: "Ingen med det navn.",
    invited: "Inviteret",
    email: "Med e-mail",
    emailPlaceholder: "navn@eksempel.dk",
    addEmail: "Tilføj",
    removeEmail: (email: string) => `Fjern ${email}`,
    notAnEmail: "Det ligner ikke en e-mailadresse.",
    tooManyEmails: (n: number) => `Højst ${n} adresser ad gangen.`,
    emailHelp:
      "Har adressen en Casy-konto, får personen en invitation. Du får ikke at vide, om den har.",
    consent: "De bliver først medlemmer, når de selv siger ja.",
    send: (n: number) => (n <= 1 ? "Send invitation" : `Send ${n} invitationer`),
    sent: "Invitationerne er sendt.",
    sentWithEmail: "Invitationerne er sendt. Har en af adresserne en Casy-konto, får de også en.",
    orLink: "Eller del et link",
    linkHelp: (expiry: string) =>
      `Alle med linket kan blive medlem, uden at nogen skal sige ja, så send det kun til dem, du vil have med. Det virker i ${expiry}.`,
    makeLink: "Lav et link",
    makingLink: "Laver et link…",
    fromContacts: "Invitér fra kontakter",
    message: (group: string) =>
      `Bliv medlem af ${group} på Casy, så vi kan finde en dato, der passer alle:`,
    shareTitle: (group: string) => `Bliv medlem af ${group} på Casy`,
    texted: "Beskeden er sendt.",
    textFailed: "Beskeden kunne ikke sendes. Prøv igen, eller del linket.",
    shareLink: "Del link",
    showQr: "Vis QR-kode",
    hideQr: "Skjul QR-kode",
    qrLabel: (group: string) => `QR-kode til at blive medlem af ${group}`,
    qrHelp: "Lad dem scanne koden med kameraet på deres telefon.",
    close: "Luk",
  },
  providers: {
    apple: { label: "Apple-kalender", help: "Få hjælp til at forbinde" },
    device: { label: "Denne telefon", help: "Sådan virker det" },
    ics: { label: "Kalenderlink (ICS)", help: "Sådan finder du dit link" },
    google: { label: "Google Kalender", help: "Sådan virker det" },
    outlook: { label: "Outlook-kalender", help: "Sådan virker det" },
  },
  aiConsent: {
    // The profile's row, and the box asked once on My calendar (#120).
    group: "AI og din kalender",
    row: "Lad Casys AI læse i din kalender",
    rowOn: "Slået til",
    rowOff: "Slået fra",
    footnote: (privacy: ReactNode) => (
      <>
        Slået til sender Casy navnene på dine kalendere og titlerne på dine aftaler til Anthropic,
        som laver AI-modellen Claude, så Casy kan sortere dine kalendere og vurdere, hvad dine
        aftaler betyder for dig. For fly, tog og busser følger stedet med, så Casy kan finde dine
        rejser. Casy deler også, uden titler, hvornår noget vigtigt starter, så datoer kan rangeres
        for gruppen. Du kan slå det fra når som helst. Læs mere i {privacy}.
      </>
    ),
    privacyLink: "privatlivspolitikken",
    title: "Lad Casys AI læse i din kalender?",
    intro:
      "Så kan Casy sortere dine kalendere og forstå, hvad dine aftaler betyder, for eksempel at en eksamen er vigtig.",
    sent: "Navnene på dine kalendere og titlerne på dine aftaler (i iPhone-appen) sendes til Anthropic i USA, som laver AI'en. For fly, tog og busser også stedet, så Casy kan finde dine rejser og spørge dig om dem. Aldrig noter, gæster eller datoer.",
    corrections:
      "Casy modtager også de rettelser, du skriver til AI'ens vurderinger, med aftalens titel, og de planer, du laver med AI, med det du skrev og det du ændrede, så AI'en kan lære af dem. Du kan slå det fra under Dine data.",
    shared:
      "Casy deler også, uden titler, hvornår noget vigtigt starter, så datoer kan rangeres for gruppen. De andre ser kun en score for hver dato.",
    safe: "Casy gemmer ikke navne eller titler, Anthropic træner ikke på dem, og du kan slå det fra når som helst under Dine data.",
    privateNote: "Titler kan være private, så sig kun ja, hvis du er tryg ved det.",
    readMore: "Læs mere i",
    allow: "Tillad",
    next: "Næste",
    pages: ["Hvad det giver", "Hvad der sendes", "Hvad Casy modtager", "Din kontrol"],
    pageDot: (n: number, of: number) => `Side ${n} af ${of}`,
    notNow: "Ikke nu",
    saving: "Gemmer",
    failed: "Det lykkedes ikke. Prøv igen.",
    turnOffMessage:
      "Casys AI holder op med at læse i din kalender, og de mærkater, der er gemt på denne telefon, og det, du har delt om vigtige aftaler og dine sendte rettelser, slettes.",
    turnOff: "Slå fra",
  },
  connectPrompt: {
    title: "Forbind din kalender",
    body: "Indtil da kan Casy ikke se, hvornår du er optaget, så den finder datoer uden dig. Hvor ligger din kalender?",
    privacy: "Casy ser kun, hvornår du er optaget, aldrig hvad du laver.",
    hints: {
      apple: "iPhone, iPad og Mac",
      google: "Gmail og Android",
      outlook: "Microsoft 365, Outlook.com og Hotmail",
      device: "Alle kalendere på telefonen, uden adgangskode",
      ics: "Andre kalendere med et link",
    },
    later: "Ikke nu",
  },
  earlyMorning: {
    you: "Du",
    oneYou: (time: string) => `Bemærk: Du har noget kl. ${time} næste morgen.`,
    one: (who: string, time: string) => `Bemærk: ${who} har noget kl. ${time} næste morgen.`,
    many: (list: string) => `Bemærk: ${list} har noget tidligt næste morgen.`,
  },
  newYearsDay: "Bemærk: Det er dagen efter nytårsaften.",
  backToBack: {
    you: "Du",
    oneYou: "Bemærk: Du har noget, der slutter lige når aftalen starter.",
    one: (who: string) => `Bemærk: ${who} har noget, der slutter lige når aftalen starter.`,
    many: (list: string) => `Bemærk: ${list} har noget, der slutter lige når aftalen starter.`,
  },
  counts: {
    calendars: (n: number) => (n === 1 ? "1 kalender" : `${n} kalendere`),
    busyBlocks: (n: number) => (n === 1 ? "1 optaget tidsrum" : `${n} optagede tidsrum`),
    members: (n: number) => (n === 1 ? "1 medlem" : `${n} medlemmer`),
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
    connectedCalendars: "Forbundne kalendere",
    onboardingTitle: "Forbind din kalender",
    onboardingIntro:
      "Så snart du har forbundet en kalender, kan Casy finde datoer, der passer for hele gruppen.",
    syncing: "Synkroniserer",
    syncNow: "Synkronisér nu",
    syncAllFresh: "Alt blev synkroniseret inden for det sidste minut.",
    syncedAccounts: (n: number) => `Synkroniserede ${n === 1 ? "1 konto" : `${n} konti`}.`,
    syncSomeFailed: (failed: number, n: number) =>
      `${failed} af ${n === 1 ? "1 konto" : `${n} konti`} kunne ikke synkroniseres. Se nedenfor.`,
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
    couldntStartConnect: "Kunne ikke begynde at forbinde",
    couldntSync: "Kunne ikke synkronisere",
    couldntAddLink: "Kunne ikke tilføje linket",
    couldntRemove: "Kunne ikke fjerne kontoen",
    couldntIcloud: "Kunne ikke forbinde til Apple-kalender",
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
    tryAgain: "Prøv igen",
    connect: "Forbind",
    lastFailed: (message: string) => `Sidste forsøg fejlede: ${message}`,
    unknownError: "ukendt fejl",
    removeDevice: (label: string | null) =>
      `Fjern ${label ?? "denne telefon"}? De optagede tidsrum fra telefonen slettes fra Casy, og appen holder op med at sende dem. Casys adgang til kalenderen kan også slås fra under Casy i telefonens Indstillinger.`,
    phoneUpdates: "opdateres, når du åbner appen",
  },
  phoneCalendar: {
    connected: (calendars: string, blocks: string) =>
      `Telefonen er forbundet: ${calendars} med ${blocks}. Casy opdaterer dem, hver gang du åbner appen.`,
    denied:
      "Casy har ikke adgang til telefonens kalendere. Slå Kalendere til under Casy i Indstillinger, og prøv igen.",
    openSettings: "Åbn Indstillinger",
    needTitle: "Casy kan ikke se nogen kalender endnu",
    phoneTitle: "Telefonens kalender er ikke med endnu",
    notNow: "Ikke nu",
    needBody:
      "Importér telefonens kalender, så Casy kan se, hvornår du er optaget. Casy gemmer kun tidspunkterne, aldrig titlerne.",
    needAsk: "iPhone spørger dig først, om Casy må se kalenderen.",
    importCalendar: "Importér min kalender",
    allowAndImport: "Tillad og importér",
    importing: "Importerer",
    nothingOnPhone: "Der var ingen kalendere på telefonen at importere.",
    otherCalendar: "Brug en anden kalender",
    couldntRead: "Kunne ikke læse telefonens kalendere. Prøv igen.",
    couldntSave: "Kunne ikke gemme telefonens kalendere.",
    updatesInApp: (synced: string | null) =>
      `Telefonens kalendere opdateres, når du åbner Casy-appen på telefonen.${synced ? ` ${synced}.` : ""}`,
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
    made: (date: string) => `lavet ${date}`,
    renameTitle: "Omdøb gruppen",
    deleteTitle: "Slet gruppen for alle",
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
    invitations: "Invitationer",
    invitedBy: (name: string) => `${name} har inviteret dig`,
    invitedAnon: "Du er inviteret",
    joinMeans: "Siger du ja, kan gruppens medlemmer se dit navn, og hvornår du er optaget.",
    join: "Deltag",
    noThanks: "Nej tak",
    emptyTitle: "Ingen aftaler endnu",
    emptyBody:
      "Find en dato på planlægningssiden, og tryk på Foreslå datoer. Datoerne dukker op her, så alle i gruppen kan svare på dem.",
    emptyBodyPhone:
      "Planlæg noget fra din kalender, så dukker datoerne op her, og alle i gruppen kan svare.",
    findDate: "Find en dato",
    needsAnswer: "Venter på dit svar",
    keepIt: "Behold den",
    waitingForOthers: "Venter på andre",
    waitingFor: (names: string) => `Venter på ${names}`,
    scheduled: "Planlagt",
    acceptedByAll: "Accepteret af alle",
    showMembers: (name: string) => `Vis medlemmer af ${name}`,
    pastClosed: "Tidligere og lukkede",
    noDate:
      "Ingen dato i det næste år passer alle længere. Foreslå den igen fra planlægningssiden.",
    happened: (date: string) => `Fandt sted: ${date}.`,
    passed: (date: string) => `Datoen gik, før alle havde svaret: ${date}.`,
    cancelConfirm: "Aflys aftalen for alle?",
    cancelEvent: "Aflys aftale",
    leaveConfirm:
      "Forlad aftalen? Den fortsætter uden dig, og Casy fjerner den fra din kalender, hvis Casy satte den ind.",
    leaveEvent: "Forlad aftale",
    stayIn: "Bliv med",
    you: "Dig",
    optional: "valgfri",
    youSuggested: "Du foreslog den",
    suggestedBy: (name: string) => `Foreslået af ${name}`,
    newDateBecause: (who: string, date: string) => `. Ny dato, fordi ${who} ikke kunne ${date}`,
    answers: "Svar",
    answered: {
      accepted: "Har sagt ja",
      maybe: "Kan, men helst ikke",
      declined: "Har sagt nej",
      none: "Har ikke svaret endnu",
    },
    earlierDates: "Datoer tilbudt før",
    stagePast: "Overstået",
    stageNoDate: "Ingen dato",
    couldntMake: (who: string) => `${who} kunne ikke`,
    // Votes (#74): several dates, swiped through.
    datesToAnswer: (n: number) => (n === 1 ? "1 dato at svare på" : `${n} datoer at svare på`),
    dateCount: (n: number) => (n === 1 ? "1 dato" : `${n} datoer`),
    ahead: "Bedst lige nu",
    bestPick: "Passer flest",
    choose: "Vælg",
    // A phone's list of events (#103): one line under each event's name.
    answeredOf: (n: number, total: number) => `${n} af ${total} har svaret`,
    canOnDate: (n: number) => `${n} kan`,
    cantOnDate: (n: number) => `${n} kan ikke`,
    answerNow: "Svar",
    cantAfterAll: "Kan ikke alligevel",
  },
  /** Swiping through a vote's dates (#74). */
  swipe: {
    yourCalendar: "Din kalender",
    noCalendar: "Forbind en kalender, så ser du dine planer omkring hver dato her.",
    week: (n: number) => `U${n}`,
    openCalendar: "Åbn din kalender",
    done: "Færdig",
    showMonth: (month: string) => `Vis ${month}`,
    weekBack: "Forrige uge",
    weekOn: "Næste uge",
    toSuggestion: "Forslaget",
    connect: "Forbind kalender",
    dateOf: (n: number, total: number) => `Dato ${n} af ${total}`,
    // How well the date suits the group by everyone's important events (#119).
    matchScore: (n: number) => `Passer ${n}%`,
    matchScoreNote: "Hvor godt datoen passer til gruppens vigtige aftaler",
    can: "Kan",
    cant: "Kan ikke",
    rather: "Helst ikke",
    answerLong: {
      accepted: "Jeg kan",
      maybe: "Jeg kan, men helst ikke",
      declined: "Jeg kan ikke",
    },
    answerWord: { accepted: "Kan", maybe: "Helst ikke", declined: "Kan ikke" },
    notAnswered: "Ikke svaret",
    youAnswered: (answer: string) => `Du svarede: ${answer}`,
    clash: (what: string, when: string, more: number) =>
      `Du har ${what}${when ? ` ${when}` : ""}${more > 0 ? ` og ${more} mere` : ""}`,
    previous: "Forrige dato",
    hint: "Swipe til højre, hvis du kan, til venstre, hvis du ikke kan, og op, hvis du kan, men helst ikke.",
    keysHint: "Brug knapperne eller piletasterne: højre kan, venstre kan ikke, op helst ikke.",
    doneTitle: "Tak, du har svaret",
    settledTitle: "Datoen er fundet",
    seeEvent: "Se aftalen",
    noDates: "Alle datoerne er allerede begyndt.",
    chooseNow: "Ingen dato passer alle. Vælg den, der passer bedst.",
    waitingForChoice: (name: string) => `Ingen dato passer alle, så ${name} vælger en.`,
    waitingFor: (names: string) => `Venter på svar fra ${names}.`,
    deciding: "Alle har svaret, så datoen er ved at blive fundet.",
    decidedBy: (day: string, time: string) =>
      `Afgøres senest ${day} kl. ${time}, også uden de sidste svar.`,
    goChoose: "Vælg datoen",
    tapToChange: "Tryk for at rette",
    changeAnswerFor: (date: string) => `Ret dit svar for ${date}`,
    changeAfter:
      "Kan du ikke alligevel? Ret dit svar til datoen herunder, så finder Casy en ny dato til alle.",
    moveConfirm:
      "Det er den dato, der er valgt. Siger du, at du ikke kan, finder Casy en ny dato til alle ud fra jeres svar.",
    moveYes: "Jeg kan ikke, find en ny",
    moveKeep: "Behold datoen",
    moved: (date: string) => `Datoen er flyttet til ${date}.`,
    yourAnswers: "Dine svar",
  },
  /** Warnings on a date against your own important events (#114). */
  importantClash: {
    when: (daysAfter: number) =>
      daysAfter <= 0 ? "samme dag" : daysAfter === 1 ? "dagen efter" : `${daysAfter} dage efter`,
    nightBefore: (what: string, when: string, avoid: string) =>
      `Det ligner, at du har ${what} ${when}: hold aftenen før fri for ${avoid}`,
    prepDayBefore: (what: string, when: string) =>
      `Det ligner, at du har ${what} ${when}: dagen før bør være fri`,
    prep: (what: string, when: string) =>
      `Det ligner, at du har ${what} ${when}: du skal nok bruge dagene før på at forberede dig`,
    recovery: (what: string, when: string) =>
      `Det ligner, at du har ${what} ${when}, og du skal nok bruge den dag på at komme dig`,
    /** What kind of event it is, said vaguely; the name is behind "Vis mig". */
    kinds: {
      exam: "en eksamen",
      deadline: "en aflevering",
      presentation: "en fremlæggelse",
      interview: "en jobsamtale",
      lecture: "undervisning",
      study: "læsning",
      work: "arbejde",
      shift: "en vagt",
      meeting: "et møde",
      appointment: "en aftale",
      flight: "et fly",
      travel: "en rejse",
      stay: "en overnatning",
      wedding: "et bryllup",
      funeral: "en begravelse",
      birthday: "en fødselsdag",
      party: "en fest",
      dinner: "en middag",
      social: "en aftale",
      sport: "træning",
      competition: "en konkurrence",
      show: "en oplevelse",
      vacation: "ferie",
      family: "noget med familien",
      chores: "et gøremål",
      reminder: "noget",
      other: "noget vigtigt",
      unclear: "noget vigtigt",
    },
    show: "Vis mig",
    hide: "Skjul",
    /** "Corporate Finance eksamen, tirsdag 19. januar kl. 09:00" */
    detail: (title: string, day: string, time: string) =>
      `${title}, ${day}${time ? ` kl. ${time}` : ""}`,
    avoid: {
      lateNight: "sen aften",
      alcohol: "alkohol",
      travel: "lang rejse",
      exercise: "hård træning",
    },
    and: "og",
    confirm: "Datoen går ud over noget vigtigt for dig. Vil du svare ja alligevel?",
    confirmYes: "Ja alligevel",
    confirmNo: "Tilbage",
  },
  /** What Casy's AI expects a planned event to involve (#113), for admins while it is tested. */
  eventImpact: {
    toggle: "Casys vurdering",
    effects: {
      lateNight: "Sen aften",
      alcohol: "Alkohol",
      travel: "Lang rejse",
      exercise: "Hård træning",
    },
    runsLate: "Trækker tit ud",
    outdoors: "Udendørs",
    daylight: "Kræver dagslys",
    testersOnly: "Kun administratorer og AI-testere ser dette, mens det testes.",
  },
  /** What Casy's AI made of one of your events (#112), under it in the day's list. */
  eventLabel: {
    toggle: "Casys vurdering",
    kinds: {
      exam: "Eksamen",
      deadline: "Aflevering",
      presentation: "Fremlæggelse",
      interview: "Jobsamtale",
      lecture: "Undervisning",
      study: "Læsning",
      work: "Arbejde",
      shift: "Vagt",
      meeting: "Møde",
      appointment: "Aftale",
      flight: "Fly",
      travel: "Rejse",
      stay: "Overnatning",
      wedding: "Bryllup",
      funeral: "Begravelse",
      birthday: "Fødselsdag",
      party: "Fest",
      dinner: "Middag",
      social: "Socialt",
      sport: "Træning",
      competition: "Konkurrence",
      show: "Oplevelse",
      vacation: "Ferie",
      family: "Familie",
      chores: "Gøremål",
      reminder: "Påmindelse",
      other: "Andet",
      unclear: "Uklart",
    },
    importance: {
      low: "Betyder ikke så meget",
      normal: "Almindelig",
      high: "Vigtig",
      critical: "Meget vigtig",
    },
    strain: {
      none: "Ikke krævende",
      light: "Let",
      moderate: "Lidt krævende",
      heavy: "Krævende",
    },
    confidence: { low: "Et gæt", medium: "Rimelig sikker", high: "Sikker" },
    prep: (days: number) =>
      days === 1 ? "1 dag til at forberede sig" : `${days} dage til at forberede sig`,
    avoid: {
      lateNight: "Ingen sen aften dagen før",
      alcohol: "Ingen alkohol dagen før",
      travel: "Ingen lang rejse dagen før",
      exercise: "Ingen hård træning dagen før",
    },
    recovery: (days: number) =>
      days === 1 ? "1 dag til at komme sig efter" : `${days} dage til at komme sig efter`,
    corrected: "Rettet af dig",
    onlyYou: "Kun du ser vurderingen. Den og dine rettelser bliver på din telefon.",
    // With sharing on (#122), a correction also goes to Casy.
    onlyYouShared:
      "Kun du ser vurderingen, og den bliver på din telefon. Din rettelse sendes også til Casy, så AI'en kan blive bedre. Du kan slå det fra under Dine data.",
    wrong: "Forkert?",
    wrongPrompt:
      "Hvad er forkert? Casy vurderer aftalen igen ud fra det, du skriver, og husker det til lignende aftaler.",
    wrongPlaceholder: "Fx: Det er kun en prøveeksamen, den betyder ikke så meget",
    send: "Vurder igen",
    sending: "Vurderer…",
    cancel: "Annuller",
  },
  calendarView: {
    title: "Min kalender",
    intro: "Det, Casy ser i dine kalendere: kun hvornår du er optaget, aldrig hvad du laver.",
    tryAgain: "Prøv igen",
    truncated: "Måneden har flere optagede tidsrum, end der kan vises, så nogle mangler.",
    noCalendars: (link: ReactNode) => (
      <>
        Ingen kalendere forbundet endnu. {link} for at se dine egne optagede tidsrum her. Danske
        helligdage vises allerede.
      </>
    ),
    noCalendarsLink: "Forbind en kalender",
    today: "I dag",
    week: (n: number) => `Uge ${n}`,
    more: (n: number) => `+${n} mere`,
    nothingBusy: "Intet optaget denne dag i de viste kalendere.",
    couldntSaveCategory: "Kunne ikke gemme kategorien",
    couldntSaveIncluded: "Kunne ikke gemme, om kalenderen tæller med",
    cellLabel: (date: string, busy: number, holidays: string) =>
      `${date}, ${busy === 1 ? "1 optaget tidsrum" : `${busy} optagede tidsrum`}${holidays ? `, ${holidays}` : ""}`,
    allDay: "Hele dagen",
    hourUnit: "t",
    publicHoliday: "Helligdag",
    observedDay: "Almindelig fridag",
    denmark: "Danmark",
    calendarFallback: "Kalender",
    noCategory: "Ingen kategori",
    /** Beside a category Casy's AI picked (#118). */
    guessedCategory: "Casy har gættet kategorien. Ret den, hvis den ikke passer.",
    holidayCategory: "Helligdag",
    holidayCalendar: "Danske helligdage",
    // What you told Casy (#116), drawn as a calendar of its own.
    casyCalendar: "Casy",
    casyPill: "Fortalt",
    continuesBoth: "Fortsætter fra dagen før og ind i den næste",
    continuesBefore: "Fortsætter fra dagen før",
    continuesAfter: "Fortsætter ind i den næste dag",
    brands: {
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Særlige",
      device: "Telefon",
      builtin: "Indbygget",
    } as Record<string, string>,
    providerNames: {
      builtin: "Indbygget",
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Kalenderlink",
      device: "Telefon",
    } as Record<string, string>,
    calendarsButton: "Kalendere",
    listTitle: "Dine kalendere",
    listIntro:
      "Kun kalendere med flueben tæller med, når Casy finder datoer, og vises her. Åbn en gruppe for at give hver kalender en kategori, og sige hvor vigtig den er.",
    showAll: (brand: string) => `Tæl alle ${brand}-kalendere med`,
    show: (name: string) => `Tæl ${name} med`,
    total: (n: number) => `${n} i alt`,
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
  // Planning from My calendar (#126): the Planlæg sheet, the paper pile and
  // the dates it finds.
  // A vote answered over the home page's month (#172).
  homeVote: {
    answer: (title: string) => `Svar på ${title}`,
    waiting: (n: number) => `${n} afstemninger venter`,
    // The date agreed, over the month before it flies into its day.
    everyone: "Alle har svaret",
    show: "Se den i kalenderen",
  },
  planFromCalendar: {
    button: "Planlæg",
    findDate: "Find dato",
    // The sheet's rows (#173).
    from: "Fra",
    to: "Til",
    fromTo: (from: string, to: string) => `${from} - ${to}`,
    flex: "Fleksibel",
    flexLess: "Mindre fleksibel",
    flexMore: "Mere fleksibel",
    friSat: "Fredag og lørdag",
    more: "Flere detaljer",
    months: "Måneder",
    you: "Dig",
    waiting: "Henter gruppens kalendere",
    ranked: (n: number) => (n === 1 ? "Den bedste dato" : `De ${n} bedste datoer`),
    noneThrough: "Ingen dag i perioden passer alle. Prøv at ændre planen.",
    suggest: (n: number) => (n === 1 ? "Foreslå datoen" : `Foreslå top ${n} datoer`),
    change: "Ret planen",
    cant: (names: string) => `${names} kan ikke`,
    reviewing: "Gennemgår kalenderne",
    allCan: (n: number) => (n === 1 ? "Du kan" : `Alle ${n} kan`),
    allCanWithCalendar: (n: number) => `Alle ${n} med kalender kan`,
    edgesClear: "Intet lige før eller tidligt morgenen efter",
    noSkips: "Ingen skal give noget op",
    matchScore: (n: number) =>
      `Passer ${n}% for gruppen, ud fra de vigtige aftaler, der er delt med Casy`,
    picked: "Med i forslaget",
    notPicked: "Ikke med: Casy spreder datoerne, så de ikke ligger tæt",
    details: (date: string) => `Detaljer om ${date}`,
    close: "Luk",
  },
  myData: {
    title: "Dine data",
    row: "Dine data",
    intro: (link: ReactNode) => (
      <>Alt, hvad Casy gemmer om dig lige nu, punkt for punkt som i {link}.</>
    ),
    privacyLink: "privatlivspolitikken",
    loading: "Henter dine data…",
    account: "Din konto",
    email: "E-mail",
    name: "Navn",
    nameCustom: "Valgt af dig",
    nameFromLogin: "Fra dit login",
    nameNotYet: "Ikke gemt endnu",
    signIn: "Log ind med",
    signInMethods: { email: "E-mail", google: "Google", apple: "Apple" } as Record<string, string>,
    push: "Notifikationer",
    pushOn: (n: number) => (n === 1 ? "Til på 1 telefon" : `Til på ${n} telefoner`),
    pushOff: "Fra",
    pushDetail:
      "Casy gemmer telefonens nøgle fra Apple og de slags beskeder, du har slået fra, til du logger ud eller sletter kontoen",
    appleToken:
      "En nøgle fra Apple gemmes, så dit Apple-login kan afbrydes, når du sletter kontoen",
    emailLanguage: "Sprog i e-mails",
    languages: { da: "Dansk", en: "Engelsk" } as Record<string, string>,
    languageDefault: "Standard, indtil du har brugt Casy logget ind",
    created: "Oprettet",
    calendars: "Forbundne kalendere",
    noCalendars: "Ingen kalendere forbundet.",
    accountsCount: (n: number) => (n === 1 ? "1 konto" : `${n} konti`),
    groupsCount: (n: number) => (n === 1 ? "1 gruppe" : `${n} grupper`),
    connectedOn: (date: string) => `Forbundet ${date}`,
    notCounted: "Tæller ikke med",
    primary: "Primær kalender",
    primaryNone: "Ingen valgt",
    autoAdd: "Tilføj automatisk",
    on: "Til",
    off: "Fra",
    busy: "Optagede tidsrum",
    toldCasy: "Det, du har fortalt Casy",
    reportsSent: "Rapporter, du har sendt",
    busyCount: "Antal gemt",
    busyFrom: "Det tidligste",
    busyTo: "Det seneste",
    busyNext: "De næste, som de er gemt",
    busyNote:
      "Det er alt, der gemmes om et optaget tidsrum: hvornår det starter, og hvornår det slutter. Ingen titel, intet sted, ingen deltagere.",
    groups: "Grupper",
    noGroups: "Du er ikke i nogen grupper.",
    groupDetail: (members: string, yours: boolean) =>
      yours ? `${members} · du lavede den` : members,
    inviteLinks: "Invitationslinks, du har lavet",
    inviteLinksValue: (made: number, active: number) => `${made} (${active} gyldige)`,
    invitationsToYou: "Invitationer til dig",
    invitationsToYouValue: (pending: number, declined: number) =>
      `${pending} åbne, ${declined} afslået`,
    invitationsSent: "Invitationer, du har sendt",
    emailLookups: "E-mailopslag",
    emailLookupsDetail: "Aldrig selve adressen",
    events: "Foreslåede aftaler",
    invitedTo: "Aftaler, du er spurgt om",
    suggested: "Aftaler, du har foreslået",
    answers: "Svar, du har givet",
    declined: "Datoer, du har afslået",
    entries: "Aftaler i din kalender",
    entriesAdded: "Lagt i din kalender af Casy",
    entriesDeleted: "Slettet af dig bagefter",
    ai: "AI",
    aiAllowed: "AI-funktioner",
    aiOn: "Slået til",
    aiOff: "Ikke slået til endnu",
    aiCalls: "Dine AI-kald de sidste 30 dage",
    aiConsent: "AI må læse i din kalender",
    aiConsentOn: (date: string) => `Ja, siden ${date}`,
    aiConsentAgain: "Ja, men du skal sige ja igen",
    aiConsentOff: "Nej",
    labels: "Mærkater på denne telefon",
    shareCorrections: "Send mine rettelser til Casy",
    shareOn: "Casy får dine rettelser af AI'en, så den kan blive bedre",
    shareOff: "Slået fra",
    correctionsKept: "Rettelser sendt til Casy",
    correctionsDelete: "Slet mine sendte rettelser",
    labelsNote:
      "Mærkater er AI'ens vurdering af dine aftaler. De gemmes kun på telefonen og kommer ikke med i din hentede kopi. Slår du AI og din kalender fra under Profil, slettes de.",
    aiNote:
      "Casy noterer hvornår og hvor meget, aldrig hvad du skrev. Notatet slettes efter 30 dage.",
    credentials: "Adgangsoplysninger",
    credentialKinds: {
      oauth: "Adgangsnøgle",
      password: "App-specifik adgangskode",
      link: "Kalenderlink",
    },
    credentialNone: "Ingen gemt",
    credentialsNote: "Krypteret, før det gemmes. Vises aldrig, heller ikke her.",
    download: "Hent en kopi",
    downloadDetail: "Alt ovenfor som en JSON-fil",
    downloading: "Henter…",
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
    onPhone: "Casy lægger den i kalenderen på din telefon, næste gang du åbner Casy-appen der.",
    notYetPhone:
      "Casy kunne ikke lægge den i telefonens kalender endnu og prøver igen, næste gang appen åbnes.",
    gone: "Den er ikke i din kalender længere.",
    addAgain: "Tilføj igen",
    chooseTitle: "Hvilken kalender skal Casy lægge aftaler i?",
    chooseHelp: "Den bliver din primære kalender. Du kan skifte den under Forbundne kalendere.",
    useAndAdd: "Brug den og tilføj",
    downloadInstead: "Hent en kalenderfil i stedet",
  },
  primaryCalendar: {
    title: "Primær kalender",
    intro:
      "Casy lægger de aftaler, I bliver enige om, i denne kalender: når du beder om det, eller af sig selv, hvis Tilføj automatisk er slået til.",
    noWritable:
      "Forbind en Apple-kalender ovenfor, eller din telefon i Casy-appen, så kan Casy lægge jeres aftaler direkte i den. Google og Outlook kommer senere.",
    waitingForSync:
      "Casy tjekker, hvilke af dine Apple-kalendere den må lægge aftaler i. Tryk Synkronisér nu, eller vent op til en time.",
    selectLabel: "Vælg primær kalender",
    choose: "Vælg en kalender",
    noneOption: "Ingen (Casy lægger intet i dine kalendere)",
    confirmChange: (name: string, current: string) =>
      `Gør ${name} til din primære kalender? Nye aftaler lægges i ${name}. Aftaler, der allerede er lagt i ${current}, bliver, hvor de er.`,
    confirmClear: (current: string) =>
      `Stop med at bruge ${current} som primær kalender? Så lægger Casy ingen aftaler i dine kalendere. Aftaler, der allerede er lagt der, bliver.`,
    yesChange: "Ja, skift",
    yesStop: "Ja, stop",
    autoAdd: "Tilføj automatisk",
    autoAddHelp:
      "Når alle har sagt ja til en aftale, lægger Casy den i din primære kalender med det samme.",
    autoAddNeedsPrimary: "Vælg en primær kalender først.",
    badge: "Primær",
  },
  signIn: {
    title: "Log ind",
    intro: "Log ind for at forbinde dine kalendere og planlægge med dine grupper.",
    google: "Fortsæt med Google",
    apple: "Fortsæt med Apple",
    appleFailed: "Log ind med Apple lykkedes ikke. Prøv igen.",
    or: "eller",
    acceptTerms: (terms: ReactNode, privacy: ReactNode) => (
      <>
        Når du logger ind, accepterer du Casys {terms} og {privacy}.
      </>
    ),
    termsLink: "vilkår",
    privacyLink: "privatlivspolitik",
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
    captchaWait:
      "Et øjeblik: vi tjekker lige, at du ikke er en robot. Prøv igen om et par sekunder.",
    captchaFailed:
      "Vi kunne ikke tjekke, at du ikke er en robot. Genindlæs siden, slå en eventuel reklameblokering fra her, eller log ind med Google.",
    // The iPhone app has no Google button (#91).
    captchaFailedApp:
      "Vi kunne ikke tjekke, at du ikke er en robot. Luk appen helt, åbn den igen og prøv på ny.",
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
    membersSoFar: (n: number) =>
      n === 1 ? "1 medlem indtil videre" : `${n} medlemmer indtil videre`,
    privacy:
      "Medlemmer kan se hinandens navne, og hvornår de er optaget, så Casy kan finde et tidspunkt, der passer alle. Ingen kan se din e-mailadresse, navnene på dine kalendere eller hvad dine aftaler hedder.",
    alreadyIn: "Du er allerede med i gruppen.",
    findDate: "Find en dato",
    joinGroup: "Bliv medlem",
    signInToJoin: "Log ind for at blive medlem",
    comeBack: "Du kommer direkte tilbage hertil bagefter.",
  },
  api: {
    describeGroup: "Kunne ikke gemme beskrivelsen",
    // The request never got an answer (callFunction): no connection, or too slow.
    offline: "Ingen forbindelse til Casy. Tjek dit internet, og prøv igen.",
    timeout: "Casy svarede ikke i tide. Prøv igen.",
    loadGroups: "Kunne ikke hente dine grupper",
    report: "Kunne ikke sende rapporten",
    blocked: "Kunne ikke ændre, hvem du har blokeret",
    loadReports: "Kunne ikke hente rapporterne",
    loadGroupCalendars: "Kunne ikke hente gruppens kalendere",
    createGroup: "Kunne ikke oprette gruppen",
    inviteMembers: "Kunne ikke sende invitationerne",
    loadInvitations: "Kunne ikke hente dine invitationer",
    answerInvitation: "Kunne ikke svare på invitationen",
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
    planAi: "AI-planlægningen svarede ikke",
    relabel: "Kunne ikke vurdere aftalen igen",
    cancelEvent: "Kunne ikke aflyse aftalen",
    editEvent: "Kunne ikke gemme sted og note",
    leaveEvent: "Kunne ikke forlade aftalen",
    answerDate: "Kunne ikke gemme dit svar",
    chooseDate: "Kunne ikke vælge datoen",
    notInGroup: "Du er ikke længere med i gruppen.",
    checkAdmin: "Kunne ikke tjekke admin-adgang",
    loadAdmin: "Kunne ikke hente admin-oversigten",
    adminDeleteGroup: "Kunne ikke slette gruppen",
    adminRemoveMember: "Kunne ikke fjerne personen fra gruppen",
    adminDeleteAccount: "Kunne ikke slette kontoen",
    adminSync: "Kunne ikke synkronisere kontoen",
    adminAiAccess: "Kunne ikke ændre AI-adgangen",
    loadPrimaryCalendar: "Kunne ikke hente din primære kalender",
    deleteAccount: "Kunne ikke slette din konto",
    loadMyData: "Kunne ikke hente dine data",
    setPrimaryCalendar: "Kunne ikke gemme din primære kalender",
    setAutoAdd: "Kunne ikke gemme Tilføj automatisk",
    addToCalendar: "Kunne ikke lægge aftalen i din kalender",
    downloadEvent: "Kunne ikke hente kalenderfilen",
    failed: (name: string, status: number) => `${name} fejlede (HTTP ${status})`,
  },
  push: {
    failed: "Notifikationer kunne ikke slås til. Prøv igen.",
    askTitle: {
      sent: "Få besked, når de andre har svaret",
      answered: "Få besked, når datoen er fundet",
      joined: "Få besked, når nogen foreslår datoer",
    },
    askEnable: "Slå notifikationer til",
    askLater: "Ikke nu",
    askNote: "Du kan slå hver slags besked fra under Indstillinger.",
    title: "Notifikationer",
    turnOn: "Slå notifikationer til",
    deniedTitle: "Notifikationer er slået fra",
    denied: "Slå dem til under Casy i iPhones Indstillinger.",
    kinds: {
      vote_invited: "Nogen foreslår datoer til dig",
      vote_decided: "Datoen er fundet",
      event_changed: "Datoen ændres, eller aftalen aflyses",
      group_invitation: "Du bliver inviteret til en gruppe",
      deadline_near: "Svarfristen nærmer sig",
    } as Record<string, string>,
    testButton: "Send en test-notifikation",
    testSending: "Sender",
    testDenied:
      "iPhone siger nej til notifikationer fra Casy. Slå dem til under Casy i Indstillinger.",
    testSent: (n: number) => (n === 1 ? "Sendt til 1 telefon." : `Sendt til ${n} telefoner.`),
    testNone: (reasons: string) => `Apple tog ikke imod den${reasons ? `: ${reasons}` : "."}`,
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
    healthOk: "Kalendersynkroniseringen virker.",
    aiToday: (used: number, limit: number) => `AI i dag: ${used} af ${limit} kald brugt.`,
    aiSkill: (name: string, today: number, month: number, cost: string) =>
      `${name}: ${today} i dag, ${month} på 30 dage, cirka ${cost}`,
    aiSkills: {
      "plan-ai": "Planlæg med AI",
      "calendar-categorize": "Sortering af kalendere",
      "event-label": "Vurdering af aftaler",
      "event-relabel": "Rettede vurderinger",
      "event-profile": "Profil af planlagte aftaler",
      "entries-ai": "Fortæl Casy",
      "trip-legs": "Rejser i kalenderen",
      earlier: "Før budgetter pr. person",
    } as Record<string, string>,
    healthStale:
      "Ingen kalender er blevet synkroniseret i over tre timer. Den timevise synkronisering er måske gået i stå.",
    healthFailing: "Over 30 % af kalenderkontiene fejler, når de synkroniseres.",
    statBusy: "Gemte optagede tidsrum",
    dismiss: "Luk",
    correctionsTitle: "Rettelser til AI'en",
    correctionsIntro:
      "Det, folk har sendt, når AI'en tog fejl: aftalens titel, hvad AI'en sagde, hvad de skrev, og hvad der kom ud af det. Aldrig hvem. Gør et gentaget fejlskøn til en skarpere regel og en ny, opfundet testsag, og markér rettelsen som håndteret, så den slettes.",
    correctionsNone: "Ingen rettelser endnu.",
    correctionPlan: "Planlæg med AI",
    correctionPlanUnchanged: "Sendt, som AI'en lavede den",
    correctionPlanChanged: "Ændret af personen",
    correctionBefore: "AI'en sagde",
    correctionAfter: "Efter rettelsen",
    correctionNote: "Skrev",
    correctionHandled: "Håndteret",
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
      (groups > 0
        ? `, sammen med ${groups === 1 ? "1 gruppe" : `${groups} grupper`}, kun personen var med i.`
        : "."),
    theAccount: "Kontoen",
    syncedBlocks: (n: number) =>
      `Synkroniseret: ${n === 1 ? "1 optaget tidsrum" : `${n} optagede tidsrum`}.`,
    syncFailed: "Synkroniseringen fejlede.",
    syncUserTitle: (name: string) => `Synkronisér alle kalendere for ${name}`,
    aiAdmin: "AI: admin",
    aiAllowed: "AI slået til",
    aiOff: "Tillad AI",
    aiTurnOff: (name: string) => `Slå AI fra for ${name}`,
    aiTurnOn: (name: string) => `Slå AI til for ${name}`,
    testerOn: "AI-tester",
    testerOff: "Gør til AI-tester",
    testerTurnOff: (name: string) => `${name} skal ikke længere være AI-tester`,
    testerTurnOn: (name: string) =>
      `Gør ${name} til AI-tester: får alle AI-funktioner, der ellers kun er for administratorer, også vurdering af aftaler, som sender titlerne på aftaler til AI`,
    syncedUser: (ok: number, failed: number, blocks: number) =>
      failed === 0
        ? `Synkroniseret: ${ok === 1 ? "1 konto" : `${ok} konti`}, ${blocks === 1 ? "1 optaget tidsrum" : `${blocks} optagede tidsrum`}.`
        : `${ok} af ${ok + failed} konti synkroniseret. Se Kalendersundhed for fejlen.`,
    providers: {
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Kalenderlink",
      device: "Telefon",
    } as Record<string, string>,
  },
};

export type Messages = typeof da;
