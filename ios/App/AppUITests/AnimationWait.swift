import ObjectiveC
import XCTest

/// iOS 26's Liquid Glass sometimes restarts a sheet's glass "match" animations
/// as the keyboard closes, and they last forever (seen under the debugger on
/// 23 Nov 2026: CAMatchMoveAnimation and friends, duration inf, on the sheet's
/// UISDFElementView following its UIDropShadowView). Nothing moves and the app
/// is idle, but XCTest waits for every animation to end before each step, 60 s
/// a step, and these never do: the Genvej test stalled one run in several.
///
/// While `AnimationWait.ignored` is on, each step still waits for the app to be
/// idle, and then, after its action, a fixed `settle` for the keyboard or a screen
/// to finish moving, instead of for every animation to end (without it, a tap
/// right after typing landed while the keyboard was still going, and was lost).
/// Turn it on only where a sheet with a text field is typed into.
enum AnimationWait {
    nonisolated(unsafe) static var ignored = false
    /// Longer than the keyboard (about 0.3 s) or a push or pop (about 0.5 s).
    static let settle: TimeInterval = 0.7

    /// After an action (not before one), the time the app's own moves take.
    private static func settleAfter(_ pre: Bool) {
        if ignored && !pre { Thread.sleep(forTimeInterval: settle) }
    }

    static func ignore(_ on: Bool) {
        _ = installed
        ignored = on
    }

    private static let installed: Void = {
        guard let process = NSClassFromString("XCUIApplicationProcess") else {
            print("AnimationWait: no XCUIApplicationProcess, waits unchanged")
            return
        }
        swap(process, "waitForQuiescenceIncludingAnimationsIdle:isPreEvent:", arguments: 2)
        swap(process, "waitForQuiescenceIncludingAnimationsIdle:usingActivity:isPreEvent:", arguments: 3)
    }()

    /// The method's first argument (animations idle) passed on as false while ignored;
    /// whether it returns nothing or a yes/no is read from its type encoding.
    private static func swap(_ cls: AnyClass, _ name: String, arguments: Int) {
        let selector = NSSelectorFromString(name)
        guard let method = class_getInstanceMethod(cls, selector) else {
            print("AnimationWait: no \(name), unchanged")
            return
        }
        let encoding = String(cString: method_getTypeEncoding(method)!)
        // Every argument a yes/no, as read on Xcode 26/27; any other shape is left alone.
        let shape = encoding.replacingOccurrences(of: "[0-9]", with: "", options: .regularExpression)
        guard shape.dropFirst().hasPrefix("@:"), shape.dropFirst(3).allSatisfy({ $0 == "B" }),
            shape.count - 3 == arguments
        else {
            print("AnimationWait: \(name) is \(encoding), unchanged")
            return
        }
        let returnsBool = encoding.hasPrefix("B") || encoding.hasPrefix("c")
        let original = method_getImplementation(method)
        print("AnimationWait: \(name) \(encoding)")
        let replacement: Any
        switch (arguments, returnsBool) {
        case (2, false):
            typealias F = @convention(c) (AnyObject, Selector, Bool, Bool) -> Void
            let call = unsafeBitCast(original, to: F.self)
            replacement = { (me: AnyObject, animations: Bool, pre: Bool) in
                call(me, selector, animations && !ignored, pre)
                settleAfter(pre)
            } as @convention(block) (AnyObject, Bool, Bool) -> Void
        case (2, true):
            typealias F = @convention(c) (AnyObject, Selector, Bool, Bool) -> Bool
            let call = unsafeBitCast(original, to: F.self)
            replacement = { (me: AnyObject, animations: Bool, pre: Bool) -> Bool in
                defer { settleAfter(pre) }
                return call(me, selector, animations && !ignored, pre)
            } as @convention(block) (AnyObject, Bool, Bool) -> Bool
        case (_, false):
            // usingActivity: a yes/no too on this Xcode (v28@0:8B16B20B24).
            typealias F = @convention(c) (AnyObject, Selector, Bool, Bool, Bool) -> Void
            let call = unsafeBitCast(original, to: F.self)
            replacement = { (me: AnyObject, animations: Bool, activity: Bool, pre: Bool) in
                call(me, selector, animations && !ignored, activity, pre)
                settleAfter(pre)
            } as @convention(block) (AnyObject, Bool, Bool, Bool) -> Void
        default:
            typealias F = @convention(c) (AnyObject, Selector, Bool, Bool, Bool) -> Bool
            let call = unsafeBitCast(original, to: F.self)
            replacement = { (me: AnyObject, animations: Bool, activity: Bool, pre: Bool) -> Bool in
                defer { settleAfter(pre) }
                return call(me, selector, animations && !ignored, activity, pre)
            } as @convention(block) (AnyObject, Bool, Bool, Bool) -> Bool
        }
        method_setImplementation(method, imp_implementationWithBlock(replacement))
    }
}
