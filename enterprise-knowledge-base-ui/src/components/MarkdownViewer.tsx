import React from 'react';
import { ClockCircleOutlined } from '@ant-design/icons';
import { Spin } from 'antd';

interface MarkdownViewerProps {
  content?: string;
  updatedAt?: string;
  loading?: boolean;
}

export const MarkdownViewer: React.FC<MarkdownViewerProps> = ({
  content,
  updatedAt,
  loading = false,
}) => {
  if (loading) {
    return (
      <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
        <Spin size="large" tip="载入 Markdown 正文中..." />
      </div>
    );
  }

  return (
    <div>
      {updatedAt && (
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-base font-semibold text-slate-800 m-0">Markdown 内容</h3>
          <span className="text-xs text-slate-400">
            <ClockCircleOutlined className="mr-1" />
            更新于: {new Date(updatedAt).toLocaleString()}
          </span>
        </div>
      )}
      <div className="p-6 bg-white border border-slate-200 rounded-xl shadow-sm min-h-[300px] whitespace-pre-wrap font-mono text-slate-700 text-sm leading-relaxed">
        {content || <span className="text-slate-400 italic">（该文档暂无正文内容）</span>}
      </div>
    </div>
  );
};
