export type ServiceHealth = {
  status: 'ok' | 'unavailable';
  dependencies?: {
    postgres: 'ok' | 'unavailable';
    redis: 'ok' | 'unavailable';
  };
};

export type DashboardMetrics = {
  totalSkus: number | null;
  inventoryValue: number | null;
  lowStockProducts: number | null;
  outOfStockProducts: number | null;
  reservedInventory: number | null;
  incomingInventory: number | null;
};

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000/api';

export async function getServiceHealth(): Promise<ServiceHealth> {
  const response = await fetch(`${apiBaseUrl}/health/ready`);
  if (!response.ok) throw new Error('API readiness check failed');
  return response.json() as Promise<ServiceHealth>;
}
