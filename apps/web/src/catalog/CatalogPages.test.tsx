import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { CatalogProduct, catalogApi } from '../api/catalog';
import { ProductFormPage } from './ProductFormPage';
import { ProductsPage } from './ProductsPage';

vi.mock('../api/catalog', () => ({
  CatalogApiError: class CatalogApiError extends Error {},
  catalogApi: {
    listProducts: vi.fn(),
    listCategories: vi.fn(),
    createProduct: vi.fn(),
    updateProduct: vi.fn(),
    archiveProduct: vi.fn(),
    restoreProduct: vi.fn(),
    importCsv: vi.fn(),
    exportCsv: vi.fn(),
  },
}));

const product: CatalogProduct = {
  id: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', tenantId: '11111111-1111-4111-8111-111111111111', sku: 'WIDGET-1', name: 'Workshop Widget',
  description: null, categoryId: null, category: null, brand: 'Northstar', productType: 'physical', status: 'active',
  barcode: null, upc: '012345678905', ean: null, gtin: null, unitOfMeasure: 'each', weight: null, dimensions: null,
  taxInformation: null, trackBatch: false, trackSerialNumber: false, trackExpiry: false, variants: [], variantCount: 0, images: [],
  createdBy: 'catalog-admin', updatedBy: 'catalog-admin', archivedAt: null, createdAt: '2026-10-06T00:00:00Z', updatedAt: '2026-10-06T00:00:00Z',
};

function renderWithProviders(children: React.ReactNode, initialEntry = '/') {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={client}>
      <MemoryRouter initialEntries={[initialEntry]}>{children}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('catalog screens', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(catalogApi.listCategories).mockResolvedValue({ data: [] });
  });

  it('shows tenant product results and pagination metadata', async () => {
    vi.mocked(catalogApi.listProducts).mockResolvedValue({ data: [product], meta: { page: 1, pageSize: 25, total: 1, totalPages: 1 } });
    renderWithProviders(<ProductsPage accessToken="session-token" />);

    expect(await screen.findByText('Workshop Widget')).toBeInTheDocument();
    expect(screen.getByText('WIDGET-1')).toBeInTheDocument();
    expect(screen.getByText('Northstar')).toBeInTheDocument();
  });

  it('shows an empty state without inventing products', async () => {
    vi.mocked(catalogApi.listProducts).mockResolvedValue({ data: [], meta: { page: 1, pageSize: 25, total: 0, totalPages: 0 } });
    renderWithProviders(<ProductsPage accessToken="session-token" />);

    expect(await screen.findByText('Your catalog starts here')).toBeInTheDocument();
    expect(screen.queryByText('Workshop Widget')).not.toBeInTheDocument();
  });

  it('validates a new product before submitting', async () => {
    const user = userEvent.setup();
    renderWithProviders(
      <Routes><Route path="/catalog/products/new" element={<ProductFormPage accessToken="session-token" />} /></Routes>,
      '/catalog/products/new',
    );

    await user.click(screen.getByRole('button', { name: 'Save product' }));
    expect(await screen.findByText('SKU is required')).toBeInTheDocument();
    expect(screen.getByText('Product name is required')).toBeInTheDocument();
    expect(catalogApi.createProduct).not.toHaveBeenCalled();
  });
});
