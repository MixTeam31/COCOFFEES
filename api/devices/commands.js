import db from "../_db.js";

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

    const database = db();

    const result = await database.execute({
      sql: `
        SELECT id, type, payload, created_at
        FROM commands
        WHERE device_id = ?
          AND consumed_at IS NULL
        ORDER BY created_at ASC
        LIMIT 20
      `,
      args: [deviceId]
    });

    if (result.rows.length > 0) {
      const ids = result.rows.map((row) => row.id);

      await database.execute({
        sql: `
          UPDATE commands
          SET consumed_at = ?
          WHERE id IN (${ids.map(() => "?").join(",")})
        `,
        args: [Math.floor(Date.now() / 1000), ...ids]
      });
    }

    return response.status(200).json({
      commands: result.rows.map((row) => ({
        id: row.id,
        type: row.type,
        payload: row.payload ? JSON.parse(row.payload) : null,
        createdAt: row.created_at
      }))
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}