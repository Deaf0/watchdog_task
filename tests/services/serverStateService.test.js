import { describe, it, expect, beforeEach } from "vitest"
import { ServerStateService } from "../../src/services/serverStateService.js"

const knownServersMock = {
    edge1: { zone: "eu" },
    edge2: { zone: "us" }
}

function makeHeartbeat({
  name = "edge1",
  utc_sent = new Date().toISOString(),
  traffic = 1000,
  cap = 10_000
} = {}) {
  return {
    name,
    utc_sent,
    traffic_amount_bytes_1m: traffic,
    iface_bytes_cap: cap,
    connection_amount: 10,
    cpu_load_1m: 0.5
  }
}


describe("ServerStateService", () => {
    let service

    beforeEach(() => {
        service = new ServerStateService(knownServersMock)
        service.initState()
    })

    it("Initializes state for all known servers", () => {
        expect(service.state.size).toBe(2)

        const edge1 = service.state.get("edge1")
        expect(edge1.zone).toBe("eu")
        expect(edge1.isAlive).toBe(false)
    })

    it("does not mark server alive after first heartbeat", () => {
        service.processHeartbeat(
            makeHeartbeat({ name: "edge1" })
        )

        const state = service.state.get("edge1")
        expect(state.isAlive).toBe(false)
        expect(state.consecutiveOk).toBe(1)
    })


    it("marks server alive after two consecutive heartbeats", () => {
        const t1 = new Date()
        const t2 = new Date(t1.getTime() + 1000)

        service.processHeartbeat(
            makeHeartbeat({ name: "edge1", utc_sent: t1.toISOString() })
        )
        service.processHeartbeat(
            makeHeartbeat({ name: "edge1", utc_sent: t2.toISOString() })
        )

        const state = service.state.get("edge1")
        expect(state.isAlive).toBe(true)
        expect(state.penalty).toBeGreaterThan(1)
    })

    it("ignores heartbeat with older utc_sent", () => {
        const now = new Date()

        service.processHeartbeat(
            makeHeartbeat({
                name: "edge1",
                utc_sent: now.toISOString()
            })
        )

        service.processHeartbeat(
            makeHeartbeat({
                name: "edge1",
                utc_sent: new Date(now.getTime() - 10_000).toISOString()
            })
        )

        const state = service.state.get("edge1")
        expect(state.consecutiveOk).toBe(1)
    })

    it("returns alive servers only for given zone", () => {
        const t1 = new Date()
        const t2 = new Date(t1.getTime() + 1000)

        service.processHeartbeat(
            makeHeartbeat({ name: "edge1", utc_sent: t1.toISOString() })
        )
        service.processHeartbeat(
            makeHeartbeat({ name: "edge1", utc_sent: t2.toISOString() })
        )

        const aliveEu = service.getAliveByZone("eu")
        const aliveUs = service.getAliveByZone("us")

        expect(aliveEu.length).toBe(1)
        expect(aliveEu[0].name).toBe("edge1")
        expect(aliveUs.length).toBe(0)
    })
})