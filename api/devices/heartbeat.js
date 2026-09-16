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

    if (!deviceId) {
      return response.status(400).json({
        error: "deviceId est obligatoire."
      });
    }

    const database = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    await database.execute({
      sql: `
        INSERT INTO devices (
          id,
          name,
          user_agent,
          current_video,
          current_index,
          state,
          last_seen,
          created_at,
          updated_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          user_agent = excluded.user_agent,
          current_video = excluded.current_video,
          current_index = excluded.current_index,
          state = excluded.state,
          last_seen = excluded.last_seen,
          updated_at = excluded.updated_at
      `,
      args: [
        deviceId,
        String(body.deviceName || "Afficheur").slice(0, 120),
        String(body.userAgent || "").slice(0, 1000),
        String(body.currentVideo || "").slice(0, 500),
        Number(body.currentIndex || 0),
        String(body.state || "unknown").slice(0, 50),
        now,
        now,
        now
      ]
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