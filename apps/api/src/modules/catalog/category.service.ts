import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import { CatalogPrincipal } from '../../auth/catalog-principal';
import { appendCatalogAudit } from './catalog-audit';
import { CreateCategoryDto, UpdateCategoryDto } from './dto/category.dto';
import { Category } from './entities/category.entity';

type CategoryNode = Category & { children: CategoryNode[] };

@Injectable()
export class CategoryService {
  constructor(private readonly dataSource: DataSource) {}

  async list(tenantId: string) {
    const categories = await this.dataSource.getRepository(Category).find({
      where: { tenantId },
      order: { name: 'ASC' },
    });
    const nodes = new Map<string, CategoryNode>(categories.map((category) => [category.id, { ...category, children: [] }]));
    const roots: CategoryNode[] = [];
    for (const node of nodes.values()) {
      const parent = node.parentId ? nodes.get(node.parentId) : undefined;
      if (parent) parent.children.push(node);
      else roots.push(node);
    }
    return { data: roots };
  }

  async create(principal: CatalogPrincipal, input: CreateCategoryDto) {
    return this.withConflictHandling(() => this.dataSource.transaction(async (manager) => {
      await this.lockTenantHierarchy(manager, principal.tenantId);
      await this.assertValidParent(manager, principal.tenantId, input.parentId ?? null);
      const repository = manager.getRepository(Category);
      const category = repository.create({
        tenantId: principal.tenantId,
        name: input.name.trim(),
        description: input.description?.trim() || null,
        parentId: input.parentId ?? null,
        status: 'active',
        createdBy: principal.subject,
        updatedBy: principal.subject,
      });
      const saved = await repository.save(category);
      await appendCatalogAudit(manager, principal, 'catalog.category.created', 'category', saved.id, { name: saved.name });
      return saved;
    }));
  }

  async update(principal: CatalogPrincipal, categoryId: string, input: UpdateCategoryDto) {
    return this.withConflictHandling(() => this.dataSource.transaction(async (manager) => {
      await this.lockTenantHierarchy(manager, principal.tenantId);
      const repository = manager.getRepository(Category);
      const category = await repository.findOne({ where: { tenantId: principal.tenantId, id: categoryId } });
      if (!category) throw new NotFoundException('Category not found');

      if (input.parentId !== undefined) {
        const parentId = input.parentId ?? null;
        await this.assertValidParent(manager, principal.tenantId, parentId);
        if (parentId) {
          const descendants = await manager.query(
            `WITH RECURSIVE descendants AS (
               SELECT id FROM categories WHERE tenant_id = $1 AND id = $2
               UNION ALL
               SELECT child.id FROM categories child
               JOIN descendants parent ON child.parent_id = parent.id
               WHERE child.tenant_id = $1
             ) SELECT id FROM descendants WHERE id = $3 LIMIT 1`,
            [principal.tenantId, category.id, parentId],
          );
          if (descendants.length) throw new BadRequestException('A category cannot be nested beneath itself or one of its descendants');
        }
        category.parentId = parentId;
      }
      if (input.name !== undefined) category.name = input.name.trim();
      if (input.description !== undefined) category.description = input.description?.trim() || null;
      if (input.status !== undefined) category.status = input.status;
      category.updatedBy = principal.subject;
      const saved = await repository.save(category);
      await appendCatalogAudit(manager, principal, 'catalog.category.updated', 'category', saved.id, { fields: Object.keys(input) });
      return saved;
    }));
  }

  private async assertValidParent(manager: EntityManager, tenantId: string, parentId: string | null) {
    if (!parentId) return;
    const parent = await manager.getRepository(Category).findOne({ where: { tenantId, id: parentId, status: 'active' } });
    if (!parent) throw new BadRequestException('parentId must reference an active category in this tenant');
  }

  private async lockTenantHierarchy(manager: EntityManager, tenantId: string) {
    await manager.query('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`catalog-category:${tenantId}`]);
  }

  private async withConflictHandling<T>(operation: () => Promise<T>): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      const databaseError = error as { code?: string; driverError?: { code?: string; constraint?: string } };
      if ((databaseError.driverError?.code ?? databaseError.code) === '23505') {
        throw new ConflictException('A category with this name already exists at this level');
      }
      throw error;
    }
  }
}
