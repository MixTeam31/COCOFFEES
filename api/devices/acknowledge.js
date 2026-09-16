import { getDatabase } from "../_db.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const body = request.body || {};
    const deviceId = String(body.deviceId || "").trim();

    const commandIds = Array.isArray(body.commandIds)
      ? body.commandIds.map(Number).filter(Number.isInteger)
      : [];

    if (!deviceId || commandIds.length === 0) {
      return response.status(200).json({
        success: true
      });
    }

    const database = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    const placeholders = commandIds.map(() => "?").join(",");

    await database.execute({
      sql: `
        UPDATE commands
        SET consumed_at = ?
        WHERE id IN (${placeholders})
          AND (device_id = ? OR device_id = '*')
      `,
      args: [now, ...commandIds, deviceId]
    });

    return response.status(200).json({
      success: true
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}