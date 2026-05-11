import { useEffect, useState } from 'react';
import { vnExpressNewsRequest } from '../utils/api';

function formatTime(value) {
  if (!value) {
    return 'Mới cập nhật';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Mới cập nhật';
  }

  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date);
}

function NewsPage() {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [items, setItems] = useState([]);

  useEffect(() => {
    let active = true;

    async function loadNews() {
      setLoading(true);
      setError('');

      try {
        const news = await vnExpressNewsRequest();
        if (!active) {
          return;
        }

        setItems(news);
      } catch (loadError) {
        if (!active) {
          return;
        }

        setError(loadError.message || 'Không thể tải tin tức.');
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    }

    loadNews();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="news-page">
      <section className="page-head">
        <div>
          <h2>Tin tức VnExpress</h2>
          <p>Cập nhật nhanh các bài viết mới nhất để theo dõi tình hình chung.</p>
        </div>
      </section>

      {loading ? <p className="loading">Đang tải tin tức...</p> : null}
      {error ? <p className="error">{error}</p> : null}

      {!loading && !error ? (
        <section className="news-list">
          {items.map((item) => (
            <article key={item.id} className="news-item">
              <p className="news-meta">{item.source} • {formatTime(item.publishedAt)}</p>
              <h3>
                <a href={item.link} target="_blank" rel="noreferrer">
                  {item.title}
                </a>
              </h3>
              <p>{item.summary || 'Xem chi tiet tai VnExpress.'}</p>
            </article>
          ))}
        </section>
      ) : null}
    </div>
  );
}

export default NewsPage;
