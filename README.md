# Modern Inventory Management Platform

A TypeScript modular-monolith for a multi-tenant inventory platform. The current business module is Catalog; other workflows are intentionally staged.

## Technology

- Web: React, TypeScript, Vite, React Router, TanStack Query, React Hook Form, Zod, Material UI
- API: Node.js, NestJS, TypeORM, PostgreSQL, REST, OpenAPI
- Local infrastructure: PostgreSQL, Redis, Kafka, OpenSearch, LocalStack S3, Keycloak
- Quality: Jest, Supertest, React Testing Library, Playwright, GitHub Actions

## Requirements

- Node.js 22 or newer
- npm 10 or newer
- Docker Compose (for local infrastructure)

## Run locally

1. Copy `.env.example` to `.env` and adjust values if needed.
2. Start dependencies: `docker compose --profile storage up -d` (includes local Keycloak and LocalStack S3)
3. Install packages: `npm install`
4. Run the catalog schema and local seed: `npm run db:migration:run -w @inventory/api && npm run db:seed:development -w @inventory/api`
5. Start the API and web app: `npm run dev`

The web app runs at <http://localhost:5173>, the API at <http://localhost:3000>, Swagger UI at <http://localhost:3000/api/docs>, and Keycloak administration at <http://localhost:8080>. Local catalog sign-in is `catalog-admin` / `inventory_local_password`; these development-only credentials, password grant, and demo tenant must never be used in production. Health checks are available at `/api/health` and `/api/health/ready`.

Useful commands:

- `npm run build` - build both workspaces
- `npm test` - run unit tests
- `npm run lint` - run ESLint
- `npm run typecheck` - typecheck both workspaces
- `npm run test:e2e` - run Supertest and Playwright browser tests
- `npm run db:migration:run -w @inventory/api` - apply TypeORM migrations
- `npm run db:seed:development -w @inventory/api` - add the demo tenant (development only)

## Architecture

See [docs/architecture.md](docs/architecture.md) for module boundaries, tenant isolation rules, data and security principles, and the staged implementation plan. Each domain module belongs under `apps/api/src/modules/<module>` and owns its API, application logic, persistence adapters, and tests. Cross-module communication should use explicit contracts and domain events.

## Current scope

The catalog module supports authenticated product and category management, variants, product images, and CSV import/export. Authentication in local development is provided by the imported Keycloak realm; production must use an appropriately configured OIDC provider and securely provision tenant claims and catalog permissions. Inventory operations, stock metrics, and unrelated business contexts are not implemented, so those dashboard values remain explicitly unavailable.

Product images are private objects in the configured S3-compatible store and use short-lived signed read URLs. LocalStack creates the configured bucket on first use. Production should use AWS S3 or a compatible object store and supply credentials through managed secrets.