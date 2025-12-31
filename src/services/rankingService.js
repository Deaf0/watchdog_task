export class RankingService {
    rank(servers) {
        return servers
            .map(s => ({
                ...s,
                score: this.score(s)
            }))
            .sort((a, b) => a.score - b.score)
    }

    score(state) {
        const m = state.metrics

        return (
            state.penalty * 
            (
                m.connectionAmount * 0.4 + 
                (m.trafficAmountBytes1m / m.ifaceBytesCap) * 0.4 + 
                m.cpuLOad1m * 0.2
            )
        )

    }
}