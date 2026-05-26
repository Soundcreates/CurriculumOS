import { useAuth } from "./AuthContext.tsx";
import { Navigate} from "react-router-dom";
import { type ReactNode } from "react";

export function ProtectedRoutes({ children }: { children: ReactNode }) {
    const { isAuthenticated } = useAuth();
    if (!isAuthenticated) return  <Navigate to="/" replace />;

    return (
        <>
            {children}
        </>
    )

}