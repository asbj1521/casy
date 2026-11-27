import Foundation
import Testing

@testable import CasyAPI

// Realtime's words as realtime-js writes and reads them (the live pulse, #202).

private func object(_ data: Data) -> [String: Any] {
    (try? JSONSerialization.jsonObject(with: data) as? [String: Any]) ?? [:]
}

@Test func theSocketIsTheProjectsWithItsKey() {
    let url = RealtimeMessage.url(projectURL: URL(string: "https://abc.supabase.co")!, apiKey: "sb_publishable_x")
    #expect(url?.absoluteString == "wss://abc.supabase.co/realtime/v1/websocket?apikey=sb_publishable_x&vsn=1.0.0")
    let local = RealtimeMessage.url(projectURL: URL(string: "http://localhost:4318")!, apiKey: "k")
    #expect(local?.absoluteString == "ws://localhost:4318/realtime/v1/websocket?apikey=k&vsn=1.0.0")
}

@Test func aJoinIsPrivateAndCarriesTheLogin() {
    let join = object(RealtimeMessage.join(topic: "realtime:pulse:u1", token: "jwt", ref: "3"))
    #expect(join["topic"] as? String == "realtime:pulse:u1")
    #expect(join["event"] as? String == "phx_join")
    #expect(join["ref"] as? String == "3")
    #expect(join["join_ref"] as? String == "3")
    let payload = join["payload"] as? [String: Any]
    #expect(payload?["access_token"] as? String == "jwt")
    let config = payload?["config"] as? [String: Any]
    #expect(config?["private"] as? Bool == true)
}

@Test func theHeartbeatAndAFreshLogin() {
    let beat = object(RealtimeMessage.heartbeat(ref: "4"))
    #expect(beat["topic"] as? String == "phoenix")
    #expect(beat["event"] as? String == "heartbeat")
    let fresh = object(RealtimeMessage.accessToken(topic: "realtime:pulse:u1", token: "new", ref: "5"))
    #expect(fresh["event"] as? String == "access_token")
    #expect((fresh["payload"] as? [String: Any])?["access_token"] as? String == "new")
}

@Test func whatComesInIsRead() {
    let topic = "realtime:pulse:u1"
    func read(_ json: String) -> RealtimeMessage.Incoming { RealtimeMessage.read(Data(json.utf8), topic: topic) }
    #expect(
        read(#"{"topic":"realtime:pulse:u1","event":"phx_reply","payload":{"status":"ok","response":{}},"ref":"1","join_ref":"1"}"#)
            == .joined(ref: "1"))
    #expect(
        read(#"{"topic":"realtime:pulse:u1","event":"phx_reply","payload":{"status":"error","response":{"reason":"Unauthorized"}},"ref":"1","join_ref":"1"}"#)
            == .refused(ref: "1"))
    #expect(
        read(#"{"topic":"realtime:pulse:u1","event":"broadcast","payload":{"type":"broadcast","event":"pulse","payload":{}},"ref":null}"#)
            == .signal)
    #expect(read(#"{"topic":"realtime:pulse:u1","event":"phx_close","payload":{},"ref":"1"}"#) == .lost)
    #expect(
        read(#"{"topic":"realtime:pulse:u1","event":"system","payload":{"status":"error","message":"token expired"},"ref":null}"#)
            == .lost)
    // A heartbeat's reply is on "phoenix"; someone else's topic isn't ours.
    #expect(read(#"{"topic":"phoenix","event":"phx_reply","payload":{"status":"ok"},"ref":"2"}"#) == .other)
    #expect(read(#"{"topic":"realtime:pulse:u2","event":"broadcast","payload":{}}"#) == .other)
}
