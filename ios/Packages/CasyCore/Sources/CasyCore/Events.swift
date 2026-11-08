// Suggested events, votes and how a list of them is sorted: the shapes in
// src/api/events.ts, src/lib/vote.ts and myEvents.ts. The database decides a
// vote; `leader` repeats its rule so the screens can say which date is ahead.

public enum EventStatus: String, Codable, Sendable, CaseIterable {
    case pending, scheduled, noDate = "no_date", cancelled
}

public enum EventMode: String, Codable, Sendable, CaseIterable {
    case single, vote
}

public enum EventResponse: String, Codable, Sendable, CaseIterable {
    case accepted, maybe, declined
}

public struct PeopleSettings: Codable, Sendable, Equatable {
    public var members: [String]
    public var optional: [String]
    public var atLeast: Int?

    public init(members: [String], optional: [String], atLeast: Int? = nil) {
        self.members = members
        self.optional = optional
        self.atLeast = atLeast
    }
}

/// What these rules read of an event's settings; the rest arrives with the engine.
public struct EventSettings: Codable, Sendable, Equatable {
    public var kind: EventKind
    public var days: Int?
    public var people: PeopleSettings?

    public init(kind: EventKind, days: Int? = nil, people: PeopleSettings? = nil) {
        self.kind = kind
        self.days = days
        self.people = people
    }
}

public struct CandidateDate: Codable, Sendable, Equatable {
    public var id: String
    public var start: String
    public var end: String
    public var matchScore: Double?
    public var answers: [String: EventResponse]

    public init(
        id: String,
        start: String,
        end: String,
        matchScore: Double? = nil,
        answers: [String: EventResponse]
    ) {
        self.id = id
        self.start = start
        self.end = end
        self.matchScore = matchScore
        self.answers = answers
    }
}

public struct EventInvitee: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    public var isYou: Bool
    public var avatarUrl: String?
    public var response: EventResponse?

    public init(
        profileId: String,
        name: String,
        isYou: Bool,
        avatarUrl: String? = nil,
        response: EventResponse? = nil
    ) {
        self.profileId = profileId
        self.name = name
        self.isYou = isYou
        self.avatarUrl = avatarUrl
        self.response = response
    }
}

public struct EventGroupRef: Codable, Sendable, Equatable {
    public var id: String
    public var name: String

    public init(id: String, name: String) {
        self.id = id
        self.name = name
    }
}

public struct EventCreator: Codable, Sendable, Equatable {
    public var id: String?
    public var name: String
    public var isYou: Bool

    public init(id: String?, name: String, isYou: Bool) {
        self.id = id
        self.name = name
        self.isYou = isYou
    }
}

public struct EventDate: Codable, Sendable, Equatable {
    public var id: String
    public var start: String
    public var end: String

    public init(id: String, start: String, end: String) {
        self.id = id
        self.start = start
        self.end = end
    }
}

public struct SuggestedEvent: Codable, Sendable, Equatable {
    public var id: String
    public var group: EventGroupRef
    public var title: String
    public var place: String?
    public var note: String?
    public var settings: EventSettings
    public var status: EventStatus
    public var mode: EventMode
    public var answerBy: String?
    public var createdBy: EventCreator
    public var createdAt: String
    public var updatedAt: String
    public var currentDate: EventDate?
    public var candidates: [CandidateDate]
    public var invitees: [EventInvitee]

    public init(
        id: String,
        group: EventGroupRef,
        title: String,
        place: String? = nil,
        note: String? = nil,
        settings: EventSettings,
        status: EventStatus,
        mode: EventMode,
        answerBy: String? = nil,
        createdBy: EventCreator,
        createdAt: String,
        updatedAt: String,
        currentDate: EventDate? = nil,
        candidates: [CandidateDate] = [],
        invitees: [EventInvitee] = []
    ) {
        self.id = id
        self.group = group
        self.title = title
        self.place = place
        self.note = note
        self.settings = settings
        self.status = status
        self.mode = mode
        self.answerBy = answerBy
        self.createdBy = createdBy
        self.createdAt = createdAt
        self.updatedAt = updatedAt
        self.currentDate = currentDate
        self.candidates = candidates
        self.invitees = invitees
    }
}

/// An instant as epoch ms. What arrives from the server is always one.
func instantOrZero(_ iso: String) -> Int64 {
    parseInstant(iso) ?? 0
}

public struct Tally: Codable, Sendable, Equatable {
    public var accepted = 0
    public var maybe = 0
    public var declined = 0
    public var missing = 0
}

public enum VoteStage: String, Codable, Sendable {
    case answer, waiting, choose, waitingForChoice
}

public func isVote(_ event: SuggestedEvent) -> Bool { event.mode == .vote }

private func isOptional(_ event: SuggestedEvent, _ profileId: String) -> Bool {
    event.settings.people?.optional.contains(profileId) ?? false
}

/// The answers of the people still invited; `required` only, the members who decide.
public func tally(
    _ date: CandidateDate,
    _ event: SuggestedEvent,
    required: Bool = false
) -> Tally {
    var counts = Tally()
    for person in event.invitees {
        if required && isOptional(event, person.profileId) { continue }
        switch date.answers[person.profileId] {
        case .accepted: counts.accepted += 1
        case .maybe: counts.maybe += 1
        case .declined: counts.declined += 1
        case nil: counts.missing += 1
        }
    }
    return counts
}

/// The dates that can still be answered: those not yet begun.
public func upcomingDates(_ event: SuggestedEvent, now: Int64) -> [CandidateDate] {
    event.candidates.filter { instantOrZero($0.start) > now }
}

private func yourId(_ event: SuggestedEvent) -> String? {
    event.invitees.first { $0.isYou }?.profileId
}

/// Where your answering starts: the first upcoming date you haven't answered, or -1.
public func firstUnanswered(_ event: SuggestedEvent, now: Int64) -> Int {
    let you = yourId(event)
    return upcomingDates(event, now: now).firstIndex { c in
        guard let you else { return true }
        return c.answers[you] == nil
    } ?? -1
}

/// True once everyone required has answered every date still to come.
public func allAnswered(_ event: SuggestedEvent, now: Int64) -> Bool {
    upcomingDates(event, now: now).allSatisfy { tally($0, event, required: true).missing == 0 }
}

/// The first non-zero of the comparisons, as JavaScript's `a || b || c`.
private func firstDifference(_ differences: Int64...) -> Int64 {
    differences.first { $0 != 0 } ?? 0
}

private func starts(_ date: CandidateDate) -> Int64 { instantOrZero(date.start) }

/// The date the vote would choose as things stand, or nil if none qualifies.
public func leader(_ event: SuggestedEvent, now: Int64) -> CandidateDate? {
    let ranked = upcomingDates(event, now: now).map { date in
        (date: date, t: tally(date, event, required: true), all: tally(date, event))
    }
    guard let atLeast = event.settings.people?.atLeast else {
        return stableSorted(ranked.filter { $0.t.declined == 0 }) { a, b in
            firstDifference(Int64(a.t.maybe - b.t.maybe), starts(a.date) - starts(b.date)) < 0
        }.first?.date
    }
    return stableSorted(ranked.filter { $0.t.accepted + $0.t.maybe >= atLeast }) { a, b in
        firstDifference(
            Int64(b.all.accepted + b.all.maybe - (a.all.accepted + a.all.maybe)),
            Int64(a.t.maybe - b.t.maybe),
            starts(a.date) - starts(b.date)
        ) < 0
    }.first?.date
}

/// What the suggester is pointed to when they choose.
public func bestPick(_ event: SuggestedEvent, now: Int64) -> CandidateDate? {
    let ranked = upcomingDates(event, now: now).map { date in
        (date: date, t: tally(date, event, required: true))
    }
    return stableSorted(ranked) { a, b in
        firstDifference(
            Int64(a.t.declined - b.t.declined),
            Int64(a.t.maybe - b.t.maybe),
            starts(a.date) - starts(b.date)
        ) < 0
    }.first?.date
}

/// Where a pending vote stands for you.
public func voteStage(_ event: SuggestedEvent, now: Int64) -> VoteStage {
    if let you = yourId(event),
        upcomingDates(event, now: now).contains(where: { $0.answers[you] == nil })
    {
        return .answer
    }
    let past = event.answerBy.map { instantOrZero($0) <= now } ?? false
    let due = allAnswered(event, now: now) || past
    if !due || leader(event, now: now) != nil { return .waiting }
    return event.createdBy.isYou ? .choose : .waitingForChoice
}

/// The required people (never you) who still owe an answer on some date to come.
public func stillToAnswer(_ event: SuggestedEvent, now: Int64) -> [String] {
    let dates = upcomingDates(event, now: now)
    return event.invitees
        .filter { person in
            !person.isYou && !isOptional(event, person.profileId)
                && dates.contains { $0.answers[person.profileId] == nil }
        }
        .map(\.name)
}

/// True if this event has dates you haven't answered.
public func needsYourAnswer(_ event: SuggestedEvent, now: Int64) -> Bool {
    guard event.status == .pending, event.mode == .vote,
        let you = event.invitees.first(where: { $0.isYou })
    else { return false }
    return event.candidates.contains {
        instantOrZero($0.start) > now && $0.answers[you.profileId] == nil
    }
}

public enum EventStage: String, Codable, Sendable {
    case toSwipe, voting, scheduled, closed
}

public struct EventSections: Sendable, Equatable {
    public var toSwipe: [SuggestedEvent] = []
    public var voting: [SuggestedEvent] = []
    public var scheduled: [SuggestedEvent] = []
    public var closed: [SuggestedEvent] = []
}

public struct StagedEvent: Sendable, Equatable {
    public var stage: EventStage
    public var event: SuggestedEvent
}

public struct PhoneEventGroups: Sendable, Equatable {
    public var answer: [StagedEvent]
    public var coming: [StagedEvent]
    public var past: [StagedEvent]
}

/// How the event list is sorted into its sections.
public func sectionEvents(_ events: [SuggestedEvent], now: Int64) -> EventSections {
    var sections = EventSections()
    var firstDate: [String: Int64] = [:]
    for event in events {
        if event.status == .cancelled { continue }
        if isVote(event) && event.status == .pending {
            let dates = upcomingDates(event, now: now)
            if let first = dates.first {
                firstDate[event.id] = instantOrZero(first.start)
                if needsYourAnswer(event, now: now) {
                    sections.toSwipe.append(event)
                } else {
                    sections.voting.append(event)
                }
            } else {
                sections.closed.append(event)
            }
            continue
        }
        if let date = event.currentDate, instantOrZero(date.end) > now,
            event.status == .scheduled
        {
            sections.scheduled.append(event)
        } else {
            sections.closed.append(event)
        }
    }
    func first(_ event: SuggestedEvent) -> Int64 { firstDate[event.id] ?? 0 }
    func soonest(_ event: SuggestedEvent) -> Int64 {
        instantOrZero(event.currentDate?.start ?? "")
    }
    sections.toSwipe = stableSorted(sections.toSwipe) { first($0) < first($1) }
    sections.voting = stableSorted(sections.voting) { first($0) < first($1) }
    sections.scheduled = stableSorted(sections.scheduled) { soonest($0) < soonest($1) }
    sections.closed = stableSorted(sections.closed) {
        instantOrZero($0.updatedAt) > instantOrZero($1.updatedAt)
    }
    return sections
}

/// Every event the page shows, section by section, each with its section.
public func eventsInOrder(_ sections: EventSections) -> [StagedEvent] {
    sections.toSwipe.map { StagedEvent(stage: .toSwipe, event: $0) }
        + sections.voting.map { StagedEvent(stage: .voting, event: $0) }
        + sections.scheduled.map { StagedEvent(stage: .scheduled, event: $0) }
        + sections.closed.map { StagedEvent(stage: .closed, event: $0) }
}

private let pastKeptMs: Int64 = 7 * 24 * 60 * 60 * 1000

private func endedAt(_ event: SuggestedEvent) -> Int64 {
    if event.status != .noDate {
        if let date = event.currentDate { return instantOrZero(date.end) }
        if let last = event.candidates.map({ instantOrZero($0.end) }).max() { return last }
    }
    return instantOrZero(event.updatedAt)
}

private func startsAt(_ staged: StagedEvent, now: Int64) -> Int64 {
    switch staged.stage {
    case .scheduled:
        return instantOrZero(staged.event.currentDate?.start ?? "")
    case .voting, .toSwipe:
        return upcomingDates(staged.event, now: now).first.map { instantOrZero($0.start) }
            ?? .max
    case .closed:
        return .max
    }
}

/// A phone's Aftaler in its three groups: what needs you, what is to come, what is over.
public func phoneEventGroups(_ events: [SuggestedEvent], now: Int64) -> PhoneEventGroups {
    let staged = eventsInOrder(sectionEvents(events, now: now))
    func yours(_ s: StagedEvent) -> Bool {
        s.stage == .toSwipe
            || (s.stage == .voting && s.event.createdBy.isYou
                && voteStage(s.event, now: now) == .choose)
    }
    return PhoneEventGroups(
        answer: staged.filter(yours),
        coming: stableSorted(staged.filter { $0.stage != .closed && !yours($0) }) {
            startsAt($0, now: now) < startsAt($1, now: now)
        },
        past: stableSorted(
            staged.filter { $0.stage == .closed && now - endedAt($0.event) < pastKeptMs }
        ) { endedAt($0.event) > endedAt($1.event) }
    )
}
