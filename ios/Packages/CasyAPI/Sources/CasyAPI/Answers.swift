// The Edge Functions' answers, as src/api/groups.ts, account.ts and
// adminStatus.ts type them. More arrive with the screens that need them.
// What TypeScript marks optional or nullable is optional here. Words the
// screens only display (a provider, a status) stay strings, so a new value
// from the server can't stop a whole answer from reading.

import Foundation

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

public struct DisplayName: Codable, Sendable, Equatable {
    public var name: String
}

public struct AvatarAnswer: Codable, Sendable, Equatable {
    public var avatarUrl: String?
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

/// What leaving or deleting a group answers: your groups as they now are.
/// `outcome` is "left", "group_deleted" (you were the last) or "deleted".
public struct LeftGroup: Codable, Sendable, Equatable {
    public var groups: [Group]?
    public var outcome: String?
}

/// Joining answers both lists, the new group in yours.
public struct JoinedGroup: Codable, Sendable, Equatable {
    public var groups: [Group]?
    public var invitations: [Invitation]?
}

/// Someone you blocked (#142); `name` is null when their account is gone.
public struct BlockedPerson: Codable, Sendable, Equatable, Identifiable {
    public var profileId: String
    public var name: String?
    public var blockedAt: String

    public var id: String { profileId }
}

/// Blocking answers whom you block now, and the invitations still open.
public struct BlockAnswer: Codable, Sendable, Equatable {
    public var blocked: [BlockedPerson]
    public var invitations: [Invitation]?
}

/// A group's new picture: a link to it, null once removed.
public struct GroupPictureAnswer: Codable, Sendable, Equatable {
    public var pictureUrl: String?
}

/// A report has arrived.
public struct ReportAnswer: Codable, Sendable, Equatable {
    public var reported: Bool
}

/// Someone you know from a group since gone (#222).
public struct Friend: Codable, Sendable, Equatable, Identifiable {
    public var profileId: String
    public var name: String
    public var avatarUrl: String?

    public var id: String { profileId }
}

public struct FriendsAnswer: Codable, Sendable, Equatable {
    public var friends: [Friend]?
}

/// A fresh invite link: anyone holding it can join until it runs out.
public struct InviteLink: Codable, Sendable, Equatable {
    public var url: String
    public var expiresAt: String
}

/// A new group: your groups, the new one among them.
public struct CreatedGroup: Codable, Sendable, Equatable {
    public var groups: [Group]
    public var createdId: String
}

/// What an action did, in the server's word ("given", "deleted").
public struct Outcome: Codable, Sendable, Equatable {
    public var outcome: String?
}

/// Whom you have blocked (#142).
public struct BlockedAnswer: Codable, Sendable, Equatable {
    public var blocked: [BlockedPerson]
}

/// Any JSON as it came, for Hent en kopi: the export is handed on whole,
/// never read field by field, so nothing in it is lost on the way.
public indirect enum JSONValue: Codable, Sendable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([JSONValue])
    case object([String: JSONValue])

    public init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([JSONValue].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: JSONValue].self))
        }
    }

    public func encode(to encoder: Encoder) throws {
        var c = encoder.singleValueContainer()
        switch self {
        case .null: try c.encodeNil()
        case .bool(let v): try c.encode(v)
        case .number(let v): try c.encode(v)
        case .string(let v): try c.encode(v)
        case .array(let v): try c.encode(v)
        case .object(let v): try c.encode(v)
        }
    }
}

/// Everything admin mode shows (`AdminOverview` in src/api/admin.ts).
public struct AdminOverview: Codable, Sendable, Equatable {
    public struct Health: Codable, Sendable, Equatable {
        public var ok: Bool
        /// "stale" or "failing" when not ok.
        public var reason: String?
    }

    public struct Skill: Codable, Sendable, Equatable {
        public var skill: String
        public var today: Int
        public var last30Days: Int
        public var costToday: Double
        public var cost30Days: Double
    }

    public struct AI: Codable, Sendable, Equatable {
        public var today: Int
        public var limit: Int
        public var skills: [Skill]?
    }

    public struct Stats: Codable, Sendable, Equatable {
        public var users: Int
        public var groups: Int
        public var connectedAccounts: Int
        public var failingSyncs: Int
        public var busyBlocks: Int
    }

    public struct Member: Codable, Sendable, Equatable, Identifiable {
        public var profileId: String
        public var name: String
        public var joinedAt: String

        public var id: String { profileId }
    }

    public struct Group: Codable, Sendable, Equatable, Identifiable {
        public var id: String
        public var name: String
        public var createdAt: String
        public var createdBy: String?
        public var createdByName: String?
        public var members: [Member]
    }

    public struct User: Codable, Sendable, Equatable, Identifiable {
        public var id: String
        public var name: String
        public var createdAt: String
        public var lastSignInAt: String?
        public var groups: Int
        public var calendars: Int
        /// "admin", "allowed" or "off".
        public var ai: String?
        public var tester: Bool?
    }

    public struct Connection: Codable, Sendable, Equatable, Identifiable {
        public var id: String
        public var ownerId: String
        public var ownerName: String
        public var provider: String
        /// "pending", "connected" or "error".
        public var status: String
        public var calendars: Int
        public var createdAt: String
        public var lastSyncedAt: String?
        public var lastSyncAttemptAt: String?
        public var syncError: String?
        public var needsReconnect: Bool
    }

    public var health: Health
    public var ai: AI?
    public var stats: Stats
    public var groups: [Group]
    public var users: [User]
    public var usersTruncated: Bool
    public var connections: [Connection]
}

public struct AdminDeleted: Codable, Sendable, Equatable {
    public var outcome: String
    public var leftGroups: Int
    public var deletedGroups: Int
}

public struct AdminUserSync: Codable, Sendable, Equatable {
    public var synced: Int
    public var failed: Int
    public var busyBlocks: Int
}

public struct AdminConnectionSync: Codable, Sendable, Equatable {
    public var ok: Bool
    public var message: String?
    public var busyBlocks: Int?
}

public struct AdminTesterAnswer: Codable, Sendable, Equatable {
    public var tester: Bool
}

public struct AdminStatus: Codable, Sendable, Equatable {
    public var isAdmin: Bool
}

/// Which notification kinds are off, and how many phones they go to.
public struct PushSettings: Codable, Sendable, Equatable {
    public var off: [String]
    public var devices: Int
}

/// The kinds off after changing one.
public struct PushKindsOff: Codable, Sendable, Equatable {
    public var off: [String]
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

/// A report of what someone wrote (#142): what, why and the text as it was,
/// never who sent it.
public struct AdminReport: Codable, Sendable, Equatable, Identifiable {
    public struct Content: Codable, Sendable, Equatable {
        public var groupName: String?
        public var groupDescription: String?
        public var title: String?
        public var place: String?
        public var note: String?
        public var memberName: String?
        public var memberId: String?
    }

    public var id: String
    /// "group", "event" or "member".
    public var kind: String
    public var reason: String
    public var note: String?
    public var content: Content
    /// The reported picture as it was (#187), linked; nil for none.
    public var pictureUrl: String?
    /// Nil once the group is gone.
    public var groupId: String?
    public var createdAt: String
}

public struct AdminReports: Codable, Sendable, Equatable {
    public var reports: [AdminReport]
}

/// A correction of the AI sent for review (#122), never whose. `data` is a
/// label correction or a plan's feedback, by `kind`.
public struct AdminCorrection: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    /// "label" or "plan".
    public var kind: String
    public var data: JSONValue
    public var createdAt: String
}

public struct AdminCorrections: Codable, Sendable, Equatable {
    public var corrections: [AdminCorrection]
}

/// A test notification (#139): how many phones got it, and Apple's reasons for the rest.
public struct PushTestAnswer: Codable, Sendable, Equatable {
    public var sent: Int
    public var failed: [String]
}

extension JSONValue {
    /// The value read as a type of its own, or nil when it isn't one.
    public func decoded<T: Decodable>(as type: T.Type) -> T? {
        guard let data = try? JSONEncoder().encode(self) else { return nil }
        return try? JSONDecoder().decode(T.self, from: data)
    }

    /// As JavaScript's JSON.stringify writes it: `16`, `"evening"`, `[5,6]`.
    public var compactJSON: String {
        let encoder = JSONEncoder()
        encoder.outputFormatting = [.sortedKeys, .withoutEscapingSlashes]
        return (try? encoder.encode(self)).flatMap { String(data: $0, encoding: .utf8) } ?? ""
    }
}

/// A label correction (`LabelCorrectionView`): the event's title and calendar,
/// the label the AI gave, what the person wrote, and the label that came of it.
public struct LabelCorrection: Codable, Sendable, Equatable {
    public struct Label: Codable, Sendable, Equatable {
        public var kind: String
        public var importance: String
    }

    public var title: String
    public var calendar: String
    public var previous: Label
    public var note: String
    public var label: Label
}

/// A plan's feedback (`PlanFeedback`): what was written, what the AI made of
/// it, the fields changed by hand and what was sent.
public struct PlanCorrection: Codable, Sendable, Equatable {
    public var texts: [String]
    public var plan: [String: JSONValue]
    public var overridden: [String]
    public var final: [String: JSONValue]
}
