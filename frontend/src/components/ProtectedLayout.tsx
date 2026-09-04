import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { AppLayout } from '../layouts/AppLayout';
export function ProtectedLayout() { const { token } = useAuth(); return token ? <AppLayout><Outlet /></AppLayout> : <Navigate to="/login" replace />; }
