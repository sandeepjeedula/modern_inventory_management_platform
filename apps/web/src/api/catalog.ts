export type ProductStatus = 'active' | 'draft' | 'archived';
export type ProductType = 'physical' | 'digital' | 'service' | 'bundle';

export type ProductVariant = {
  id: string;
  productId: string;
  sku: string;
  attributes: Record<string, string | number | boolean>;
  barcode: string | null;
  price: string | null;
  cost: string | null;
  status: 'active' | 'archived';
};

export type ProductImage = {
  id: string;
  originalName: string;
  contentType: string;
  byteSize: number;
  altText: string | null;
  sortOrder: number;
  isPrimary: boolean;
  createdAt: string;
};

export type CatalogProduct = {
  id: string;
  tenantId: string;
  sku: string;
  name: string;
  description: string | null;
  categoryId: string | null;
  category: { id: string; name: string; status: 'active' | 'inactive' } | null;
  brand: string | null;
  productType: ProductType;
  status: ProductStatus;
  barcode: string | null;
  upc: string | null;
  ean: string | null;
  gtin: string | null;
  unitOfMeasure: string;
  weight: string | null;
  dimensions: { length?: number; width?: number; height?: number; unit?: string } | null;
  taxInformation: { code?: string; rate?: number; inclusive?: boolean } | null;
  trackBatch: boolean;
  trackSerialNumber: boolean;
  trackExpiry: boolean;
  variants: ProductVariant[];
  variantCount: number;
  images: ProductImage[];
  createdBy: string;
  updatedBy: string;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type CategoryNode = {
  id: string;
  tenantId: string;
  name: string;
  description: string | null;
  parentId: string | null;
  status: 'active' | 'inactive';
  children: CategoryNode[];
};

export type ProductInput = {
  sku: string;
  name: string;
  description?: string | null;
  categoryId?: string | null;
  brand?: string | null;
  productType?: ProductType;
  status?: 'active' | 'draft';
  barcode?: string | null;
  upc?: string | null;
  ean?: string | null;
  gtin?: string | null;
  unitOfMeasure?: string;
  weight?: number | null;
  dimensions?: CatalogProduct['dimensions'];
  taxInformation?: CatalogProduct['taxInformation'];
  trackBatch?: boolean;
  trackSerialNumber?: boolean;
  trackExpiry?: boolean;
};

export type ProductPage = {
  data: CatalogProduct[];
  meta: { page: number; pageSize: number; total: number; totalPages: number };
};

export type CatalogSummary = { activeProducts: number; totalSkus: number; activeCategories: number };

export type ProductListFilters = {
  page: number;
  pageSize: number;
  search?: string;
  status?: ProductStatus;
  productType?: ProductType;
  categoryId?: string;
  brand?: string;
  sortBy?: 'sku' | 'name' | 'createdAt' | 'updatedAt';
  sortOrder?: 'ASC' | 'DESC';
};

export class CatalogApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'CatalogApiError';
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

async function request<T>(token: string, path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  const response = await fetch(`${apiBaseUrl}${path}`, { ...init, headers });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const error = await response.json() as { message?: string | string[]; errors?: string[] };
      const detail = error.message ?? error.errors;
      if (typeof detail === 'string') message = detail;
      if (Array.isArray(detail)) message = detail.join(', ');
    } catch {
      message = response.statusText || message;
    }
    throw new CatalogApiError(message, response.status);
  }
  if (response.status === 204) return undefined as T;
  return response.json() as Promise<T>;
}

const json = (value: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(value) });
const patch = (value: unknown): RequestInit => ({ method: 'PATCH', body: JSON.stringify(value) });

function queryString(values: Record<string, string | number | undefined>) {
  const query = new URLSearchParams();
  Object.entries(values).forEach(([key, value]) => {
    if (value !== undefined && value !== '') query.set(key, String(value));
  });
  return query.toString();
}

export const catalogApi = {
  getSummary(token: string) {
    return request<CatalogSummary>(token, '/catalog/products/summary');
  },
  listProducts(token: string, filters: ProductListFilters) {
    return request<ProductPage>(token, `/catalog/products?${queryString(filters)}`);
  },
  getProduct(token: string, id: string) {
    return request<CatalogProduct>(token, `/catalog/products/${id}`);
  },
  createProduct(token: string, input: ProductInput) {
    return request<CatalogProduct>(token, '/catalog/products', json(input));
  },
  updateProduct(token: string, id: string, input: Partial<ProductInput>) {
    return request<CatalogProduct>(token, `/catalog/products/${id}`, patch(input));
  },
  archiveProduct(token: string, id: string) {
    return request<CatalogProduct>(token, `/catalog/products/${id}/archive`, { method: 'POST' });
  },
  restoreProduct(token: string, id: string) {
    return request<CatalogProduct>(token, `/catalog/products/${id}/restore`, { method: 'POST' });
  },
  listCategories(token: string) {
    return request<{ data: CategoryNode[] }>(token, '/catalog/categories');
  },
  createCategory(token: string, input: { name: string; description?: string; parentId?: string | null }) {
    return request<CategoryNode>(token, '/catalog/categories', json(input));
  },
  updateCategory(token: string, id: string, input: { name?: string; description?: string | null; parentId?: string | null; status?: 'active' | 'inactive' }) {
    return request<CategoryNode>(token, `/catalog/categories/${id}`, patch(input));
  },
  createVariant(token: string, productId: string, input: { sku: string; attributes: Record<string, string | number | boolean>; price?: number | null; cost?: number | null; barcode?: string | null }) {
    return request<ProductVariant>(token, `/catalog/products/${productId}/variants`, json(input));
  },
  updateVariant(token: string, productId: string, variantId: string, input: {
    sku?: string; attributes?: Record<string, string | number | boolean>; price?: number | null; cost?: number | null;
    barcode?: string | null; status?: 'active' | 'archived';
  }) {
    return request<ProductVariant>(token, `/catalog/products/${productId}/variants/${variantId}`, patch(input));
  },
  listImages(token: string, productId: string) {
    return request<{ data: Array<ProductImage & { url: string }> }>(token, `/catalog/products/${productId}/images`);
  },
  uploadImage(token: string, productId: string, file: File, altText?: string) {
    const body = new FormData();
    body.set('file', file);
    if (altText) body.set('altText', altText);
    return request<ProductImage & { url: string }>(token, `/catalog/products/${productId}/images`, { method: 'POST', body });
  },
  updateImage(token: string, productId: string, imageId: string, input: { altText?: string; sortOrder?: number; isPrimary?: boolean }) {
    return request<ProductImage & { url: string }>(token, `/catalog/products/${productId}/images/${imageId}`, patch(input));
  },
  reorderImages(token: string, productId: string, imageIds: string[]) {
    return request<{ data: Array<ProductImage & { url: string }> }>(token, `/catalog/products/${productId}/images/order`, patch({ imageIds }));
  },
  deleteImage(token: string, productId: string, imageId: string) {
    return request<{ removed: boolean }>(token, `/catalog/products/${productId}/images/${imageId}`, { method: 'DELETE' });
  },
  importCsv(token: string, file: File) {
    const body = new FormData();
    body.set('file', file);
    return request<{ imported: number }>(token, '/catalog/products/import', { method: 'POST', body });
  },
  async exportCsv(token: string) {
    const response = await fetch(`${apiBaseUrl}/catalog/products/export.csv`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new CatalogApiError('Product export failed', response.status);
    return response.blob();
  },
  async importTemplate(token: string) {
    const response = await fetch(`${apiBaseUrl}/catalog/products/import-template.csv`, { headers: { Authorization: `Bearer ${token}` } });
    if (!response.ok) throw new CatalogApiError('CSV template download failed', response.status);
    return response.blob();
  },
};