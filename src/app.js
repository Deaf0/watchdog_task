import Fastify from "fastify"
import routes from "./routes/best-route.js"
import { RankingService } from "./services/rankingService.js"
import { ServerStateService } from "./services/serverStateService.js"
import { MikroORM } from '@mikro-orm/postgresql'
import { ServerRepository } from "./repositories/serverRepository.js"

const fastify = Fastify({
  logger: true
})

const orm = await MikroORM.init() 

const serverRepo = new ServerRepository(orm.em.fork())
const serverStateService = new ServerStateService(serverRepo)
const rankingService = new RankingService()

fastify.addHook('onReady', async () => {
  await serverStateService.init()
})

fastify.addHook('onClose', async () => {
  await serverStateService.destroy()
  await orm.close()
})

fastify.register(routes, {
  serverStateService,
  rankingService
})

export default fastify