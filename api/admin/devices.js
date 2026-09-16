import db from "../_db.js";

export default async function handler(request, response) {
  if (request.method !== "GET") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const database = db();
    const now = Math.floor(Date.now() / 1000);
    const onlineLimit = now - 90;

    const result = await database.execute({
      sql: `
        SELECT
          id,
          name,
          user_agent,
          current_video,
          current_index,
          state,
          last_seen,
          created_at
        FROM devices
        ORDER BY last_seen DESC
      `,
      args: []
    });

    return response.status(200).json({
      devices: result.rows.map((device) => ({
        ...device,
        online: Number(device.last_seen) >= onlineLimit
      }))
    });
  } catch (error) {
    console.error(error);

    return response.status(500).json({
      error: "Erreur serveur."
    });
  }
}