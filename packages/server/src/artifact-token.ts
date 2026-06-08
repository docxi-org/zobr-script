import * as jose from "jose";
import { config } from "./config";

const ALG = "HS256";
const ISSUER = "zs-artifact";
const AUDIENCE = "zs-artifact-viewer";

let artifactSecret: Uint8Array | undefined;

function getSecret(): Uint8Array {
  if (!artifactSecret) {
    const base = process.env["ZS_JWT_SECRET"] ?? "";
    artifactSecret = new TextEncoder().encode(base + ":artifact");
  }
  return artifactSecret;
}

export interface ArtifactTokenPayload {
  invocation_id: string;
  agent_id: string;
}

export async function createArtifactToken(payload: ArtifactTokenPayload): Promise<string> {
  const ttl = config.artifactTokenTtl ?? "1h";
  return new jose.SignJWT({ inv: payload.invocation_id, agt: payload.agent_id })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(ttl)
    .sign(getSecret());
}

export async function verifyArtifactToken(token: string): Promise<ArtifactTokenPayload | null> {
  try {
    const { payload } = await jose.jwtVerify(token, getSecret(), { issuer: ISSUER, audience: AUDIENCE });
    const inv = payload["inv"];
    const agt = payload["agt"];
    if (typeof inv !== "string" || typeof agt !== "string") return null;
    return { invocation_id: inv, agent_id: agt };
  } catch {
    return null;
  }
}

export function parseCookieToken(cookie: string | undefined, name: string): string | undefined {
  if (!cookie) return undefined;
  const match = cookie.match(new RegExp(`(?:^|;)\\s*${name}=([^;]*)`));
  return match?.[1];
}
