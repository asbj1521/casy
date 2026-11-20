// What makes a password good enough for Casy (#282), passwordRules.ts: the
// length and letters-and-numbers rules match what Supabase Auth enforces, and
// a password mustn't be built from the person's email or name. Kept equal by
// format.cases.ts.

import Foundation

/// Matches `minimum_password_length` in supabase/config.toml.
public let minPasswordLength = 8

public struct PasswordChecks: Codable, Sendable, Equatable {
    public var length: Bool
    /// At least one a-z letter and one digit: Supabase's "letters_digits".
    public var lettersAndDigits: Bool
    /// Doesn't contain the person's email name or name.
    public var notPersonal: Bool

    public var pass: Bool { length && lettersAndDigits && notPersonal }
}

/// Lowercase, and only letters and digits, so "Anna.Jensen" and "annajensen" compare equal.
private func squash(_ text: String) -> String {
    String(String.UnicodeScalarView(text.lowercased().unicodeScalars.filter {
        $0.properties.isAlphabetic || $0.properties.numericType != nil
    }))
}

/// The parts of an email address or name worth refusing in a password: the
/// whole thing, the part before the @, and each word, four letters or more.
public func personalWords(_ values: [String?]) -> [String] {
    var words: [String] = []
    for value in values {
        guard let value, !value.isEmpty else { continue }
        let local = value.split(separator: "@", omittingEmptySubsequences: false).first.map(String.init) ?? value
        let parts = local.split(omittingEmptySubsequences: false) { " \t\n._+-".contains($0) }.map(String.init)
        for part in [value, local] + parts {
            let squashed = squash(part)
            if squashed.count >= 4 && !words.contains(squashed) { words.append(squashed) }
        }
    }
    return words
}

public func checkPassword(_ password: String, _ personal: [String]) -> PasswordChecks {
    let squashed = squash(password)
    let ascii = password.unicodeScalars
    return PasswordChecks(
        length: password.utf16.count >= minPasswordLength,
        lettersAndDigits: ascii.contains { ("a"..."z").contains($0) || ("A"..."Z").contains($0) }
            && ascii.contains { ("0"..."9").contains($0) },
        notPersonal: !personal.contains { squashed.contains($0) })
}

/// How often a hash suffix appears in Have I Been Pwned's range answer ("SUFFIX:COUNT" per line).
public func breachCount(_ rangeAnswer: String, suffix: String) -> Int {
    for line in rangeAnswer.split(whereSeparator: \.isNewline) {
        let parts = line.trimmingCharacters(in: .whitespaces).split(separator: ":", maxSplits: 1)
        if parts.first.map({ $0.uppercased() == suffix }) == true {
            return parts.count > 1 ? Int(parts[1].trimmingCharacters(in: .whitespaces)) ?? 0 : 0
        }
    }
    return 0
}
