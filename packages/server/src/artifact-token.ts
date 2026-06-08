import * as jose from "jose";

const ALG = "HS256";
const ISSUER = "zs-artifact";
const AUDIENCE = "zs-artifact-viewer";
const DEFAULT_TTL = "1h";

let secret: Uint8Array | undefined;

function getSecret(): Uint8Array {
  if (!secret) {
    const env = process.env["ZS_JWT_SECRET"];
    secret = env ? new TextEncoder().encode(env) : jose.base64url.decode(jose.generateSecret(ALG).toString());
  }
  return secret;
}

export interface ArtifactTokenPayload {
  invocation_id: string;
  agent_id: string;
}

export async function createArtifactToken(payload: ArtifactTokenPayload): Promise<string> {
  return new jose.SignJWT({ inv: payload.invocation_id, agt: payload.agent_id })
    .setProtectedHeader({ alg: ALG })
    .setIssuedAt()
    .setIssuer(ISSUER)
    .setAudience(AUDIENCE)
    .setExpirationTime(DEFAULT_TTL)
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
