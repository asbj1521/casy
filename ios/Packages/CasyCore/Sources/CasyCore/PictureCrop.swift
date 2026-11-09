// src/lib/pictureCrop.ts: the part of a photo kept as a picture (#190), as a
// square in the photo's own pixels. Kept equal by the parity fixtures, so the
// expressions follow the TypeScript's order exactly.

public struct Square: Codable, Sendable, Equatable {
    public var left: Double
    public var top: Double
    public var side: Double

    public init(left: Double, top: Double, side: Double) {
        self.left = left
        self.top = top
        self.side = side
    }
}

/// How far in the person can zoom, from the whole short side.
public let maxPictureZoom: Double = 4

/// The middle square of a photo, as large as it can be.
public func centredSquare(_ width: Double, _ height: Double) -> Square {
    let side = min(width, height)
    return Square(left: (width - side) / 2, top: (height - side) / 2, side: side)
}

/// The square kept inside the photo, and between the whole short side and maxPictureZoom.
private func clamp(_ square: Square, _ width: Double, _ height: Double) -> Square {
    let most = min(width, height)
    let side = min(most, max(most / maxPictureZoom, square.side))
    return Square(
        left: min(width - side, max(0, square.left)),
        top: min(height - side, max(0, square.top)),
        side: side)
}

/// The photo dragged by `dx`, `dy` screen points in a frame `frame` wide: the
/// square moves the other way, as the photo follows the finger.
public func moveSquare(
    _ square: Square, dx: Double, dy: Double, frame: Double, width: Double, height: Double
) -> Square {
    let perPixel = square.side / frame
    return clamp(
        Square(left: square.left - dx * perPixel, top: square.top - dy * perPixel, side: square.side),
        width, height)
}

/// Zoomed in by `factor` about the point `x`, `y` in the frame: the part of
/// the photo under that point stays under it, as far as the edges allow.
public func zoomSquare(
    _ square: Square, factor: Double, x: Double, y: Double, frame: Double, width: Double,
    height: Double
) -> Square {
    let most = min(width, height)
    let side = min(most, max(most / maxPictureZoom, square.side / factor))
    let px = square.left + (x / frame) * square.side
    let py = square.top + (y / frame) * square.side
    return clamp(
        Square(left: px - (x / frame) * side, top: py - (y / frame) * side, side: side),
        width, height)
}
