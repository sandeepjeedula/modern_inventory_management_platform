import dataSource from './data-source';

const DEVELOPMENT_TENANT_ID = '11111111-1111-4111-8111-111111111111';

async function seedDevelopmentTenant() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('The development tenant seed is disabled in production');
  }

  await dataSource.initialize();
  try {
    await dataSource.query(
      `INSERT INTO tenants (id, name, slug)
       VALUES ($1, 'Local Workspace', 'local-workspace')
       ON CONFLICT (id) DO NOTHING`,
      [DEVELOPMENT_TENANT_ID],
    );
  } finally {
    await dataSource.destroy();
  }
}

void seedDevelopmentTenant();
