import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CreateProductDto } from './product.dto';

describe('CreateProductDto', () => {
  it('rejects empty SKUs and names', () => {
    const dto = plainToInstance(CreateProductDto, { sku: '   ', name: '' });
    expect(validateSync(dto).map((error) => error.property)).toEqual(expect.arrayContaining(['sku', 'name']));
  });

  it('rejects malformed standard identifiers', () => {
    const dto = plainToInstance(CreateProductDto, { sku: 'A-1', name: 'Widget', upc: '1234' });
    expect(validateSync(dto).map((error) => error.property)).toContain('upc');
  });

  it('rejects standard identifiers with an invalid check digit', () => {
    const dto = plainToInstance(CreateProductDto, { sku: 'A-1', name: 'Widget', upc: '012345678906' });
    expect(validateSync(dto).map((error) => error.property)).toContain('upc');
  });

  it('accepts a valid minimal product and UPC-A identifier', () => {
    const dto = plainToInstance(CreateProductDto, { sku: 'A-1', name: 'Widget', upc: '012345678905' });
    expect(validateSync(dto)).toHaveLength(0);
  });

  it('preserves explicit null for optional numeric values', () => {
    const dto = plainToInstance(CreateProductDto, { sku: 'A-1', name: 'Widget', weight: null });
    expect(dto.weight).toBeNull();
    expect(validateSync(dto)).toHaveLength(0);
  });
});
