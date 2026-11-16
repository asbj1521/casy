import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// A starred day on the home page, opened (#171, #200): which group is free,
/// when, that everyone is, and one way on, Planlæg with the group and the day
/// set, which is still the page's (`LeavingProfile.plan`). The footnote is the
/// promise: nobody hears of it until something is sent.
struct PrimeDateSheet: View {
    let preferences: NativePreferences
    let prime: PrimeDate?
    let onDone: () -> Void
    let leave: (LeavingProfile) -> Void

    @State private var group: CasyAPI.Group?
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    var body: some View {
        NavigationStack {
            List {
                if let prime, let group {
                    Section {
                        ListAvatarRow(group.name, index: 0, url: group.pictureUrl.flatMap(URL.init(string:)))
                        ListRow(
                            formatLongDate(isoString(prime.day), lang), systemImage: "calendar",
                            value: when(prime))
                        ListRow(
                            CasyStrings.primeAllFree(group.members.count), systemImage: "person.2",
                            detail: everyone(
                                group.members.filter { !$0.isYou }.map(\.name)
                                    + (group.members.contains(where: \.isYou) ? [CasyStrings.primeYou] : []),
                                lang))
                    } footer: {
                        Text(CasyStrings.primeFootnote)
                    }
                } else if let failure {
                    Notice(failure, tone: .error, bare: true)
                } else {
                    ProgressView()
                }
            }
            .casySheetBar(CasyStrings.primeTitle, close: CasyStrings.done, action: onDone)
            .safeAreaInset(edge: .bottom) {
                FlowButton(action: { leave(.plan) }) { Text(CasyStrings.primePlan) }
                    .disabled(group == nil)
                    .accessibilityIdentifier("prime.plan")
                    .padding(.horizontal, 16)
                    .padding(.bottom, 8)
            }
            .task { await load() }
        }
        .presentationDetents([.medium, .large])
        .nativeSheetLook(preferences)
    }

    /// The free time in words: "18:00 til 22:00", "Hele dagen", "Hele weekenden".
    private func when(_ prime: PrimeDate) -> String {
        let time = { (ms: Int64) in formatTime(isoString(ms)) }
        switch stretchShape(prime, appTimeZone) {
        case "weekend": return CasyStrings.primeWeekend
        case "allDay": return CasyStrings.primeAllDay
        case "from": return CasyStrings.primeFrom(time(prime.start))
        default: return CasyStrings.primeUntil(time(prime.start), time(prime.end))
        }
    }

    private func load() async {
        guard let prime else { return }
        do {
            guard let api = await Native.api() else { throw APIError.failed(status: 401, message: CasyStrings.groupsLoadFailed) }
            group = try await api.groups(errorMessage: CasyStrings.groupsLoadFailed).first { $0.id == prime.groupId }
            if group == nil { failure = CasyStrings.groupsLoadFailed }
        } catch {
            failure = error.localizedDescription
        }
    }
}
