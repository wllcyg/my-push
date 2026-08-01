import { api } from './client';

export interface UserInfo {
  id: string;
  username: string;
  email: string;
  role: string;
  avatar: string;
}

export interface LoginResponse {
  code: number;
  message: string;
  data: {
    token: string;
    refreshToken: string;
    user: UserInfo;
  };
}

export const loginApi = async (username: string, password: string): Promise<LoginResponse['data']> => {
  const response = await api.post<LoginResponse>('/auth/login', { username, password });
  return response.data.data;
};
