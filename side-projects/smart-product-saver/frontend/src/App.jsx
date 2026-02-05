import { Routes, Route, Navigate } from "react-router-dom";
import { useAuthStore } from "./stores/authStore";
import Layout from "./components/Layout";
import LoginPage from "./components/LoginPage";
import RegisterPage from "./components/RegisterPage";
import ProductList from "./components/ProductList";
import ProductDetail from "./components/ProductDetail";
import CompareView from "./components/CompareView";
import SettingsPage from "./components/SettingsPage";

function ProtectedRoute({ children }) {
  const token = useAuthStore((state) => state.token);
  if (!token) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route index element={<ProductList />} />
        <Route path="collection/:id" element={<ProductList />} />
        <Route path="product/:id" element={<ProductDetail />} />
        <Route path="compare" element={<CompareView />} />
        <Route path="settings" element={<SettingsPage />} />
      </Route>
    </Routes>
  );
}
