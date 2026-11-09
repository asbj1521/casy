import CasyCore
import CasyUI
import PhotosUI
import SwiftUI
import UIKit

/// A picture for Casy (#187) from a photo: upright, then the square chosen
/// (#190) made into a 512 px JPEG, as the web's lib/pictureFile. Drawing it
/// again drops everything a camera writes into a photo (where and when).
enum PictureFile {
    private static let size: CGFloat = 512
    private static let quality: CGFloat = 0.85
    /// The longest side a photo is kept at while cropping: a 48 MP photo would only use memory.
    private static let shownSide: CGFloat = 2048

    /// The photo upright, in pixels, no larger than needed. Nil if it can't be drawn.
    static func prepare(_ image: UIImage) -> UIImage? {
        let width = image.size.width
        let height = image.size.height
        guard width > 0, height > 0 else { return nil }
        let scale = min(1, shownSide / max(width, height))
        let target = CGSize(width: (width * scale).rounded(), height: (height * scale).rounded())
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        return UIGraphicsImageRenderer(size: target, format: format).image { _ in
            image.draw(in: CGRect(origin: .zero, size: target))
        }
    }

    /// The photo's `square` as base64 JPEG, ready for the pictures function.
    static func jpeg(_ image: UIImage, _ square: Square) -> String? {
        let format = UIGraphicsImageRendererFormat()
        format.scale = 1
        format.opaque = true
        let k = size / square.side
        let picture = UIGraphicsImageRenderer(
            size: CGSize(width: size, height: size), format: format
        ).image { _ in
            image.draw(
                in: CGRect(
                    x: -square.left * k, y: -square.top * k, width: image.size.width * k,
                    height: image.size.height * k))
        }
        return picture.jpegData(compressionQuality: quality)?.base64EncodedString()
    }
}

/// A photo waiting for its square.
struct PhotoToCrop: Identifiable {
    let id = UUID()
    let image: UIImage
}

/// Choosing which part of a photo becomes the picture, as the iPhone's own
/// "Flyt og skalér": the photo fills a round frame, one finger drags it, two
/// pinch it. It opens on the middle square, so Færdig at once is fine.
struct PictureCropSheet: View {
    let image: UIImage
    let onCancel: () -> Void
    let onDone: (Square) -> Void

    @State private var square: Square?
    @State private var lastDrag = CGSize.zero
    @State private var lastZoom: CGFloat = 1

    private var width: Double { image.size.width }
    private var height: Double { image.size.height }
    private var current: Square { square ?? centredSquare(width, height) }

    var body: some View {
        NavigationStack {
            GeometryReader { geometry in
                let frame = min(geometry.size.width, geometry.size.height)
                let k = frame / current.side
                Image(uiImage: image)
                    .resizable()
                    .frame(width: width * k, height: height * k)
                    .offset(x: -current.left * k, y: -current.top * k)
                    .frame(width: frame, height: frame, alignment: .topLeading)
                    .clipped()
                    .overlay {
                        Rectangle()
                            .fill(.black.opacity(0.55))
                            .mask {
                                Rectangle()
                                    .overlay { Circle().blendMode(.destinationOut) }
                                    .compositingGroup()
                            }
                            .overlay { Circle().stroke(.white.opacity(0.8), lineWidth: 1) }
                            .allowsHitTesting(false)
                    }
                    .contentShape(Rectangle())
                    .gesture(drag(frame).simultaneously(with: zoom(frame)))
                    .accessibilityElement()
                    .accessibilityLabel(CasyStrings.picturesCropFrame)
                    .frame(maxWidth: .infinity, maxHeight: .infinity)
            }
            .padding()
            .background(Color.black)
            .navigationTitle(CasyStrings.picturesCropTitle)
            .navigationBarTitleDisplayMode(.inline)
            .toolbarBackground(.black, for: .navigationBar)
            .toolbarColorScheme(.dark, for: .navigationBar)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button(CasyStrings.cancel, action: onCancel)
                }
                ToolbarItem(placement: .confirmationAction) {
                    Button(CasyStrings.done) { onDone(current) }
                }
            }
        }
    }

    private func drag(_ frame: Double) -> some Gesture {
        DragGesture(minimumDistance: 0)
            .onChanged { value in
                let dx = value.translation.width - lastDrag.width
                let dy = value.translation.height - lastDrag.height
                lastDrag = value.translation
                square = moveSquare(
                    current, dx: dx, dy: dy, frame: frame, width: width, height: height)
            }
            .onEnded { _ in lastDrag = .zero }
    }

    private func zoom(_ frame: Double) -> some Gesture {
        MagnifyGesture()
            .onChanged { value in
                let factor = value.magnification / lastZoom
                lastZoom = value.magnification
                square = zoomSquare(
                    current, factor: factor, x: value.startAnchor.x * frame,
                    y: value.startAnchor.y * frame, frame: frame, width: width, height: height)
            }
            .onEnded { _ in lastZoom = 1 }
    }
}

/// The camera, for Tag billede.
struct CameraView: UIViewControllerRepresentable {
    let onPicked: (UIImage?) -> Void

    func makeCoordinator() -> Coordinator { Coordinator(onPicked: onPicked) }

    func makeUIViewController(context: Context) -> UIImagePickerController {
        let picker = UIImagePickerController()
        picker.sourceType = .camera
        picker.delegate = context.coordinator
        return picker
    }

    func updateUIViewController(_ controller: UIImagePickerController, context: Context) {}

    final class Coordinator: NSObject, UIImagePickerControllerDelegate,
        UINavigationControllerDelegate
    {
        let onPicked: (UIImage?) -> Void
        init(onPicked: @escaping (UIImage?) -> Void) { self.onPicked = onPicked }

        func imagePickerController(
            _ picker: UIImagePickerController,
            didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]
        ) {
            onPicked(info[.originalImage] as? UIImage)
        }

        func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
            onPicked(nil)
        }
    }
}

/// A picture that is also its own menu (#187): Fotobibliotek, Tag billede,
/// and Fjern billede when there is one; the square chosen is handed to
/// `onPicked` as base64 JPEG. Shared by Profil and, later, a group.
struct PictureMenu<Label: View>: View {
    let hasPicture: Bool
    let addLabel: String
    let changeLabel: String
    let onPicked: (String) -> Void
    let onRemove: () -> Void
    let onUnreadable: () -> Void
    @ViewBuilder let label: () -> Label

    @State private var choosing = false
    @State private var item: PhotosPickerItem?
    @State private var photographing = false
    @State private var cropping: PhotoToCrop?

    private var hasCamera: Bool { UIImagePickerController.isSourceTypeAvailable(.camera) }

    var body: some View {
        Menu {
            Button(CasyStrings.picturesLibrary, systemImage: "photo.on.rectangle") {
                #if DEBUG
                    if let sample = TestLaunch.samplePicture { return picked(sample) }
                #endif
                choosing = true
            }
            if hasCamera {
                Button(CasyStrings.picturesCamera, systemImage: "camera") { photographing = true }
            }
            if hasPicture {
                Button(CasyStrings.picturesRemove, systemImage: "trash", role: .destructive) {
                    onRemove()
                }
            }
        } label: {
            label()
        }
        .accessibilityLabel(hasPicture ? changeLabel : addLabel)
        .photosPicker(isPresented: $choosing, selection: $item, matching: .images)
        .onChange(of: item) { _, chosen in
            guard let chosen else { return }
            item = nil
            Task {
                let data = try? await chosen.loadTransferable(type: Data.self)
                picked(data.flatMap(UIImage.init(data:)))
            }
        }
        .fullScreenCover(isPresented: $photographing) {
            CameraView { image in
                photographing = false
                if let image { picked(image) }
            }
            .ignoresSafeArea()
        }
        .sheet(item: $cropping) { photo in
            PictureCropSheet(
                image: photo.image,
                onCancel: { cropping = nil },
                onDone: { square in
                    cropping = nil
                    if let jpeg = PictureFile.jpeg(photo.image, square) {
                        onPicked(jpeg)
                    } else {
                        onUnreadable()
                    }
                })
        }
    }

    private func picked(_ image: UIImage?) {
        guard let image, let upright = PictureFile.prepare(image) else { return onUnreadable() }
        cropping = PhotoToCrop(image: upright)
    }
}
