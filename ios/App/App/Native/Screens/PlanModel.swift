import CasyAPI
import CasyCore
import CasyUI
import Foundation
import UIKit

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
    /// Each "at least N" with its first date (#259), nil until the calendars are read.
    private(set) var counts: [CountOption]?
    private var countsTask: Task<Void, Never>?
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

    /// "Nulstil planen": a fresh plan for the same group (the web's reset, #189).
    func startOver() {
        fillTask?.cancel()
        fill = nil
        questions = []
        aiFailure = nil
        name = ""
        extras = .defaults
        settings = Self.randomSettings()
        peopleChoices = [:]
        restart()
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
        countsTask?.cancel()
        guard let people = people, !people.participants.isEmpty else {
            found = nil
            counts = nil
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
            if !Task.isCancelled {
                found = result
                recount()
            }
        }
    }

    /// "Hvor mange skal kunne": the first date for each count, searched off the main thread.
    private func recount() {
        countsTask?.cancel()
        guard let people, !settings.multiDay else {
            counts = nil
            return
        }
        let input = WidenInput(
            participants: people.participants, settings: settings, members: members,
            choice: peopleChoice, today: isoString(startOfDay(Native.now, zone)), limitEnd: searchWindowFrom(Native.now).end,
            timeZone: zone, now: Native.now)
        countsTask = Task {
            let result = await Task.detached(priority: .utility) { firstDateByCount(input) }.value
            if !Task.isCancelled { counts = result }
        }
    }

    // MARK: Asking the AI (#173)

    /// Whether the name field also asks the AI (the web's useAiAllowed).
    private(set) var aiOn = false
    private(set) var aiPending = false
    private(set) var aiFailure: String?
    /// The AI's questions, each with the option picked (nil while unanswered).
    private(set) var questions: [(question: PlanQuestion, picked: Int?)] = []
    /// AI answers left today.
    private(set) var aiLeft: Int?

    func loadAi() async {
        let profile = ProfileModel.shared
        if profile.whoAmI == nil { await profile.load() }
        aiOn = profile.whoAmI?.aiAllowed == true
    }

    /// The plan as it stands, for the fill to play back from.
    var state: PlanState { PlanState(name: name, settings: settings) }

    /// What is written, sent as a fresh plan (the phone's sheet always starts
    /// over): settings, title and how many from the answer; no places, notes or
    /// people by name, which the phone has no rows for (#260). `onAnswer` hears
    /// whether there are questions to ask first.
    func describe(_ text: String, onAnswer: @escaping (_ hasQuestions: Bool) -> Void) {
        let trimmed = text.trimmingCharacters(in: .whitespacesAndNewlines)
        guard !trimmed.isEmpty, !aiPending else { return }
        aiPending = true
        aiFailure = nil
        Task {
            defer { aiPending = false }
            do {
                guard let api = await Native.api() else {
                    throw APIError.failed(status: 401, message: CasyStrings.planAiFailed)
                }
                let answer = try await api.planWithAi(
                    text: trimmed, earlier: [], current: nil, errorMessage: CasyStrings.planAiFailed)
                let plan = answer.plan
                settings = applyPlan(aiBaseSettings, plan.settings, zone)
                name = String((plan.title ?? "").prefix(Self.maxName))
                extras = .defaults
                if let id = activeGroup?.id {
                    peopleChoices[id] = applyPeople(PeopleChoice(), plan, resolved: [:])
                }
                questions = plan.questions.map { ($0, nil) }
                aiLeft = answer.left
                restart()
                onAnswer(!plan.questions.isEmpty)
            } catch {
                aiFailure = error.localizedDescription
            }
        }
    }

    /// One of a question's options: its settings applied as they are, no call.
    func answer(_ question: Int, _ option: Int) {
        guard questions.indices.contains(question),
            questions[question].question.options.indices.contains(option)
        else { return }
        settings = applyPlan(settings, questions[question].question.options[option].patch, zone)
        questions[question].picked = option
        restart()
    }

    // MARK: The AI filling the sheet in (useAiFill)

    /// The fill playing: the sheet as it was, played forward a move at a time.
    private(set) var fill: PlanFill?
    private var fillTask: Task<Void, Never>?

    /// What the rows show: the fill's frame while it plays, else the plan.
    var shownSettings: SchedulerSettings { fill?.frame?.settings ?? settings }
    var shownName: String { fill?.frame?.name ?? name }
    var lit: FillKey? { fill?.frame?.lit }
    var fillSheet: FillSheet? { fill?.frame?.sheet }
    var fillPress: FillPress? { fill?.frame?.press }
    /// Nothing to press while the AI answers or fills the sheet in.
    var filling: Bool { fill != nil || aiPending }

    /// The sheet as it was while the AI's questions are open.
    func holdFill(from: PlanState) {
        fillTask?.cancel()
        fill = PlanFill(frames: [Frame(name: from.name, settings: from.settings, ms: 0)], tick: 0)
    }

    /// Play the answer back from the sheet as it was before it was asked;
    /// under reduced motion it is simply there.
    func startFill(from: PlanState) {
        fillTask?.cancel()
        if UIAccessibility.isReduceMotionEnabled {
            fill = nil
            return
        }
        let frames = fillScript(from: from, to: state)
        fill = PlanFill(frames: frames, tick: 0)
        fillTask = Task {
            for i in frames.indices {
                guard !Task.isCancelled else { return }
                fill?.tick = i
                let frame = frames[i]
                if frame.lit != .name {
                    UIImpactFeedbackGenerator(style: .light).impactOccurred()
                } else if frame.ms == FillTiming.type {
                    UISelectionFeedbackGenerator().selectionChanged()
                }
                try? await Task.sleep(for: .milliseconds(frame.ms))
            }
            guard !Task.isCancelled else { return }
            // The last light fades before the sheet is the plan's own again.
            fill?.tick = frames.count
            try? await Task.sleep(for: .milliseconds(FillTiming.sheet))
            guard !Task.isCancelled else { return }
            fill = nil
        }
    }

    // MARK: Defaults

    /// A fresh plan's settings: one of the meetings people plan most (the web's randomDefaultSettings).
    static func randomSettings() -> SchedulerSettings {
        let presets: [(Double, Int)] = [(18, 180), (19, 120), (12, 60), (10, 120), (14, 180), (17, 120)]
        var preset = presets.randomElement() ?? (18, 180)
        #if DEBUG
            // The web's seeded draw in the parity build (the browser tests' generator).
            if TestLaunch.isActive { preset = presets[5] }
        #endif
        return SchedulerSettings(
            multiDay: false, startHour: preset.0, durationMinutes: preset.1, dows: allDows, anyTime: false,
            startWindow: nil, days: 3, startDow: 5, period: nil)
    }
}
