import React from 'react';
import { Drawer, Tag, Button, Spin } from 'antd';
import {
  FileTextOutlined,
  EditOutlined,
  GlobalOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useQuery } from '@tanstack/react-query';
import { getDocumentDetail } from '@/api/document';
import { StatusTag } from '@/components/StatusTag';
import { MarkdownViewer } from '@/components/MarkdownViewer';

interface Props {
  documentId: string | null;
  visible: boolean;
  onClose: () => void;
  onEdit: (id: string) => void;
}

export const DocumentDetailModal: React.FC<Props> = ({
  documentId,
  visible,
  onClose,
  onEdit,
}) => {
  const { data: doc, isLoading } = useQuery({
    queryKey: ['document', documentId],
    queryFn: () => getDocumentDetail(documentId!),
    enabled: visible && !!documentId,
  });

  return (
    <Drawer
      title={
        <div className="flex items-center gap-2">
          <FileTextOutlined className="text-indigo-600" />
          <span>文档正文预览</span>
        </div>
      }
      width={720}
      open={visible}
      onClose={onClose}
      extra={
        doc && (
          <Button
            type="primary"
            icon={<EditOutlined />}
            onClick={() => {
              onClose();
              onEdit(doc.id);
            }}
            className="bg-indigo-600"
          >
            编辑文档
          </Button>
        )
      }
    >
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Spin size="large" tip="载入文档详情中..." />
        </div>
      ) : doc ? (
        <div className="space-y-6">
          {/* 文档头部 */}
          <div>
            <div className="flex items-center gap-3 mb-2">
              <StatusTag status={doc.status} />
              {doc.isPublic ? (
                <Tag icon={<GlobalOutlined />} color="processing">
                  公开
                </Tag>
              ) : (
                <Tag icon={<LockOutlined />}>私有</Tag>
              )}
              {doc.tags &&
                doc.tags.split(',').map((tag, idx) => (
                  <Tag key={idx} color="purple">
                    {tag.trim()}
                  </Tag>
                ))}
            </div>
            <h1 className="text-2xl font-bold text-slate-800 m-0">{doc.title}</h1>
            {doc.summary && (
              <p className="text-slate-500 text-sm mt-2 bg-slate-50 p-3 rounded-lg border border-slate-200/60">
                {doc.summary}
              </p>
            )}
          </div>

          {/* 元数据指标 */}
          <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 rounded-xl border border-slate-200/60">
            <div className="text-center">
              <span className="text-xs text-slate-400 block">浏览数</span>
              <span className="text-lg font-semibold text-slate-700">{doc.viewCount ?? 0}</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400 block">点赞数</span>
              <span className="text-lg font-semibold text-slate-700">{doc.likeCount ?? 0}</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400 block">正文字数</span>
              <span className="text-lg font-semibold text-indigo-600">{doc.wordCount ?? 0} 字</span>
            </div>
            <div className="text-center">
              <span className="text-xs text-slate-400 block">Mongo ContentID</span>
              <span className="text-xs font-mono text-slate-500 truncate block mt-1">
                {doc.contentId}
              </span>
            </div>
          </div>

          {/* Markdown 正文组件 */}
          <MarkdownViewer content={doc.content} updatedAt={doc.updatedAt} />
        </div>
      ) : null}
    </Drawer>
  );
};
