import axios from 'axios';

/**
 * 通用 Axios HTTP 客户端
 * 本地开发 (pnpm dev) 时自动读取 .env.development -> http://localhost:3000
 * 线上构建 (pnpm build) 时自动读取 .env.production -> https://kb-api.cheatppf.xyz
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000',
  timeout: 15000,
});

// 请求拦截器：自动注入 Supabase Access Token
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('sb_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

