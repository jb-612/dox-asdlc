import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/layout/Layout';
import Dashboard from './pages/Dashboard';
import GatesPage from './pages/GatesPage';
import GateDetailPage from './pages/GateDetailPage';
import WorkersPage from './pages/WorkersPage';
import SessionsPage from './pages/SessionsPage';

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<Dashboard />} />
          <Route path="gates" element={<GatesPage />} />
          <Route path="gates/:gateId" element={<GateDetailPage />} />
          <Route path="workers" element={<WorkersPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
