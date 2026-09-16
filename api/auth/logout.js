import { clearSessionCookie } from "../_auth.js";

export default async function handler(request, response) {
  if (request.method !== "POST") {
    return response.status(405).json({
      error: "Méthode non autorisée."
    });
  }

  clearSessionCookie(response);

  return response.status(200).json({
    success: true
  });
}