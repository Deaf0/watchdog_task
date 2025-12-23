async function routes (fastify, options) {
    fastify.get('/best', {
        schema: {
            querystring: {
                type: 'object',
                required: ['zone'],
                properties: { zone: { type: 'string' } }
            }
        }
    }, async (request) => {
            return { zone: request.query.zone, smth: request.query.smth_else }
        }
    )
}

export default routes;