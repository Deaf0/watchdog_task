import { Server } from "../entities/Server.js"

export class ServerRepository {
    constructor(em) {
        this.em = em
    }

    getAll() {
        return this.em.find(Server, {})
    }
}