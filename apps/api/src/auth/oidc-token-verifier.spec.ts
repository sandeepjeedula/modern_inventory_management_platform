import { generateKeyPairSync } from 'node:crypto';
import { ConfigService } from '@nestjs/config';
import * as jwt from 'jsonwebtoken';
import { OidcTokenVerifier } from './oidc-token-verifier';

const issuer = 'https://identity.example.test/realm/inventory';
const audience = 'inventory-api';
const jwksUri = 'https://identity.example.test/realm/inventory/keys';
const tenantId = '11111111-1111-4111-8111-111111111111';
const signingPair = generateKeyPairSync('rsa', { modulusLength: 2048 });
const publicJwk = signingPair.publicKey.export({ format: 'jwk' });
const originalFetch = global.fetch;

function createVerifier() {
  const values: Record<string, string> = { OIDC_ISSUER: issuer, OIDC_AUDIENCE: audience, OIDC_JWKS_URI: jwksUri };
  const config = { getOrThrow: (key: string) => values[key] } as ConfigService;
  return new OidcTokenVerifier(config);
}

function signedToken(overrides: jwt.JwtPayload = {}, algorithm: jwt.Algorithm = 'RS256') {
  const payload: jwt.JwtPayload = { sub: 'user-1', tenant_id: tenantId, ...overrides };
  return jwt.sign(payload, algorithm === 'RS256' ? signingPair.privateKey : 'test-secret', {
    algorithm,
    keyid: 'catalog-test-key',
    issuer,
    audience,
    expiresIn: '5m',
  });
}

describe('OidcTokenVerifier', () => {
  const fetchMock = jest.fn();

  beforeEach(() => {
    fetchMock.mockReset().mockResolvedValue(new Response(JSON.stringify({
      keys: [{ ...publicJwk, kid: 'catalog-test-key', alg: 'RS256', use: 'sig' }],
    }), { status: 200, headers: { 'content-type': 'application/json' } }));
    global.fetch = fetchMock as unknown as typeof fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  it('verifies signed issuer, audience, and tenant claims using cached JWKS', async () => {
    const verifier = createVerifier();
    const token = signedToken();

    await expect(verifier.verify(token)).resolves.toMatchObject({ sub: 'user-1', tenant_id: tenantId });
    await verifier.verify(token);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('rejects a token from a different issuer', async () => {
    const token = jwt.sign({ sub: 'user-1', tenant_id: tenantId }, signingPair.privateKey, {
      algorithm: 'RS256', keyid: 'catalog-test-key', issuer: 'https://attacker.example.test', audience,
    });
    await expect(createVerifier().verify(token)).rejects.toThrow();
  });

  it('rejects algorithms outside the allowlist', async () => {
    await expect(createVerifier().verify(signedToken({}, 'HS256'))).rejects.toThrow('JWT algorithm is not allowed');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects an unavailable JWKS endpoint', async () => {
    fetchMock.mockResolvedValueOnce(new Response('', { status: 503 }));
    await expect(createVerifier().verify(signedToken())).rejects.toThrow('OIDC signing keys are unavailable');
  });
});
