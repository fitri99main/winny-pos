import { Suspense } from "react";
import { Routes, Route, Navigate, useLocation } from "react-router-dom";
import Home from "./components/home";
import LoginPage from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import { KioskView } from "./components/kiosk/KioskView";
import { ESSView } from "./components/attendance/ESSView";
import { ErrorBoundary } from "./components/ErrorBoundary";

// Protected Route Wrapper
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-gray-50">
        <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<p>Loading...</p>}>
        <Routes>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/kiosk" element={
            <ErrorBoundary>
              <KioskView />
            </ErrorBoundary>
          } />
          <Route path="/ess" element={<ESSView />} />
          <Route
            path="/"
            element={
              <ProtectedRoute>
                <Home />
              </ProtectedRoute>
            }
          />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}

export default App;
