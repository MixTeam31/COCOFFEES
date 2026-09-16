import {
  createSessionToken,
  setSessionCookie
} from "../_auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  const body = request.body || {};

  const id = String(body.id || "");
  const password = String(body.password || "");

  if (
    id !== process.env.ADMIN_ID ||
    password !== process.env.ADMIN_PASSWORD
  ) {
    return response.status(401).json({
      error: "Identifiant ou mot de passe incorrect."
    });
  }

  const token = createSessionToken();

  setSessionCookie(response, token);

  return response.status(200).json({
    success: true
  });
}