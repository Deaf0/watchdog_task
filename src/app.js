import Fastify from "fastify"
import routes from "./routes/best-route.js"
import { RankingService } from "./services/rankingService.js"
import { ServerStateService } from "./services/serverStateService.js"
import { knownServers } from "./config/knownServers.js"

const fastify = Fastify({
  logger: true
})

const serverStateService = new ServerStateService(knownServers)

fastify.addHook('onReady', async () => {
  await serverStateService.init()
})

fastify.addHook('onClose', async () => {
  await serverStateService.destroy()
})

const rankingService = new RankingService()

fastify.register(routes, {
  serverStateService,
  rankingService
})

export default fastify