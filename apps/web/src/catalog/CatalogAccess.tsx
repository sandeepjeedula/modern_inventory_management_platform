import { ReactNode } from 'react';
import { Alert, Box, Button, CircularProgress, Typography } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { useAuth } from 'react-oidc-context';

export function CatalogAccess({ children }: { children: (accessToken: string) => ReactNode }) {
  const auth = useAuth();

  if (auth.isLoading) {
    return <Box className="catalog-state"><CircularProgress size={28} /><Typography>Checking your session</Typography></Box>;
  }

  if (auth.error) {
    return <Alert severity="error" className="catalog-alert">Sign-in failed: {auth.error.message}</Alert>;
  }

  if (!auth.isAuthenticated || !auth.user?.access_token) {
    return (
      <Box className="catalog-locked-state">
        <span className="catalog-lock-icon"><LockOutlinedIcon /></span>
        <Typography variant="h2">Sign in to open the catalog</Typography>
        <Typography color="text.secondary">Catalog data is scoped to your verified workspace and access permissions.</Typography>
        <Button variant="contained" onClick={() => void auth.signinRedirect()}>Sign in</Button>
      </Box>
    );
  }

  return <>{children(auth.user.access_token)}</>;
}
