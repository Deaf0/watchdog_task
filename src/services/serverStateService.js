const HEARTBEAT_TIMEOUT_MS = 70_000
const HEALTHCHECK_INTERVAL_MS = 30_000

export class ServerStateService{
    constructor(knownServers) {
        this.knownServers= knownServers
        this.state = new Map()
        this.intervalId = null
    }

    init() {
        for (const [name, data] of Object.entries(this.knownServers)) {
            this.state.set(name, {
                name,
                zone: data.zone,

                lastUtcSent: null,
                lastReceivedAt: null,

                consecutiveOk: 0,
                isAlive: false,
                penalty: 1.0,

                metrics: null
            })
        }
    }

    processHeartbeat(hb) {
        const state = this.state.get(hb.name)
        if (!state) return

        const sentAt = new Date(hb.utc_sent)

        if (state.lastUtcSent && sentAt <= state.lastUtcSent) return

        const now = Date.now()

        if (
            state.lastReceivedAt && 
            now - state.lastReceivedAt > HEARTBEAT_TIMEOUT_MS
        ) {
            state.consecutiveOk = 0
            state.isAlive = false
        }

        state.lastUtcSent = sentAt
        state.lastReceivedAt = now
        state.consecutiveOk += 1

        if (state.consecutiveOk >= 2) {
            if (!state.isAlive) {
                state.penalty = 1.5
            }
            state.isAlive = true
        }

        if (state.isAlive) {
            state.penalty = Math.max(1.0, state.penalty * 0.9)
        }
    }

    startHealthCheck() {
        setInterval(() => {
            const now = Date.now()

            for (const state of this.state.values()) {
                if (
                    state.isAlive &&
                    state.lastReceivedAt &&
                    now - state.lastReceivedAt > HEALTHCHECK_INTERVAL_MS
                ) {
                    state.isAlive = false
                    state.consecutiveOk = 0
                }
            }
        }, HEALTHCHECK_INTERVAL_MS)
    }

    getAliveByZone(zone) {
        return [...this.state.values()].filter(
            s => s.zone === zone && s.isAlive
        )
    }
}