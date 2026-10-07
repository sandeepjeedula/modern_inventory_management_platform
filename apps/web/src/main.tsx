import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import { BrowserRouter } from 'react-router-dom';
import { AuthProvider } from 'react-oidc-context';
import { WebStorageStateStore } from 'oidc-client-ts';
import App from './App';
import './styles.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const theme = createTheme({
  palette: {
    mode: 'light',
    primary: { main: '#176b58' },
    secondary: { main: '#d07845' },
    background: { default: '#f4f6f3', paper: '#ffffff' },
    text: { primary: '#202c28', secondary: '#6b7772' },
    divider: '#e1e7e3',
  },
  typography: {
    fontFamily: '"DM Sans", "Segoe UI", sans-serif',
    h1: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400 },
    h2: { fontFamily: '"DM Serif Display", Georgia, serif', fontWeight: 400 },
  },
  shape: { borderRadius: 6 },
});

const oidcSettings = {
  authority: import.meta.env.VITE_OIDC_AUTHORITY ?? 'http://localhost:8080/realms/inventory',
  client_id: import.meta.env.VITE_OIDC_CLIENT_ID ?? 'inventory-web',
  redirect_uri: window.location.origin,
  post_logout_redirect_uri: window.location.origin,
  response_type: 'code',
  scope: 'openid profile email',
  automaticSilentRenew: true,
  userStore: new WebStorageStateStore({ store: window.sessionStorage }),
  onSigninCallback: () => window.history.replaceState({}, document.title, window.location.pathname),
};

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <AuthProvider {...oidcSettings}>
        <QueryClientProvider client={queryClient}>
          <BrowserRouter>
            <App />
          </BrowserRouter>
        </QueryClientProvider>
      </AuthProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
