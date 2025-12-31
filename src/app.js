import Fastify from 'fastify'
import routes from './routes/best-route.js'

const fastify = Fastify({
  logger: true
});

fastify.register(routes);

export default fastify;