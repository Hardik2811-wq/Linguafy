const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:4000').replace(/\/+$/, '');

export function getToken() { return localStorage.getItem('linguafy_token'); }
export function getStoredUser() { try { return JSON.parse(localStorage.getItem('linguafy_user') || 'null'); } catch { return null; } }
export function setSession({ token, user }) { localStorage.setItem('linguafy_token', token); localStorage.setItem('linguafy_user', JSON.stringify(user)); }
export function clearSession() { localStorage.removeItem('linguafy_token'); localStorage.removeItem('linguafy_user'); }

export async function api(path, { method = 'GET', body } = {}) {
  const response = await fetch(`${API_URL}${path}`, { method, headers: { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: `Bearer ${getToken()}` } : {}) }, ...(body ? { body: JSON.stringify(body) } : {}) });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.success === false) throw new Error(data.error || 'The request could not be completed.');
  return data;
}
