import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';

interface ProtectedRouteProps {
  children: React.ReactElement;
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children }) => {
  const token = localStorage.getItem('sb_access_token');
  const location = useLocation();

  if (!token) {
    // 未登录时重定向到登录页，并记录原本想访问的 location
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return children;
};
