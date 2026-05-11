const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';
const VNEXPRESS_RSS_URL = 'https://vnexpress.net/rss/tin-moi-nhat.rss';
const RSS_PROXY_URL = 'https://api.allorigins.win/raw?url=';

async function request(path, options = {}) {
  const headers = new Headers(options.headers || {});
  headers.set('Content-Type', 'application/json');

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers,
  });

  const contentType = response.headers.get('content-type') || '';
  const payload = contentType.includes('application/json') ? await response.json() : null;

  if (!response.ok) {
    throw new Error(payload?.message || 'Yêu cầu không thành công.');
  }

  return payload;
}

function buildQuery(params = {}) {
  const searchParams = new URLSearchParams();

  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === '') {
      return;
    }

    searchParams.set(key, String(value));
  });

  const query = searchParams.toString();
  return query ? `?${query}` : '';
}

export function loginRequest(body) {
  return request('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function registerRequest(body) {
  return request('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

export function meRequest(token) {
  return request('/api/auth/me', {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

export function logoutRequest(refreshToken) {
  return request('/api/auth/logout', {
    method: 'POST',
    body: JSON.stringify({ refreshToken }),
  });
}

export function saveAddressRequest(token, body) {
  return request('/api/auth/addresses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export function updateAddressRequest(token, addressId, body) {
  return request(`/api/auth/addresses/${addressId}`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export function deleteAddressRequest(token, addressId) {
  return request(`/api/auth/addresses/${addressId}`, {
    method: 'DELETE',
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}

function parseRssDate(value) {
  const date = new Date(value || '');
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function stripHtml(input) {
  if (!input) {
    return '';
  }

  const parser = new DOMParser();
  const doc = parser.parseFromString(input, 'text/html');
  return doc.body.textContent?.trim() || '';
}

function parseRssItems(xmlText) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(xmlText, 'application/xml');
  const itemNodes = Array.from(xml.querySelectorAll('item'));

  return itemNodes.slice(0, 20).map((item, index) => {
    const title = item.querySelector('title')?.textContent?.trim() || 'Tin moi';
    const link = item.querySelector('link')?.textContent?.trim() || 'https://vnexpress.net';
    const description = stripHtml(item.querySelector('description')?.textContent || '');
    const pubDate = parseRssDate(item.querySelector('pubDate')?.textContent);

    return {
      id: `${index}-${link}`,
      title,
      link,
      summary: description,
      publishedAt: pubDate,
      source: 'VnExpress',
    };
  });
}

export async function vnExpressNewsRequest() {
  const response = await fetch(`${RSS_PROXY_URL}${encodeURIComponent(VNEXPRESS_RSS_URL)}`);
  if (!response.ok) {
    throw new Error('Không tải được tin tức từ VnExpress.');
  }

  const xmlText = await response.text();
  const items = parseRssItems(xmlText);

  if (!items.length) {
    throw new Error('Không có dữ liệu tin tức từ VnExpress.');
  }

  return items;
}

export function healthRequest() {
  return request('/health', { method: 'GET' });
}

export function decisionSummaryRequest(params = {}) {
  return request(`/api/decision/traffic/summary${buildQuery(params)}`, { method: 'GET' });
}

export function decisionRecommendationsRequest(params = {}) {
  return request(`/api/decision/traffic/recommendations${buildQuery(params)}`, { method: 'GET' });
}

export function changePasswordRequest(token, body) {
  return request('/api/auth/change-password', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export async function uploadAvatarRequest(token, file) {
  if (!file) {
    throw new Error('No file provided');
  }

  const form = new FormData();
  form.append('avatar', file);

  const response = await fetch(`${API_BASE_URL}/api/auth/profile/avatar`, {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: form,
  });

  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(payload?.message || 'Không thể tải avatar lên.');
  }

  return response.json();
}

export function patchProfileRequest(token, body) {
  return request('/api/auth/profile', {
    method: 'PATCH',
    headers: {
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify(body),
  });
}

export { API_BASE_URL };
