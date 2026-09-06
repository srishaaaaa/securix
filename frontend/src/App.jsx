import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import Navbar from "./components/Navbar";
import { ProtectedRoute } from "./components/ProtectedRoute";

import Landing from "./pages/Landing";
import Login from "./pages/Login";
import Register from "./pages/Register";
import KycFlow from "./pages/KycFlow";
import Dashboard from "./pages/Dashboard";
import AdminDashboard from "./pages/AdminDashboard";
import VerificationProgress from "./pages/VerificationProgress";
import FraudNetwork from "./pages/FraudNetwork";

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <div className="min-h-screen bg-void-900 font-body text-ink-100">
          <Navbar />
          <main>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/login" element={<Login />} />
              <Route path="/register" element={<Register />} />
              <Route
                path="/verify"
                element={
                  <ProtectedRoute>
                    <KycFlow />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute adminOnly>
                    <AdminDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/verification-progress/:id"
                element={
                  <ProtectedRoute>
                    <VerificationProgress />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/fraud-network/:id"
                element={
                  <ProtectedRoute adminOnly>
                    <FraudNetwork />
                  </ProtectedRoute>
                }
              />
            </Routes>
          </main>
        </div>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
