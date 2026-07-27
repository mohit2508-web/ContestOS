import axios from 'axios';

export const apiAxios = axios.create({
  baseURL: '/api',
  headers: {
    'Content-Type': 'application/json',
  },
});

apiAxios.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export const api = {
  get: (url: string) => apiAxios.get(url).then((res) => res.data),
  post: (url: string, data?: any) => apiAxios.post(url, data).then((res) => res.data),
  put: (url: string, data?: any) => apiAxios.put(url, data).then((res) => res.data),
  delete: (url: string) => apiAxios.delete(url).then((res) => res.data),

  // Contest helpers
  getManagerContest: (id: string) => apiAxios.get(`/contests/manager/${id}`).then((res) => res.data),
  joinManagerContest: (id: string) => apiAxios.post(`/contests/manager/${id}/join`).then((res) => res.data),
  getSebToken: (id: string) => apiAxios.post(`/contests/manager/${id}/seb-token`).then((res) => res.data),
  downloadSebConfig: (id: string) => apiAxios.get(`/contests/manager/${id}/seb-config`, { responseType: 'blob' }).then((res) => res.data),
  getMyContestReport: (id: string) => apiAxios.get(`/contests/${id}/my-report`).then((res) => res.data),
};

export default api;
