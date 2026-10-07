# Architecture

## Shape

Start as a modular monolith in an npm workspace. `apps/api` is the system of record and owns domain policy and persistence. `apps/web` is an API client, not a second source of business rules. Each bounded context lives in `apps/api/src/modules/<context>` and exposes a small public application contract; other contexts must not reach into its repositories or entities. Extract a context into a service only when its ownership, scaling, or release needs justify the operational cost.

## Bounded contexts

The Catalog context is implemented under `apps/api/src/modules/catalog`: products, variants, identifiers, hierarchical categories, object-backed images, and bulk CSV workflows. Shared authentication, Redis, storage, and database adapters are infrastructure modules; domain-specific rules stay inside their owning context. Planned contexts still include Users, Tenant Provisioning, Inventory, Warehouses, Locations, Suppliers, Purchasing, Sales Orders, Reservations, Transfers, Receiving, Returns, Counting, Notifications, Reporting, Integrations, Search, AI, Billing, and Administration.

## Data and tenant boundary

PostgreSQL is the transactional source of truth. Tenant-owned tables use UUID identifiers and a non-null `tenant_id` foreign key, with tenant-scoped unique constraints and indexes. Catalog references use composite `(tenant_id, id)` foreign keys so a product cannot reference another tenant's category. Product and variant SKUs share a tenant-scoped normalized SKU registry; product identifiers are unique per tenant. Category hierarchy mutations serialize on a tenant-scoped advisory lock and reject cycles. Application queries derive tenant scope from verified request identity, never trust a tenant identifier supplied only in a request body or query. PostgreSQL row-level security remains an option for defense in depth. Schema changes are versioned TypeORM migrations; automatic schema synchronization is disabled.

Inventory will be modeled as an append-only transaction ledger plus transactionally maintained projections. Posting operations must be idempotent and use database transactions and row-level locks (or optimistic version checks) around relevant stock balances. Financial, inventory, and audit records are corrected with compensating entries, not deletion. Audit events are append-only.

## Integration boundaries

Use explicit domain events and an outbox for reliable Kafka publication after database commits. Redis is for ephemeral caching, rate limiting, and coordination, never the authority for stock quantities. OpenSearch is a rebuildable search/read model. Object storage is accessed behind an application-owned port with S3-compatible implementations. Product images use private objects, tenant/product-prefixed keys, signed short-lived reads, and validated image signatures. LocalStack supplies local S3; production may use AWS S3 or another S3-compatible provider.

## API and security

REST controllers validate input at the boundary and document the `/api` surface in Swagger. Catalog routes require OIDC bearer JWTs, verify signature and issuer/audience against cached JWKS keys, accept only RS256/ES256, and require a UUID `tenant_id` claim. Authorization reads catalog permissions from token `scope`, `permissions`, or verified realm roles. The tenant ID is attached to request principal context; caller-provided tenant headers and body values do not influence query scope. Central configuration validates environment variables and requires HTTPS OIDC endpoints in production. The imported Keycloak realm and password-grant demo account are local-only; production must use authorization-code/PKCE browser flow with a production OIDC provider, managed secrets, TLS, restrictive CORS, and non-development database credentials.

## Repository layout

```text
apps/
  api/       NestJS application, migrations, modular domain contexts
  web/       React application, routes, shared UI and API client
docs/        Architecture decisions and operational guidance
```

## Delivery sequence

1. Foundation, configuration, health checks, and CI.
2. Catalog products, categories, variants, images, and bulk workflows (current).
3. Production identity and tenant provisioning, permission administration, and audit request context.
4. Inventory ledger, concurrency controls, idempotency, and outbox.
5. Receiving, purchasing, reservations, sales, transfers, and returns.
6. Reporting/search projections, integrations, billing, and operational hardening.
