import { render, screen } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MemoryRouter } from 'react-router-dom';
import { describe, expect, it, vi } from 'vitest';
import App from './App';

vi.mock('react-oidc-context', () => ({
  useAuth: () => ({ isAuthenticated: false, isLoading: false, signinRedirect: vi.fn(), signoutRedirect: vi.fn() }),
}));

vi.mock('./api/contracts', () => ({
  getServiceHealth: vi.fn().mockResolvedValue({
    status: 'ok',
    dependencies: { postgres: 'ok', redis: 'ok' },
  }),
}));

describe('application shell', () => {
  it('shows honest empty dashboard states and workspace navigation', async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={client}>
        <MemoryRouter><App /></MemoryRouter>
      </QueryClientProvider>,
    );

    expect(screen.getByRole('heading', { name: 'Good morning.' })).toBeInTheDocument();
    expect(screen.getAllByText('Tenant catalog')).toHaveLength(2);
    expect(screen.getAllByText('Inventory module pending')).toHaveLength(3);
    expect(screen.getByText('No transactions yet')).toBeInTheDocument();
    expect(screen.getByRole('navigation', { name: 'Main navigation' })).toBeInTheDocument();
    expect(await screen.findByText('Systems operational')).toBeInTheDocument();
  });
});
