import Foundation

/// The help pages' words (#198), the web pages' own, both languages, in
/// HelpPages.json, which e2e/helpPages.parity.ts writes and checks: Hjælp og
/// kontakt, Sådan virker det, Vilkår and Privatliv can't drift from the site's.
public struct HelpPages: Decodable, Sendable {
    /// A titled page of sections, as the web's LegalPage lays out.
    public struct Legal: Decodable, Sendable {
        public struct Section: Decodable, Sendable, Identifiable {
            /// Linkable as /privacy#id.
            public let id: String?
            public let title: String
            public let blocks: [Block]

            enum CodingKeys: String, CodingKey { case id, title, blocks }

            public init(from decoder: Decoder) throws {
                let c = try decoder.container(keyedBy: CodingKeys.self)
                title = try c.decode(String.self, forKey: .title)
                blocks = try c.decode([Block].self, forKey: .blocks)
                id = try c.decodeIfPresent(String.self, forKey: .id) ?? title
            }
        }

        public let title: String
        public let updated: String
        public let sections: [Section]
    }

    /// A paragraph, or a list's items, each Markdown: **a term**, [words](/address).
    public enum Block: Decodable, Sendable {
        case text(String)
        case list([String])

        enum CodingKeys: String, CodingKey { case text, list }

        public init(from decoder: Decoder) throws {
            let c = try decoder.container(keyedBy: CodingKeys.self)
            if let text = try c.decodeIfPresent(String.self, forKey: .text) {
                self = .text(text)
            } else {
                self = .list(try c.decode([String].self, forKey: .list))
            }
        }
    }

    /// Sådan virker det: six steps from signing in to a date in the calendar.
    public struct HowItWorks: Decodable, Sendable {
        public struct Step: Decodable, Sendable {
            public let title: String
            public let body: String
        }

        public let eyebrow: String
        public let title: String
        public let intro: String
        public let steps: [Step]
        public let neverSeesTitle: String
        public let neverSeesBody: String
        public let privacyLink: String
        public let plan: String
    }

    public struct Both<Page: Decodable & Sendable>: Decodable, Sendable {
        let da: Page
        let en: Page

        /// The page in the app's language.
        public var current: Page { CasyStrings.language == "en" ? en : da }
    }

    public let support: Both<Legal>
    public let howItWorks: Both<HowItWorks>
    public let terms: Both<Legal>
    public let privacy: Both<Legal>

    /// Read once, from the package's own copy.
    public static let shared: HelpPages = {
        guard let url = Bundle.module.url(forResource: "HelpPages", withExtension: "json"),
            let data = try? Data(contentsOf: url),
            let pages = try? JSONDecoder().decode(HelpPages.self, from: data)
        else { fatalError("HelpPages.json is missing or unreadable: run e2e/helpPages.parity.ts") }
        return pages
    }()

    /// Markdown as text, its links kept for the app's own pages and Mail; a
    /// link to a site outside goes, since the app never opens Safari.
    public static func text(_ markdown: String) -> AttributedString {
        let inApp = markdown.replacingOccurrences(
            of: #"\[([^\]]*)\]\(https?://[^)]*\)"#, with: "$1", options: .regularExpression)
        var text =
            (try? AttributedString(
                markdown: inApp,
                options: .init(interpretedSyntax: .inlineOnlyPreservingWhitespace)))
            ?? AttributedString(inApp)
        for run in text.runs where run.link != nil {
            text[run.range].underlineStyle = .single
        }
        return text
    }
}
