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

    @Environment(\.fitSheet) private var fitSheet
    @State private var group: CasyAPI.Group?
    @State private var failure: String?

    private var lang: Lang { CasyStrings.language == "en" ? .en : .da }

    @State private var bar: CGFloat = 0
    @State private var content: CGFloat = 0

    /// The web's PrimeDateSheet (#281): one CardList with the group (its
    /// bubbles), the day (calendar-heart, the time as its value) and that
    /// everyone is free (users, their names under it), the promise as its
    /// footnote, Planlæg under it; the sheet as tall as that, in iOS's glass.
    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(spacing: 0) {
                    if let prime, let group {
                        CardList(footnote: CasyStrings.primeFootnote, spaced: false) {
                            CardRow(group.name) {
                                GroupBubbles(members: group.members, picture: group.pictureUrl.flatMap(URL.init(string:)))
                            }
                            CardRow(
                                formatLongDate(isoString(prime.day), lang), icon: "calendar-heart", value: when(prime))
                            CardRow(
                                CasyStrings.primeAllFree(group.members.count), icon: "users",
                                detail: everyone(
                                    group.members.filter { !$0.isYou }.map(\.name)
                                        + (group.members.contains(where: \.isYou) ? [CasyStrings.primeYou] : []),
                                    lang))
                        }
                    } else if let failure {
                        Notice(failure, tone: .error, bare: true)
                    } else {
                        ProgressView().frame(height: 160)
                    }
                    FlowButton(action: { leave(.plan) }) { Text(CasyStrings.primePlan) }
                        .disabled(group == nil)
                        .accessibilityIdentifier("prime.plan")
                        .padding(.top, 16)
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 16)
                .onGeometryChange(for: CGFloat.self) { $0.size.height } action: { content = $0 }
            }
            .scrollBounceBehavior(.basedOnSize)
            .onGeometryChange(for: CGFloat.self) { $0.safeAreaInsets.top } action: { bar = $0 }
            .onChange(of: bar + content, initial: true) { _, height in
                if bar > 0, content > 0 { fitSheet(height) }
            }
            .accessibilityIdentifier("prime.screen")
            .casySheetBar(CasyStrings.primeTitle, close: CasyStrings.done, action: onDone)
            .task { await load() }
        }
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

/// A group as its members (the web's GroupBubbles, `md`): their 32 point
/// pictures overlapping by 8, each ringed in the card's colour, the first
/// three full and two more fading away, paler and smaller; its own picture
/// instead when it has one, the users icon on orange-50 when it has nobody.
struct GroupBubbles: View {
    let members: [GroupMember]
    let picture: URL?

    private static let solid = 3
    private static let faded: [(opacity: Double, scale: Double)] = [(0.5, 0.88), (0.22, 0.76)]

    var body: some View {
        Group {
            if let picture {
                Avatar(name: "", index: 0, size: .medium, url: picture)
            } else if members.isEmpty {
                LucideIcon("users", size: 16)
                    .foregroundStyle(Theme.primary.color)
                    .frame(width: 32, height: 32)
                    .background(Theme.orange50.color, in: Circle())
            } else {
                let shown = Array(members.prefix(members.count > Self.solid ? Self.solid + Self.faded.count : Self.solid))
                HStack(spacing: -8) {
                    ForEach(Array(shown.enumerated()), id: \.element.id) { i, member in
                        let fade = i >= Self.solid ? Self.faded[i - Self.solid] : (opacity: 1, scale: 1)
                        Avatar(
                            name: member.name, index: i, size: .medium,
                            url: member.avatarUrl.flatMap(URL.init(string:))
                        )
                        .padding(2)
                        .background(Theme.card.color, in: Circle())
                        .padding(-2)
                        .opacity(fade.opacity)
                        .scaleEffect(fade.scale)
                        .zIndex(Double(-i))
                    }
                }
            }
        }
        .accessibilityHidden(true)
    }
}
