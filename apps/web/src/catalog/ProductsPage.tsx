import { ChangeEvent, useDeferredValue, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, FormControl, InputLabel, MenuItem, Paper, Select,
  Snackbar, Table, TableBody, TableCell, TableContainer, TableHead, TablePagination, TableRow, TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import DescriptionOutlinedIcon from '@mui/icons-material/DescriptionOutlined';
import DownloadOutlinedIcon from '@mui/icons-material/DownloadOutlined';
import FileUploadOutlinedIcon from '@mui/icons-material/FileUploadOutlined';
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined';
import { useNavigate } from 'react-router-dom';
import { CatalogProduct, CategoryNode, ProductListFilters, ProductStatus, ProductType, catalogApi } from '../api/catalog';

const statusOptions: Array<{ value: ProductStatus | ''; label: string }> = [
  { value: '', label: 'All non-archived' },
  { value: 'active', label: 'Active' },
  { value: 'draft', label: 'Draft' },
  { value: 'archived', label: 'Archived' },
];

function flattenCategories(categories: CategoryNode[], depth = 0): Array<{ id: string; name: string; depth: number }> {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name, depth },
    ...flattenCategories(category.children, depth + 1),
  ]);
}

function errorMessage(error: unknown) {
  return error instanceof Error ? error.message : 'The request could not be completed';
}

function statusColor(status: ProductStatus): 'success' | 'default' | 'warning' {
  if (status === 'active') return 'success';
  if (status === 'draft') return 'warning';
  return 'default';
}

export function ProductsPage({ accessToken }: { accessToken: string }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState<ProductStatus | ''>('');
  const [productType, setProductType] = useState<ProductType | ''>('');
  const [categoryId, setCategoryId] = useState('');
  const [brand, setBrand] = useState('');
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(25);
  const [sortBy, setSortBy] = useState<ProductListFilters['sortBy']>('createdAt');
  const [sortOrder, setSortOrder] = useState<ProductListFilters['sortOrder']>('DESC');
  const [notice, setNotice] = useState('');
  const deferredSearch = useDeferredValue(search);
  const categories = useQuery({ queryKey: ['catalog', 'categories', accessToken], queryFn: () => catalogApi.listCategories(accessToken) });
  const filters: ProductListFilters = {
    page: page + 1,
    pageSize,
    search: deferredSearch.trim() || undefined,
    status: status || undefined,
    productType: productType || undefined,
    categoryId: categoryId || undefined,
    brand: brand.trim() || undefined,
    sortBy,
    sortOrder,
  };
  const products = useQuery({
    queryKey: ['catalog', 'products', accessToken, filters],
    queryFn: () => catalogApi.listProducts(accessToken, filters),
    placeholderData: (previous) => previous,
  });

  const importProducts = useMutation({
    mutationFn: (file: File) => catalogApi.importCsv(accessToken, file),
    onSuccess: async (result) => {
      setNotice(`${result.imported} products imported`);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
    },
  });
  const exportProducts = useMutation({
    mutationFn: () => catalogApi.exportCsv(accessToken),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'products.csv';
      anchor.click();
      URL.revokeObjectURL(url);
      setNotice('Product export downloaded');
    },
  });
  const downloadTemplate = useMutation({
    mutationFn: () => catalogApi.importTemplate(accessToken),
    onSuccess: (blob) => {
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement('a');
      anchor.href = url;
      anchor.download = 'products-template.csv';
      anchor.click();
      URL.revokeObjectURL(url);
    },
  });

  const onImportFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) importProducts.mutate(file);
    event.target.value = '';
  };

  const toggleSort = (column: NonNullable<ProductListFilters['sortBy']>) => {
    setSortOrder(sortBy === column && sortOrder === 'ASC' ? 'DESC' : 'ASC');
    setSortBy(column);
  };

  const categoryChoices = flattenCategories(categories.data?.data ?? []).filter((item) => {
    const find = (nodes: CategoryNode[]): CategoryNode | undefined => {
      for (const node of nodes) {
        if (node.id === item.id) return node;
        const child = find(node.children);
        if (child) return child;
      }
      return undefined;
    };
    return find(categories.data?.data ?? [])?.status === 'active';
  });

  return (
    <Box className="catalog-page">
      <Box className="catalog-page-heading">
        <Box>
          <Typography variant="overline" className="eyebrow">CATALOG / MASTER DATA</Typography>
          <Typography variant="h1" className="page-title">Products</Typography>
          <Typography color="text.secondary">Manage products, identifiers, variants, and product media.</Typography>
        </Box>
        <Box className="catalog-actions">
          <input ref={uploadInput} hidden type="file" accept=".csv,text/csv" onChange={onImportFile} />
          <Button variant="text" startIcon={<DescriptionOutlinedIcon />} onClick={() => downloadTemplate.mutate()} disabled={downloadTemplate.isPending}>CSV template</Button>
          <Button variant="outlined" startIcon={<FileUploadOutlinedIcon />} onClick={() => uploadInput.current?.click()} disabled={importProducts.isPending}>
            {importProducts.isPending ? 'Importing' : 'Import CSV'}
          </Button>
          <Button variant="outlined" startIcon={<DownloadOutlinedIcon />} onClick={() => exportProducts.mutate()} disabled={exportProducts.isPending}>
            Export
          </Button>
          <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={() => navigate('/catalog/products/new')}>
            New product
          </Button>
        </Box>
      </Box>

      {(importProducts.isError || exportProducts.isError || downloadTemplate.isError) && (
        <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(importProducts.error ?? exportProducts.error ?? downloadTemplate.error)}</Alert>
      )}
      {products.isError && <Alert severity="error" sx={{ mb: 2 }}>{errorMessage(products.error)}</Alert>}

      <Paper variant="outlined" className="catalog-table-panel">
        <Box className="catalog-filter-row">
          <TextField
            size="small"
            placeholder="Search products or identifiers"
            value={search}
            onChange={(event) => { setSearch(event.target.value); setPage(0); }}
            InputProps={{ startAdornment: <SearchOutlinedIcon fontSize="small" color="action" sx={{ mr: 1 }} /> }}
            className="catalog-search"
            inputProps={{ 'aria-label': 'Search products' }}
          />
          <FormControl size="small" className="catalog-filter">
            <InputLabel id="product-status-label">Status</InputLabel>
            <Select labelId="product-status-label" label="Status" value={status} onChange={(event) => { setStatus(event.target.value as ProductStatus | ''); setPage(0); }}>
              {statusOptions.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
            </Select>
          </FormControl>
          <FormControl size="small" className="catalog-filter">
            <InputLabel id="product-type-label">Type</InputLabel>
            <Select labelId="product-type-label" label="Type" value={productType} onChange={(event) => { setProductType(event.target.value as ProductType | ''); setPage(0); }}>
              <MenuItem value="">All types</MenuItem>
              <MenuItem value="physical">Physical</MenuItem><MenuItem value="digital">Digital</MenuItem>
              <MenuItem value="service">Service</MenuItem><MenuItem value="bundle">Bundle</MenuItem>
            </Select>
          </FormControl>
          <FormControl size="small" className="catalog-filter category-filter">
            <InputLabel id="product-category-label">Category</InputLabel>
            <Select labelId="product-category-label" label="Category" value={categoryId} onChange={(event) => { setCategoryId(event.target.value); setPage(0); }}>
              <MenuItem value="">All categories</MenuItem>
              {categoryChoices.map((category) => <MenuItem key={category.id} value={category.id}>{'　'.repeat(category.depth)}{category.name}</MenuItem>)}
            </Select>
          </FormControl>
          <TextField size="small" label="Brand" value={brand} onChange={(event) => { setBrand(event.target.value); setPage(0); }} className="catalog-filter" />
        </Box>

        <TableContainer className="catalog-table-scroll">
          <Table size="small" aria-label="Products">
            <TableHead><TableRow>
              <TableCell><button className="sort-heading" onClick={() => toggleSort('sku')}>SKU {sortBy === 'sku' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}</button></TableCell>
              <TableCell><button className="sort-heading" onClick={() => toggleSort('name')}>Product {sortBy === 'name' ? (sortOrder === 'ASC' ? '↑' : '↓') : ''}</button></TableCell>
              <TableCell>Category</TableCell><TableCell>Brand</TableCell><TableCell>Type</TableCell><TableCell>Status</TableCell>
              <TableCell align="right">Variants</TableCell>
            </TableRow></TableHead>
            <TableBody>
              {products.isPending ? (
                <TableRow><TableCell colSpan={7}><Box className="catalog-loading"><CircularProgress size={24} />Loading products</Box></TableCell></TableRow>
              ) : products.data?.data.length ? products.data.data.map((product: CatalogProduct) => (
                <TableRow hover key={product.id} onClick={() => navigate(`/catalog/products/${product.id}`)} className="catalog-product-row">
                  <TableCell className="sku-cell">{product.sku}</TableCell>
                  <TableCell><strong>{product.name}</strong><small className="product-subline">{product.barcode || product.upc || product.ean || product.gtin || 'No barcode'}</small></TableCell>
                  <TableCell>{product.category?.name ?? '—'}</TableCell>
                  <TableCell>{product.brand ?? '—'}</TableCell>
                  <TableCell className="capitalize">{product.productType}</TableCell>
                  <TableCell><Chip size="small" label={product.status} color={statusColor(product.status)} variant={product.status === 'active' ? 'filled' : 'outlined'} /></TableCell>
                  <TableCell align="right">{product.variantCount}</TableCell>
                </TableRow>
              )) : (
                <TableRow><TableCell colSpan={7}><Box className="catalog-empty">
                  <Typography variant="h2">{search || status || categoryId ? 'No matching products' : 'Your catalog starts here'}</Typography>
                  <Typography color="text.secondary">{search || status || categoryId ? 'Change the filters or search terms.' : 'Create a product or import a CSV to populate this workspace.'}</Typography>
                  {!search && !status && !categoryId && <Button onClick={() => navigate('/catalog/products/new')} startIcon={<AddOutlinedIcon />}>Create product</Button>}
                </Box></TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TableContainer>
        <TablePagination
          component="div"
          count={products.data?.meta.total ?? 0}
          page={page}
          rowsPerPage={pageSize}
          rowsPerPageOptions={[10, 25, 50, 100]}
          onPageChange={(_, nextPage) => setPage(nextPage)}
          onRowsPerPageChange={(event) => { setPageSize(Number(event.target.value)); setPage(0); }}
        />
      </Paper>
      <Snackbar open={Boolean(notice)} autoHideDuration={4000} message={notice} onClose={() => setNotice('')} />
    </Box>
  );
}
