import Capacitor
import ContactsUI
import MessageUI
import UIKit

/// Inviting friends from the phone (#149): iOS's contact picker, then a message
/// ready to send with the group's invite link.
///
/// The picker runs in its own process and hands back only the people picked,
/// so it needs no permission and Casy never sees the rest of the contacts.
/// What it returns (names, numbers, emails) stays on the phone: the page only
/// passes it on to the message composer, never to Casy's server.
public class InvitePlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "InvitePlugin"
    public let jsName = "Invite"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickContacts", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "canText", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "text", returnType: CAPPluginReturnPromise),
    ]

    /// The call waiting for the picker or the composer to close. One at a time:
    /// a second sheet can't open over the first anyway.
    private var pickCall: CAPPluginCall?
    private var textCall: CAPPluginCall?

    /// The people picked, each with every number and email they have
    /// (the page chooses which to use). None when the picker is closed.
    @objc func pickContacts(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard let presenter = self.bridge?.viewController else {
                call.reject("No screen to show the contacts on")
                return
            }
            self.pickCall = call
            let picker = CNContactPickerViewController()
            picker.delegate = self
            // Only people who can be sent a message can be picked.
            picker.predicateForEnablingContact = NSPredicate(
                format: "phoneNumbers.@count > 0 OR emailAddresses.@count > 0")
            presenter.present(picker, animated: true)
        }
    }

    /// Whether this phone can send a message (not on the simulator, or a phone
    /// without Messages set up); the page shares the link instead.
    @objc func canText(_ call: CAPPluginCall) {
        call.resolve(["able": MFMessageComposeViewController.canSendText()])
    }

    /// Messages, opened with the recipients and the text filled in; the person
    /// still presses send. Answers "sent", "cancelled" or "failed".
    @objc func text(_ call: CAPPluginCall) {
        let recipients = call.getArray("recipients", String.self) ?? []
        let body = call.getString("body") ?? ""
        DispatchQueue.main.async {
            guard MFMessageComposeViewController.canSendText(),
                let presenter = self.bridge?.viewController
            else {
                call.reject("This phone can't send messages")
                return
            }
            self.textCall = call
            let composer = MFMessageComposeViewController()
            composer.messageComposeDelegate = self
            composer.recipients = recipients
            composer.body = body
            presenter.present(composer, animated: true)
        }
    }
}

extension InvitePlugin: CNContactPickerDelegate {
    public func contactPicker(_ picker: CNContactPickerViewController, didSelect contacts: [CNContact]) {
        let people: [[String: Any]] = contacts.map { contact in
            [
                "name": CNContactFormatter.string(from: contact, style: .fullName) ?? "",
                "phones": contact.phoneNumbers.map { $0.value.stringValue },
                "emails": contact.emailAddresses.map { $0.value as String },
            ]
        }
        pickCall?.resolve(["contacts": people])
        pickCall = nil
    }

    public func contactPickerDidCancel(_ picker: CNContactPickerViewController) {
        pickCall?.resolve(["contacts": []])
        pickCall = nil
    }
}

extension InvitePlugin: MFMessageComposeViewControllerDelegate {
    public func messageComposeViewController(
        _ controller: MFMessageComposeViewController,
        didFinishWith result: MessageComposeResult
    ) {
        controller.dismiss(animated: true)
        let outcome: String
        switch result {
        case .sent: outcome = "sent"
        case .cancelled: outcome = "cancelled"
        default: outcome = "failed"
        }
        textCall?.resolve(["result": outcome])
        textCall = nil
    }
}
