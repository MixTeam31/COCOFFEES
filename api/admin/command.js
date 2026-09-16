import { getDatabase } from "../_db.js";
import { requireAdmin } from "../_auth.js";

const ALLOWED_COMMANDS = [
  "play",
  "pause",
  "restart",
  "change_video",
  "notification"
];

export default async function handler(request, response) {
  if (!requireAdmin(request, response)) {
    return;
  }

  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  try {
    const body = request.body || {};

    const deviceId = String(body.deviceId || "").trim();
    const type = String(body.type || "").trim();
    const payload = body.payload || {};

    if (!deviceId) {
      return response.status(400).json({
        error: "deviceId est obligatoire."
      });
    }

    if (!ALLOWED_COMMANDS.includes(type)) {
      return response.status(400).json({
        error: "Type de commande invalide."
      });
    }

    if (type === "notification") {
      const message = String(payload.message || "").trim();
      const durationSeconds = Number(payload.durationSeconds);

      if (!message) {
        return response.status(400).json({
          error: "Le message est obligatoire."
        });
      }

      if (
        !Number.isFinite(durationSeconds) ||
        durationSeconds < 1 ||
        durationSeconds > 86400
      ) {
        return response.status(400).json({
          error: "Durée invalide. Maximum : 24 heures."
        });
      }
    }

    const database = getDatabase();
    const now = Math.floor(Date.now() / 1000);

    await database.execute({
      sql: `
        INSERT INTO commands (
          device_id,
          type,
          payload,
          created_at
        )
        VALUES (?, ?, ?, ?)
      `,
      args: [
        deviceId,
        type,
        JSON.stringify(payload),
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