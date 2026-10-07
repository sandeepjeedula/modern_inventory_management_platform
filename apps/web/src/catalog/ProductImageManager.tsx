import { ChangeEvent, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper, TextField, Tooltip, Typography,
} from '@mui/material';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import StarOutlineIcon from '@mui/icons-material/StarOutline';
import StarIcon from '@mui/icons-material/Star';
import ArrowBackOutlinedIcon from '@mui/icons-material/ArrowBackOutlined';
import ArrowForwardOutlinedIcon from '@mui/icons-material/ArrowForwardOutlined';
import { ProductImage, catalogApi } from '../api/catalog';

export function ProductImageManager({ accessToken, productId, disabled }: { accessToken: string; productId: string; disabled: boolean }) {
  const queryClient = useQueryClient();
  const input = useRef<HTMLInputElement>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<ProductImage | null>(null);
  const images = useQuery({
    queryKey: ['catalog', 'images', accessToken, productId],
    queryFn: () => catalogApi.listImages(accessToken, productId),
    refetchInterval: 240_000,
  });
  const invalidate = () => queryClient.invalidateQueries({ queryKey: ['catalog', 'images', accessToken, productId] });
  const upload = useMutation({ mutationFn: (file: File) => catalogApi.uploadImage(accessToken, productId, file), onSuccess: invalidate });
  const update = useMutation({ mutationFn: (variables: { id: string; input: { isPrimary?: boolean; sortOrder?: number; altText?: string } }) => catalogApi.updateImage(accessToken, productId, variables.id, variables.input), onSuccess: invalidate });
  const remove = useMutation({ mutationFn: (id: string) => catalogApi.deleteImage(accessToken, productId, id), onSuccess: invalidate });
  const reorder = useMutation({ mutationFn: (imageIds: string[]) => catalogApi.reorderImages(accessToken, productId, imageIds), onSuccess: invalidate });
  const onFile = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      setErrorMessage('');
      upload.mutate(file, { onError: (error) => setErrorMessage(error.message) });
    }
    event.target.value = '';
  };
  const items = images.data?.data ?? [];

  return (
    <Paper variant="outlined" className="detail-section">
      <Box className="detail-section-heading"><Box><Typography variant="h2">Product images</Typography><Typography color="text.secondary">Images are stored in the configured object store.</Typography></Box>
        <input ref={input} hidden type="file" accept="image/jpeg,image/png,image/gif,image/webp" onChange={onFile} />
        <Button variant="outlined" startIcon={<AddPhotoAlternateOutlinedIcon />} onClick={() => input.current?.click()} disabled={disabled || upload.isPending}>{upload.isPending ? 'Uploading' : 'Add image'}</Button>
      </Box>
      {(errorMessage || images.isError) && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{errorMessage || images.error?.message}</Alert>}
      {disabled && <Alert severity="info" sx={{ mx: 2, mb: 2 }}>Restore this product before changing its images.</Alert>}
      {images.isPending ? <Box className="catalog-loading"><CircularProgress size={22} />Loading images</Box>
        : items.length ? <Box className="product-image-grid">{items.map((image: ProductImage & { url: string }) => (
          <Box className="product-image-item" key={image.id}>
            <img src={image.url} alt={image.altText || image.originalName} />
            <Box className="product-image-meta"><span title={image.originalName}>{image.originalName}</span>{image.isPrimary && <small>Primary</small>}</Box>
            <TextField size="small" fullWidth placeholder="Alt text" defaultValue={image.altText ?? ''} onBlur={(event) => {
              if (event.target.value !== (image.altText ?? '')) update.mutate({ id: image.id, input: { altText: event.target.value } });
            }} inputProps={{ 'aria-label': `Alt text for ${image.originalName}` }} />
            <Box className="product-image-controls">
              <Tooltip title="Move earlier"><span><IconButton size="small" aria-label={`Move ${image.originalName} earlier`} disabled={disabled || reorder.isPending || items.indexOf(image) === 0} onClick={() => {
                const next = items.map((item) => item.id);
                const index = next.indexOf(image.id);
                [next[index - 1], next[index]] = [next[index], next[index - 1]];
                reorder.mutate(next);
              }}><ArrowBackOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title="Move later"><span><IconButton size="small" aria-label={`Move ${image.originalName} later`} disabled={disabled || reorder.isPending || items.indexOf(image) === items.length - 1} onClick={() => {
                const next = items.map((item) => item.id);
                const index = next.indexOf(image.id);
                [next[index + 1], next[index]] = [next[index], next[index + 1]];
                reorder.mutate(next);
              }}><ArrowForwardOutlinedIcon fontSize="small" /></IconButton></span></Tooltip>
              <Tooltip title={image.isPrimary ? 'Primary image' : 'Set as primary'}><span><IconButton size="small" aria-label={`Set ${image.originalName} as primary`} onClick={() => update.mutate({ id: image.id, input: { isPrimary: true } })} disabled={disabled || image.isPrimary}><>{image.isPrimary ? <StarIcon fontSize="small" /> : <StarOutlineIcon fontSize="small" />}</></IconButton></span></Tooltip>
              <Tooltip title="Delete image"><span><IconButton size="small" aria-label={`Delete ${image.originalName}`} onClick={() => setDeleteTarget(image)} disabled={disabled}><DeleteOutlineIcon fontSize="small" /></IconButton></span></Tooltip>
            </Box>
          </Box>
        ))}</Box> : <Box className="detail-empty"><Typography>No product images</Typography><Typography variant="body2" color="text.secondary">Add a product image to make this catalog record easier to recognize.</Typography></Box>}
      {(update.isError || remove.isError || reorder.isError) && <Alert severity="error" sx={{ mx: 2, mb: 2 }}>{update.error?.message ?? remove.error?.message ?? reorder.error?.message}</Alert>}
      <Dialog open={Boolean(deleteTarget)} onClose={() => setDeleteTarget(null)}>
        <DialogTitle>Remove product image?</DialogTitle>
        <DialogContent><Typography color="text.secondary">{deleteTarget?.originalName} will be removed from this product.</Typography></DialogContent>
        <DialogActions><Button onClick={() => setDeleteTarget(null)}>Cancel</Button><Button color="error" variant="contained" disabled={remove.isPending} onClick={() => {
          if (deleteTarget) remove.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
        }}>Remove image</Button></DialogActions>
      </Dialog>
    </Paper>
  );
}
