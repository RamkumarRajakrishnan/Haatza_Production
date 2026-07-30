import * as dotenv from "dotenv";
import * as path from "path";
import { defineConfig } from "prisma/config";

dotenv.config({ path: path.resolve(__dirname, ".env") });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "npx ts-node prisma/seed.ts",
  },
  datasource: {
    url: process.env.DATABASE_URL || "postgresql://postgres:Haatza%402025@127.0.0.1:5433/haatza?schema=public",
  },
});
