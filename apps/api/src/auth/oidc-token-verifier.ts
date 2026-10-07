import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createPublicKey, KeyObject, JsonWebKey as NodeJsonWebKey } from 'node:crypto';
import * as jwt from 'jsonwebtoken';

type SigningJwk = {
  kid?: string;
  kty: string;
  use?: string;
  alg?: string;
  n?: string;
  e?: string;
  crv?: string;
  x?: string;
  y?: string;
  key_ops?: string[];
};

@Injectable()
export class OidcTokenVerifier {
  private readonly jwksUri: string;
  private readonly issuer: string;
  private readonly audience: string;
  private signingKeys = new Map<string, KeyObject>();
  private cacheExpiresAt = 0;
  private lastUnknownKidRefreshAt = 0;
  private refreshInFlight?: Promise<void>;

  constructor(config: ConfigService) {
    this.jwksUri = config.getOrThrow<string>('OIDC_JWKS_URI');
    this.issuer = config.getOrThrow<string>('OIDC_ISSUER');
    this.audience = config.getOrThrow<string>('OIDC_AUDIENCE');
  }

  async verify(token: string): Promise<jwt.JwtPayload> {
    const decoded = jwt.decode(token, { complete: true });
    if (!decoded || typeof decoded === 'string' || !decoded.header.kid) throw new Error('JWT key id is required');
    if (!['RS256', 'ES256'].includes(decoded.header.alg ?? '')) throw new Error('JWT algorithm is not allowed');
    const key = await this.getSigningKey(decoded.header.kid);

    return new Promise((resolve, reject) => {
      jwt.verify(token, key, {
        issuer: this.issuer,
        audience: this.audience,
        algorithms: ['RS256', 'ES256'],
      }, (error, decoded) => {
        if (error) return reject(error);
        if (!decoded || typeof decoded === 'string') return reject(new Error('JWT payload is invalid'));
        resolve(decoded);
      });
    });
  }

  private async getSigningKey(kid: string): Promise<KeyObject> {
    if (Date.now() >= this.cacheExpiresAt) await this.refreshKeys();
    let key = this.signingKeys.get(kid);
    if (!key) {
      if (Date.now() - this.lastUnknownKidRefreshAt < 30_000) throw new Error('Unknown JWT key id');
      this.lastUnknownKidRefreshAt = Date.now();
      await this.refreshKeys(true);
      key = this.signingKeys.get(kid);
    }
    if (!key) throw new Error('Unknown JWT key id');
    return key;
  }

  private async refreshKeys(force = false): Promise<void> {
    if (!force && Date.now() < this.cacheExpiresAt) return;
    if (this.refreshInFlight) return this.refreshInFlight;
    const pending = this.fetchKeys();
    this.refreshInFlight = pending;
    try {
      await pending;
    } finally {
      this.refreshInFlight = undefined;
    }
  }

  private async fetchKeys(): Promise<void> {
    const response = await fetch(this.jwksUri, { signal: AbortSignal.timeout(5_000) });
    if (!response.ok) throw new Error('OIDC signing keys are unavailable');
    const document = await response.json() as { keys?: SigningJwk[] };
    const keys = new Map<string, KeyObject>();
    for (const jwk of document.keys ?? []) {
      if (!jwk.kid || jwk.use && jwk.use !== 'sig' || jwk.key_ops && !jwk.key_ops.includes('verify')) continue;
      try {
        const key = createPublicKey({ key: jwk as unknown as NodeJsonWebKey, format: 'jwk' });
        if (key.asymmetricKeyType === 'rsa' && (key.asymmetricKeyDetails?.modulusLength ?? 0) >= 2048 && (!jwk.alg || jwk.alg === 'RS256')) {
          keys.set(jwk.kid, key);
        }
        if (key.asymmetricKeyType === 'ec' && (!jwk.alg || jwk.alg === 'ES256') && jwk.crv === 'P-256') keys.set(jwk.kid, key);
      } catch {
        continue;
      }
    }
    if (!keys.size) throw new Error('OIDC signing keys are invalid');
    this.signingKeys = keys;
    this.cacheExpiresAt = Date.now() + 600_000;
  }
}
