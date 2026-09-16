import { createClient } from "@libsql/client";

let databaseClient = null;

export function getDatabase() {
  if (databaseClient) {
    return databaseClient;
  }

  const url = process.env.TURSO_DATABASE_URL;
  const authToken = process.env.TURSO_AUTH_TOKEN;

  if (!url || !authToken) {
    throw new Error(
      "TURSO_DATABASE_URL ou TURSO_AUTH_TOKEN est manquant."
    );
  }

  databaseClient = createClient({
    url,
    authToken
  });

  return databaseClient;
}