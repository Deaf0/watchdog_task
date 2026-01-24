import { connect, JSONCodec, consumerOpts } from "nats"

const HEARTBEAT_TIMEOUT_MS = 70_000
const HEALTHCHECK_INTERVAL_MS = 30_000
const STREAM_NAME = "heartbeat-stream"

export class ServerStateService{
    constructor(serverRepository) {
        this.serverRepository= serverRepository
        this.state = new Map()
        this.nc = null 
        this.js = null
        this.sub = null
        this.codec = JSONCodec()
        this.intervalId = null
        this.pullInterval = null
    }

    async init() {
        await this.initState()
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
    
    async initState() {
        const servers = await this.serverRepository.getAll()

        for (const server of servers) {
            this.state.set(server.name, {
                name: server.name,
                zone: server.zone,

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
            servers: process.env.NATS_URL 
        })

        const jsm = await this.nc.jetstreamManager()

        this.js = this.nc.jetstream()
        
        try {
            await jsm.streams.info(STREAM_NAME)
            console.log(`Stream "${STREAM_NAME}" already exists`)
        } catch (error) {
            if (error.code === '404' || error.message?.includes('not found')) {
                console.log(`Stream "${STREAM_NAME}" not found, creating...`)
                await this.createStream(jsm)
            } else {
                throw error
            }
        }

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

    async createStream(jsm) {
        try {
            const streamConfig = {
                name: STREAM_NAME,
                subjects: ["heartbeat.>"],
                retention: "limits",
                storage: "file",
                max_age: 120 * 1_000_000_000
            }

            await jsm.streams.add(streamConfig)
            console.log(`Stream "${STREAM_NAME}" created successfully`)
        } catch (error) {
            console.error(`Failed to create stream "${STREAM_NAME}":`, error)
            throw error
        }
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

