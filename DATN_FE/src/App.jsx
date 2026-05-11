import { Navigate, Route, Routes } from 'react-router-dom';
import ProtectedRoute from './components/ProtectedRoute';
import { useAuth } from './context/AuthContext';
import DashboardLayout from './pages/DashboardLayout';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import MapPage from './pages/MapPage';
import AnalysisPage from './pages/AnalysisPage';
import SavedPlacesPage from './pages/SavedPlacesPage';
import NewsPage from './pages/NewsPage';
import ProfilePage from './pages/ProfilePage';

function App() {
  const { bootstrapping } = useAuth();

  if (bootstrapping) {
    return <div className="boot-screen">Đang kết nối backend...</div>;
  }

  return (
    <Routes>
      <Route path="/" element={<Navigate to="/app/map" replace />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route
        path="/app"
        element={(
          <ProtectedRoute>
            <DashboardLayout />
          </ProtectedRoute>
        )}
      >
        <Route index element={<Navigate to="map" replace />} />
        <Route path="map" element={<MapPage />} />
        <Route path="analysis" element={<AnalysisPage />} />
        <Route path="saved-places" element={<SavedPlacesPage />} />
        <Route path="news" element={<NewsPage />} />
        <Route path="profile" element={<ProfilePage />} />
      </Route>
      <Route path="*" element={<Navigate to="/app/map" replace />} />
    </Routes>
  );
}

export default App;
