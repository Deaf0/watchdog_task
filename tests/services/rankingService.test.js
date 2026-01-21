import { describe, it, expect, beforeEach } from "vitest"
import { RankingService } from "../../src/services/rankingService"

const baseServer = {
  name: "edge-base",
  zone: "eu",
  penalty: 1.0,
  metrics: {
    connectionAmount: 100,
    trafficAmountBytes1m: 500,
    ifaceBytesCap: 1000,
    cpuLoad1m: 0.5
  }
}

const highPenaltyServer = {
  ...baseServer,
  name: "edge-high-penalty",
  penalty: 2.0
}

const highBandwidthServer = {
  ...baseServer,
  name: "edge-high-bandwidth",
  metrics: {
    ...baseServer.metrics,
    ifaceBytesCap: 10_000
  }
}

const highCpuServer = {
  ...baseServer,
  name: "edge-high-cpu",
  metrics: {
    ...baseServer.metrics,
    cpuLoad1m: 0.95
  }
}

const highTrafficServer = {
  ...baseServer,
  name: "edge-high-traffic",
  metrics: {
    ...baseServer.metrics,
    trafficAmountBytes1m: 900
  }
}

const bestServer = {
  name: "edge-best",
  zone: "eu",
  penalty: 1.0,
  metrics: {
    connectionAmount: 10,
    trafficAmountBytes1m: 50,
    ifaceBytesCap: 1000,
    cpuLoad1m: 0.1
  }
}

const worstServer = {
  name: "edge-worst",
  zone: "eu",
  penalty: 2.5,
  metrics: {
    connectionAmount: 1000,
    trafficAmountBytes1m: 900,
    ifaceBytesCap: 1000,
    cpuLoad1m: 0.95
  }
}

  const diffNameServer = {
    ...baseServer,
    name: "another-name",
  }

  const badMetricsServer = {
    ...baseServer,
    name: "bad-metrics-server",
    metrics: null
  }

  const invalidIfaceBytesCapServer = {
    ...baseServer,
    name: "invalid-ifaceBytesCap-server",
    metrics: {
      ...baseServer.metrics,
      ifaceBytesCap: 0
    }
  }

  const badNumberServer = {
    ...baseServer,
    name: "bad-number-server",
    metrics: {
      ...baseServer.metrics,
      connectionAmount: "abc"
    }
  }
  
  const testInputs = [baseServer, highPenaltyServer, bestServer]
  const edgeCaseInputs = [baseServer, badMetricsServer, invalidIfaceBytesCapServer, badNumberServer]
  const sameScoreInputs = [baseServer, diffNameServer]  

describe("RankingService", () => {
    let service

    beforeEach(() => {
      service = new RankingService()
    })

    describe("score()", () => {
      it("Correct point scoring for a single server", () => {
        expect(service.score(baseServer)).toBeCloseTo(40.3, 5)
      })

      it("Penalty effect on the result", () => {
        expect(service.score(highPenaltyServer)).toBeGreaterThan(service.score(baseServer))
      })

      it("Traffic normalization works fine", () => {
        expect(service.score(baseServer)).toBeGreaterThan(service.score(highBandwidthServer))
      })

      it("Traffic has a greater effect than CPU", () => {
        expect(service.score(highTrafficServer)).toBeGreaterThan(service.score(highCpuServer))
      })
    })

    describe("rank()", () => {
      it("Rank return array", () => {
        const result = service.rank(testInputs)
        expect(result).toBeInstanceOf(Array)
      })

      it("Rank preserves array length", () => {
        const result = service.rank(testInputs)
        expect(testInputs.length).eq(result.length)
      })

      it("Rank adds numeric score to each server", () => {
        const result = service.rank(testInputs)

        result.forEach((item) => {
          expect(item).toHaveProperty('score')
          expect(item.score).toBeTypeOf('number')
        })
      })

      it("Servers with lower score go first", () => {
        const result = service.rank(testInputs)
        
        for (let i = 0; i < result.length - 1; i++) {
          const currentScore = result[i].score
          const nextScore = result[i + 1].score
          expect(currentScore).toBeLessThanOrEqual(nextScore)
        }
      })

      it("Preserves input order when scores are equal", () => {
        const result = service.rank(sameScoreInputs)
        const originalNames = sameScoreInputs.map(s => s.name) 
        const resultNames = result.map(s => s.name)
        expect(originalNames).toEqual(resultNames)
      })

      it("All servers with invalid metrics receive Infinity score", () => {
        const result = service.rank(edgeCaseInputs)
        result.forEach((item) => {
          if (["bad-metrics-server", "invalid-ifaceBytesCap-server", "bad-number-server"].includes(item.name)) {
            expect(item.score).toBe(Infinity)
          }
        })
      })

      it("Empty array don't break method", () => {
        const result = service.rank([])
        expect(result).toEqual([])
      }) 
    })
})