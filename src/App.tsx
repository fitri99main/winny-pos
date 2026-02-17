import { Suspense, useEffect } from "react";
import { Routes, Route, Navigate, useLocation, useNavigate, useSearchParams } from "react-router-dom";
import Home from "./components/home";
import LoginPage from "./components/auth/LoginPage";
import { AuthProvider, useAuth } from "./components/auth/AuthProvider";
import { SessionGuardProvider } from "./components/auth/SessionGuardContext";
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
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const isKioskMode = localStorage.getItem('app_mode') === 'kiosk';

  useEffect(() => {
    if (searchParams.get('setup') === 'kiosk') {
      localStorage.setItem('app_mode', 'kiosk');
      navigate('/kiosk', { replace: true });
    }
  }, [searchParams, navigate]);

  return (
    <ErrorBoundary>
      <AuthProvider>
        <SessionGuardProvider>
          <Suspense fallback={<p>Loading...</p>}>
            <Routes>
              {isKioskMode ? (
                <>
                  <Route path="/kiosk" element={<KioskView />} />
                  <Route path="*" element={<Navigate to="/kiosk" replace />} />
                </>
              ) : (
                <>
                  <Route path="/login" element={<LoginPage />} />
                  <Route path="/kiosk" element={<KioskView />} />
                  <Route path="/ess" element={<ESSView />} />
                  <Route
                    path="/"
                    element={
                      <ProtectedRoute>
                        <Home />
                      </ProtectedRoute>
                    }
                  />
                </>
              )}
            </Routes>
          </Suspense>
        </SessionGuardProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;
