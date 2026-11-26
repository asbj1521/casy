// Trips (#115) as the trip sheet shows them (#200): trips.ts's legs, trips and
// questions, tripView.ts's marks and city names, and the days a question offers.
// Finding them is TripDetection.swift's (#202).

import Foundation

/// One flight, train or bus event with the cities it runs between.
public struct Leg: Codable, Sendable, Equatable, Identifiable {
    public var id: String
    /// "flight", "train" or "bus".
    public var mode: String
    /// City keys: where it leaves from and arrives.
    public var from: String
    public var to: String
    /// Epoch ms.
    public var start: Int64
    public var end: Int64
    public var count: Int
    /// The cities as written ("Copenhagen"), for showing.
    public var names: Names?

    public struct Names: Codable, Sendable, Equatable {
        public var from: String
        public var to: String

        public init(from: String, to: String) {
            self.from = from
            self.to = to
        }
    }

    public init(
        id: String, mode: String, from: String, to: String, start: Int64, end: Int64, count: Int, names: Names?
    ) {
        self.id = id
        self.mode = mode
        self.from = from
        self.to = to
        self.start = start
        self.end = end
        self.count = count
        self.names = names
    }
}

/// A trip: away from the first departure to the last arrival.
public struct Trip: Codable, Sendable, Equatable {
    public var id: String
    public var start: Int64
    public var end: Int64
    public var legs: [Leg]
    public var answered: Bool
    /// The person said yes to it: only then does it block.
    public var accepted: Bool
    public var city: String?
    /// It was written into the phone's own calendar.
    public var inCalendar: Bool?

    public init(
        id: String, start: Int64, end: Int64, legs: [Leg], answered: Bool, accepted: Bool, city: String?,
        inCalendar: Bool?
    ) {
        self.id = id
        self.start = start
        self.end = end
        self.legs = legs
        self.answered = answered
        self.accepted = accepted
        self.city = city
        self.inCalendar = inCalendar
    }
}

/// What is asked when in doubt: where home is, or when they are back or left.
public struct TripQuestion: Codable, Sendable, Equatable {
    /// "home", "return" or "outbound".
    public var kind: String
    public var id: String
    public var legs: [Leg]
    /// For "home": the cities to choose between.
    public var cities: [String]?
    /// For "return" and "outbound": the bounds of the day, epoch ms (nil: none).
    public var earliest: Int64?
    public var latest: Int64?

    public init(kind: String, id: String, legs: [Leg], cities: [String]?, earliest: Int64?, latest: Int64?) {
        self.kind = kind
        self.id = id
        self.legs = legs
        self.cities = cities
        self.earliest = earliest
        self.latest = latest
    }
}

/// A trip or a question as a mark on the month (`TripMark`).
public struct TripMark: Codable, Sendable, Equatable, Identifiable {
    /// "trip" or "question".
    public var kind: String
    public var id: String
    public var trip: Trip?
    public var question: TripQuestion?
    public var start: Int64
    public var end: Int64
    public var city: String
    /// A question's journeys themselves, which its guessing bar grows from.
    public var legsStart: Int64?
    public var legsEnd: Int64?

    /// The journeys it is about.
    public var legs: [Leg] { trip?.legs ?? question?.legs ?? [] }

    public init(
        kind: String, id: String, trip: Trip?, question: TripQuestion?, start: Int64, end: Int64, city: String,
        legsStart: Int64? = nil, legsEnd: Int64? = nil
    ) {
        self.legsStart = legsStart
        self.legsEnd = legsEnd
        self.kind = kind
        self.id = id
        self.trip = trip
        self.question = question
        self.start = start
        self.end = end
        self.city = city
    }
}

/// Cities whose Danish name isn't their English one, by key (`DANISH_NAMES`).
private let danishNames: [String: String] = [
    "copenhagen": "København", "elsinore": "Helsingør", "gothenburg": "Göteborg", "rome": "Rom",
    "munich": "München", "vienna": "Wien", "prague": "Prag", "lisbon": "Lissabon", "athens": "Athen",
    "brussels": "Bruxelles", "warsaw": "Warszawa", "cologne": "Köln", "nuremberg": "Nürnberg",
    "zurich": "Zürich", "geneva": "Genève", "venice": "Venedig", "florence": "Firenze", "milan": "Milano",
    "naples": "Napoli", "turin": "Torino", "seville": "Sevilla", "krakow": "Kraków", "moscow": "Moskva",
    "the hague": "Haag", "mexico city": "Mexico City",
]

/// "new york" as "New York": each letter after the start or a white space upper-cased.
private func titleCase(_ key: String) -> String {
    var out = ""
    var atStart = true
    for c in key {
        out += atStart && c.isLetter ? c.uppercased() : String(c)
        atStart = c.isWhitespace
    }
    return out
}

/// A city's name in the reader's language: as the legs wrote it, or its key title-cased.
public func cityName(_ key: String, legs: [Leg], _ lang: Lang) -> String {
    if lang == .da, let danish = danishNames[key] { return danish }
    var names: [String: String] = [:]
    for leg in legs {
        guard let written = leg.names else { continue }
        // A city filled in from home carries its key, not a name: a real one wins.
        if written.from != leg.from || names[leg.from] == nil { names[leg.from] = written.from }
        if written.to != leg.to || names[leg.to] == nil { names[leg.to] = written.to }
    }
    return names[key] ?? titleCase(key)
}

/// As long as a trip may be: the most days a question offers.
public let maxTripDays = 60

/// The days to offer for a question, each a local midnight: soonest first for a
/// way back, latest first for a way out.
public func dayOptions(_ question: TripQuestion, now: Int64) -> [Int64] {
    var days: [Int64] = []
    if question.kind == "return" {
        let first = max(startOfDay(question.earliest ?? now, appTimeZone), startOfDay(now, appTimeZone))
        for i in 0..<maxTripDays {
            let day = addDays(first, i, appTimeZone)
            if let latest = question.latest, day > startOfDay(latest, appTimeZone) { break }
            days.append(day)
        }
    } else {
        let last = startOfDay(question.latest ?? now, appTimeZone)
        for i in 0..<maxTripDays {
            let day = addDays(last, -i, appTimeZone)
            if let earliest = question.earliest, day < earliest { break }
            days.append(day)
        }
    }
    return days
}
