import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { changePasswordRequest, patchProfileRequest } from '../utils/api';

function ProfilePage() {
  const { currentUser } = useAuth();
  const { theme } = useTheme();
  const navigate = useNavigate();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (currentUser) {
      setFullName(currentUser.fullName || '');
      setEmail(currentUser.email || '');
      setPhoneNumber(currentUser.phoneNumber || '');
    }
  }, [currentUser]);

  function readSession() {
    try {
      const raw = localStorage.getItem('traffic_web_session');
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  async function handleUpdateProfile(e) {
    e.preventDefault();
    setMessage('');
    const session = readSession();
    if (!session?.accessToken) {
      setMessage('Vui lòng đăng nhập để cập nhật thông tin.');
      return;
    }

    setLoading(true);
    try {
      const res = await patchProfileRequest(session.accessToken, {
        fullName: fullName.trim(),
        email: email.trim(),
        phoneNumber: phoneNumber.trim(),
      });
      
      // Update localStorage with new user info
      if (res.user) {
        const parsed = JSON.parse(localStorage.getItem('traffic_web_session'));
        parsed.fullName = res.user.fullName || fullName;
        parsed.email = res.user.email || email;
        parsed.phoneNumber = res.user.phoneNumber || phoneNumber;
        localStorage.setItem('traffic_web_session', JSON.stringify(parsed));
      }
      
      setMessage('Cập nhật thông tin thành công.');
    } catch (err) {
      setMessage(err.message || 'Lỗi khi cập nhật thông tin.');
    } finally {
      setLoading(false);
    }
  }

  async function handleChangePassword(e) {
    e.preventDefault();
    setMessage('');
    const session = readSession();
    if (!session?.accessToken) {
      setMessage('Vui lòng đăng nhập để thay đổi mật khẩu.');
      return;
    }

    setLoading(true);
    try {
      await changePasswordRequest(session.accessToken, {
        currentPassword,
        newPassword,
      });
      setMessage('Đổi mật khẩu thành công.');
      setCurrentPassword('');
      setNewPassword('');
    } catch (err) {
      setMessage(err.message || 'Lỗi khi đổi mật khẩu.');
    } finally {
      setLoading(false);
    }
  }



  return (
    <div style={{ 
      minHeight: '100vh', 
      background: theme === 'dark' 
        ? 'linear-gradient(135deg, #2d2d2d 0%, #1a1a1a 100%)'
        : '#ffffff',
      padding: '40px 20px' 
    }}>
      <div style={{ maxWidth: 650, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 32 }}>
          <h1 style={{ fontSize: 32, fontWeight: 700, color: theme === 'dark' ? '#fff' : '#333', margin: '0 0 8px 0' }}>⚙️ Cài đặt hồ sơ</h1>
          <p style={{ color: theme === 'dark' ? 'rgba(255,255,255,0.8)' : '#666', margin: 0 }}>Quản lý thông tin tài khoản và bảo mật</p>
        </div>

        {/* User Info Card */}
        <div style={{ 
          background: theme === 'dark' ? 'var(--color-panel-bg)' : '#fff', 
          borderRadius: 12, 
          padding: 20, 
          marginBottom: 24, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
        }}>
          <h3 style={{ margin: '0 0 16px 0', fontSize: 18, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>👤 Thông tin người dùng</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: 12, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-secondary)' : '#666', textTransform: 'uppercase' }}>Tên đầy đủ</p>
              <p style={{ margin: 0, fontSize: 16, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333', fontWeight: 500 }}>{fullName || '—'}</p>
            </div>
            <div>
              <p style={{ margin: '0 0 4px 0', fontSize: 12, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-secondary)' : '#666', textTransform: 'uppercase' }}>Email</p>
              <p style={{ margin: 0, fontSize: 16, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333', fontWeight: 500 }}>{email || '—'}</p>
            </div>
            <div style={{ gridColumn: '1 / -1' }}>
              <p style={{ margin: '0 0 4px 0', fontSize: 12, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-secondary)' : '#666', textTransform: 'uppercase' }}>Số điện thoại</p>
              <p style={{ margin: 0, fontSize: 16, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333', fontWeight: 500 }}>{phoneNumber || 'Chưa cập nhật'}</p>
            </div>
          </div>
        </div>

        {/* Profile Info Edit Section */}
        <div style={{ 
          background: theme === 'dark' ? 'var(--color-panel-bg)' : '#fff', 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>📋 Chỉnh sửa thông tin</h3>
          <form onSubmit={handleUpdateProfile}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>Tên đầy đủ *</label>
              <input 
                type="text" 
                value={fullName} 
                onChange={(e) => setFullName(e.target.value)} 
                placeholder="Nhập tên của bạn"
                required
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  fontSize: 14, 
                  border: `1px solid ${theme === 'dark' ? 'var(--color-input-border)' : '#e0e0e0'}`, 
                  borderRadius: 8, 
                  boxSizing: 'border-box', 
                  fontFamily: 'inherit',
                  background: theme === 'dark' ? 'var(--color-input-bg)' : '#fff',
                  color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
                }}
              />
            </div>

            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>Email *</label>
              <input 
                type="email" 
                value={email} 
                onChange={(e) => setEmail(e.target.value)} 
                placeholder="Nhập email của bạn"
                required
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  fontSize: 14, 
                  border: `1px solid ${theme === 'dark' ? 'var(--color-input-border)' : '#e0e0e0'}`, 
                  borderRadius: 8, 
                  boxSizing: 'border-box', 
                  fontFamily: 'inherit',
                  background: theme === 'dark' ? 'var(--color-input-bg)' : '#fff',
                  color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>Số điện thoại (tùy chọn)</label>
              <input 
                type="tel" 
                value={phoneNumber} 
                onChange={(e) => setPhoneNumber(e.target.value)} 
                placeholder="Nhập số điện thoại"
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  fontSize: 14, 
                  border: `1px solid ${theme === 'dark' ? 'var(--color-input-border)' : '#e0e0e0'}`, 
                  borderRadius: 8, 
                  boxSizing: 'border-box', 
                  fontFamily: 'inherit',
                  background: theme === 'dark' ? 'var(--color-input-bg)' : '#fff',
                  color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              style={{ width: '100%', padding: '12px 16px', fontSize: 16, fontWeight: 600, background: loading ? '#ccc' : '#667eea', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}
              onMouseOver={(e) => !loading && (e.target.style.background = '#5568d3')}
              onMouseOut={(e) => !loading && (e.target.style.background = '#667eea')}
            >
              {loading ? 'Đang cập nhật...' : '💾 Cập nhật thông tin'}
            </button>
          </form>
        </div>

        {/* Change Password Section */}
        <div style={{ 
          background: theme === 'dark' ? 'var(--color-panel-bg)' : '#fff', 
          borderRadius: 12, 
          padding: 24, 
          marginBottom: 24, 
          boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
          color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
        }}>
          <h3 style={{ margin: '0 0 20px 0', fontSize: 18, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>🔐 Thay đổi mật khẩu</h3>
          <form onSubmit={handleChangePassword}>
            <div style={{ marginBottom: 16 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>Mật khẩu hiện tại *</label>
              <input 
                type="password" 
                value={currentPassword} 
                onChange={(e) => setCurrentPassword(e.target.value)} 
                placeholder="Nhập mật khẩu hiện tại"
                required
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  fontSize: 14, 
                  border: `1px solid ${theme === 'dark' ? 'var(--color-input-border)' : '#e0e0e0'}`, 
                  borderRadius: 8, 
                  boxSizing: 'border-box', 
                  fontFamily: 'inherit',
                  background: theme === 'dark' ? 'var(--color-input-bg)' : '#fff',
                  color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
                }}
              />
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: theme === 'dark' ? 'var(--color-text-primary)' : '#333' }}>Mật khẩu mới *</label>
              <input 
                type="password" 
                value={newPassword} 
                onChange={(e) => setNewPassword(e.target.value)} 
                placeholder="Nhập mật khẩu mới (tối thiểu 6 ký tự)"
                required
                style={{ 
                  width: '100%', 
                  padding: '12px 14px', 
                  fontSize: 14, 
                  border: `1px solid ${theme === 'dark' ? 'var(--color-input-border)' : '#e0e0e0'}`, 
                  borderRadius: 8, 
                  boxSizing: 'border-box', 
                  fontFamily: 'inherit',
                  background: theme === 'dark' ? 'var(--color-input-bg)' : '#fff',
                  color: theme === 'dark' ? 'var(--color-text-primary)' : '#333'
                }}
              />
            </div>

            <button 
              type="submit" 
              disabled={loading} 
              style={{ width: '100%', padding: '12px 16px', fontSize: 16, fontWeight: 600, background: loading ? '#ccc' : '#764ba2', color: '#fff', border: 'none', borderRadius: 8, cursor: loading ? 'not-allowed' : 'pointer', transition: 'background 0.3s' }}
              onMouseOver={(e) => !loading && (e.target.style.background = '#63408a')}
              onMouseOut={(e) => !loading && (e.target.style.background = '#764ba2')}
            >
              {loading ? 'Đang xử lý...' : '🔒 Thay đổi mật khẩu'}
            </button>
          </form>
        </div>

        {/* Message */}
        {message ? (
          <div style={{ 
            background: message.includes('thành công') 
              ? theme === 'dark' ? '#1a3a1a' : '#d4edda'
              : theme === 'dark' ? '#3a1a1a' : '#f8d7da', 
            border: `1px solid ${message.includes('thành công') 
              ? theme === 'dark' ? '#2d5a2d' : '#c3e6cb'
              : theme === 'dark' ? '#5a2d2d' : '#f5c6cb'}`, 
            color: message.includes('thành công') 
              ? theme === 'dark' ? '#66bb6a' : '#155724'
              : theme === 'dark' ? '#ff5252' : '#721c24', 
            padding: 16, 
            borderRadius: 8, 
            marginBottom: 24 
          }}>
            <p style={{ margin: 0, fontSize: 14, fontWeight: 500 }}>
              {message.includes('thành công') ? '✅ ' : '❌ '}
              {message}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default ProfilePage;
