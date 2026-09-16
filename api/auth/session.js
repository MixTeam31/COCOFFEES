import { verifySession } from "../_auth.js";

export default async function handler(request, response) {
  return response.status(200).json({
    authenticated: verifySession(request)
  });
}