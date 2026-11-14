import CasyCore
import ContactsUI
import MessageUI
import UIKit

/// Inviting from the phone's contacts (#149), natively: iOS's contact picker,
/// then Messages with the invite filled in, or the share sheet on a phone that
/// can't text. The picker runs in its own process and hands back only the
/// people picked, so it needs no permission; what it returns stays on the
/// phone and is never sent to our server. The same steps as InvitePlugin,
/// which the web's screens use until they are all native.
@MainActor
final class ContactInviter: NSObject {
    static let shared = ContactInviter()

    enum Outcome { case sent, shared, cancelled, failed }

    private var picking: CheckedContinuation<[CNContact], Never>?
    private var texting: CheckedContinuation<MessageComposeResult, Never>?

    /// Pick, then text or share `message` and `url`; nil when nobody was picked.
    func invite(message: String, url: String, shareTitle: String) async -> Outcome? {
        let people = await pick()
        let to = recipientsOf(people)
        if to.isEmpty { return nil }
        if MFMessageComposeViewController.canSendText() {
            switch await text(to, body: "\(message) \(url)") {
            case .sent: return .sent
            case .cancelled: return .cancelled
            default: return .failed
            }
        }
        share(text: message, url: url, title: shareTitle)
        return .shared
    }

    /// The share sheet, for Del link's fallback.
    func share(text: String, url: String, title: String) {
        guard let top = Self.top(), let link = URL(string: url) else { return }
        let sheet = UIActivityViewController(activityItems: [text, link], applicationActivities: nil)
        sheet.setValue(title, forKey: "subject")
        top.present(sheet, animated: true)
    }

    private func pick() async -> [CNContact] {
        guard let top = Self.top() else { return [] }
        return await withCheckedContinuation { continuation in
            picking = continuation
            let picker = CNContactPickerViewController()
            picker.delegate = self
            // Only people who can be sent a message can be picked.
            picker.predicateForEnablingContact = NSPredicate(
                format: "phoneNumbers.@count > 0 OR emailAddresses.@count > 0")
            top.present(picker, animated: true)
        }
    }

    private func text(_ recipients: [String], body: String) async -> MessageComposeResult {
        guard let top = Self.top() else { return .failed }
        return await withCheckedContinuation { continuation in
            texting = continuation
            let composer = MFMessageComposeViewController()
            composer.messageComposeDelegate = self
            composer.recipients = recipients
            composer.body = body
            top.present(composer, animated: true)
        }
    }

    private func recipientsOf(_ people: [CNContact]) -> [String] {
        recipients(
            people.map { person in
                (
                    phones: person.phoneNumbers.map { $0.value.stringValue },
                    emails: person.emailAddresses.map { $0.value as String }
                )
            })
    }

    /// Whatever is on screen at the top: the native sheet over the page.
    private static func top() -> UIViewController? {
        let scene = UIApplication.shared.connectedScenes
            .compactMap { $0 as? UIWindowScene }
            .first { $0.activationState == .foregroundActive }
        var top = scene?.keyWindow?.rootViewController
        while let next = top?.presentedViewController { top = next }
        return top
    }
}

extension ContactInviter: CNContactPickerDelegate {
    nonisolated func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
        MainActor.assumeIsolated {
            picking?.resume(returning: contacts)
            picking = nil
        }
    }

    nonisolated func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        MainActor.assumeIsolated {
            picking?.resume(returning: [])
            picking = nil
        }
    }
}

extension ContactInviter: MFMessageComposeViewControllerDelegate {
    nonisolated func messageComposeViewController(
        _ controller: MFMessageComposeViewController, didFinishWith result: MessageComposeResult
    ) {
        MainActor.assumeIsolated {
            controller.dismiss(animated: true)
            texting?.resume(returning: result)
            texting = nil
        }
    }
}
