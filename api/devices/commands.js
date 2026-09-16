import { getDatabase } from "../_db.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const deviceId = String(request.query.deviceId || "").trim();

    if (!deviceId) {
      return response.status(400).json({
        error: "deviceId est obligatoire."
      });
    }

    const database = getDatabase();

    const result = await database.execute({
      sql: `
        SELECT id, type, payload, created_at
        FROM commands
        WHERE consumed_at IS NULL
          AND (device_id = ? OR device_id = '*')
        ORDER BY created_at ASC
        LIMIT 30
      `,
      args: [deviceId]
    });

    const commands = result.rows.map((command) => ({
      id: Number(command.id),
      type: command.type,
      payload: command.payload ? JSON.parse(command.payload) : {},
      createdAt: Number(command.created_at)
    }));

    return response.status(200).json({
      commands
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}