import type { ReactNode } from "react";

import type { Messages } from "@/i18n/da";

/** English copy. Typed as Messages, so a key missing here fails the build. */

const days = (n: number) => (n === 1 ? "1 day" : `${n} days`);
const hours = (n: number) => (n === 1 ? "1 hour" : `${n} hours`);

export const en: Messages = {
  language: {
    switchLabel: "Language",
  },
  common: {
    cancel: "Cancel",
    save: "Save",
    copy: "Copy",
    copied: "Copied",
    example: "Example",
    loading: "Loading…",
    previousMonth: "Previous month",
    nextMonth: "Next month",
    days,
    hours,
    duration: (min: number) => {
      const h = Math.floor(min / 60);
      const m = min % 60;
      if (h === 0) return `${m} min`;
      if (m === 0) return `${h} h`;
      if (m === 30) return `${h}½ h`;
      return `${h} h ${m} min`;
    },
    withYou: (name: string) => `${name} (you)`,
  },
  weekdaysShort: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],
  eventTypes: {
    evening: "Evening",
    lunch: "Lunch",
    dinner: "Dinner",
    gaming: "Gaming",
    nightout: "Night out",
    weekend: "Weekend trip",
    vacation: "Vacation",
    meeting: "Hangout",
  },
  examples: {
    you: "You",
    groups: {
      basketball: "Basketball team",
      highschool: "Highschool group",
      family: "Family",
      bookclub: "Book club",
      studygroup: "Study group",
      work: "Work team",
      running: "Running club",
      band: "The band",
      neighbours: "Neighbours",
      oldfriends: "Old friends",
    },
  },
  nav: {
    scheduler: "Scheduler",
    schedulerShort: "Schedule",
    events: "My events",
    eventsShort: "Events",
    calendar: "My calendar",
    calendarShort: "Calendar",
    profile: "Profile",
    profileShort: "Profile",
    signIn: "Sign in",
    signOut: "Sign out",
    waitingForAnswer: (n: number) => `${n} waiting for your answer`,
  },
  footer: {
    howItWorks: "How it works",
    privacy: "Privacy",
  },
  scheduler: {
    group: "Group",
    name: "What are you doing",
    namePlaceholder: "E.g. drinks or board games",
    startsAt: "Starts at",
    anyTime: "Any time",
    duration: "Duration",
    dayLabel: "Days",
    tripToggle: "Trip / holiday",
    tripToggleAria: "A trip or holiday over several days",
    tripDays: "Number of days",
    tripStarts: "Starts on",
    anyDay: "Any day",
    shorter: "Shorter",
    longer: "Longer",
    fewerDays: "Fewer days",
    moreDays: "More days",
    sentenceAt: "at",
    sentenceFor: "for",
    sentenceOn: "on",
    sentenceFrom: "starting",
    sentenceAnyDay: "any day",
    dayList: { all: "every day", weekdays: "weekdays", weekends: "weekends" },
    kickerAll: (name: string) =>
      name ? `${name}: first date everyone can make` : "First date everyone can make",
    inDays: (n: number) => (n <= 0 ? "today" : n === 1 ? "tomorrow" : `in ${days(n)}`),
    timeRange: (start: string, end: string) => `${start} to ${end}`,
    tripTimes: (start: string, end: string) => `Leave ${start}, home ${end}`,
    countCan: (n: number, total: number) => `${n} of ${total} can`,
    nextOption: "Next option",
    nextShort: "Next",
    suggestShort: "Suggest",
    chartTitle: (month: string) => `${month}, day by day`,
    legendAll: "Everyone can",
    legendFree: "Free",
    legendOff: "Not searched",
    alsoPossible: "Also possible",
    suggest: "Suggest this date",
    suggested: "Suggested",
    sent: (link: ReactNode) => <>Sent to the group. {link}.</>,
    sentLink: "Follow the answers in My events",
    hintSignIn: "Sign in and make a group to suggest events.",
    hintExample: "Make a group to suggest events to real people.",
    hintEveryone: "Everyone in the group gets it to accept or decline.",
    hintAccept: "First accept taking the time off.",
    copyLink: "Copy link",
    copiedLink: "Copied!",
    previousTime: "Previous recommended time",
    freeWithTimeOff: "free only with time off",
    freeIfSkipping: "free only by skipping",
    cellTitle: (free: number, total: number, needTimeOff: number) =>
      `${free}/${total} can meet${needTimeOff > 0 ? `, ${needTimeOff} would need time off` : ""}`,
    cellTitleSkip: (free: number, total: number, skipping: number) =>
      `${free}/${total} can meet${skipping > 0 ? `, ${skipping} would skip something` : ""}`,
    noVacation: (n: number) =>
      `No stretch of ${days(n)} works for the whole group in this range. Try fewer days or another group.`,
    noTrip:
      "No week has a free trip window for the whole group in this range. Try changing which days the trip covers.",
    noSingle: (time: string) =>
      `No time works for the whole group at ${time} on the selected days in this range. Try a different start time, duration, or more days.`,
    noSingleAnyTime: (duration: string) =>
      `No day has ${duration} free in a row between 10:00 and 22:00 that works for the whole group, on the selected days. Try a different duration or more days.`,
    needsApproval: "Needs your approval",
    selfConflict: (titles: string) =>
      `The earliest possible dates, but you have ${titles} in your calendar.`,
    othersNeedTimeOff: (names: string) => ` ${names} would also need to take time off.`,
    aCommitment: "a commitment",
    accept: "Accept",
    underReview: "Dates under review",
    othersMustApprove: (names: string, count: number) =>
      `${names} ${count === 1 ? "has" : "have"} work or school during these dates and must approve them.`,
    youApprovedTimeOff: " You have approved taking time off.",
    worksIfSkipping: "Works if some skip",
    youSkip: (titles: string) => `You'd skip ${titles}. `,
    othersSkip: (names: string) => `${names} would skip something. `,
    skipWhy: "No date within a week works without.",
    youApprovedDates: "You approved taking time off for these dates.",
    suggestionFits: (
      requested: number,
      needsTimeOff: boolean,
      fits: number,
      span: string,
      extra: string,
    ) => (
      <>
        {days(requested)} {needsTimeOff ? "needs time off" : "does not fit"}, but{" "}
        <span className="font-semibold">{days(fits)} works for everyone</span>: {span}
        {extra}.
      </>
    ),
    leaveAfterWork: ", leaving after work on the first day",
    homeBeforeWork: ", home before work starts again",
    closestWorkaround: (n: number, span: string, names: string, count: number) =>
      `Closest workaround: ${days(n)}, ${span}, if ${names} ${count === 1 ? "takes" : "take"} time off.`,
    useTheseDates: "Use these dates",
    groupMembers: "Group members",
    exampleSignedOut: (link: ReactNode) => (
      <>Everyone here is example data. {link} to use your own calendar and make a real group.</>
    ),
    exampleSignedOutLink: "Sign in",
    exampleCalendarsFailed: "Couldn't load your calendars, so you are shown with example data too.",
    exampleSignedIn: (link: ReactNode) => (
      <>
        The other people here are example data. {link} and make a group to find a date with real
        people.
      </>
    ),
    exampleSignedInLink: "Connect a calendar",
    busyFailed: "Couldn't load this group's calendars, so these times are incomplete.",
    noCalendars: "Nobody in the group has linked a calendar yet, so there is nothing to search.",
    busyLoading: "Loading everyone's calendars…",
    realTimes:
      "These times come from every member's own connected calendars. Nobody sees what your events are called.",
  },
  groupSwitcher: {
    select: "Select group",
    yourGroups: "Your friend groups",
    newGroup: "New group",
  },
  groupPanel: {
    noProfileTitle: "Don't have a profile yet?",
    noProfileBody: "Sign up to link your own calendar and make a group with real people.",
    signUp: "Sign up",
    members: (n: number) => (n === 1 ? "1 member" : `${n} members`),
    whatMembersSee: "What members can see",
    whatMembersSeeBody:
      "Everyone in a group can see each other's name and when they are busy. Nobody sees your email address, your calendars' names, or what any of your events are called. Casy never stores event titles at all.",
    noCalendarYet: "no calendar yet",
    waitingOne: (name: string) =>
      `${name} has not linked a calendar yet, so they are left out of the search.`,
    waitingMany: (n: number) =>
      `${n} members have not linked a calendar yet, so they are left out of the search.`,
    waitingWhy: "Counting them as free would make every date look better than it is.",
    newInvite: "New invite link",
    invite: "Invite people",
    inviteInfo: (expiry: string) =>
      `Anyone with this link can join the group. It works for ${expiry} and can be used by as many people as you send it to.`,
    lastMember: (name: string) => `You are the last member. Leaving deletes "${name}" for good.`,
    leaveConfirm: (name: string) =>
      `Leave "${name}"? You will need a new invite link to get back in.`,
    deleteGroup: "Delete group",
    leaveGroup: "Leave group",
  },
  inviteExpiry: {
    expired: "expired",
    days,
    hours,
    underAnHour: "under an hour",
  },
  newGroup: {
    title: "New group",
    body: "Give it a name, then share an invite link with the people you want in it.",
    nameLabel: "Group name",
    placeholder: "e.g. Board game night",
    create: "Create group",
  },
  providers: {
    apple: { label: "Apple iCloud Calendar", help: "Get help connecting" },
    ics: { label: "Calendar link (ICS)", help: "How to find your link" },
    google: { label: "Google Calendar", help: "How it works" },
    outlook: { label: "Outlook Calendar", help: "How it works" },
  },
  earlyMorning: {
    you: "You",
    oneYou: (time: string) => `Heads up: you have something at ${time} the next morning.`,
    one: (who: string, time: string) =>
      `Heads up: ${who} has something at ${time} the next morning.`,
    many: (list: string) => `Heads up: ${list} have something early the next morning.`,
  },
  backToBack: {
    you: "You",
    oneYou: "Heads up: you have something that ends just as this starts.",
    one: (who: string) => `Heads up: ${who} has something that ends just as this starts.`,
    many: (list: string) => `Heads up: ${list} have something that ends just as this starts.`,
  },
  counts: {
    calendars: (n: number) => (n === 1 ? "1 calendar" : `${n} calendars`),
    busyBlocks: (n: number) => (n === 1 ? "1 busy block" : `${n} busy blocks`),
    members: (n: number) => (n === 1 ? "1 member" : `${n} members`),
  },
  synced: {
    justNow: "Synced just now",
    minutes: (n: number) => `Synced ${n} min ago`,
    hours: (n: number) => `Synced ${n} h ago`,
    days: (n: number) => `Synced ${days(n)} ago`,
  },
  profile: {
    adminEnter: "Switch to admin mode",
    adminExit: "Exit admin mode",
    adminOpening: "Opening admin mode…",
    connected: (label: string) => `Connected to ${label} and pulled in your busy times.`,
    yourCalendar: "your calendar",
    couldntConnect: (reason: string) => `Couldn't connect: ${reason}`,
    changeName: "Change your display name",
    statGroups: "Groups",
    statCalendars: "Calendars",
    statBusy: "Busy blocks",
    connectedCalendars: "Connected calendars",
    onboardingTitle: "Connect your calendar",
    onboardingIntro:
      "Once you connect a calendar, Casy can find dates that work for the whole group.",
    syncing: "Syncing",
    syncNow: "Sync now",
    syncAllFresh: "Everything was synced within the last minute.",
    syncedAccounts: (n: number) => `Synced ${n === 1 ? "1 account" : `${n} accounts`}.`,
    syncSomeFailed: (failed: number, n: number) =>
      `${failed} of ${n === 1 ? "1 account" : `${n} accounts`} couldn't sync. See below.`,
    password: "Password",
    passwordSaved:
      "Password saved. You can use it to sign in from now on, and you are signed out on your other devices.",
    codeSent: (email: string) =>
      `You haven't signed in within the last day, so we sent a code to ${email} to make sure it's you. Enter it here to save your new password.`,
    codeLabel: "Code from the email",
    codeResend: "Send a new code",
    codeResent: "New code sent",
    signOutEverywhere: "Sign out on all devices",
    signOutEverywhereHelp:
      "Signs you out everywhere, here too. Use it if you lost a phone or were signed in on someone else's computer.",
    signingOutEverywhere: "Signing out",
    couldntSignOutEverywhere: "Couldn't sign out on all devices. Try again.",
    savePassword: "Save password",
    saving: "Saving",
    setPassword: "Set or change your password",
    icsAdded: (label: string, blocks: number) =>
      `Added "${label}" with ${blocks} busy ${blocks === 1 ? "block" : "blocks"}.`,
    appleConnected: (label: string, calendars: number, blocks: number, skipped: number) =>
      `Connected ${label}: ${calendars} ${calendars === 1 ? "calendar" : "calendars"}, ${blocks} busy ${blocks === 1 ? "block" : "blocks"}.` +
      (skipped > 0
        ? ` ${skipped} ${skipped === 1 ? "event" : "events"} couldn't be read and ${skipped === 1 ? "was" : "were"} left out.`
        : ""),
    couldntStartConnect: "Couldn't start connecting",
    couldntSync: "Couldn't sync",
    couldntAddLink: "Couldn't add the link",
    couldntRemove: "Couldn't remove the account",
    couldntIcloud: "Couldn't connect to iCloud",
    oauthErrors: {
      access_denied: "You cancelled, or didn't allow access.",
      missing_code_or_state: "The provider's answer was missing something. Try again.",
      invalid_state: "The connection expired before it finished. Try again.",
      server_misconfigured: "That connection isn't set up on the server yet.",
      db_error: "The account connected but couldn't be saved. Try again.",
      connect_failed: "The provider turned the connection down. Try again.",
    } as Record<string, string>,
  },
  providerCard: {
    removeIcs: (label: string | null) =>
      `Remove ${label ?? "this link"}? Its synced busy times and the saved link are deleted from Casy. The link itself stays valid at its source until you regenerate it there.`,
    removeApple: (label: string | null) =>
      `Remove ${label ?? "this account"}? Its synced busy times and the saved password are deleted from Casy. To also revoke the password itself, delete it under App-Specific Passwords at account.apple.com/account/manage.`,
    removeOauth: (label: string | null, company: string) =>
      `Remove ${label ?? "this account"}? Its synced busy times are deleted from Casy. To also revoke Casy's access, remove it in that account's connected-apps settings at ${company}.`,
    unknownAccount: "unknown account",
    lastSyncFailed: "· last sync failed, retrying",
    linkStopped: "This link stopped working. Remove it and add it again.",
    accessExpired: "Access expired. Reconnect this account to keep it in sync.",
    reconnectTitle: "Reconnect (pick this account again)",
    removeTitle: "Remove this account",
    remove: "Remove",
    checking: "Checking",
    connecting: "Connecting",
    addLink: "Add link",
    addAnother: "Add another",
    addShort: "Add",
    tryAgain: "Try again",
    connect: "Connect",
    notConnected: "Not connected yet.",
    lastFailed: (message: string) => `Last attempt failed: ${message}`,
    unknownError: "unknown error",
  },
  appleForm: {
    email: "Apple Account email",
    password: "App-specific password",
    about: "About app-specific passwords",
    aboutBody:
      "Apple has no one-click sign-in for calendars. In Sign-In and Security at account.apple.com, open App-Specific Passwords and create one for Casy. Casy never sees your main Apple Account password. It only asks Apple for event times, never titles, and stores this password encrypted. You can revoke it at any time in the same place.",
    reading: "Reading calendars",
    stepByStep: "Get step-by-step help",
    noPasswordYet: (link: ReactNode) => <>Don't have one yet? {link}</>,
    stuck: (link: ReactNode) => <>Stuck? {link}</>,
    looksWrong: (example: ReactNode) => (
      <>
        That doesn't look like an app-specific password. They look like this: {example}. Did you
        paste your normal Apple password?
      </>
    ),
  },
  icsForm: {
    link: "Calendar link",
    about: "About calendar links",
    aboutBody:
      "Anyone who has this link can read the calendar. It is stored privately and never shown again. Only start and end times are kept; titles, places and attendees are removed before anything is stored.",
    likePassword: "Treat this link like a password.",
    name: "Name (optional)",
    namePlaceholder: "e.g. CBS timetable",
    reading: "Reading calendar",
  },
  passwordForm: {
    newPassword: "New password",
    confirm: "Confirm password",
    mismatch: "Passwords don't match.",
    ruleLength: (n: number) => `At least ${n} characters`,
    ruleLettersDigits: "Both letters and numbers",
    ruleNotPersonal: "Not your email address or name",
    rulesNotMet: "The password doesn't meet the requirements under the field.",
    checking: "Checking the password",
    leaked: (times: string) =>
      `That password appears ${times} times in known data leaks, so it is easy to guess. Choose another.`,
  },
  groupsSection: {
    title: "Your groups",
    makeGroup: "Make a group",
    loading: "Loading your groups…",
    loadFailed: "Couldn't load your groups.",
    empty: (button: ReactNode) => <>You're not in a group yet. {button} and invite people in.</>,
    makeOne: "Make one",
    made: (date: string) => `made ${date}`,
    renameTitle: "Rename this group",
    inviteTitle: "Get an invite link for this group",
    inviteLink: "Invite link",
    leaveTitle: "Leave this group",
    deleteTitle: "Delete this group for everyone",
    inviteShort: (expiry: string) => `Anyone with this link can join. It works for ${expiry}.`,
    done: "Done",
    makingLink: "Making a link…",
    linkFailed: "Couldn't make an invite link.",
    deleteConfirm: (name: string, members: number) =>
      `Delete "${name}" for everyone? All ${members === 1 ? "1 member" : `${members} members`} lose access right away.`,
    leaveSole: (name: string) =>
      `Leave "${name}"? You're the only member, so this deletes it for good.`,
  },
  authErrors: {
    invalidCredentials: "Wrong email or password.",
    weakPassword:
      "That password is too weak. Use at least 8 characters with both letters and numbers.",
    samePassword: "The new password must be different from the old one.",
    rateLimit: "Too many attempts. Wait a little and try again.",
    emailNotConfirmed: "Confirm your email first. Check your inbox.",
    codeInvalid: "That code is wrong or has expired. Check the email, or get a new code.",
    userExists: "There is already an account with that email.",
  },
  categories: {
    work: "Work",
    school: "School",
    personal: "Personal",
    other: "Other",
  },
  events: {
    title: "My events",
    intro:
      "Events suggested in your groups. When someone declines, Casy finds the next date that works and asks everyone again.",
    loading: "Loading your events…",
    loadFailed: "Couldn't load your events.",
    emptyTitle: "No events yet",
    emptyBody:
      "Find a date on the scheduling page and press Suggest this date. It shows up here for everyone in the group.",
    findDate: "Find a date",
    needsAnswer: "Needs your answer",
    cantMake:
      "Can't make it? Casy finds the next date that works for the group and asks everyone again.",
    declineFind: "Decline and find a new date",
    keepIt: "Keep it",
    accept: "Accept",
    decline: "Decline",
    waitingForOthers: "Waiting for others",
    waitingFor: (names: string) => `Waiting for ${names}`,
    scheduled: "Scheduled",
    acceptedByAll: "Accepted by everyone",
    showMembers: (name: string) => `Show members of ${name}`,
    pastClosed: "Past and closed",
    noDate:
      "No date in the next year works for everyone any more. Suggest it again from the scheduling page.",
    happened: (date: string) => `Happened: ${date}.`,
    passed: (date: string) => `The date passed before everyone answered: ${date}.`,
    cancelConfirm: "Cancel this event for everyone?",
    cancelEvent: "Cancel event",
    leaveConfirm:
      "Leave this event? It goes ahead without you, and Casy takes it out of your calendar if Casy put it there.",
    leaveEvent: "Leave event",
    stayIn: "Stay in",
    you: "You",
    youSuggested: "You suggested this",
    suggestedBy: (name: string) => `Suggested by ${name}`,
    newDateBecause: (who: string, date: string) =>
      `. New date because ${who} couldn't make ${date}`,
  },
  calendarView: {
    back: "Back to profile",
    tryAgain: "Try again",
    truncated: "This month has more busy blocks than can be shown, so some are missing.",
    noCalendars: (link: ReactNode) => (
      <>
        No calendars connected yet. {link} to see your own busy times here. Danish holidays are
        already shown.
      </>
    ),
    noCalendarsLink: "Connect one on your profile",
    today: "Today",
    weekHeader: "wk",
    weekNumber: "Week number",
    week: (n: number) => `Week ${n}`,
    more: (n: number) => `+${n} more`,
    nothingBusy: "Nothing busy on this day in the calendars shown.",
    couldntSaveCategory: "Couldn't save the category",
    couldntSaveIncluded: "Couldn't save whether the calendar counts",
    couldntLoad: "Couldn't load your calendars",
    cellLabel: (date: string, busy: number, holidays: string) =>
      `${date}, ${busy} busy ${busy === 1 ? "block" : "blocks"}${holidays ? `, ${holidays}` : ""}`,
    allDay: "All day",
    hourUnit: "h",
    publicHoliday: "Public holiday",
    observedDay: "Commonly observed day off",
    denmark: "Denmark",
    calendarFallback: "Calendar",
    noCategory: "No category",
    holidayCategory: "Holiday",
    holidayCalendar: "Danish public holidays",
    continuesBoth: "Continues from the previous day and into the next",
    continuesBefore: "Continues from the previous day",
    continuesAfter: "Continues into the next day",
    brands: {
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Special",
      builtin: "Built in",
    } as Record<string, string>,
    providerNames: {
      builtin: "Built in",
      google: "Google",
      outlook: "Outlook",
      apple: "Apple",
      ics: "Calendar link",
    } as Record<string, string>,
    listTitle: "Your calendars",
    listIntro:
      "Only ticked calendars count when Casy finds dates, and show here. Open a group to give each calendar a category and say how much it matters.",
    showAll: (brand: string) => `Count all ${brand} calendars`,
    show: (name: string) => `Count ${name}`,
    total: (n: number) => `${n} in total`,
    builtInNoAccount: "Built in, no account needed",
    categoryFor: (name: string) => `Category for ${name}`,
    notCounted: (n: number) => `Not counted (${n})`,
    priorityFor: (name: string) => `How much ${name} matters`,
    priorities: {
      skip: "Can skip",
      normal: "Normal",
      never: "Never skip",
    },
    priorityHelp:
      "Can skip: Casy may plan over it when no date within a week works without. Normal: busy, but for trips and vacations you can take time off work and school. Never skip: busy, even when planning trips.",
    priorityHelpLabel: "What does this mean?",
    couldntSavePriority: "Couldn't save how much the calendar matters",
    rename: (name: string) => `Rename ${name}`,
    originally: (name: string) => `Original name: ${name}`,
    useOriginalName: (name: string) => `Use the original name (${name})`,
    couldntSaveName: "Couldn't save the name",
  },
  deleteAccount: {
    title: "Delete account",
    intro:
      "Deletes your account and everything that belongs to it: your connected calendars and Casy's access to them, your busy times and your name. You leave your groups, and groups where you are the only member are deleted. Events Casy added to your calendar stay there. This can't be undone.",
    button: "Delete my account",
    word: "DELETE",
    prompt: (word: string) => `Type ${word} to confirm.`,
    confirmButton: "Delete the account for good",
    deleting: "Deleting",
    failed: "Couldn't delete your account. Try again.",
  },
  weakPasswordNotice: {
    message: "Your password is easier to guess than Casy now allows.",
    action: "Choose a new one",
    dismiss: "Dismiss",
  },
  addToCalendar: {
    button: "Add to my calendar",
    goesInto: (name: string) => `Casy adds it to ${name}.`,
    goesIntoFallback: "Casy adds it to your primary calendar.",
    willAsk: "You choose which calendar it goes into.",
    asFile: "You get a calendar file your calendar app can open.",
    added: (name: string) => `Added to ${name}`,
    addedFallback: "Added to your calendar",
    adding: "Casy is adding it to your calendar.",
    notYet: "Casy couldn't add it to your calendar yet and will try again within the hour.",
    tryAgain: "Try again now",
    gone: "It's no longer in your calendar.",
    addAgain: "Add it again",
    chooseTitle: "Which calendar should Casy add events to?",
    chooseHelp: "It becomes your primary calendar. You can change it on your profile.",
    useAndAdd: "Use it and add",
    downloadInstead: "Download a calendar file instead",
  },
  primaryCalendar: {
    title: "Primary calendar",
    intro:
      "Casy adds the events you agree on to this calendar: when you ask it to, or on its own if Add automatically is on.",
    noWritable:
      "Connect an iCloud calendar below and Casy can add your agreed events straight to it. Google and Outlook are coming later.",
    waitingForSync:
      "Casy is checking which of your iCloud calendars it may add events to. Press Sync now, or wait up to an hour.",
    selectLabel: "Choose primary calendar",
    choose: "Choose a calendar",
    noneOption: "None (Casy adds nothing to your calendars)",
    confirmFirst: (name: string) =>
      `Make ${name} your primary calendar? Casy only adds events to it when you ask, or when Add automatically is on.`,
    confirmChange: (name: string, current: string) =>
      `Make ${name} your primary calendar? New events go into ${name}. Events already added to ${current} stay where they are.`,
    confirmClear: (current: string) =>
      `Stop using ${current} as your primary calendar? Casy then adds no events to your calendars. Events already added stay.`,
    yesChange: "Yes, change",
    yesChoose: "Yes, use it",
    yesStop: "Yes, stop",
    autoAdd: "Add automatically",
    autoAddHelp:
      "When everyone has accepted an event, Casy adds it to your primary calendar straight away.",
    autoAddNeedsPrimary: "Choose a primary calendar first.",
    badge: "Primary",
    makePrimary: "Make primary calendar",
    current: (name: string) => `Primary calendar: ${name}`,
    noneYet: "No primary calendar chosen yet.",
  },
  signIn: {
    title: "Sign in",
    intro: "Sign in to connect your calendars and plan with your groups.",
    google: "Continue with Google",
    or: "or",
    linkSent: (email: ReactNode, button: ReactNode) => (
      <>
        Check your inbox. We sent a sign-in link to {email}. Open it in this browser to finish
        signing in. {button}
      </>
    ),
    otherEmail: "Use another email",
    confirmSent: (email: ReactNode, resend: ReactNode, other: ReactNode) => (
      <>
        Check your inbox. We sent a link to {email}. Click it to confirm your email, and your
        account is ready and you are signed in. No email? {resend} {other}
      </>
    ),
    confirmResend: "Send it again",
    confirmResending: "Sending",
    confirmResent: "Sent again.",
    accountDeleted: "Your account has been deleted. Thank you for using Casy.",
    captchaWait: "One moment: we're checking you're not a robot. Try again in a few seconds.",
    captchaFailed:
      "We couldn't check that you're not a robot. Reload the page, turn off any ad blocker for this site, or sign in with Google.",
    email: "Email",
    emailPlaceholder: "you@example.com",
    sendingLink: "Sending link",
    sendLink: "Email me a sign-in link",
    tabSignIn: "Sign in",
    tabSignUp: "Create account",
    resetSent: (email: ReactNode, button: ReactNode) => (
      <>
        Check your inbox. We sent a password reset link to {email}. {button}
      </>
    ),
    tryAgain: "Try again",
    password: "Password",
    signingIn: "Signing in",
    signInButton: "Sign in",
    sendingReset: "Sending reset link",
    forgot: "Forgot password?",
    createAccount: "Create account",
    creatingAccount: "Creating account",
    usePassword: "Use a password instead",
    useLink: "Use an email link instead",
    enterEmailFirst: "Enter your email above first.",
    newPasswordTitle: "Choose a new password",
    newPasswordIntro: "You can sign in with this the next time, instead of an email link.",
  },
  join: {
    opening: "Opening the invite…",
    broken: "This invite doesn't work",
    brokenBody: (reason: string) =>
      `${reason} Invite links last seven days, so ask whoever sent it for a fresh one.`,
    goToCasy: "Go to Casy",
    invitedTo: "You have been invited to",
    membersSoFar: (n: number) => (n === 1 ? "1 member so far" : `${n} members so far`),
    privacy:
      "Members can see each other's name and when they are busy, so Casy can find a time that works for everyone. Nobody sees your email address, your calendars' names, or what any of your events are called.",
    alreadyIn: "You are already in this group.",
    findDate: "Find a date",
    joinGroup: "Join group",
    signInToJoin: "Sign in to join",
    comeBack: "You will come straight back here afterwards.",
  },
  api: {
    loadGroups: "Couldn't load your groups",
    loadGroupCalendars: "Couldn't load the group's calendars",
    createGroup: "Couldn't create the group",
    loadProfile: "Couldn't load your profile",
    renameGroup: "Couldn't rename the group",
    invite: "Couldn't make an invite link",
    preview: "Couldn't open the invite",
    joinGroup: "Couldn't join the group",
    leaveGroup: "Couldn't leave the group",
    deleteGroup: "Couldn't delete the group",
    setName: "Couldn't save your name",
    loadCalendars: "Couldn't load your calendars",
    loadStatus: "Couldn't load your calendar connections",
    loadEvents: "Couldn't load your events",
    suggestEvent: "Couldn't suggest the event",
    cancelEvent: "Couldn't cancel the event",
    leaveEvent: "Couldn't leave the event",
    acceptEvent: "Couldn't accept the event",
    declineEvent: "Couldn't decline the event",
    noDateToAccept: "This event has no date to accept.",
    noDateToDecline: "This event has no date to decline.",
    cantReschedule: "This event can't be rescheduled.",
    notInGroup: "You're no longer in this group.",
    checkAdmin: "Couldn't check admin access",
    loadAdmin: "Couldn't load the admin overview",
    adminDeleteGroup: "Couldn't delete the group",
    adminRemoveMember: "Couldn't remove them from the group",
    adminDeleteAccount: "Couldn't delete the account",
    adminSync: "Couldn't sync that account",
    loadPrimaryCalendar: "Couldn't load your primary calendar",
    deleteAccount: "Couldn't delete your account",
    setPrimaryCalendar: "Couldn't save your primary calendar",
    setAutoAdd: "Couldn't save Add automatically",
    addToCalendar: "Couldn't add the event to your calendar",
    downloadEvent: "Couldn't get the calendar file",
    failed: (name: string, status: number) => `${name} failed (HTTP ${status})`,
  },
  admin: {
    title: "Admin",
    intro:
      "All of Casy, for you only. Names, dates and sync health; never emails, busy times or event details.",
    refresh: "Refresh",
    statUsers: "Users",
    statGroups: "Groups",
    statAccounts: "Connected accounts",
    statFailing: "Failing syncs",
    statBusy: "Busy blocks stored",
    dismiss: "Dismiss",
    tabGroups: "Groups",
    tabUsers: "Users",
    tabCalendars: "Calendar health",
    onlyNoCalendar: "Only users without a calendar",
    onlyProblems: "Only problems",
    search: "Search by name",
    loading: "Loading everything…",
    noGroupMatch: "No group matches that.",
    noGroups: "Nobody has made a group yet.",
    firstOnly: (n: string) => `Showing the first ${n} accounts only.`,
    noUserMatch: "No user matches that.",
    noProblems: "No problems. Every account is syncing.",
    noAccountMatch: "No calendar accounts match that.",
    groupMeta: (members: string, date: string, by: string | null) =>
      `${members} · made ${date}${by ? ` by ${by}` : ""}`,
    removeMemberTitle: (name: string, group: string) => `Remove ${name} from ${group}`,
    deleteGroupTitle: "Delete this group for everyone",
    deleteGroupConfirm: (group: string, members: number) =>
      `Delete "${group}"? All ${members === 1 ? "1 member" : `${members} members`} lose it right away, along with its invite links. This can't be undone.`,
    deleteGroup: "Delete group",
    removeLast: (name: string, group: string) =>
      `Remove ${name}? They are the only member, so "${group}" is deleted too.`,
    removeMember: (name: string, group: string) =>
      `Remove ${name} from "${group}"? They'll need a new invite link to get back in.`,
    removeAndDelete: "Remove and delete",
    remove: "Remove",
    you: "You",
    joined: (date: string) => `Joined ${date}`,
    lastSignIn: (date: string) => ` · last signed in ${date}`,
    groupsLabel: "groups",
    calendarsLabel: "calendars",
    deleteUserTitle: (name: string) => `Delete ${name}'s account`,
    impactAccounts: (n: number) => (n === 1 ? "1 calendar account" : `${n} calendar accounts`),
    impactNoGroups: "no groups",
    impactGroups: (n: number) => (n === 1 ? "1 group membership" : `${n} group memberships`),
    impactSole: (n: number, sole: number) =>
      `${n === 1 ? "1 group membership" : `${n} group memberships`} (${sole} of them ${sole === 1 ? "a group" : "groups"} only they are in, deleted too)`,
    deleteUserConfirm: (name: string, parts: string) =>
      `Delete ${name}'s account? This removes their ${parts}, along with every busy time Casy stored for them. Groups other people are in carry on without them. This can't be undone, and it isn't a ban: they can sign up again.`,
    and: " and ",
    typeToConfirm: (name: ReactNode) => <>Type {name} to confirm</>,
    deleteAccount: "Delete account",
    neverSynced: "never synced",
    connectingNeverFinished: "Connecting, never finished",
    connectingFailed: "Connecting failed",
    needsReconnect: "Needs the owner to reconnect.",
    syncTitle: "Sync this account now",
    userDeleted: (who: string, groups: number) =>
      `${who} was deleted` +
      (groups > 0
        ? `, along with ${groups === 1 ? "1 group" : `${groups} groups`} only they were in.`
        : "."),
    theAccount: "The account",
    syncedBlocks: (n: number) => `Synced: ${n === 1 ? "1 busy block" : `${n} busy blocks`}.`,
    syncFailed: "Sync failed.",
    syncUserTitle: (name: string) => `Sync all calendars for ${name}`,
    syncedUser: (ok: number, failed: number, blocks: number) =>
      failed === 0
        ? `Synced: ${ok === 1 ? "1 account" : `${ok} accounts`}, ${blocks === 1 ? "1 busy block" : `${blocks} busy blocks`}.`
        : `${ok} of ${ok + failed} accounts synced. See Calendar health for the error.`,
    providers: {
      google: "Google",
      outlook: "Outlook",
      apple: "iCloud",
      ics: "Calendar link",
    } as Record<string, string>,
  },
};
