import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert, Box, Breadcrumbs, Button, CircularProgress, FormControlLabel, MenuItem, Paper, Switch, TextField, Typography,
} from '@mui/material';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { CatalogProduct, CategoryNode, ProductInput, catalogApi } from '../api/catalog';
import { CatalogApiError } from '../api/catalog';

const decimalField = z.string().refine((value) => value === '' || /^\d+(\.\d{1,4})?$/.test(value), 'Enter a non-negative number');
const productFormSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  name: z.string().trim().min(1, 'Product name is required').max(200),
  description: z.string().max(10000),
  categoryId: z.string(),
  brand: z.string().max(120),
  productType: z.enum(['physical', 'digital', 'service', 'bundle']),
  status: z.enum(['active', 'draft']),
  barcode: z.string().max(100),
  upc: z.string().refine((value) => value === '' || /^(?:\d{8}|\d{12})$/.test(value), 'UPC must be 8 or 12 digits'),
  ean: z.string().refine((value) => value === '' || /^(?:\d{8}|\d{13})$/.test(value), 'EAN must be 8 or 13 digits'),
  gtin: z.string().refine((value) => value === '' || /^(?:\d{8}|\d{12}|\d{13}|\d{14})$/.test(value), 'GTIN must be 8, 12, 13, or 14 digits'),
  unitOfMeasure: z.string().trim().min(1).max(30),
  weight: decimalField,
  length: decimalField,
  width: decimalField,
  height: decimalField,
  dimensionUnit: z.string().max(20),
  taxCode: z.string().max(80),
  taxRate: z.string().refine((value) => value === '' || (/^\d+(\.\d{1,4})?$/.test(value) && Number(value) <= 100), 'Tax rate must be from 0 to 100'),
  taxInclusive: z.boolean(),
  trackBatch: z.boolean(),
  trackSerialNumber: z.boolean(),
  trackExpiry: z.boolean(),
});

type ProductFormValues = z.infer<typeof productFormSchema>;

const emptyValues: ProductFormValues = {
  sku: '', name: '', description: '', categoryId: '', brand: '', productType: 'physical', status: 'draft',
  barcode: '', upc: '', ean: '', gtin: '', unitOfMeasure: 'each', weight: '', length: '', width: '', height: '',
  dimensionUnit: 'cm', taxCode: '', taxRate: '', taxInclusive: false, trackBatch: false, trackSerialNumber: false, trackExpiry: false,
};

function flattenCategories(categories: CategoryNode[], depth = 0): Array<{ id: string; name: string; depth: number; status: string }> {
  return categories.flatMap((category) => [
    { id: category.id, name: category.name, depth, status: category.status },
    ...flattenCategories(category.children, depth + 1),
  ]);
}

function formValues(product?: CatalogProduct): ProductFormValues {
  if (!product) return emptyValues;
  return {
    sku: product.sku,
    name: product.name,
    description: product.description ?? '',
    categoryId: product.categoryId ?? '',
    brand: product.brand ?? '',
    productType: product.productType,
    status: product.status === 'archived' ? 'draft' : product.status,
    barcode: product.barcode ?? '',
    upc: product.upc ?? '',
    ean: product.ean ?? '',
    gtin: product.gtin ?? '',
    unitOfMeasure: product.unitOfMeasure,
    weight: product.weight ?? '',
    length: product.dimensions?.length?.toString() ?? '',
    width: product.dimensions?.width?.toString() ?? '',
    height: product.dimensions?.height?.toString() ?? '',
    dimensionUnit: product.dimensions?.unit ?? 'cm',
    taxCode: product.taxInformation?.code ?? '',
    taxRate: product.taxInformation?.rate?.toString() ?? '',
    taxInclusive: product.taxInformation?.inclusive ?? false,
    trackBatch: product.trackBatch,
    trackSerialNumber: product.trackSerialNumber,
    trackExpiry: product.trackExpiry,
  };
}

function toProductInput(values: ProductFormValues): ProductInput {
  const dimensions = [values.length, values.width, values.height].some(Boolean)
    ? {
        ...(values.length ? { length: Number(values.length) } : {}),
        ...(values.width ? { width: Number(values.width) } : {}),
        ...(values.height ? { height: Number(values.height) } : {}),
        unit: values.dimensionUnit || 'cm',
      }
    : null;
  const taxInformation = values.taxCode || values.taxRate
    ? { ...(values.taxCode ? { code: values.taxCode } : {}), ...(values.taxRate ? { rate: Number(values.taxRate) } : {}), inclusive: values.taxInclusive }
    : null;
  return {
    sku: values.sku,
    name: values.name,
    description: values.description || null,
    categoryId: values.categoryId || null,
    brand: values.brand || null,
    productType: values.productType,
    status: values.status,
    barcode: values.barcode || null,
    upc: values.upc || null,
    ean: values.ean || null,
    gtin: values.gtin || null,
    unitOfMeasure: values.unitOfMeasure,
    weight: values.weight ? Number(values.weight) : null,
    dimensions,
    taxInformation,
    trackBatch: values.trackBatch,
    trackSerialNumber: values.trackSerialNumber,
    trackExpiry: values.trackExpiry,
  };
}

export function ProductFormPage({ accessToken }: { accessToken: string }) {
  const { id } = useParams();
  const product = useQuery({ queryKey: ['catalog', 'product', accessToken, id], queryFn: () => catalogApi.getProduct(accessToken, id!), enabled: Boolean(id) });
  if (id && product.isPending) return <Box className="catalog-state"><CircularProgress size={26} />Loading product</Box>;
  if (id && product.isError) return <Alert severity="error" className="catalog-alert">{product.error.message}</Alert>;
  return <ProductEditor key={id ?? 'new'} accessToken={accessToken} product={product.data} />;
}

function ProductEditor({ accessToken, product }: { accessToken: string; product?: CatalogProduct }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const categories = useQuery({ queryKey: ['catalog', 'categories', accessToken], queryFn: () => catalogApi.listCategories(accessToken) });
  const form = useForm<ProductFormValues>({ resolver: zodResolver(productFormSchema), defaultValues: formValues(product) });
  const save = useMutation({
    mutationFn: (input: ProductInput) => product
      ? catalogApi.updateProduct(accessToken, product.id, input)
      : catalogApi.createProduct(accessToken, input),
    onSuccess: async (saved) => {
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'product', accessToken, saved.id] });
      navigate(`/catalog/products/${saved.id}`);
    },
  });
  const choices = flattenCategories(categories.data?.data ?? []).filter((category) => category.status === 'active');
  const submit = form.handleSubmit((values) => save.mutate(toProductInput(values)));
  const apiError = save.error instanceof CatalogApiError ? save.error.message : save.error?.message;

  return (
    <Box className="catalog-page">
      <Breadcrumbs className="catalog-breadcrumbs"><Link to="/catalog/products">Products</Link><Typography>{product ? 'Edit product' : 'New product'}</Typography></Breadcrumbs>
      <Box className="catalog-page-heading form-heading">
        <Box><Typography variant="overline" className="eyebrow">CATALOG / PRODUCT</Typography><Typography variant="h1" className="page-title">{product ? 'Edit product' : 'New product'}</Typography></Box>
        <Box className="catalog-actions">
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate(product ? `/catalog/products/${product.id}` : '/catalog/products')}>Cancel</Button>
          <Button variant="contained" startIcon={<SaveOutlinedIcon />} onClick={() => void submit()} disabled={save.isPending}>{save.isPending ? 'Saving' : 'Save product'}</Button>
        </Box>
      </Box>
      {apiError && <Alert severity="error" sx={{ mb: 2 }}>{apiError}</Alert>}
      <Box component="form" onSubmit={submit} className="product-form-layout" noValidate>
        <Paper variant="outlined" className="product-form-section">
          <Typography variant="h2">Product identity</Typography>
          <Typography color="text.secondary" className="section-description">Core catalog details and classification.</Typography>
          <Box className="product-form-grid">
            <TextField label="SKU" required {...form.register('sku')} error={Boolean(form.formState.errors.sku)} helperText={form.formState.errors.sku?.message} />
            <TextField label="Product name" required {...form.register('name')} error={Boolean(form.formState.errors.name)} helperText={form.formState.errors.name?.message} />
            <Controller control={form.control} name="productType" render={({ field }) => <TextField select label="Product type" {...field}>
              <MenuItem value="physical">Physical</MenuItem><MenuItem value="digital">Digital</MenuItem><MenuItem value="service">Service</MenuItem><MenuItem value="bundle">Bundle</MenuItem>
            </TextField>} />
            <Controller control={form.control} name="status" render={({ field }) => <TextField select label="Status" {...field}><MenuItem value="draft">Draft</MenuItem><MenuItem value="active">Active</MenuItem></TextField>} />
            <Controller control={form.control} name="categoryId" render={({ field }) => <TextField select label="Category" {...field}>
              <MenuItem value="">Uncategorized</MenuItem>
              {choices.map((category) => <MenuItem key={category.id} value={category.id}>{'\u00a0'.repeat(category.depth * 3)}{category.name}</MenuItem>)}
            </TextField>} />
            <TextField label="Brand" {...form.register('brand')} />
            <TextField label="Unit of measure" required {...form.register('unitOfMeasure')} error={Boolean(form.formState.errors.unitOfMeasure)} helperText={form.formState.errors.unitOfMeasure?.message} />
            <TextField label="Weight" inputMode="decimal" {...form.register('weight')} error={Boolean(form.formState.errors.weight)} helperText={form.formState.errors.weight?.message} />
            <TextField label="Barcode" {...form.register('barcode')} />
            <TextField label="UPC" {...form.register('upc')} error={Boolean(form.formState.errors.upc)} helperText={form.formState.errors.upc?.message} />
            <TextField label="EAN" {...form.register('ean')} error={Boolean(form.formState.errors.ean)} helperText={form.formState.errors.ean?.message} />
            <TextField label="GTIN" {...form.register('gtin')} error={Boolean(form.formState.errors.gtin)} helperText={form.formState.errors.gtin?.message} />
            <TextField label="Description" multiline minRows={3} className="form-wide" {...form.register('description')} />
          </Box>
        </Paper>

        <Paper variant="outlined" className="product-form-section">
          <Typography variant="h2">Measurements and tax</Typography>
          <Typography color="text.secondary" className="section-description">Optional product dimensions and tax defaults.</Typography>
          <Box className="product-form-grid dimensions-grid">
            <TextField label="Length" inputMode="decimal" {...form.register('length')} error={Boolean(form.formState.errors.length)} />
            <TextField label="Width" inputMode="decimal" {...form.register('width')} error={Boolean(form.formState.errors.width)} />
            <TextField label="Height" inputMode="decimal" {...form.register('height')} error={Boolean(form.formState.errors.height)} />
            <TextField label="Dimension unit" {...form.register('dimensionUnit')} />
            <TextField label="Tax code" {...form.register('taxCode')} />
            <TextField label="Tax rate (%)" inputMode="decimal" {...form.register('taxRate')} error={Boolean(form.formState.errors.taxRate)} helperText={form.formState.errors.taxRate?.message} />
            <Controller control={form.control} name="taxInclusive" render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Tax inclusive" />} />
          </Box>
        </Paper>

        <Paper variant="outlined" className="product-form-section tracking-section">
          <Box><Typography variant="h2">Tracking requirements</Typography><Typography color="text.secondary" className="section-description">Inventory tracking behavior for this product.</Typography></Box>
          <Box className="tracking-options">
            <Controller control={form.control} name="trackBatch" render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Track batches" />} />
            <Controller control={form.control} name="trackSerialNumber" render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Track serial numbers" />} />
            <Controller control={form.control} name="trackExpiry" render={({ field }) => <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label="Track expiry dates" />} />
          </Box>
          {categories.isError && <Alert severity="warning">Categories could not be loaded. Products can still be saved without a category.</Alert>}
        </Paper>
      </Box>
    </Box>
  );
}
