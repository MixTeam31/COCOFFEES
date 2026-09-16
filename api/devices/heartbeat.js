import db from "../_db.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const database = db();
    const body = request.body || {};

    const deviceId = String(body.deviceId || "").trim();
    const deviceName = String(body.deviceName || "Afficheur").trim();
    const userAgent = String(body.userAgent || "").slice(0, 1000);
    const currentVideo = String(body.currentVideo || "").slice(0, 500);
    const currentIndex = Number.isInteger(body.currentIndex)
      ? body.currentIndex
      : 0;
    const state = String(body.state || "unknown").slice(0, 50);

    if (!deviceId) {
      return response.status(400).json({
        error: "deviceId est obligatoire."
      });
    }

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
          created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(id) DO UPDATE SET
          name = excluded.name,
          user_agent = excluded.user_agent,
          current_video = excluded.current_video,
          current_index = excluded.current_index,
          state = excluded.state,
          last_seen = excluded.last_seen
      `,
      args: [
        deviceId,
        deviceName,
        userAgent,
        currentVideo,
        currentIndex,
        state,
        now,
        now
      ]
    });

    return response.status(200).json({
      success: true,
      serverTime: now
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}