import React from 'react';
import { Tag, Tooltip } from 'antd';
import { SyncOutlined, ExclamationCircleOutlined } from '@ant-design/icons';
import { DocumentStatus } from '@/api/document';

interface StatusTagProps {
  status?: DocumentStatus;
  remark?: string | null;
}

export const StatusTag: React.FC<StatusTagProps> = ({ status, remark }) => {
  switch (status) {
    case DocumentStatus.Published:
      return <Tag color="success">已发布</Tag>;
    case DocumentStatus.Archived:
      return <Tag color="default">已归档</Tag>;
    case DocumentStatus.Parsing:
      return (
        <Tag color="processing" icon={<SyncOutlined spin />}>
          解析中
        </Tag>
      );
    case DocumentStatus.Failed:
      return (
        <Tooltip title={remark || '解析或向量化处理失败'}>
          <Tag color="error" icon={<ExclamationCircleOutlined />}>
            解析失败
          </Tag>
        </Tooltip>
      );
    case DocumentStatus.Draft:
    default:
      return <Tag color="warning">草稿</Tag>;
  }
};
