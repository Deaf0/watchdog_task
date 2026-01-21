import { connect, JSONCodec, consumerOpts } from "nats"

const HEARTBEAT_TIMEOUT_MS = 70_000
const HEALTHCHECK_INTERVAL_MS = 30_000

export class ServerStateService{
    constructor(knownServers) {
        this.knownServers= knownServers
        this.state = new Map()
        this.nc = null 
        this.js = null
        this.sub = null
        this.codec = JSONCodec()
        this.intervalId = null
        this.pullInterval = null
    }

    async init() {
        this.initState()
        await this.connectNats()
        this.startConsumerLoop()
        this.startHealthCheck()
    }

    async destroy() {
        await this.stopConsumerLoop()
        this.stopHealthCheck()
        
        if (this.nc) {
            await this.nc.drain()
            this.nc = null
        }

        this.state.clear()
    }
    
    initState() {
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

    async connectNats() {
        this.nc = await connect({ 
            servers: "nats://localhost:4222" 
        })
        this.js = this.nc.jetstream()

        const opts = consumerOpts()
        opts.durable("watchdog")
        opts.ackExplicit()
        opts.deliverNew()
        opts.filterSubject("heartbeat.>")

        this.sub = await this.js.pullSubscribe(
            "heartbeat.>",
            opts
        )
    }

    startConsumerLoop() {
        (async () => {
            for await (const msg of this.sub) {
                try {
                    const hb = this.codec.decode(msg.data)
                    this.processHeartbeat(hb)
                    msg.ack()
                } catch (e) {
                    console.error("heartbeat error", e)
                }
            }
        })()

        this.pullInterval = setInterval(() => {
            this.sub.pull({ batch: 10, expires: 1000 })
        }, 1000)
    }

    async stopConsumerLoop() {
        if (this.pullInterval) {
            clearInterval(this.pullInterval)
            this.pullInterval = null
        }

        if (this.sub) {
            await this.sub.destroy()
            this.sub = null
        }
    }

    startHealthCheck() {
        if (this.intervalId) return

        this.intervalId = setInterval(() => {
            const now = Date.now()

            for (const state of this.state.values()) {
                if (
                    state.isAlive &&
                    this.isTimedOut(state, now)
                ) {
                    state.isAlive = false
                    state.consecutiveOk = 0
                }
            }
        }, HEALTHCHECK_INTERVAL_MS)
    }

    stopHealthCheck() {
        if (this.intervalId) {
            clearInterval(this.intervalId)
            this.intervalId = null
        }
    }

    processHeartbeat(hb) {
        const state = this.state.get(hb.name)
        if (!state) return

        const traffic = Number(hb.traffic_amount_bytes_1m)
        const cap = Number(hb.iface_bytes_cap)

        if (!Number.isFinite(traffic) || !Number.isFinite(cap)) return

        const sentAt = new Date(hb.utc_sent)

        if (state.lastUtcSent && sentAt <= state.lastUtcSent) return

        const now = Date.now()

        if (
            this.isTimedOut(state, now)
        ) {
            state.consecutiveOk = 0
            state.isAlive = false
        }

        state.metrics = {
            connectionAmount: hb.connection_amount,
            trafficAmountBytes1m: traffic,
            ifaceBytesCap: cap,
            cpuLoad1m: hb.cpu_load_1m
        }

        state.lastUtcSent = sentAt
        state.lastReceivedAt = now
        state.consecutiveOk += 1

        if (state.consecutiveOk >= 2 && !state.isAlive) {
            state.penalty = 1.5
            state.isAlive = true
        }

        if (state.isAlive) {
            state.penalty = Math.max(1.0, state.penalty * 0.9)
        }
    } 

    getAliveByZone(zone) {
        return [...this.state.values()].filter(
            s => s.zone === zone && s.isAlive
        )
    }

    isTimedOut(state, now) {
        return (
            state.lastReceivedAt && now - state.lastReceivedAt > HEARTBEAT_TIMEOUT_MS
        )
    }
}

