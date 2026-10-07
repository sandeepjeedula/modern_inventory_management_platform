import { BadRequestException } from '@nestjs/common';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CategoryService } from './category.service';
import { Category } from './entities/category.entity';

describe('CategoryService hierarchy', () => {
  const tenantId = '11111111-1111-4111-8111-111111111111';
  const categoryId = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const descendantId = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const category = { id: categoryId, tenantId, parentId: null, status: 'active', name: 'Hardware' } as Category;
  const repository = {
    findOne: jest.fn(),
    save: jest.fn(),
  } as unknown as Repository<Category>;
  const manager = {
    getRepository: jest.fn().mockReturnValue(repository),
    query: jest.fn(),
  } as unknown as EntityManager;
  const dataSource = {
    transaction: jest.fn((operation: (manager: EntityManager) => unknown) => operation(manager)),
  } as unknown as DataSource;
  const service = new CategoryService(dataSource);

  beforeEach(() => {
    jest.clearAllMocks();
    jest.mocked(manager.getRepository).mockReturnValue(repository);
  });

  it('rejects moving a category beneath one of its descendants', async () => {
    jest.mocked(repository.findOne)
      .mockResolvedValueOnce(category)
      .mockResolvedValueOnce({ id: descendantId, tenantId, parentId: categoryId, status: 'active' } as Category);
    jest.mocked(manager.query).mockResolvedValue([{ id: categoryId }]);

    await expect(service.update(
      { tenantId, subject: 'user-1', permissions: ['catalog:write'] },
      categoryId,
      { parentId: descendantId },
    )).rejects.toBeInstanceOf(BadRequestException);
    expect(repository.save).not.toHaveBeenCalled();
  });
});
