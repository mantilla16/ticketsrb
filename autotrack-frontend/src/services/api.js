import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3001/api',
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('at-token');
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res.data,
  (err) => Promise.reject(err.response?.data || { error: 'Error de conexión con el servidor' })
);

export const authAPI = {
  microsoft: (idToken) => api.post('/auth/microsoft', { idToken }),
  config: () => api.get('/auth/config'),
  me: () => api.get('/auth/me'),
  // Solo responden si el backend corre con NODE_ENV!=production y ALLOW_DEV_LOGIN=true
  devUsers: () => api.get('/auth/dev-users'),
  devLogin: (email) => api.post('/auth/dev-login', { email }),
};

export const projectsAPI = {
  getAll: () => api.get('/projects'),
  create: (data) => api.post('/projects', data),
  update: (id, data) => api.put(`/projects/${id}`, data),
  remove: (id) => api.delete(`/projects/${id}`),
  addLog: (id, data) => api.post(`/projects/${id}/logs`, data),
  addTask:    (id, data)    => api.post(`/projects/${id}/tasks`, data),
  updateTask: (id, taskId, data) => api.patch(`/projects/${id}/tasks/${taskId}`, data),
  removeTask: (id, taskId)  => api.delete(`/projects/${id}/tasks/${taskId}`),
  // Marcar/desmarcar que a un cliente del proyecto ya se le cargó la analítica.
  setClientAnalytics: (id, clientId, analyticsLoaded) =>
    api.patch(`/projects/${id}/clients/${clientId}`, { analyticsLoaded }),
};

export const usersAPI = {
  getAll:  ()         => api.get('/users'),
  create:  (data)     => api.post('/users', data),
  update:  (id, data) => api.put(`/users/${id}`, data),
  remove:  (id)       => api.delete(`/users/${id}`),
  unlock:  (id)       => api.post(`/users/${id}/unlock`),
};

export const notificationsAPI = {
  getAll:      () => api.get('/notifications'),
  markAllRead: () => api.patch('/notifications/read-all'),
};

export const solicitudesAPI = {
  getAll:             ()          => api.get('/solicitudes'),
  create:             (formData)  => api.post('/solicitudes', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus:       (id, data)  => api.put(`/solicitudes/${id}/status`, data),
  updateInfo:         (id, data)  => api.put(`/solicitudes/${id}/info`, data),
  markProjectCreated: (id)        => api.patch(`/solicitudes/${id}/project-created`),
  remove:             (id)        => api.delete(`/solicitudes/${id}`),
};

export const analyticsReportAPI = {
  getReport:        ()              => api.get('/analytics-report'),
  getHistory:       ()              => api.get('/analytics-report/history'),
  takeSnapshot:     ()              => api.post('/analytics-report/snapshot'),
  getClients:       ()              => api.get('/analytics-report/clients'),
  createClient:     (data)          => api.post('/analytics-report/clients', data),
  updateClient:     (id, data)      => api.put(`/analytics-report/clients/${id}`, data),
  deleteClient:     (id)            => api.delete(`/analytics-report/clients/${id}`),
};

export default api;
