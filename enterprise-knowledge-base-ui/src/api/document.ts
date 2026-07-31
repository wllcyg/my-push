import axios from 'axios';
import { api } from './client';

/** 文档状态枚举 */
export enum DocumentStatus {
  Draft = 0,
  Published = 1,
  Archived = 2,
  Parsing = 3,
  Failed = 4,
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

/** R2 预签名 URL 响应接口 */
export interface PresignedUrlResult {
  uploadUrl: string;
  fileR2Key: string;
  fileUrl: string;
}

/** 直传解析后端 DTO */
export interface UploadParsePayload {
  fileUrl: string;
  fileR2Key: string;
  originalFilename: string;
  mimetype?: string;
  fileSize?: number;
  title?: string;
  summary?: string;
  categoryId?: string;
  teamId?: string;
  coverImage?: string;
  tags?: string;
  isPublic?: boolean;
}

/** 上传解析响应接口 */
export interface UploadParseResult {
  documentId: string;
  title: string;
  fileUrl: string | null;
  fileSize: number;
  fileExtension: string;
  status: DocumentStatus;
  message: string;
}

/** 获取 Cloudflare R2 直传预签名 URL */
export async function getPresignedUrl(
  filename: string,
  contentType?: string,
): Promise<PresignedUrlResult> {
  const res = await api.post<PresignedUrlResult>('/storage/presigned-url', {
    filename,
    contentType: contentType || 'application/octet-stream',
  });
  return res.data;
}

/** 浏览器端直传文件二进制到 Cloudflare R2 */
export async function uploadToR2Directly(
  uploadUrl: string,
  file: File,
  onProgress?: (percent: number) => void,
): Promise<void> {
  await axios.put(uploadUrl, file, {
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    onUploadProgress: (progressEvent: any) => {
      if (progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress?.(percent);
      }
    },
  });
}

/** 提交直传后的元数据至后端创建占位文档并入队 MQ 解析 */
export async function submitDirectUploadParse(
  data: UploadParsePayload,
): Promise<UploadParseResult> {
  const res = await api.post<UploadParseResult>('/documents/upload/parse', data);
  return res.data;
}

/**
 * 前端直传 R2 并提交 MQ 异步解析封装方法
 */
export async function uploadAndParseDocument(
  file: File,
  meta: Partial<UploadParsePayload> = {},
  onProgress?: (stepText: string, percent?: number) => void,
): Promise<UploadParseResult> {
  // Step 1: 申请预签名链接
  onProgress?.('获取预签名链接中...');
  const { uploadUrl, fileR2Key, fileUrl } = await getPresignedUrl(file.name, file.type);

  // Step 2: 浏览器直传 R2 存储
  onProgress?.('直传 R2 存储中...', 0);
  await uploadToR2Directly(uploadUrl, file, (percent) => {
    onProgress?.(`直传 R2 存储中... (${percent}%)`, percent);
  });

  // Step 3: 提交后端入队 MQ
  onProgress?.('投递 MQ 解析任务中...');
  const payload: UploadParsePayload = {
    ...meta,
    fileUrl,
    fileR2Key,
    originalFilename: file.name,
    mimetype: file.type || 'application/octet-stream',
    fileSize: file.size,
  };

  return await submitDirectUploadParse(payload);
}

