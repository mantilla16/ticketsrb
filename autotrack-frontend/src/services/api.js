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
  register: (data) => api.post('/auth/register', data),
  login: (data) => api.post('/auth/login', data),
  google: (credential) => api.post('/auth/google', { credential }),
  config: () => api.get('/auth/config'),
  me: () => api.get('/auth/me'),
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
};

export const usersAPI = {
  getAll:  ()         => api.get('/users'),
  create:  (data)     => api.post('/users', data),
  update:  (id, data) => api.put(`/users/${id}`, data),
  remove:  (id)       => api.delete(`/users/${id}`),
  unlock:  (id)       => api.post(`/users/${id}/unlock`),
};

export const solicitudesAPI = {
  getAll:             ()          => api.get('/solicitudes'),
  create:             (formData)  => api.post('/solicitudes', formData, { headers: { 'Content-Type': 'multipart/form-data' } }),
  updateStatus:       (id, data)  => api.put(`/solicitudes/${id}/status`, data),
  updateInfo:         (id, data)  => api.put(`/solicitudes/${id}/info`, data),
  markProjectCreated: (id)        => api.patch(`/solicitudes/${id}/project-created`),
  remove:             (id)        => api.delete(`/solicitudes/${id}`),
};

export default api;
