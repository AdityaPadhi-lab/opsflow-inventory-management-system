import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from './hooks/useAuth';
import { ToastProvider } from './hooks/useToast';
import { ProtectedLayout } from './components/ProtectedLayout';
import { LoginPage } from './pages/LoginPage';
import { OverviewPage } from './pages/OverviewPage';
import { InventoryPage } from './pages/InventoryPage';
import { WorkOrdersPage } from './pages/WorkOrdersPage';
import { TransfersPage } from './pages/TransfersPage';
import { OrdersPage } from './pages/OrdersPage';
const queryClient = new QueryClient({ defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } } });
export function App() { return <QueryClientProvider client={queryClient}><AuthProvider><ToastProvider><BrowserRouter><Routes><Route path="/login" element={<LoginPage />} /><Route element={<ProtectedLayout />}><Route path="/" element={<OverviewPage />} /><Route path="/inventory" element={<InventoryPage />} /><Route path="/work-orders" element={<WorkOrdersPage />} /><Route path="/transfers" element={<TransfersPage />} /><Route path="/orders" element={<OrdersPage />} /></Route><Route path="*" element={<Navigate to="/" replace />} /></Routes></BrowserRouter></ToastProvider></AuthProvider></QueryClientProvider>; }
