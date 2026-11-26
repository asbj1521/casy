// What the phone's home page shows of Casy's own events (#172; homeVotes.ts):
// the votes waiting for your answer, their dates pencilled into their days, and
// the events decided, as chips of their own. Drawn by the app itself (#202).

/// The month items' calendar id for Casy's events, drawn in Casy's orange.
public let casyVoteCalendar = "casy"
// Casy's orange is `casyRGB` (CalendarDay.swift).

/// You said no to the date an event was decided on: it isn't yours to show.
private func saidNo(_ e: SuggestedEvent) -> Bool {
    guard let you = e.invitees.first(where: \.isYou)?.profileId, let current = e.currentDate else { return false }
    return e.candidates.first { $0.id == current.id }?.answers[you] == .declined
}

/// Votes with dates waiting for your answer, soonest first (My events' "toSwipe").
public func waitingVotes(_ events: [SuggestedEvent], now: Int64) -> [SuggestedEvent] {
    sectionEvents(events, now: now).toSwipe
}

/// Each waiting vote's dates still to come, pencilled in under its title.
public func pencilItems(_ votes: [SuggestedEvent], titleOf: (SuggestedEvent) -> String, now: Int64) -> [MonthItem] {
    votes.flatMap { vote in
        upcomingDates(vote, now: now).map {
            MonthItem(
                calendarId: casyVoteCalendar, start: instantOrZero($0.start), end: instantOrZero($0.end),
                label: titleOf(vote), pencil: true)
        }
    }
}

/// The events Casy has decided that you are going to, still to come, as month items
/// under their title. One your calendar already holds at exactly that time is left out:
/// that is the copy Casy wrote into it, already drawn.
public func scheduledItems(
    _ events: [SuggestedEvent], calendarItems: [MonthItem], titleOf: (SuggestedEvent) -> String, now: Int64
) -> [MonthItem] {
    let taken = Set(calendarItems.map { "\($0.start)/\($0.end)" })
    return sectionEvents(events, now: now).scheduled.compactMap { e in
        guard let current = e.currentDate else { return nil }
        let start = instantOrZero(current.start)
        let end = instantOrZero(current.end)
        if saidNo(e) || taken.contains("\(start)/\(end)") { return nil }
        return MonthItem(calendarId: casyVoteCalendar, start: start, end: end, label: titleOf(e))
    }
}

/// The events decided since this device last looked (`seen`: their ids), still to come.
public func newlyDecided(_ events: [SuggestedEvent], seen: Set<String>, now: Int64) -> [SuggestedEvent] {
    sectionEvents(events, now: now).scheduled.filter { !seen.contains($0.id) }
}
