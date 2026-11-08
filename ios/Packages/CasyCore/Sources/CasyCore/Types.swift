// The shapes the scheduling engine works on (src/types/index.ts). Instants are
// ISO 8601 strings in UTC, as they arrive from the server and as the engine's
// TypeScript reads them.

public enum CalendarProvider: String, Codable, Sendable, CaseIterable {
    case google, outlook, apple, ics, device
}

public enum CalendarPurpose: String, Codable, Sendable, CaseIterable {
    case work, school, personal, other
}

public enum EventCategory: String, Codable, Sendable, CaseIterable {
    case work, school, social, health, travel, personal, family
}

public enum CalendarPriority: String, Codable, Sendable, CaseIterable {
    case skip, normal, never
}

public struct BusyInterval: Codable, Sendable, Equatable {
    public var start: String
    public var end: String
    public var title: String?
    public var category: EventCategory?
    public var priority: CalendarPriority?
    public var holiday: Bool?

    public init(
        start: String,
        end: String,
        title: String? = nil,
        category: EventCategory? = nil,
        priority: CalendarPriority? = nil,
        holiday: Bool? = nil
    ) {
        self.start = start
        self.end = end
        self.title = title
        self.category = category
        self.priority = priority
        self.holiday = holiday
    }
}

public struct Participant: Codable, Sendable, Equatable {
    public var profileId: String
    public var name: String
    public var busy: [BusyInterval]

    public init(profileId: String, name: String, busy: [BusyInterval]) {
        self.profileId = profileId
        self.name = name
        self.busy = busy
    }
}

public struct FriendGroup: Codable, Sendable, Equatable {
    public var id: String
    public var name: String
    public var participants: [Participant]

    public init(id: String, name: String, participants: [Participant]) {
        self.id = id
        self.name = name
        self.participants = participants
    }
}

public struct SchedulingConstraints: Codable, Sendable, Equatable {
    public var earliestHour: Double?
    public var latestHour: Double?
    public var allowedDays: [Int]?
    public var startStepMinutes: Int?
    public var preferredHour: Double?

    public init(
        earliestHour: Double? = nil,
        latestHour: Double? = nil,
        allowedDays: [Int]? = nil,
        startStepMinutes: Int? = nil,
        preferredHour: Double? = nil
    ) {
        self.earliestHour = earliestHour
        self.latestHour = latestHour
        self.allowedDays = allowedDays
        self.startStepMinutes = startStepMinutes
        self.preferredHour = preferredHour
    }
}

public struct MeetingSearch: Codable, Sendable, Equatable {
    public var participants: [Participant]
    public var quorum: Int?
    public var durationMinutes: Int
    public var searchStart: String
    public var searchEnd: String
    public var timeZone: String
    public var constraints: SchedulingConstraints?

    public init(
        participants: [Participant],
        quorum: Int? = nil,
        durationMinutes: Int,
        searchStart: String,
        searchEnd: String,
        timeZone: String,
        constraints: SchedulingConstraints? = nil
    ) {
        self.participants = participants
        self.quorum = quorum
        self.durationMinutes = durationMinutes
        self.searchStart = searchStart
        self.searchEnd = searchEnd
        self.timeZone = timeZone
        self.constraints = constraints
    }
}

public struct TimeSlot: Codable, Sendable, Equatable {
    public var start: String
    public var end: String

    public init(start: String, end: String) {
        self.start = start
        self.end = end
    }
}
