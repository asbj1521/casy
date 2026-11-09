import Foundation
import Testing

@testable import CasyUI

private struct Pair: Decodable {
    let light: [Int]
    let dark: [Int]
}

@Test func everyColourIsTheWebsPhoneColour() throws {
    let url = try #require(
        Bundle.module.url(forResource: "colors", withExtension: "json", subdirectory: "Fixtures"))
    let web = try JSONDecoder().decode([String: Pair].self, from: Data(contentsOf: url))
    #expect(Set(web.keys) == Set(Theme.all.keys))
    #expect(web.count > 20)
    for (name, pair) in web {
        let mine = try #require(Theme.all[name])
        #expect(mine.light == pair.light, "\(name) in light")
        #expect(mine.dark == pair.dark, "\(name) in dark")
    }
}

@Test func aFilledOrangeStaysReadableBehindWhiteText() {
    func contrastWithWhite(_ rgb: [Int]) -> Double {
        let channels = rgb.map { value -> Double in
            let c = Double(value) / 255
            return c <= 0.03928 ? c / 12.92 : pow((c + 0.055) / 1.055, 2.4)
        }
        let luminance = 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
        return 1.05 / (luminance + 0.05)
    }
    #expect(contrastWithWhite(Theme.cta.light) >= 4.5)
    #expect(contrastWithWhite(Theme.cta.dark) >= 3)
}

@Test func aLetterIsTheNamesFirstInCapitals() {
    #expect(avatarLetter("  emilie") == "E")
    #expect(avatarLetter("Øjvind") == "Ø")
    #expect(avatarLetter("") == "")
}

@Test func neighboursGetDifferentColours() {
    for index in 0..<20 {
        #expect(avatarColors(index).background != avatarColors(index + 1).background)
    }
    #expect(avatarColors(5).background == avatarColors(0).background)
    #expect(avatarColors(-1).background == avatarColors(4).background)
}

// The catalog, read as the file it is written in.

private struct Catalog: Decodable {
    struct Unit: Decodable {
        let state: String
        let value: String
    }
    struct Localization: Decodable {
        let stringUnit: Unit
    }
    struct Entry: Decodable {
        let localizations: [String: Localization]
    }
    let sourceLanguage: String
    let strings: [String: Entry]
}

private func catalog() throws -> Catalog {
    let file = URL(fileURLWithPath: #filePath)
        .deletingLastPathComponent().deletingLastPathComponent().deletingLastPathComponent()
        .appending(path: "Sources/CasyUI/Resources/Localizable.xcstrings")
    return try JSONDecoder().decode(Catalog.self, from: Data(contentsOf: file))
}

private func allText(_ c: Catalog) -> [(String, String)] {
    c.strings.flatMap { key, entry in
        entry.localizations.map { lang, l in ("\(key) (\(lang))", l.stringUnit.value) }
    }
}

@Test func everyStringIsInBothLanguages() throws {
    let c = try catalog()
    #expect(c.sourceLanguage == "da")
    #expect(!c.strings.isEmpty)
    for (key, entry) in c.strings {
        for lang in ["da", "en"] {
            let unit = try #require(entry.localizations[lang]?.stringUnit, "\(key) has no \(lang)")
            #expect(unit.state == "translated", "\(key) in \(lang)")
            #expect(!unit.value.isEmpty, "\(key) in \(lang)")
        }
    }
}

@Test func noStringHasADashOrAnEmoji() throws {
    for (name, text) in allText(try catalog()) {
        #expect(!containsForbidden(text), "\(name): \(text)")
    }
}

@Test func theCheckItselfCatchesThem() {
    #expect(containsForbidden("Mandag – fredag"))
    #expect(containsForbidden("Mandag — fredag"))
    #expect(containsForbidden("Hej 🎉"))
    #expect(!containsForbidden("Indlæser… 12-14, æøå"))
}

@Test func appleCalendarIsNeverCallediCloud() throws {
    for (name, text) in allText(try catalog()) {
        #expect(!text.localizedCaseInsensitiveContains("icloud"), "\(name): \(text)")
    }
}

private func containsForbidden(_ text: String) -> Bool {
    text.unicodeScalars.contains { scalar in
        let dashes: Set<UInt32> = [0x2012, 0x2013, 0x2014, 0x2015]
        if dashes.contains(scalar.value) { return true }
        return scalar.properties.isEmojiPresentation
    }
}

@Test func theStringsLoadFromTheBuiltCatalog() {
    for text in [
        CasyStrings.cancel, CasyStrings.done, CasyStrings.save, CasyStrings.areYouSure,
        CasyStrings.loading,
    ] {
        #expect(!text.hasPrefix("common."), "\(text) is its key, not its words")
    }
}

@Test func stringsFollowCasysLanguageNotThePhones() {
    defer { CasyStrings.language = "da" }
    CasyStrings.language = "en"
    #expect(CasyStrings.settingsLanguage == "Language")
    CasyStrings.language = "da"
    #expect(CasyStrings.settingsLanguage == "Sprog")
}
