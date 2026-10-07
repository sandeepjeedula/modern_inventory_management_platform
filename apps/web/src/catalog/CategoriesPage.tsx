import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { zodResolver } from '@hookform/resolvers/zod';
import { Controller, useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  FormControl, InputLabel, MenuItem, Paper, Select, Table, TableBody, TableCell, TableHead, TableRow,
  TextField, Typography,
} from '@mui/material';
import AddOutlinedIcon from '@mui/icons-material/AddOutlined';
import EditOutlinedIcon from '@mui/icons-material/EditOutlined';
import { CategoryNode, catalogApi } from '../api/catalog';

const categorySchema = z.object({
  name: z.string().trim().min(1, 'Name is required').max(160),
  description: z.string().max(300),
  parentId: z.string(),
  status: z.enum(['active', 'inactive']),
});
type CategoryFormValues = z.infer<typeof categorySchema>;
type FlatCategory = { category: CategoryNode; depth: number };

function flatten(categories: CategoryNode[], depth = 0, result: FlatCategory[] = []): FlatCategory[] {
  for (const category of categories) {
    result.push({ category, depth });
    flatten(category.children, depth + 1, result);
  }
  return result;
}

function descendantIds(category: CategoryNode): string[] {
  return [category.id, ...category.children.flatMap(descendantIds)];
}

export function CategoriesPage({ accessToken }: { accessToken: string }) {
  const queryClient = useQueryClient();
  const [editing, setEditing] = useState<CategoryNode | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const categories = useQuery({ queryKey: ['catalog', 'categories', accessToken], queryFn: () => catalogApi.listCategories(accessToken) });
  const form = useForm<CategoryFormValues>({ resolver: zodResolver(categorySchema), defaultValues: { name: '', description: '', parentId: '', status: 'active' } });
  const save = useMutation({
    mutationFn: (values: CategoryFormValues) => editing
      ? catalogApi.updateCategory(accessToken, editing.id, { name: values.name, description: values.description || null, parentId: values.parentId || null, status: values.status })
      : catalogApi.createCategory(accessToken, { name: values.name, description: values.description || undefined, parentId: values.parentId || null }),
    onSuccess: async () => {
      setDialogOpen(false);
      setEditing(null);
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'categories'] });
      await queryClient.invalidateQueries({ queryKey: ['catalog', 'products'] });
    },
  });

  const rows = flatten(categories.data?.data ?? []);
  const excluded = editing ? new Set(descendantIds(editing)) : new Set<string>();
  const parents = rows.filter(({ category }) => category.status === 'active' && !excluded.has(category.id));

  const openNew = () => {
    setEditing(null);
    form.reset({ name: '', description: '', parentId: '', status: 'active' });
    setDialogOpen(true);
  };
  const openEdit = (category: CategoryNode) => {
    setEditing(category);
    form.reset({ name: category.name, description: category.description ?? '', parentId: category.parentId ?? '', status: category.status });
    setDialogOpen(true);
  };
  const submit = form.handleSubmit((values) => save.mutate(values));

  return (
    <Box className="catalog-page">
      <Box className="catalog-page-heading">
        <Box><Typography variant="overline" className="eyebrow">CATALOG / CLASSIFICATION</Typography><Typography variant="h1" className="page-title">Categories</Typography><Typography color="text.secondary">Organize products into tenant-specific category trees.</Typography></Box>
        <Button variant="contained" startIcon={<AddOutlinedIcon />} onClick={openNew}>New category</Button>
      </Box>
      {categories.isError && <Alert severity="error" sx={{ mb: 2 }}>{categories.error.message}</Alert>}
      {save.isError && <Alert severity="error" sx={{ mb: 2 }}>{save.error.message}</Alert>}
      <Paper variant="outlined" className="catalog-table-panel">
        <Table aria-label="Product categories" size="small">
          <TableHead><TableRow><TableCell>Category</TableCell><TableCell>Description</TableCell><TableCell>Status</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
          <TableBody>
            {categories.isPending ? <TableRow><TableCell colSpan={4}><Box className="catalog-loading"><CircularProgress size={24} />Loading categories</Box></TableCell></TableRow>
              : rows.length ? rows.map(({ category, depth }) => (
                <TableRow key={category.id}>
                  <TableCell><span className="category-tree-name" style={{ paddingInlineStart: `${depth * 22}px` }}>{depth > 0 && <span className="tree-branch">↳</span>}{category.name}</span></TableCell>
                  <TableCell>{category.description || '—'}</TableCell>
                  <TableCell><Chip size="small" label={category.status} color={category.status === 'active' ? 'success' : 'default'} variant="outlined" /></TableCell>
                  <TableCell align="right"><Button aria-label={`Edit ${category.name}`} size="small" startIcon={<EditOutlinedIcon />} onClick={() => openEdit(category)}>Edit</Button></TableCell>
                </TableRow>
              )) : <TableRow><TableCell colSpan={4}><Box className="catalog-empty"><Typography variant="h2">No categories yet</Typography><Typography color="text.secondary">Create a category to organize products.</Typography><Button onClick={openNew} startIcon={<AddOutlinedIcon />}>Create category</Button></Box></TableCell></TableRow>}
          </TableBody>
        </Table>
      </Paper>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} fullWidth maxWidth="sm">
        <Box component="form" onSubmit={submit} noValidate>
          <DialogTitle>{editing ? 'Edit category' : 'New category'}</DialogTitle>
          <DialogContent className="category-dialog-content">
            <TextField autoFocus label="Name" required {...form.register('name')} error={Boolean(form.formState.errors.name)} helperText={form.formState.errors.name?.message} />
            <TextField label="Description" multiline minRows={2} {...form.register('description')} />
            <Controller control={form.control} name="parentId" render={({ field }) => <FormControl fullWidth>
              <InputLabel id="category-parent-label">Parent category</InputLabel>
              <Select labelId="category-parent-label" label="Parent category" {...field}>
                <MenuItem value="">No parent</MenuItem>
                {parents.map(({ category, depth }) => <MenuItem key={category.id} value={category.id}>{'\u00a0'.repeat(depth * 3)}{category.name}</MenuItem>)}
              </Select>
            </FormControl>} />
            {editing && <Controller control={form.control} name="status" render={({ field }) => <TextField select label="Status" {...field}><MenuItem value="active">Active</MenuItem><MenuItem value="inactive">Inactive</MenuItem></TextField>} />}
          </DialogContent>
          <DialogActions><Button onClick={() => setDialogOpen(false)}>Cancel</Button><Button type="submit" variant="contained" disabled={save.isPending}>{save.isPending ? 'Saving' : 'Save category'}</Button></DialogActions>
        </Box>
      </Dialog>
    </Box>
  );
}
