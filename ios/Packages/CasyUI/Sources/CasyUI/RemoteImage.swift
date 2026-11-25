import CryptoKit
import Foundation
import ImageIO
import SwiftUI

/// Pictures fetched once and kept (#199): a picture seen before shows at once, in
/// the first frame, rather than its letter or a dark square flashing while
/// AsyncImage fetches it again each time a row appears. Kept by the picture's
/// address without its query: a stored picture's link is signed afresh on every
/// read (a week's token), but a new picture is a new path. Kept on the phone too
/// (Caches), so they are there at once after the app is opened again.
@MainActor
public enum PictureMemory {
    private static var kept: [String: CGImage] = [:]
    private static var order: [String] = []
    private static var loading: [String: Task<CGImage?, Never>] = [:]
    /// Enough for every face and group picture on the screens at once.
    private static let most = 200

    /// The same picture whatever its link's signature.
    private static func key(_ url: URL) -> String {
        guard url.scheme == "http" || url.scheme == "https",
            var parts = URLComponents(url: url, resolvingAgainstBaseURL: false)
        else { return url.absoluteString }
        parts.query = nil
        return parts.string ?? url.absoluteString
    }

    private static let folder: URL? = {
        guard let caches = FileManager.default.urls(for: .cachesDirectory, in: .userDomainMask).first else { return nil }
        let folder = caches.appendingPathComponent("pictures", isDirectory: true)
        try? FileManager.default.createDirectory(at: folder, withIntermediateDirectories: true)
        return folder
    }()

    /// Where a fetched picture is kept on the phone (none for one written into its link).
    private static func file(_ key: String) -> URL? {
        guard key.hasPrefix("http"), let folder else { return nil }
        let name = SHA256.hash(data: Data(key.utf8)).map { String(format: "%02x", $0) }.joined()
        return folder.appendingPathComponent(name)
    }

    private nonisolated static func decode(_ data: Data) -> CGImage? {
        guard let source = CGImageSourceCreateWithData(data as CFData, nil) else { return nil }
        return CGImageSourceCreateImageAtIndex(source, 0, nil)
    }

    /// The picture if it has been fetched before, in this run or an earlier one.
    public static func image(for url: URL) -> CGImage? {
        let key = key(url)
        if let image = kept[key] { return image }
        guard let file = file(key), let data = try? Data(contentsOf: file), let image = decode(data) else { return nil }
        keep(image, key)
        return image
    }

    /// The picture, fetched once however many rows ask for it at the same time.
    public static func load(_ url: URL) async -> CGImage? {
        if let image = image(for: url) { return image }
        let key = key(url)
        if let running = loading[key] { return await running.value }
        let file = file(key)
        let task = Task<CGImage?, Never>.detached(priority: .userInitiated) {
            guard let (data, response) = try? await URLSession.shared.data(from: url),
                (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                let image = decode(data)
            else { return nil }
            if let file { try? data.write(to: file, options: .atomic) }
            return image
        }
        loading[key] = task
        let image = await task.value
        loading[key] = nil
        if let image { keep(image, key) }
        return image
    }

    /// Fetched ahead, before the screen showing them opens.
    public static func fetch(_ urls: [URL]) {
        for url in urls where image(for: url) == nil { Task { _ = await load(url) } }
    }

    private static func keep(_ image: CGImage, _ key: String) {
        if kept[key] == nil { order.append(key) }
        kept[key] = image
        if order.count > most {
            kept[order.removeFirst()] = nil
        }
    }
}

/// A remote picture, or `placeholder` until it has loaded (or if it can't).
public struct RemoteImage<Placeholder: View>: View {
    let url: URL
    let placeholder: Placeholder
    @State private var image: CGImage?

    public init(url: URL, @ViewBuilder placeholder: () -> Placeholder) {
        self.url = url
        self.placeholder = placeholder()
        // Already fetched: drawn in the very first frame.
        _image = State(initialValue: PictureMemory.image(for: url))
    }

    public var body: some View {
        Group {
            if let image {
                Image(decorative: image, scale: 1).resizable()
            } else {
                placeholder
            }
        }
        .task(id: url) {
            if let kept = PictureMemory.image(for: url) {
                image = kept
            } else {
                image = await PictureMemory.load(url)
            }
        }
    }
}
