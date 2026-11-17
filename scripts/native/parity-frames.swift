// Frame timing of a simulator recording: the recorder writes a frame only when
// the screen changes, so runs of frames are motion and the gaps inside a run
// are dropped frames (#281, docs/native-visual-parity.md, rule 6). parity.sh
// runs it on each film with PARITY_VIDEO=1. Usage: swift parity-frames.swift <video.mp4>
import AVFoundation

let url = URL(fileURLWithPath: CommandLine.arguments[1])
let asset = AVURLAsset(url: url)
let semaphore = DispatchSemaphore(value: 0)
var times: [Double] = []

Task {
    let track = try await asset.loadTracks(withMediaType: .video)[0]
    let reader = try AVAssetReader(asset: asset)
    let output = AVAssetReaderTrackOutput(track: track, outputSettings: nil)
    reader.add(output)
    reader.startReading()
    while let sample = output.copyNextSampleBuffer() {
        times.append(CMSampleBufferGetPresentationTimeStamp(sample).seconds)
    }
    semaphore.signal()
}
semaphore.wait()

// Motion runs: frames less than 100 ms apart.
var runs: [[Double]] = []
for t in times {
    if let last = runs.last?.last, t - last < 0.1 { runs[runs.count - 1].append(t) } else { runs.append([t]) }
}
for run in runs where run.count >= 5 {
    let gaps = zip(run.dropFirst(), run).map { $0 - $1 }
    let long = gaps.filter { $0 > 1.5 / 60 }.count
    print(String(format: "motion at %.2fs: %.0f ms, %d frames, longest gap %.0f ms, %d gaps over 25 ms",
                 run[0], (run.last! - run[0]) * 1000, run.count, (gaps.max() ?? 0) * 1000, long))
}
