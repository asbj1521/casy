import Foundation

/// The fake backend this test runner's app talks to (scripts/native/fake-backend.ts).
/// One per simulator when the suite runs on several at once
/// (scripts/native/ui-tests-parallel.py hands each runner its own, `CASY_BACKEND`);
/// otherwise the one on port 4318. The parity shots keep 4318: their web build is made for it.
let testBackend = ProcessInfo.processInfo.environment["CASY_BACKEND"] ?? "http://localhost:4318"
