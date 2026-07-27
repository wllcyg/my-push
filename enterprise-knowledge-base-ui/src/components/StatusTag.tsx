import React from 'react';
import { Tag } from 'antd';
import { DocumentStatus } from '@/api/document';

interface StatusTagProps {
  status?: DocumentStatus;
}

export const StatusTag: React.FC<StatusTagProps> = ({ status }) => {
  switch (status) {
    case DocumentStatus.Published:
      return <Tag color="success">已发布</Tag>;
    case DocumentStatus.Archived:
      return <Tag color="default">已归档</Tag>;
    case DocumentStatus.Draft:
    default:
      return <Tag color="warning">草稿</Tag>;
  }
};
