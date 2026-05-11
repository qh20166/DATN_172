import { NavLink, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function Sidebar() {
  const { currentUser, logout } = useAuth();

  return (
    <aside className="sidebar">
      <div className="brand">
        <h1>Traffic Insight</h1>
        <p>TP.HCM Smart Mobility</p>
      </div>

      <nav className="menu">
        <NavLink to="/app/map" className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}>
          Xem bản đồ
        </NavLink>
        <NavLink
          to="/app/analysis"
          className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
        >
          Hỗ trợ quyết định
        </NavLink>
        <NavLink
          to="/app/saved-places"
          className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
        >
          Vị trí đã lưu
        </NavLink>
        <NavLink
          to="/app/news"
          className={({ isActive }) => `menu-link${isActive ? ' active' : ''}`}
        >
          Tin tức VnExpress
        </NavLink>
      </nav>

      <div className="user-card">
        <p className="user-name">{currentUser?.fullName}</p>
        <p className="user-email">{currentUser?.email}</p>
        <div style={{ display: 'flex', gap: 8, flexDirection: 'column' }}>
          <Link to="/app/profile" className="btn-secondary" style={{ textAlign: 'center', textDecoration: 'none', padding: '8px 12px' }}>
            ⚙️ Cài đặt
          </Link>
          <button type="button" className="btn-secondary" onClick={logout}>
            Đăng xuất
          </button>
        </div>
      </div>
    </aside>
  );
}

export default Sidebar;
