import { getDatabase } from "../_db.js";
import { requireAdmin } from "../_auth.js";

export default async function handler(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }

  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const database = getDatabase();

    const result = await database.execute(`
      SELECT
        id,
        name,
        user_agent,
        current_video,
        current_index,
        state,
        last_seen,
        created_at,
        updated_at
      FROM devices
      ORDER BY last_seen DESC
    `);

    const now = Math.floor(Date.now() / 1000);
    const onlineThreshold = now - 35;

    const devices = result.rows.map((device) => ({
      id: device.id,
      name: device.name,
      userAgent: device.user_agent,
      currentVideo: device.current_video,
      currentIndex: Number(device.current_index),
      state: device.state,
      lastSeen: Number(device.last_seen),
      online: Number(device.last_seen) >= onlineThreshold
    }));

    return response.status(200).json({
      now,
      devices
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}