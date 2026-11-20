// Searching an open vote again (#240), searchAgain.ts: the vote's plan as
// Planlæg's (planFromVote) and everyone's answers counted in the search
// (withAnswers). Kept equal by widen.cases.ts.

/// The vote's plan as Planlæg's settings and who it is for.
public struct VotePlan: Codable, Sendable, Equatable {
    public var sched: SchedulerSettings
    public var people: PeopleChoice
}

/// The vote's plan as Planlæg's settings (the reverse of settingsToSearch),
/// laid over `base`: the same meeting or trip, every month from today, and
/// who it is for now, the members added among them and the rest of the
/// group left out.
public func planFromVote(
    _ settings: EventSettings, invited: [String], group: [String], onto base: SchedulerSettings
) -> VotePlan {
    let optional = settings.people?.optional ?? []
    var states: [String: MemberState] = [:]
    for id in group {
        states[id] = !invited.contains(id) ? .out : optional.contains(id) ? .optional : .required
    }
    let people = PeopleChoice(states: states, atLeast: settings.people?.atLeast)
    var s = base
    s.period = nil
    switch settings.kind {
    case .single:
        s.multiDay = false
        s.startHour = settings.startHour ?? s.startHour
        s.durationMinutes = settings.durationMinutes ?? s.durationMinutes
        s.anyTime = settings.anyTime ?? false
        s.startWindow = settings.startWindow
        s.dows = settings.allowedDays ?? [0, 1, 2, 3, 4, 5, 6]
    case .trip:
        s.multiDay = true
        if let shape = settings.shape {
            s.startDow = shape.anchorDow
            s.days = shape.spanDays
        }
    case .vacation:
        s.multiDay = true
        s.startDow = nil
        s.days = settings.days ?? s.days
    }
    return VotePlan(sched: s, people: people)
}

/// Everyone's busy time with their answers to the vote's dates added: a
/// "can't" is that person busy then (never), a "rather not" time they could
/// skip.
public func withAnswers(_ participants: [Participant], _ dates: [CandidateDate]) -> [Participant] {
    participants.map { p in
        let answered: [BusyInterval] = dates.compactMap { d in
            switch d.answers[p.profileId] {
            case .declined: BusyInterval(start: d.start, end: d.end, priority: .never)
            case .maybe: BusyInterval(start: d.start, end: d.end, priority: .skip)
            default: nil
            }
        }
        guard !answered.isEmpty else { return p }
        var q = p
        q.busy += answered
        return q
    }
}
