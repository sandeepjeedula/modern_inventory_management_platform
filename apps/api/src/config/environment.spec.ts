import { validateEnvironment } from './environment';

describe('validateEnvironment', () => {
  it('applies local defaults and parses numeric ports', () => {
    expect(validateEnvironment({}).API_PORT).toBe(3000);
    expect(validateEnvironment({ API_PORT: '3100' }).API_PORT).toBe(3100);
  });

  it('rejects invalid service origins', () => {
    expect(() => validateEnvironment({ WEB_ORIGIN: 'not-a-url' })).toThrow();
  });
});
