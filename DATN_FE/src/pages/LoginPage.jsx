import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    Promise.resolve(login(form)).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }

      const redirectTo = location.state?.from?.pathname || '/app/map';
      navigate(redirectTo, { replace: true });
    });
  }

  return (
    <div className="auth-page">
      <div className="auth-cover">
        {/* <img src="/asset/figma/2.%20Sign%20in%20%26%20Sign%20up.png" alt="Figma auth reference" /> */}
         <img
          src="/asset/logo.png"
          alt="Logo"
          className="auth-cover-logo"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/asset/logo.jpg'; }}
        />
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Đăng nhập hệ thống</h2>
        <p>Theo dõi mật độ kẹt xe TP.HCM theo thời tiết và lưu lượng thực tế.</p>

        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          value={form.email}
          onChange={updateField}
          placeholder="you@example.com"
          required
        />

        <label htmlFor="password">Mật khẩu</label>
        <input
          id="password"
          name="password"
          type="password"
          value={form.password}
          onChange={updateField}
          placeholder="********"
          required
        />

        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn-primary" type="submit">
          Đăng nhập
        </button>

        <p className="switch-auth">
          Chưa có tài khoản? <Link to="/register">Đăng ký</Link>
        </p>
      </form>
    </div>
  );
}

export default LoginPage;
