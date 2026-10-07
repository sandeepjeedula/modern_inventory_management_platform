import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Resolver, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert, Box, Button, Chip, Dialog, DialogActions, DialogContent, DialogTitle, IconButton, Paper,
  Table, TableBody, TableCell, TableHead, TableRow, TextField, Tooltip, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { ProductVariant, catalogApi } from '../api/catalog';

const attributesSchema = z.string().transform((value, context) => {
  try {
    const parsed: unknown = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) throw new Error();
    if (Object.values(parsed).some((entry) => !['string', 'number', 'boolean'].includes(typeof entry))) throw new Error();
    return parsed as Record<string, string | number | boolean>;
  } catch {
    context.addIssue({ code: z.ZodIssueCode.custom, message: 'Enter a JSON object with text, number, or boolean values' });
    return z.NEVER;
  }
});
const variantSchema = z.object({
  sku: z.string().trim().min(1, 'SKU is required').max(100),
  attributesText: attributesSchema,
  price: z.string().refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), 'Enter a non-negative price'),
  cost: z.string().refine((value) => !value || /^\d+(\.\d{1,2})?$/.test(value), 'Enter a non-negative cost'),
  barcode: z.string().max(100),
});
type VariantFormInput = z.input<typeof variantSchema>;
type VariantFormOutput = z.output<typeof variantSchema>;

export function VariantsPanel({ accessToken, productId, variants, disabled }: {
  accessToken: string;
  productId: string;
  variants: ProductVariant[];
  disabled: boolean;
}) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<ProductVariant | null>(null);
  const [open, setOpen] = useState(false);
  const form = useForm<VariantFormInput, unknown, VariantFormOutput>({
    resolver: zodResolver(variantSchema) as unknown as Resolver<VariantFormInput, unknown, VariantFormOutput>,
    defaultValues: { sku: '', attributesText: '{}', price: '', cost: '', barcode: '' },
  });
  const save = useMutation({
    mutationFn: (values: VariantFormOutput) => {
      const payload = {
        sku: values.sku,
        attributes: values.attributesText,
        price: values.price ? Number(values.price) : null,
        cost: values.cost ? Number(values.cost) : null,
        barcode: values.barcode || null,
      };
      return editing
        ? catalogApi.updateVariant(accessToken, productId, editing.id, payload)
        : catalogApi.createVariant(accessToken, productId, payload);
    },
    onSuccess: async () => {
      setOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'product', accessToken, productId] });
    },
  });
  const openNew = () => {
    setEditing(null);
    form.reset({ sku: '', attributesText: '{}', price: '', cost: '', barcode: '' });
    setOpen(true);
  };
  const openEdit = (variant: ProductVariant) => {
    setEditing(variant);
    form.reset({ sku: variant.sku, attributesText: JSON.stringify(variant.attributes, null, 2), price: variant.price ?? '', cost: variant.cost ?? '', barcode: variant.barcode ?? '' });
    setOpen(true);
  };
  const archive = useMutation({
    mutationFn: (variant: ProductVariant) => catalogApi.updateVariant(accessToken, productId, variant.id, { status: variant.status === 'archived' ? 'active' : 'archived' }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['catalog', 'product', accessToken, productId] }),
  });
  const submit = form.handleSubmit((values) => save.mutate(values));

  return (
    <Paper variant="outlined" className="detail-section">
      <Box className="detail-section-heading"><Box><Typography variant="h2">Variants</Typography><Typography color="text.secondary">SKU-level options, identifiers, and pricing.</Typography></Box>
        <Button variant="outlined" startIcon={<AddOutlinedIcon />} onClick={openNew} disabled={disabled}>Add variant</Button>
      </Box>
      {(save.isError || archive.isError) && <Alert severity="error" sx={{ m: 2 }}>{save.error?.message ?? archive.error?.message}</Alert>}
      {disabled && <Alert severity="info" sx={{ mx: 2, mb: 2 }}>Restore this product before changing its variants.</Alert>}
      {variants.length ? <Table size="small" aria-label="Product variants"><TableHead><TableRow><TableCell>SKU</TableCell><TableCell>Attributes</TableCell><TableCell>Barcode</TableCell><TableCell align="right">Price</TableCell><TableCell align="right">Cost</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
        <TableBody>{variants.map((variant) => <TableRow key={variant.id}>
          <TableCell className="sku-cell">{variant.sku}</TableCell>
          <TableCell><Box className="attribute-chips">{Object.entries(variant.attributes).map(([name, value]) => <Chip key={name} size="small" variant="outlined" label={`${name}: ${value}`} />)}</Box></TableCell>
          <TableCell>{variant.barcode ?? '—'}</TableCell>
          <TableCell align="right">{variant.price == null ? '—' : Number(variant.price).toFixed(2)}</TableCell>
          <TableCell align="right">{variant.cost == null ? '—' : Number(variant.cost).toFixed(2)}</TableCell>
          <TableCell><Chip size="small" label={variant.status} color={variant.status === 'active' ? 'success' : 'default'} variant="outlined" /></TableCell>
          <TableCell align="right"><Tooltip title="Edit variant"><IconButton size="small" aria-label={`Edit ${variant.sku}`} onClick={() => openEdit(variant)} disabled={disabled}><EditOutlinedIcon fontSize="small" /></IconButton></Tooltip><Button size="small" onClick={() => archive.mutate(variant)} disabled={disabled}>{variant.status === 'active' ? 'Archive' : 'Restore'}</Button></TableCell>
        </TableRow>)}</TableBody></Table> : <Box className="detail-empty"><Typography>No variants</Typography><Typography variant="body2" color="text.secondary">Add options such as size or color when this product needs separate SKUs.</Typography></Box>}

      <Dialog open={open} onClose={() => setOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submit} noValidate><DialogTitle>{editing ? 'Edit variant' : 'New variant'}</DialogTitle>
          <DialogContent className="variant-dialog-content">
            {save.isError && <Alert severity="error">{save.error.message}</Alert>}
            <TextField label="Variant SKU" required {...form.register('sku')} error={Boolean(form.formState.errors.sku)} helperText={form.formState.errors.sku?.message} />
            <TextField label="Attributes (JSON)" multiline minRows={4} {...form.register('attributesText')} error={Boolean(form.formState.errors.attributesText)} helperText={form.formState.errors.attributesText?.message as string} />
            <Box className="variant-numbers"><TextField label="Price" inputMode="decimal" {...form.register('price')} error={Boolean(form.formState.errors.price)} /><TextField label="Cost" inputMode="decimal" {...form.register('cost')} error={Boolean(form.formState.errors.cost)} /></Box>
            <TextField label="Barcode" {...form.register('barcode')} />
          </DialogContent>
          <DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving' : 'Save variant'}</Button></DialogActions>
        </Box>
      </Dialog>
    </Paper>
  );
}
