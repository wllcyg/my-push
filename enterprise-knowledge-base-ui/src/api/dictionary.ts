import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

/** 分类字典实体接口 */
export interface CategoryItem {
  id: string;
  name: string;
  code: string;
  remark?: string;
  createdAt: string;
}

export interface CreateCategoryInput {
  name: string;
  code: string;
  remark?: string;
}

export interface UpdateCategoryInput extends Partial<CreateCategoryInput> {}

/** 团队字典实体接口 */
export interface TeamItem {
  id: string;
  name: string;
  code: string;
  remark?: string;
  createdAt: string;
}

export interface CreateTeamInput {
  name: string;
  code: string;
  remark?: string;
}

export interface UpdateTeamInput extends Partial<CreateTeamInput> {}

/** 标签字典实体接口 */
export interface TagItem {
  id: string;
  name: string;
  color?: string;
  quoteCount: number;
  createdAt: string;
}

export interface CreateTagInput {
  name: string;
  color?: string;
}

export interface UpdateTagInput extends Partial<CreateTagInput> {}

// ==========================================
// 分类 API (Categories)
// ==========================================

export async function getCategories(): Promise<CategoryItem[]> {
  const res = await api.get<CategoryItem[]>('/categories');
  return res.data;
}

export async function createCategory(data: CreateCategoryInput): Promise<CategoryItem> {
  const res = await api.post<CategoryItem>('/categories', data);
  return res.data;
}

export async function updateCategory(id: string, data: UpdateCategoryInput): Promise<CategoryItem> {
  const res = await api.patch<CategoryItem>(`/categories/${id}`, data);
  return res.data;
}

export async function deleteCategory(id: string): Promise<{ id: string; success: boolean }> {
  const res = await api.delete<{ id: string; success: boolean }>(`/categories/${id}`);
  return res.data;
}

// ==========================================
// 团队 API (Teams)
// ==========================================

export async function getTeams(): Promise<TeamItem[]> {
  const res = await api.get<TeamItem[]>('/teams');
  return res.data;
}

export async function createTeam(data: CreateTeamInput): Promise<TeamItem> {
  const res = await api.post<TeamItem>('/teams', data);
  return res.data;
}

export async function updateTeam(id: string, data: UpdateTeamInput): Promise<TeamItem> {
  const res = await api.patch<TeamItem>(`/teams/${id}`, data);
  return res.data;
}

export async function deleteTeam(id: string): Promise<{ id: string; success: boolean }> {
  const res = await api.delete<{ id: string; success: boolean }>(`/teams/${id}`);
  return res.data;
}

// ==========================================
// 标签 API (Tags)
// ==========================================

export async function getTags(): Promise<TagItem[]> {
  const res = await api.get<TagItem[]>('/tags');
  return res.data;
}

export async function getHotTags(limit = 20): Promise<TagItem[]> {
  const res = await api.get<TagItem[]>('/tags/hot', { params: { limit } });
  return res.data;
}

export async function createTag(data: CreateTagInput): Promise<TagItem> {
  const res = await api.post<TagItem>('/tags', data);
  return res.data;
}

export async function updateTag(id: string, data: UpdateTagInput): Promise<TagItem> {
  const res = await api.patch<TagItem>(`/tags/${id}`, data);
  return res.data;
}

export async function deleteTag(id: string): Promise<{ id: string; success: boolean }> {
  const res = await api.delete<{ id: string; success: boolean }>(`/tags/${id}`);
  return res.data;
}
