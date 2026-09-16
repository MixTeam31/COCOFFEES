import crypto from "node:crypto";

const SESSION_DURATION_SECONDS = 60 * 60 * 12;
const COOKIE_NAME = "cocoffees_admin_session";

function getSessionSecret() {
  const secret = process.env.SESSION_SECRET;

  if (!secret) {
    throw new Error("SESSION_SECRET est manquant.");
  }

  return secret;
}

function base64UrlEncode(value) {
  return Buffer.from(value)
    .toString("base64")
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replaceAll("=", "");
}

function base64UrlDecode(value) {
  const normalized = value
    .replaceAll("-", "+")
    .replaceAll("_", "/");

  return Buffer.from(normalized, "base64").toString("utf8");
}

function sign(value) {
  return crypto
    .createHmac("sha256", getSessionSecret())
    .update(value)
    .digest("base64url");
}

function parseCookies(request) {
  const cookieHeader = request.headers.cookie || "";

  return cookieHeader.split(";").reduce((cookies, item) => {
    const [key, ...value] = item.trim().split("=");

    if (key) {
      cookies[key] = decodeURIComponent(value.join("="));
    }

    return cookies;
  }, {});
}

export function createSessionToken() {
  const payload = {
    role: "admin",
    expiresAt: Math.floor(Date.now() / 1000) + SESSION_DURATION_SECONDS
  };

  const encodedPayload = base64UrlEncode(JSON.stringify(payload));
  const signature = sign(encodedPayload);

  return `${encodedPayload}.${signature}`;
}

export function verifySession(request) {
  try {
    const cookies = parseCookies(request);
    const token = cookies[COOKIE_NAME];

    if (!token) {
      return false;
    }

    const [encodedPayload, signature] = token.split(".");

    if (!encodedPayload || !signature) {
      return false;
    }

    const expectedSignature = sign(encodedPayload);

    if (
      !crypto.timingSafeEqual(
        Buffer.from(signature),
        Buffer.from(expectedSignature)
      )
    ) {
      return false;
    }

    const payload = JSON.parse(base64UrlDecode(encodedPayload));

    return (
      payload.role === "admin" &&
      Number(payload.expiresAt) > Math.floor(Date.now() / 1000)
    );
  } catch (error) {
    return false;
  }
}

export function setSessionCookie(response, token) {
  response.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=${encodeURIComponent(token)}`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      `Max-Age=${SESSION_DURATION_SECONDS}`
    ].join("; ")
  );
}

export function clearSessionCookie(response) {
  response.setHeader(
    "Set-Cookie",
    [
      `${COOKIE_NAME}=`,
      "Path=/",
      "HttpOnly",
      "Secure",
      "SameSite=Strict",
      "Max-Age=0"
    ].join("; ")
  );
}

export function requireAdmin(request, response) {
  if (verifySession(request)) {
    return true;
  }

  response.status(401).json({
    error: "Session administrateur requise."
  });

  return false;
}