import Foundation
import Testing

@testable import CasyAPI

// The answers the fake backend gives the browser tests (e2e/apiAnswers.parity.ts).
// Each must read, and write back with nothing lost: a field the web's types
// have and these don't fails here.

private indirect enum Value: Codable, Equatable {
    case null
    case bool(Bool)
    case number(Double)
    case string(String)
    case array([Value])
    case object([String: Value])

    init(from decoder: Decoder) throws {
        let c = try decoder.singleValueContainer()
        if c.decodeNil() {
            self = .null
        } else if let v = try? c.decode(Bool.self) {
            self = .bool(v)
        } else if let v = try? c.decode(Double.self) {
            self = .number(v)
        } else if let v = try? c.decode(String.self) {
            self = .string(v)
        } else if let v = try? c.decode([Value].self) {
            self = .array(v)
        } else {
            self = .object(try c.decode([String: Value].self))
        }
    }

    func encode(to encoder: Encoder) throws {
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

    var withoutNulls: Value {
        switch self {
        case .array(let v): .array(v.map(\.withoutNulls))
        case .object(let v): .object(v.compactMapValues { $0 == .null ? nil : $0.withoutNulls })
        default: self
        }
    }
}

private func data(_ name: String) throws -> Data {
    let url = try #require(
        Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "Answers"))
    return try Data(contentsOf: url)
}

@discardableResult
private func readsWithNothingLost<T: Codable>(_ name: String, as type: T.Type) throws -> T {
    let raw = try data(name)
    let decoded = try JSONDecoder().decode(T.self, from: raw)
    let original = try JSONDecoder().decode(Value.self, from: raw).withoutNulls
    let back = try JSONDecoder().decode(Value.self, from: JSONEncoder().encode(decoded))
    #expect(back.withoutNulls == original, "\(name)")
    return decoded
}

@Test func whoAmIReads() throws {
    let me = try readsWithNothingLost("whoami", as: WhoAmI.self)
    #expect(!me.name.isEmpty)
}

@Test func groupsRead() throws {
    let answer = try readsWithNothingLost("groups-list", as: GroupsAnswer.self)
    let groups = try #require(answer.groups)
    #expect(!groups.isEmpty)
    #expect(groups.allSatisfy { !$0.members.isEmpty })
}

@Test func noGroupsRead() throws {
    let answer = try readsWithNothingLost("groups-list-empty", as: GroupsAnswer.self)
    #expect(answer.groups?.isEmpty == true)
}

@Test func invitationsRead() throws {
    try readsWithNothingLost("groups-invitations", as: InvitationsAnswer.self)
}

@Test func myDataReads() throws {
    let mine = try readsWithNothingLost("account-data", as: MyData.self)
    #expect(!mine.calendars.isEmpty)
}

@Test func myDataWithNothingLinkedReads() throws {
    let mine = try readsWithNothingLost("account-data-empty", as: MyData.self)
    #expect(mine.calendars.isEmpty)
}

@Test func adminStatusReads() throws {
    try readsWithNothingLost("admin-status", as: AdminStatus.self)
}

@Test func deletingAnAccountReads() throws {
    try readsWithNothingLost("account-delete", as: NoAnswer.self)
}
