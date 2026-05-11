import { Outlet } from 'react-router-dom';
import Sidebar from '../components/Sidebar';
import ThemeToggle from '../components/ThemeToggle';

function DashboardLayout() {
  return (
    <div className="dashboard-shell">
      <Sidebar />
      <main className="dashboard-main">
        <div className="dashboard-header">
          <ThemeToggle />
        </div>
        <Outlet />
      </main>
    </div>
  );
}

export default DashboardLayout;
