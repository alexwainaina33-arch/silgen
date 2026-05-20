import { Navigate, useLocation } from 'react-router-dom'
import useAuthStore from '../store/auth.js'

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, isAdmin } = useAuthStore()
  const location = useLocation()

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  if (adminOnly && !isAdmin) {
    return <Navigate to="/" replace />
  }

  return children
}

export function AdminRoute({ children }) {
  return <ProtectedRoute adminOnly>{children}</ProtectedRoute>
}