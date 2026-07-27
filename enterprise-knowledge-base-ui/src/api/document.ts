import axios from 'axios';

// 基础 Axios 实例
const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
});

/** 文档状态枚举 */
export enum DocumentStatus {
  Draft = 0,
  Published = 1,
  Archived = 2,
}

/** 文档元数据接口 */
export interface DocumentItem {
  id: string;
  title: string;
  contentId: string;
  summary?: string;
  categoryId?: string;
  teamId?: string;
  authorId?: string;
  coverImage?: string;
  tags?: string;
  status: DocumentStatus;
  remark?: string;
  viewCount: number;
  likeCount: number;
  commentCount: number;
  favouriteCount: number;
  wordCount: number;
  publishTime?: string;
  isPublic: boolean;
  createdAt: string;
  updatedAt: string;
  createBy?: string;
  updateBy?: string;
  deleted: boolean;
  content?: string; // 详查时携带正文
}

/** 分页列表响应类型 */
export interface PageResult<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
}

/** 查询列表入参 */
export interface QueryDocumentParams {
  title?: string;
  categoryId?: string;
  teamId?: string;
  authorId?: string;
  status?: number;
  page?: number;
  pageSize?: number;
}

/** 创建文档入参 */
export interface CreateDocumentInput {
  title: string;
  content: string;
  summary?: string;
  categoryId?: string;
  teamId?: string;
  authorId?: string;
  coverImage?: string;
  tags?: string;
  status?: DocumentStatus;
  remark?: string;
  isPublic?: boolean;
  createBy?: string;
}

/** 更新文档入参 */
export interface UpdateDocumentInput extends Partial<Omit<CreateDocumentInput, 'createBy'>> {
  updateBy?: string;
}

/** 获取文档列表 */
export async function getDocumentList(params: QueryDocumentParams): Promise<PageResult<DocumentItem>> {
  const res = await api.get<PageResult<DocumentItem>>('/documents', { params });
  return res.data;
}

/** 获取文档详情 (含 Markdown 正文) */
export async function getDocumentDetail(id: string): Promise<DocumentItem> {
  const res = await api.get<DocumentItem>(`/documents/${id}`);
  return res.data;
}

/** 创建文档 */
export async function createDocument(data: CreateDocumentInput): Promise<DocumentItem> {
  const res = await api.post<DocumentItem>('/documents', data);
  return res.data;
}

/** 更新文档 */
export async function updateDocument(id: string, data: UpdateDocumentInput): Promise<DocumentItem> {
  const res = await api.patch<DocumentItem>(`/documents/${id}`, data);
  return res.data;
}

/** 软删除文档 */
export async function deleteDocument(id: string): Promise<{ id: string; deleted: boolean }> {
  const res = await api.delete<{ id: string; deleted: boolean }>(`/documents/${id}`);
  return res.data;
}
