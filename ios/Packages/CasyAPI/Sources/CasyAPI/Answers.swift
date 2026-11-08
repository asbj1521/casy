// The Edge Functions' answers, as src/api/groups.ts, account.ts and
// adminStatus.ts type them. More arrive with the screens that need them.
// What TypeScript marks optional or nullable is optional here. Words the
// screens only display (a provider, a status) stay strings, so a new value
// from the server can't stop a whole answer from reading.

public struct WhoAmI: Codable, Sendable, Equatable {
    public var name: String
    public var unnamed: Bool?
    public var avatarUrl: String?
    public var aiAllowed: Bool?
    public var aiTester: Bool?
    public var eventLabels: Bool?
    public var aiConsent: Bool?
    public var aiShare: Bool?
}

public struct GroupMember: Codable, Sendable, Equatable, Identifiable {
    public var profileId: String
    public var name: String
    public var isYou: Bool
    public var joinedAt: String
    public var avatarUrl: String?

    public var id: String { profileId }
}

public struct Group: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    public var name: String
    public var description: String?
    public var createdAt: String
    public var createdBy: String?
    public var pictureUrl: String?
    public var primeDates: Bool?
    public var members: [GroupMember]
    public var invited: [String]
}

public struct Invitation: Codable, Sendable, Equatable, Identifiable {
    public var groupId: String
    public var groupName: String
    public var groupDescription: String?
    public var memberCount: Int
    public var invitedBy: String?
    public var pictureUrl: String?
    public var createdAt: String

    public var id: String { groupId }
}

public struct GroupsAnswer: Codable, Sendable, Equatable {
    public var groups: [Group]?
}

public struct InvitationsAnswer: Codable, Sendable, Equatable {
    public var invitations: [Invitation]?
}

public struct AdminStatus: Codable, Sendable, Equatable {
    public var isAdmin: Bool
}

/// An answer nobody reads.
public struct NoAnswer: Codable, Sendable, Equatable {
    public init() {}
}

public struct MyData: Codable, Sendable, Equatable {
    public struct Push: Codable, Sendable, Equatable {
        public var devices: Int
        public var off: [String]
    }

    public struct Account: Codable, Sendable, Equatable {
        public var email: String?
        public var name: String?
        public var nameIsCustom: Bool
        public var picture: Bool?
        public var signIn: [String]
        public var push: Push
        public var appleToken: Bool
        public var language: String?
        public var createdAt: String?
    }

    public struct Calendar: Codable, Sendable, Equatable {
        public var name: String?
        public var customName: String?
        public var purpose: String?
        public var categoryName: String?
        public var purposeGuessed: Bool
        public var priority: String
        public var included: Bool
        public var busyCount: Int
    }

    public struct Connection: Codable, Sendable, Equatable {
        public var provider: String
        public var label: String?
        public var status: String
        public var connectedAt: String
        public var lastSyncedAt: String?
        public var credential: String?
        public var calendars: [Calendar]
    }

    public struct Primary: Codable, Sendable, Equatable {
        public var calendar: String?
        public var autoAdd: Bool
        public var lang: String
    }

    public struct Span: Codable, Sendable, Equatable {
        public var start: String
        public var end: String
    }

    public struct Busy: Codable, Sendable, Equatable {
        public var count: Int
        public var first: String?
        public var last: String?
        public var next: [Span]
    }

    public struct GroupEntry: Codable, Sendable, Equatable {
        public var name: String
        public var description: String?
        public var members: Int
        public var createdByYou: Bool
        public var joinedAt: String
        public var primeDates: Bool?
    }

    public struct Links: Codable, Sendable, Equatable {
        public var made: Int
        public var active: Int
    }

    public struct Invitations: Codable, Sendable, Equatable {
        public var pending: Int
        public var declined: Int
        public var sent: Int
    }

    public struct Events: Codable, Sendable, Equatable {
        public var invitedTo: Int
        public var suggested: Int
        public var answers: Int
        public var declined: Int
    }

    public struct CalendarEntries: Codable, Sendable, Equatable {
        public var added: Int
        public var deletedByYou: Int
    }

    public struct Count: Codable, Sendable, Equatable {
        public var count: Int
    }

    public struct Shortcuts: Codable, Sendable, Equatable {
        public var count: Int
        public var pictures: Int?
    }

    public struct Safety: Codable, Sendable, Equatable {
        public var blocked: Int
        public var reportsSent: Int
    }

    public struct Consent: Codable, Sendable, Equatable {
        public var givenAt: String
        public var current: Bool
    }

    public struct Corrections: Codable, Sendable, Equatable {
        public var kept: Int
        public var sharing: Bool
    }

    public struct AI: Codable, Sendable, Equatable {
        public var calls: Int
        public var consent: Consent?
        public var corrections: Corrections
    }

    public var account: Account
    public var calendars: [Connection]
    public var primary: Primary?
    public var busy: Busy
    public var groups: [GroupEntry]
    public var inviteLinks: Links
    public var friendLinks: Links?
    public var invitations: Invitations
    public var emailLookups: Int
    public var events: Events
    public var calendarEntries: CalendarEntries
    public var toldCasy: Count
    public var groupPictures: Count?
    public var shortcuts: Shortcuts
    public var safety: Safety
    public var friends: Count?
    public var ai: AI
}
