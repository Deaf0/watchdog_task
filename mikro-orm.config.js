import { defineConfig } from "@mikro-orm/postgresql"
import { schema as ServerSchema } from "./src/entities/Server.js"

export default defineConfig({
  host: process.env.POSTGRES_HOST || 'localhost',
  port: 5432,
  user: process.env.POSTGRES_USER || 'postgres',
  password: process.env.POSTGRES_PASSWORD || 'postgres',
  dbName: process.env.POSTGRES_DB || 'watchdog',

  entities: [ServerSchema],

  migrations: {
    path: './src/migrations',
    emit: 'js', 
  },

  debug: process.env.NODE_ENV !== 'production',
})