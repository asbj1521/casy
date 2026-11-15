import CasyAPI
import CasyCore
import CasyUI
import SwiftUI

/// Tilføj til min kalender (#199), the bottom of an agreed event's screen, as
/// the web's AddToCalendar `flow`: with a primary calendar, straight into it;
/// without one but with a calendar Casy may write to, it asks which (that
/// becomes the primary); with none, a calendar file to open. Once in, it says
/// where; if the last sync found it deleted by hand, it offers it again.
struct AddToCalendar: View {
    let event: SuggestedEvent

    private let model = EventsModel.shared
    @State private var primary: PrimaryCalendar?
    @State private var connections: [CalendarConnection] = []
    @State private var adding = false
    @State private var downloading = false
    @State private var choosing = false
    @State private var file: EventFileToShare?
    @State private var failure: String?

    /// The calendars that can take it, by account (`primaryOptions`).
    private var options: [(account: String, calendars: [CalendarSource])] {
        connections.filter { $0.status == "connected" }
            .map { c in
                (c.account_label ?? c.provider, c.calendar_sources.filter { $0.writable || $0.id == primary?.calendarId })
            }
            .filter { !$0.calendars.isEmpty }
    }

    /// The primary calendar's name (`primaryName`).
    private var primaryLabel: String? {
        guard let id = primary?.calendarId else { return nil }
        return connections.lazy.flatMap(\.calendar_sources).first { $0.id == id }?.name
    }

    var body: some View {
        VStack(spacing: 6) {
            content
            if let failure { Notice(failure, tone: .error, bare: true) }
        }
        .padding(.horizontal, 16)
        .padding(.bottom, 8)
        .task { await loadCalendars() }
        .sheet(isPresented: $choosing) {
            ChooseCalendarSheet(options: options) { calendarId in
                choosing = false
                add(choosing: calendarId)
            } download: {
                choosing = false
                download()
            }
            .nativeSheetLook(NativePreferences.shared)
        }
        .sheet(item: $file) { shared in
            ShareFile(url: shared.url)
        }
    }

    @ViewBuilder private var content: some View {
        let state = event.myCalendar?.state
        if state == "added" {
            FlowButton(kind: .quiet, action: {}) {
                Label(
                    primaryLabel.map(CasyStrings.addToCalendarAdded) ?? CasyStrings.addToCalendarAddedFallback,
                    systemImage: "checkmark")
            }
            .disabled(true)
        } else if state == "adding" && !adding {
            let onPhone = event.myCalendar?.onPhone == true
            FlowButton(kind: .quiet, action: { add() }) {
                Text(CasyStrings.addToCalendarTryAgain)
            }
            footnote(
                event.myCalendar?.error != nil
                    ? (onPhone ? CasyStrings.addToCalendarNotYetPhone : CasyStrings.addToCalendarNotYet)
                    : CasyStrings.addToCalendarAdding)
        } else {
            if state == "gone" { footnote(CasyStrings.addToCalendarGone) }
            FlowButton(busy: adding || downloading, action: press) {
                Label(
                    state == "gone" ? CasyStrings.addToCalendarAddAgain : CasyStrings.addToCalendar,
                    systemImage: "calendar.badge.plus")
            }
            footnote(destination)
        }
    }

    private var writesDirectly: Bool { primary != nil }
    private var canChoose: Bool { primary == nil && !options.isEmpty }

    private var destination: String {
        if writesDirectly {
            return primaryLabel.map(CasyStrings.addToCalendarGoesInto) ?? CasyStrings.addToCalendarGoesIntoFallback
        }
        return canChoose ? CasyStrings.addToCalendarWillAsk : CasyStrings.addToCalendarAsFile
    }

    private func footnote(_ text: String) -> some View {
        Text(text)
            .font(.caption)
            .foregroundStyle(Theme.mutedForeground.color)
            .multilineTextAlignment(.center)
            .frame(maxWidth: .infinity)
    }

    private func press() {
        failure = nil
        if writesDirectly {
            add()
        } else if canChoose {
            choosing = true
        } else {
            download()
        }
    }

    private func loadCalendars() async {
        guard let api = await Native.api() else { return }
        async let primary = try? api.primaryCalendar(errorMessage: CasyStrings.addToCalendarLoadPrimaryFailed)
        async let connections = try? api.calendarConnections(errorMessage: CasyStrings.addToCalendarLoadStatusFailed)
        self.primary = await primary ?? nil
        self.connections = await connections ?? []
    }

    private func add(choosing calendarId: String? = nil) {
        adding = true
        failure = nil
        Task {
            defer { adding = false }
            do {
                try await model.addToCalendar(event.id, choosing: calendarId)
                if calendarId != nil { await loadCalendars() }
            } catch {
                failure = error.localizedDescription
            }
        }
    }

    /// The event as a calendar file, handed to the share sheet (Calendar opens it).
    private func download() {
        downloading = true
        failure = nil
        Task {
            defer { downloading = false }
            do {
                guard let api = await Native.api() else { return }
                let answer = try await api.eventFile(event.id, errorMessage: CasyStrings.addToCalendarDownloadFailed)
                let url = FileManager.default.temporaryDirectory.appending(path: answer.filename)
                try Data(answer.ics.utf8).write(to: url, options: .atomic)
                file = EventFileToShare(url: url)
            } catch {
                failure = error.localizedDescription
            }
        }
    }
}

/// Which calendar agreed events go into: the choice becomes the primary calendar.
private struct ChooseCalendarSheet: View {
    let options: [(account: String, calendars: [CalendarSource])]
    let choose: (String) -> Void
    let download: () -> Void

    @Environment(\.dismiss) private var dismiss
    @State private var chosen: String?

    var body: some View {
        NavigationStack {
            List {
                Section {
                } footer: {
                    Text(CasyStrings.addToCalendarChooseHelp)
                }
                ForEach(options, id: \.account) { group in
                    Section(group.account) {
                        ForEach(group.calendars) { c in
                            ListPickRow(c.name, isSelected: chosen == c.id) { chosen = c.id }
                        }
                    }
                }
            }
            .casySheetBar(CasyStrings.addToCalendarChooseTitle, close: CasyStrings.cancel) { dismiss() }
            .safeAreaInset(edge: .bottom) {
                VStack(spacing: 8) {
                    FlowButton(action: { if let chosen { choose(chosen) } }) {
                        Text(CasyStrings.addToCalendarUseAndAdd)
                    }
                    .disabled(chosen == nil)
                    FlowButton(kind: .quiet, action: download) {
                        Text(CasyStrings.addToCalendarDownloadInstead)
                    }
                }
                .padding(.horizontal, 16)
                .padding(.bottom, 8)
            }
        }
        .onAppear {
            let all = options.flatMap(\.calendars)
            if all.count == 1 { chosen = all[0].id }
        }
    }
}

private struct EventFileToShare: Identifiable {
    let url: URL
    var id: URL { url }
}

private struct ShareFile: UIViewControllerRepresentable {
    let url: URL

    func makeUIViewController(context: Context) -> UIActivityViewController {
        UIActivityViewController(activityItems: [url], applicationActivities: nil)
    }

    func updateUIViewController(_ controller: UIActivityViewController, context: Context) {}
}
