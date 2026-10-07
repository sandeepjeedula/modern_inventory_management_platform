import { EntityManager } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';

export async function appendCatalogAudit(
  manager: EntityManager,
  principal: CatalogPrincipal,
  action: string,
  resourceType: string,
  resourceId: string | null,
  metadata: Record<string, unknown> = {},
): Promise<void> {
  await manager.query(
    `INSERT INTO audit_events (tenant_id, action, resource_type, resource_id, metadata)
     VALUES ($1, $2, $3, $4, $5::jsonb)`,
    [principal.tenantId, action, resourceType, resourceId, JSON.stringify({ actorSubject: principal.subject, ...metadata })],
  );
}
