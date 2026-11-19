import CasyAPI
import CasyCore
import CasyUI
import Foundation

/// Planning an event for a group, natively (#282): the web's usePlanning for
/// what the Planlæg sheet needs: which group, what it is called, what and
/// when (`settings`), who it is for, the extras sent with the dates, and
/// the first date everyone can make, searched from the group's busy times.
/// One for the launch: the plan stays as it was left (as the web's
/// pageMemory), forgotten after PLAN_FORGET and when the person changes.
@MainActor @Observable
final class PlanModel {
    static let shared = PlanModel()

    /// How long a plan left alone is remembered, as the web's PLAN_FORGET_MS.
    static let forgetAfter: TimeInterval = 10 * 60
    /// The titles' length (MAX_NAME_LENGTH) and what a description for the AI may hold.
    static let maxName = 60
    static let maxDescription = 500

    private let zone = appTimeZone

    // MARK: What is planned

    var name = ""
    var extras = EventExtras.defaults
    var settings: SchedulerSettings = PlanModel.randomSettings()
    /// Who each group's event is for, per group: members differ (#89).
    private(set) var peopleChoices: [String: PeopleChoice] = [:]
    private(set) var steps = AnswerSteps.restart()
    private(set) var selectedGroupId: String?

    // MARK: What it is planned from

    private(set) var groups: [CasyAPI.Group]?
    private(set) var groupsFailed = false
    private(set) var busy: GroupBusy?
    private(set) var busyFailed = false
    private(set) var busyLoading = false
    private var busyFor: String?
    private var busyTask: Task<Void, Never>?
    private var closedAt: Date?

    /// The answer on screen: the first date for the step, nil while the
    /// group's calendars load or when nothing fits.
    private(set) var found: MultiDayResult?
    private var searchTask: Task<Void, Never>?
    /// The group the person last planned for, kept on the phone as the web does (lastGroupKey).
    private static let lastGroupKey = "casy-last-group"

    // MARK: Groups

    func reset() {
        name = ""
        extras = .defaults
        settings = Self.randomSettings()
        peopleChoices = [:]
        steps = .restart()
        selectedGroupId = nil
        groups = nil
        groupsFailed = false
        busy = nil
        busyFor = nil
        found = nil
    }

    /// Opened: a plan left long ago starts over; groups and calendars are read again.
    func open() async {
        if let closedAt, Date().timeIntervalSince(closedAt) > Self.forgetAfter {
            name = ""
            extras = .defaults
            settings = Self.randomSettings()
            peopleChoices = [:]
            steps = .restart()
            selectedGroupId = nil
        }
        closedAt = nil
        await loadGroups()
    }

    func closed() { closedAt = Date() }

    func loadGroups() async {
        guard let api = await Native.api() else { return }
        do {
            groups = try await api.groups(errorMessage: CasyStrings.groupsLoadFailed)
            groupsFailed = false
        } catch {
            if groups == nil { groupsFailed = true }
        }
        await loadBusy()
    }

    /// The group on screen: the one picked, else the one last planned for, else the first.
    var activeGroup: CasyAPI.Group? {
        guard let groups, !groups.isEmpty else { return nil }
        let remembered = UserDefaults.standard.string(forKey: Self.lastGroupKey)
        return groups.first { $0.id == (selectedGroupId ?? remembered) } ?? groups[0]
    }

    func select(_ group: CasyAPI.Group) {
        selectedGroupId = group.id
        UserDefaults.standard.set(group.id, forKey: Self.lastGroupKey)
        restart()
        Task { await loadBusy() }
    }

    var members: [String] { activeGroup?.members.map(\.profileId) ?? [] }
    var you: String? { activeGroup?.members.first(where: \.isYou)?.profileId }

    // MARK: Who it is for

    var peopleChoice: PeopleChoice {
        activeGroup.flatMap { peopleChoices[$0.id] } ?? PeopleChoice()
    }

    func updatePeople(_ choice: PeopleChoice) {
        guard let id = activeGroup?.id else { return }
        peopleChoices[id] = choice
        // Like any other setting: back to the first date for the new rules.
        restart()
    }

    // MARK: What is searched

    /// What is searched, as the sheet's settings and the people choice make it.
    var search: EventSettings {
        settingsToSearch(settings, people: peopleFromChoice(members, peopleChoice, meeting: !settings.multiDay))
    }

    /// The months to search, else the whole year from today.
    var searchWindow: (start: String, end: String) {
        let limit = searchWindowFrom(Native.now)
        return periodWindow(settings.period, today: isoString(startOfDay(Native.now, zone)), limitEnd: limit.end, zone)
    }

    private func searchWindowFrom(_ now: Int64) -> (start: String, end: String) {
        CasyCore.searchWindow(now: now, zone)
    }

    /// Every searched member, with Christmas and New Year blocked: nil while the calendars load.
    var people: GroupPeople? {
        guard let group = activeGroup, let busy else { return nil }
        return participantsFromGroup(group, busy, markYou: { $0 }, now: Native.now, zone)
    }

    // MARK: Changing it

    /// A setting changed, by hand or by the AI: back to the first date.
    func update(_ change: (inout SchedulerSettings) -> Void) {
        change(&settings)
        restart()
    }

    func restart() {
        steps = .restart()
        research()
    }

    func jump(to from: String, day: Bool = false) {
        steps = steps.jump(from, day: day)
        research()
    }

    func stepBack() {
        steps = steps.back()
        research()
    }

    // MARK: Reading the calendars

    func loadBusy() async {
        guard let group = activeGroup, let api = await Native.api() else { return }
        if busyFor == group.id, busy != nil {
            research()
            return
        }
        busyTask?.cancel()
        busyFor = group.id
        busyLoading = true
        busyFailed = false
        let window = CasyCore.searchWindow(now: Native.now, zone)
        busyTask = Task {
            defer { busyLoading = false }
            do {
                let data = try await api.groupBusy(
                    group.id, from: window.start, to: window.end, errorMessage: CasyStrings.loadGroupCalendarsFailed)
                guard !Task.isCancelled, busyFor == group.id else { return }
                busy = data
                research()
            } catch {
                guard !Task.isCancelled else { return }
                busy = nil
                busyFailed = true
                found = nil
            }
        }
        await busyTask?.value
    }

    /// The first date for the step on screen, searched off the main thread.
    func research() {
        searchTask?.cancel()
        guard let people = people, !people.participants.isEmpty else {
            found = nil
            return
        }
        let participants = people.participants
        let search = search
        let step = steps.current
        let window = searchWindow
        let now = Native.now
        let zone = zone
        searchTask = Task {
            let result = await Task.detached(priority: .userInitiated) {
                findAnswer(
                    participants, search, from: step.from, day: step.day == true, windowStart: window.start,
                    windowEnd: window.end, now: now, zone)
            }.value
            if !Task.isCancelled { found = result }
        }
    }

    // MARK: Defaults

    /// A fresh plan's settings: one of the meetings people plan most (the web's randomDefaultSettings).
    static func randomSettings() -> SchedulerSettings {
        let presets: [(Double, Int)] = [(18, 180), (19, 120), (12, 60), (10, 120), (14, 180), (17, 120)]
        let preset = presets.randomElement() ?? (18, 180)
        return SchedulerSettings(
            multiDay: false, startHour: preset.0, durationMinutes: preset.1, dows: allDows, anyTime: false,
            startWindow: nil, days: 3, startDow: 5, period: nil)
    }
}
