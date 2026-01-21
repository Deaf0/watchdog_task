export default async function routes (fastify, options) {
    const { serverStateService, rankingService } = options

    fastify.get('/best', {
        schema: {
            querystring: {
                type: 'object',
                required: ['zone'],
                properties: { zone: { type: 'string' } }
            }
        }
    }, async (request) => {
            const { zone } = request.query

            const alive = serverStateService.getAliveByZone(zone)
            const ranked = rankingService.rank(alive)

            return ranked.map(s => s.name)
        }
    )
}
