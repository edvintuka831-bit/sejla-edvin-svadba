// Svi pozivi idu na Netlify funkcije; sesija je u HttpOnly kolačiću (JavaScript je ne vidi).
export class AuthError extends Error {}

async function request(path, { method = 'GET', body } = {}) {
  const res = await fetch(path, {
    method,
    credentials: 'same-origin',
    headers: { 'content-type': 'application/json', 'x-admin-request': '1' },
    body: body ? JSON.stringify(body) : undefined,
  })
  const data = await res.json().catch(() => ({}))
  if (res.status === 401 && path !== '/api/admin/login') throw new AuthError(data.error || 'Prijavite se.')
  if (!res.ok) throw new Error(data.error || `Greška ${res.status}`)
  return data
}

export const api = {
  session: () => request('/api/admin/session'),
  login: (password) => request('/api/admin/login', { method: 'POST', body: { password } }),
  logout: () => request('/api/admin/logout', { method: 'POST' }),
  list: () => request('/api/admin/rsvps').then((d) => d.rsvps),
  update: (id, data) => request(`/api/admin/rsvps/${id}`, { method: 'PUT', body: data }).then((d) => d.rsvp),
  remove: (id) => request(`/api/admin/rsvps/${id}`, { method: 'DELETE' }),
}
