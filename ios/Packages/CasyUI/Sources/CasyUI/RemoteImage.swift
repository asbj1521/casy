import Foundation
import ImageIO
import SwiftUI

/// Pictures fetched once and kept for the app's life (#199): a picture seen
/// before shows at once, in the first frame, rather than its letter flashing
/// while AsyncImage fetches it again each time a row appears.
@MainActor
enum PictureMemory {
    private static var kept: [URL: CGImage] = [:]
    private static var order: [URL] = []
    private static var loading: [URL: Task<CGImage?, Never>] = [:]
    /// Enough for every face and group picture on the screens at once.
    private static let most = 200

    static func image(for url: URL) -> CGImage? { kept[url] }

    /// The picture, fetched once however many rows ask for it at the same time.
    static func load(_ url: URL) async -> CGImage? {
        if let image = kept[url] { return image }
        if let running = loading[url] { return await running.value }
        let task = Task<CGImage?, Never> {
            guard let (data, response) = try? await URLSession.shared.data(from: url),
                (response as? HTTPURLResponse).map({ (200..<300).contains($0.statusCode) }) ?? true,
                let source = CGImageSourceCreateWithData(data as CFData, nil)
            else { return nil }
            return CGImageSourceCreateImageAtIndex(source, 0, nil)
        }
        loading[url] = task
        let image = await task.value
        loading[url] = nil
        if let image { keep(image, url) }
        return image
    }

    private static func keep(_ image: CGImage, _ url: URL) {
        kept[url] = image
        order.append(url)
        if order.count > most {
            kept[order.removeFirst()] = nil
        }
    }
}

/// A remote picture, or `placeholder` until it has loaded (or if it can't).
struct RemoteImage<Placeholder: View>: View {
    let url: URL
    let placeholder: Placeholder
    @State private var image: CGImage?

    init(url: URL, @ViewBuilder placeholder: () -> Placeholder) {
        self.url = url
        self.placeholder = placeholder()
        // Already fetched: drawn in the very first frame.
        _image = State(initialValue: PictureMemory.image(for: url))
    }

    var body: some View {
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
