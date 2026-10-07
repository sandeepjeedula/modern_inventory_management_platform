import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Breadcrumbs, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Divider, Paper, Snackbar, Typography,
} from '@mui/material';
import ArchiveOutlinedIcon from '@mui/icons-material/ArchiveOutlined';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import RestoreOutlinedIcon from '@mui/icons-material/RestoreOutlined';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { catalogApi } from '../api/catalog';
import { ProductImageManager } from './ProductImageManager';
import { VariantsPanel } from './VariantsPanel';

function Field({ label, value }: { label: string; value: string | number | null | undefined }) {
  return <Box className="product-detail-field"><Typography variant="caption">{label}</Typography><Typography>{value === null || value === undefined || value === '' ? '—' : value}</Typography></Box>;
}

export function ProductDetailsPage({ accessToken }: { accessToken: string }) {
  const { id = '' } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [confirmArchive, setConfirmArchive] = useState(false);
  const [notice, setNotice] = useState('');
  const product = useQuery({ queryKey: ['catalog', 'product', accessToken, id], queryFn: () => catalogApi.getProduct(accessToken, id), enabled: Boolean(id) });
  const changeStatus = useMutation({
    mutationFn: (archived: boolean) => archived ? catalogApi.archiveProduct(accessToken, id) : catalogApi.restoreProduct(accessToken, id),
    onSuccess: async (saved) => {
      setConfirmArchive(false);
      setNotice(saved.status === 'archived' ? 'Product archived' : 'Product restored');
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'product', accessToken, id] });
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
    },
  });

  if (product.isPending) return <Box className="catalog-state"><CircularProgress size={26} />Loading product</Box>;
  if (product.isError) return <Box className="catalog-page"><Alert severity="error">{product.error.message}</Alert><Button onClick={() => navigate('/catalog/products')}>Back to products</Button></Box>;
  const item = product.data;
  const archived = item.status === 'archived';

  return (
    <Box className="catalog-page">
      <Breadcrumbs className="catalog-breadcrumbs"><Link to="/catalog/products">Products</Link><Typography>{item.name}</Typography></Breadcrumbs>
      <Box className="catalog-page-heading product-detail-heading">
        <Box><Typography variant="overline" className="eyebrow">PRODUCT / {item.sku}</Typography><Typography variant="h1" className="page-title">{item.name}</Typography>
          <Box className="product-detail-badges"><Chip size="small" label={item.status} color={item.status === 'active' ? 'success' : item.status === 'draft' ? 'warning' : 'default'} variant={item.status === 'active' ? 'filled' : 'outlined'} /><span>{item.productType}</span>{item.brand && <span>{item.brand}</span>}</Box>
        </Box>
        <Box className="catalog-actions">
          <Button startIcon={<ArrowBackOutlinedIcon />} onClick={() => navigate('/catalog/products')}>Products</Button>
          {!archived && <Button variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/catalog/products/${item.id}/edit`)}>Edit product</Button>}
          <Button color={archived ? 'primary' : 'error'} variant={archived ? 'contained' : 'outlined'} startIcon={archived ? <RestoreOutlinedIcon /> : <ArchiveOutlinedIcon />} onClick={() => archived ? changeStatus.mutate(false) : setConfirmArchive(true)} disabled={changeStatus.isPending}>
            {archived ? 'Restore' : 'Archive'}
          </Button>
        </Box>
      </Box>
      {changeStatus.isError && <Alert severity="error" sx={{ mb: 2 }}>{changeStatus.error.message}</Alert>}

      <Paper variant="outlined" className="detail-section product-overview-section">
        <Box className="detail-section-heading"><Box><Typography variant="h2">Product information</Typography><Typography color="text.secondary">Catalog attributes and inventory tracking rules.</Typography></Box></Box>
        <Divider />
        <Box className="product-detail-grid">
          <Field label="SKU" value={item.sku} /><Field label="Category" value={item.category?.name} /><Field label="Unit of measure" value={item.unitOfMeasure} />
          <Field label="Barcode" value={item.barcode} /><Field label="UPC" value={item.upc} /><Field label="EAN" value={item.ean} /><Field label="GTIN" value={item.gtin} />
          <Field label="Weight" value={item.weight ? `${item.weight}` : null} />
          <Field label="Dimensions" value={item.dimensions ? [item.dimensions.length, item.dimensions.width, item.dimensions.height].filter((value) => value !== undefined).join(' × ') + (item.dimensions.unit ? ` ${item.dimensions.unit}` : '') : null} />
          <Field label="Tax code" value={item.taxInformation?.code} /><Field label="Tax rate" value={item.taxInformation?.rate == null ? null : `${item.taxInformation.rate}%`} />
          <Field label="Batch tracking" value={item.trackBatch ? 'Enabled' : 'Disabled'} /><Field label="Serial tracking" value={item.trackSerialNumber ? 'Enabled' : 'Disabled'} /><Field label="Expiry tracking" value={item.trackExpiry ? 'Enabled' : 'Disabled'} />
          <Field label="Created" value={new Date(item.createdAt).toLocaleDateString()} /><Field label="Last updated" value={new Date(item.updatedAt).toLocaleDateString()} />
        </Box>
        {item.description && <Box className="product-description"><Typography variant="caption">Description</Typography><Typography>{item.description}</Typography></Box>}
      </Paper>

      <ProductImageManager accessToken={accessToken} productId={item.id} disabled={archived} />
      <VariantsPanel accessToken={accessToken} productId={item.id} variants={item.variants} disabled={archived} />

      <Dialog open={confirmArchive} onClose={() => setConfirmArchive(false)}>
        <DialogTitle>Archive {item.name}?</DialogTitle>
        <DialogContent><Typography color="text.secondary">The product will remain in the catalog history and can be restored later. It will no longer appear in the default product list.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setConfirmArchive(false)}>Cancel</Button><Button color="error" variant="contained" onClick={() => changeStatus.mutate(true)} disabled={changeStatus.isPending}>Archive product</Button></DialogActions>
      </Dialog>
      <Snackbar open={Boolean(notice)} autoHideDuration={3500} message={notice} onClose={() => setNotice('')} />
    </Box>
  );
}
