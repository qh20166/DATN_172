import { useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';

const DEFAULT_FORM = {
  label: 'home',
  address: '',
};

function SavedPlacesPage() {
  const { currentUser, saveAddress, updateAddress, deleteAddress } = useAuth();
  const [form, setForm] = useState(DEFAULT_FORM);
  const [editingId, setEditingId] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [status, setStatus] = useState('');

  const addresses = useMemo(() => currentUser?.addresses || [], [currentUser?.addresses]);

  function handleFieldChange(event) {
    setForm((prev) => ({
      ...prev,
      [event.target.name]: event.target.value,
    }));
  }

  function resetForm() {
    setForm(DEFAULT_FORM);
    setEditingId(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setError('');
    setStatus('');

    const label = form.label.trim();
    const address = form.address.trim();

    if (!label || !address) {
      setError('Nhập đầy đủ nhãn và địa chỉ.');
      return;
    }

    setSubmitting(true);

    try {
      const result = editingId
        ? await updateAddress({ addressId: editingId, label, address })
        : await saveAddress({ label, address });

      if (!result.ok) {
        setError(result.message || 'Không thể lưu địa chỉ.');
        return;
      }

      setStatus(editingId ? 'Cập nhật địa chỉ thành công.' : 'Đã lưu địa chỉ thành công.');
      resetForm();
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(addressId) {
    setError('');
    setStatus('');

    setSubmitting(true);
    try {
      const result = await deleteAddress(addressId);
      if (!result.ok) {
        setError(result.message || 'Không thể xóa địa chỉ.');
        return;
      }

      if (editingId === addressId) {
        resetForm();
      }

      setStatus('Đã xóa địa chỉ.');
    } finally {
      setSubmitting(false);
    }
  }

  function handleEdit(item) {
    setEditingId(item.id);
    setError('');
    setStatus('');
    setForm({
      label: item.label || 'other',
      address: item.address || '',
    });
  }

  return (
    <div className="saved-page">
      <section className="page-head">
        <div>
          <h2>Vị trí đã lưu</h2>
          <p>Lưu địa chỉ quan trọng như home, work để sử dụng nhanh.</p>
        </div>
      </section>

      <div className="saved-layout">
        <form className="saved-form" onSubmit={handleSubmit}>
          <h3>{editingId ? 'Chỉnh sửa địa chỉ' : 'Thêm địa chỉ mới'}</h3>

          <label htmlFor="label">Nhãn</label>
          <select id="label" name="label" value={form.label} onChange={handleFieldChange}>
            <option value="home">Home</option>
            <option value="work">Work</option>
            <option value="school">School</option>
            <option value="other">Other</option>
          </select>

          <label htmlFor="address">Địa chỉ</label>
          <textarea
            id="address"
            name="address"
            value={form.address}
            onChange={handleFieldChange}
            rows={4}
            placeholder="Số nhà, đường, quận, thành phố..."
          />

          {error ? <p className="form-error">{error}</p> : null}
          {status ? <p className="form-success">{status}</p> : null}

          <div className="saved-form-actions">
            <button type="submit" className="btn-primary" disabled={submitting}>
              {submitting ? 'Đang xử lý...' : editingId ? 'Cập nhật' : 'Lưu địa chỉ'}
            </button>
            {editingId ? (
              <button type="button" className="btn-light" onClick={resetForm} disabled={submitting}>
                Hủy
              </button>
            ) : null}
          </div>
        </form>

        <section className="saved-list-box">
          <h3>Danh sách địa chỉ</h3>
          {!addresses.length ? (
            <p className="saved-empty">Bạn chưa có địa chỉ nào.</p>
          ) : (
            <div className="saved-list">
              {addresses.map((item) => (
                <article key={item.id} className="saved-item">
                  <div>
                    <p className="saved-label">{item.label}</p>
                    <p className="saved-address">{item.address}</p>
                  </div>
                  <div className="saved-item-actions">
                    <button type="button" className="btn-light" onClick={() => handleEdit(item)}>
                      Sửa
                    </button>
                    <button
                      type="button"
                      className="btn-danger"
                      onClick={() => handleDelete(item.id)}
                      disabled={submitting}
                    >
                      Xóa
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}

export default SavedPlacesPage;
