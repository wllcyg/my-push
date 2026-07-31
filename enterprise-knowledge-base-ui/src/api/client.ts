import axios from 'axios';

/**
 * 通用 Axios HTTP 客户端
 * 优先读取环境变量 VITE_API_BASE_URL，默认适配部署的后端自定义域名 https://kb-api.cheatppf.xyz
 */
export const api = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || 'https://kb-api.cheatppf.xyz',
  timeout: 15000,
});
