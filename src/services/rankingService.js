export class RankingService {
    rank(servers) {
        return servers
            .map(s => {
                if (!this.isValidServer(s)) {
                    return { 
                        ...s, 
                        score: Infinity 
                    }
                }

                return {
                    ...s,
                    score: this.score(s)
                }
            })
            .sort((a, b) => a.score - b.score)
    }

    score(state) {
        const m = state.metrics

        return (
            state.penalty * 
            (
                m.connectionAmount * 0.4 + 
                (m.trafficAmountBytes1m / m.ifaceBytesCap) * 0.4 + 
                m.cpuLoad1m * 0.2
            )
        )

    }

    isValidServer(state) {
        const m = state.metrics

        if (!m) return false
        if (!Number.isFinite(state.penalty)) return false
        if (!Number.isFinite(m.connectionAmount)) return false
        if (!Number.isFinite(m.trafficAmountBytes1m)) return false
        if (!Number.isFinite(m.ifaceBytesCap)) return false
        if (m.ifaceBytesCap <= 0) return false
        if (!Number.isFinite(m.cpuLOad1m)) return false

        return true
    }
}