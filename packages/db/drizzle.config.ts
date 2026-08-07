import { config } from "dotenv";
import { defineConfig } from "drizzle-kit";

/*
 * drizzle-kit NIE czyta .env sam z siebie — bez tej linii `push` szedl do
 * fallbacku, czyli do lokalnej bazy, i cicho raportowal sukces, podczas gdy
 * produkcja zostawala bez tabel. Zlapane na tabeli subscriptions.
 */
config({ path: "../../.env" });

export default defineConfig({
  schema: "./src/schema.ts",
  out: "./drizzle",
  dialect: "postgresql",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "postgres://kuba@localhost:5432/auta",
  },
});
