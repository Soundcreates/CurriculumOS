import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "./AuthContext";

export function PublicOnlyRoutes() {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return null;
  if (isAuthenticated) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}

