import { EntitySchema } from "@mikro-orm/core"

class Server {
    constructor(name, zone) {
        this.name = name
        this.zone = zone
    }
}

const schema = new EntitySchema({
    class: Server,
    tableName: 'servers',
    properties: {
        id: {
            type: 'number',
            primary: true,
            autoincrement: true
        },
        name: {
            type: 'string',
            unique: true
        },
        zone: { type: 'string' }
    }
})

export { Server, schema }
export default schema