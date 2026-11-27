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

    /// The Apple Calendar guide as a list (#202): what it takes, the steps at
    /// Apple in the iPhone's words, and what to do when Apple says no.
    public struct AppleGuide: Decodable, Sendable {
        public let eyebrow: String
        public let title: String
        public let intro: String
        public let needTitle: String
        public let need: [String]
        public let safe: String
        public let stepsTitle: String
        public let steps: [String]
        public let signIn: String
        public let failedTitle: String
        public let failed: String
        public let missingTitle: String
        public let missing: String
        public let next: String
        public let revoke: String
    }

    /// Find din kalenders link: five places a link can come from, each with a
    /// drawing of where it is, in that app's own words.
    public struct LinkGuide: Decodable, Sendable {
        public struct Source: Decodable, Sendable, Identifiable {
            public let id: String
            public let badge: String
            public let title: String
            public let body: String
        }

        public struct Mock: Decodable, Sendable {
            public let sidebar: [String]
            public let getInfo: String
            public let unsubscribe: String
            public let sharing: String
            public let publicCalendar: String
            public let integrate: String
            public let secretAddress: String
            public let publishTitle: String
            public let canView: String
            public let publish: String
            public let keywords: [String]
            /// Markdown, the addresses' ends as `code`.
            public let looksLike: String
        }

        public let eyebrow: String
        public let title: String
        public let intro: String
        public let warning: String
        public let sources: [Source]
        public let mock: Mock
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
    public let appleGuide: Both<AppleGuide>
    public let linkGuide: Both<LinkGuide>

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
    /// `size`: the words' size, for the web's links and highlighted words
    /// (`**word**`): medium, in the text's own colour, as `Term` and `Link`.
    public static func text(_ markdown: String, size: CGFloat? = nil) -> AttributedString {
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
        for run in text.runs where run.inlinePresentationIntent?.contains(.code) == true {
            text[run.range].font = .system(size: size ?? 12, design: .monospaced)
        }
        if let size {
            for run in text.runs
            where run.link != nil || run.inlinePresentationIntent?.contains(.stronglyEmphasized) == true {
                text[run.range].font = .system(size: size, weight: .medium)
                text[run.range].foregroundColor = Theme.foreground.color
                text[run.range].inlinePresentationIntent = nil
            }
        }
        return text
    }
}
