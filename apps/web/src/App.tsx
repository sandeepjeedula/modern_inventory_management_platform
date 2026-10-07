import { lazy, Suspense } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Divider, IconButton, Paper, Tooltip, Typography } from '@mui/material';
import Button from '@mui/material/Button';
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined';
import Inventory2OutlinedIcon from '@mui/icons-material/Inventory2Outlined';
import LocalShippingOutlinedIcon from '@mui/icons-material/LocalShippingOutlined';
import NotificationsNoneOutlinedIcon from '@mui/icons-material/NotificationsNoneOutlined';
import CategoryOutlinedIcon from '@mui/icons-material/CategoryOutlined';
import { useAuth } from 'react-oidc-context';
import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { catalogApi } from './api/catalog';
import { getServiceHealth } from './api/contracts';
import { CatalogAccess } from './catalog/CatalogAccess';

const CategoriesPage = lazy(() => import('./catalog/CategoriesPage').then((module) => ({ default: module.CategoriesPage })));
const ProductDetailsPage = lazy(() => import('./catalog/ProductDetailsPage').then((module) => ({ default: module.ProductDetailsPage })));
const ProductFormPage = lazy(() => import('./catalog/ProductFormPage').then((module) => ({ default: module.ProductFormPage })));
const ProductsPage = lazy(() => import('./catalog/ProductsPage').then((module) => ({ default: module.ProductsPage })));

function Dashboard() {
  const auth = useAuth();
  const health = useQuery({ queryKey: ['service-health'], queryFn: getServiceHealth, refetchInterval: 30_000 });
  const token = auth.user?.access_token;
  const catalog = useQuery({
    queryKey: ['catalog', 'summary', token],
    queryFn: () => catalogApi.getSummary(token!),
    enabled: Boolean(auth.isAuthenticated && token),
  });
  const metrics = [
    { label: 'Total SKUs', value: catalog.data?.totalSkus ?? null, icon: <Inventory2OutlinedIcon />, source: 'Tenant catalog' },
    { label: 'Active products', value: catalog.data?.activeProducts ?? null, icon: <CategoryOutlinedIcon />, source: 'Tenant catalog' },
    { label: 'Inventory value', value: null, icon: <span className="metric-symbol">$</span>, source: 'Inventory module pending' },
    { label: 'Low stock', value: null, icon: <span className="metric-symbol warning">!</span>, source: 'Inventory module pending' },
    { label: 'Out of stock', value: null, icon: <span className="metric-symbol muted">0</span>, source: 'Inventory module pending' },
    { label: 'Reserved', value: null, icon: <span className="metric-symbol">↗</span>, source: 'Reservations module pending' },
    { label: 'Incoming', value: null, icon: <LocalShippingOutlinedIcon />, source: 'Purchasing module pending' },
  ];

  return (
    <Box className="page-content">
      <Box className="page-heading">
        <Box>
          <Typography variant="overline" className="eyebrow">OVERVIEW / OPERATIONS</Typography>
          <Typography variant="h1" className="page-title">Good morning.</Typography>
          <Typography color="text.secondary">Your inventory at a glance.</Typography>
        </Box>
        <Box className="connection-status" aria-live="polite">
          <span className={`status-dot ${health.data?.status === 'ok' ? 'online' : ''}`} />
          {health.isPending ? 'Connecting' : health.data?.status === 'ok' ? 'Systems operational' : 'API unavailable'}
        </Box>
      </Box>

      {health.isError && <Alert severity="warning" sx={{ mb: 2 }}>The API is not reachable. Service status will retry automatically.</Alert>}

      <Box className="metrics-grid" aria-label="Inventory summary">
        {metrics.map((metric) => (
          <Paper variant="outlined" className="metric" key={metric.label}>
            <Box className="metric-top"><Typography variant="body2">{metric.label}</Typography><span className="metric-icon">{metric.icon}</span></Box>
            <Typography className="metric-value">{metric.value ?? '—'}</Typography>
            <Typography variant="caption" color="text.secondary">{metric.value === null ? metric.source : 'Tenant catalog'}</Typography>
          </Paper>
        ))}
      </Box>

      <Box className="lower-grid">
        <Paper variant="outlined" className="activity-panel">
          <Box className="panel-heading"><Box><Typography variant="h2">Recent transactions</Typography><Typography variant="body2" color="text.secondary">Latest inventory movements</Typography></Box><Typography className="panel-period">ALL ACTIVITY</Typography></Box>
          <Divider />
          <Box className="empty-state"><Box className="empty-icon"><Inventory2OutlinedIcon /></Box><Typography fontWeight={600}>No transactions yet</Typography><Typography variant="body2" color="text.secondary">Inventory activity will appear here when operations are connected.</Typography></Box>
        </Paper>
        <Paper variant="outlined" className="alerts-panel">
          <Box className="panel-heading"><Box><Typography variant="h2">Inventory alerts</Typography><Typography variant="body2" color="text.secondary">Needs your attention</Typography></Box><NotificationsNoneOutlinedIcon color="action" /></Box>
          <Divider />
          <Box className="empty-state compact"><Typography variant="body2" color="text.secondary">No alert data available.</Typography></Box>
        </Paper>
      </Box>
      <Typography className="system-footnote">{health.data?.dependencies ? `PostgreSQL ${health.data.dependencies.postgres} · Redis ${health.data.dependencies.redis}` : 'Inventory reporting is not configured'}</Typography>
    </Box>
  );
}

export default function App() {
  const auth = useAuth();
  const location = useLocation();
  const pageTitle = location.pathname.startsWith('/catalog/categories') ? 'Categories'
    : location.pathname.includes('/catalog/products/new') ? 'New product'
    : location.pathname.includes('/edit') ? 'Edit product'
    : location.pathname.startsWith('/catalog/products/') ? 'Product details'
    : location.pathname.startsWith('/catalog/products') ? 'Products' : 'Overview';
  return (
    <Box className="app-frame">
      <aside className="sidebar">
        <Box className="brand"><span className="brand-mark">N</span><Box><Typography className="brand-name">NORTHSTAR</Typography><Typography className="brand-caption">INVENTORY PLATFORM</Typography></Box></Box>
        <Typography className="nav-label">WORKSPACE</Typography>
        <nav aria-label="Main navigation">
          <NavLink to="/" end className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><DashboardOutlinedIcon /><span>Overview</span></NavLink>
          <Typography className="nav-label nav-group-label">CATALOG</Typography>
          <NavLink to="/catalog/products" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><Inventory2OutlinedIcon /><span>Products</span></NavLink>
          <NavLink to="/catalog/categories" className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}><CategoryOutlinedIcon /><span>Categories</span></NavLink>
        </nav>
        <Box className="sidebar-bottom"><Divider /><Typography className="tenant-label">ACTIVE WORKSPACE</Typography><button className="tenant-switch" type="button" disabled aria-label="Tenant selection unavailable"><span className="tenant-avatar">W</span><span><strong>Workspace</strong><small>Tenant selection pending</small></span><span className="tenant-chevron">⌄</span></button></Box>
      </aside>
      <Box component="main" className="main-area">
        <header className="topbar"><Typography className="breadcrumb">Workspace <span>/</span> {pageTitle}</Typography><Box className="topbar-actions"><Tooltip title="Notifications"><IconButton aria-label="Notifications" size="small"><NotificationsNoneOutlinedIcon /></IconButton></Tooltip>{auth.isAuthenticated ? <Button size="small" onClick={() => void auth.signoutRedirect()}>{auth.user?.profile.email ?? 'Sign out'}</Button> : <Button size="small" variant="outlined" onClick={() => void auth.signinRedirect()}>Sign in</Button>}</Box></header>
        <Suspense fallback={<Box className="catalog-state">Loading workspace</Box>}>
          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/catalog/products" element={<CatalogAccess>{(accessToken) => <ProductsPage accessToken={accessToken} />}</CatalogAccess>} />
            <Route path="/catalog/products/new" element={<CatalogAccess>{(accessToken) => <ProductFormPage accessToken={accessToken} />}</CatalogAccess>} />
            <Route path="/catalog/products/:id/edit" element={<CatalogAccess>{(accessToken) => <ProductFormPage accessToken={accessToken} />}</CatalogAccess>} />
            <Route path="/catalog/products/:id" element={<CatalogAccess>{(accessToken) => <ProductDetailsPage accessToken={accessToken} />}</CatalogAccess>} />
            <Route path="/catalog/categories" element={<CatalogAccess>{(accessToken) => <CategoriesPage accessToken={accessToken} />}</CatalogAccess>} />
            <Route path="*" element={<Dashboard />} />
          </Routes>
        </Suspense>
      </Box>
    </Box>
  );
}
