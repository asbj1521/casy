import Foundation
import Testing

@testable import CasyUI

// HelpPages.json, which e2e/helpPages.parity.ts writes from the web's pages.

@Test func everyHelpPageReadsInBothLanguages() {
    let pages = HelpPages.shared
    for page in [pages.support, pages.terms, pages.privacy] {
        #expect(!page.da.sections.isEmpty && page.da.sections.count == page.en.sections.count)
    }
    #expect(pages.howItWorks.da.steps.count == 6 && pages.howItWorks.en.steps.count == 6)
    // /privacy#ai lands on the AI section.
    #expect(pages.privacy.da.sections.contains { $0.id == "ai" })
}

@Test func aTermIsBoldAndALinkStaysInTheApp() {
    let text = HelpPages.text("**Din konto:** se [vilkårene](/terms) og [Google](https://google.com).")
    #expect(String(text.characters) == "Din konto: se vilkårene og Google.")
    let links = text.runs.compactMap(\.link)
    #expect(links == [URL(string: "/terms")!], "a site outside is never a link")
}
