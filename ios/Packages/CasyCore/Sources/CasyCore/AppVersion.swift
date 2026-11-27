// Whether this app is too old to use (#143), as src/lib/appVersion.ts says it,
// kept equal by its parity fixture (appVersion.json). The page asked until
// #202; without it the app asks itself (the `app-version` function).

import Foundation

/// "1.2.3" as [1, 2, 3], "1.2" as [1, 2, 0]; nil for anything else.
public func parseVersion(_ version: String) -> [Int]? {
    let parts = version.trimmingCharacters(in: .whitespacesAndNewlines).split(
        separator: ".", omittingEmptySubsequences: false)
    guard (2...3).contains(parts.count),
        parts.allSatisfy({ !$0.isEmpty && $0.allSatisfy { $0.isASCII && $0.isNumber } })
    else { return nil }
    let numbers = parts.compactMap { Int($0) }
    guard numbers.count == parts.count else { return nil }
    return numbers.count == 3 ? numbers : numbers + [0]
}

/// True when `current` is older than `minimum`. Anything unreadable on either
/// side counts as new enough: a typo in the secret must never lock everyone out.
public func isOutdated(_ current: String, _ minimum: String?) -> Bool {
    guard let minimum, !minimum.isEmpty, let a = parseVersion(current), let b = parseVersion(minimum) else {
        return false
    }
    for i in 0..<3 where a[i] != b[i] { return a[i] < b[i] }
    return false
}
