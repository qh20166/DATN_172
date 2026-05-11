import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function RegisterPage() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullName: '', email: '', phoneNumber: '', password: '', confirmPassword: '' });
  const [error, setError] = useState('');

  function updateField(event) {
    setForm((prev) => ({ ...prev, [event.target.name]: event.target.value }));
  }

  function handleSubmit(event) {
    event.preventDefault();
    setError('');

    if (form.password.length < 6) {
      setError('Mật khẩu tối thiểu 6 ký tự.');
      return;
    }

    if (form.password !== form.confirmPassword) {
      setError('Mật khẩu xác nhận không khớp.');
      return;
    }

    Promise.resolve(
      register({
        fullName: form.fullName,
        email: form.email,
        phoneNumber: form.phoneNumber,
        password: form.password,
      }),
    ).then((result) => {
      if (!result.ok) {
        setError(result.message);
        return;
      }

      navigate('/app/map');
    });
  }

  return (
    <div className="auth-page">
      <div className="auth-cover">
        {/* <img src="/figma/2.2%20Sign%20Up%20-%20Empte%20State.png" alt="Figma sign up reference" /> */}
        <img
          src="/asset/logo.png"
          alt="Logo"
          className="auth-cover-logo"
          onError={(e) => { e.currentTarget.onerror = null; e.currentTarget.src = '/asset/logo.jpg'; }}
        />
      </div>
      <form className="auth-form" onSubmit={handleSubmit}>
        <h2>Tạo tài khoản</h2>
        <p>Đăng ký để lưu trữ cấu hình và theo dõi tình hình giao thông theo thời gian.</p>

        <label htmlFor="fullName">Họ và tên</label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          value={form.fullName}
          onChange={updateField}
          placeholder="Nguyen Van A"
          required
        />

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

        <label htmlFor="phoneNumber">Số điện thoại</label>
        <input
          id="phoneNumber"
          name="phoneNumber"
          type="tel"
          value={form.phoneNumber}
          onChange={updateField}
          placeholder="+84..."
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

        <label htmlFor="confirmPassword">Nhập lại mật khẩu</label>
        <input
          id="confirmPassword"
          name="confirmPassword"
          type="password"
          value={form.confirmPassword}
          onChange={updateField}
          placeholder="********"
          required
        />

        {error ? <p className="form-error">{error}</p> : null}

        <button className="btn-primary" type="submit">
          Đăng ký
        </button>

        <p className="switch-auth">
          Đã có tài khoản? <Link to="/login">Đăng nhập</Link>
        </p>
      </form>
    </div>
  );
}

export default RegisterPage;
