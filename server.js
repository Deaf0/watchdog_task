import Fastify from 'fastify'
import routes from './routes/best-route.js'

const fastify = Fastify({
  logger: true
})

fastify.register(routes)

// Run the server!
try {
  await fastify.listen({ port: 3000 })
} catch (err) {
  fastify.log.error(err)
  process.exit(1)
}