import React, { useState } from 'react';
import {
  Card,
  Input,
  Select,
  Button,
  Tag,
  Space,
  Popconfirm,
  message,
  Tooltip,
} from 'antd';
import {
  SearchOutlined,
  ReloadOutlined,
  PlusOutlined,
  EyeOutlined,
  EditOutlined,
  DeleteOutlined,
  GlobalOutlined,
  LockOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DocumentItem,
  DocumentStatus,
  QueryDocumentParams,
  deleteDocument,
  getDocumentList,
} from '@/api/document';
import { StatusTag } from '@/components/StatusTag';
import { MetricBadge } from '@/components/MetricBadge';
import { DataTable } from '@/components/DataTable';
import { DocumentDetailModal } from './DocumentDetailModal';

export const DocumentList: React.FC = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // 搜索表单草稿输入状态（输入框不实时触发网络请求）
  const [searchForm, setSearchForm] = useState<{
    title?: string;
    status?: number;
    categoryId?: string;
  }>({});

  // 真正用于 API 请求的查询参数
  const [queryParams, setQueryParams] = useState<QueryDocumentParams>({
    page: 1,
    pageSize: 10,
  });

  // 详情预览 Drawer 状态
  const [previewId, setPreviewId] = useState<string | null>(null);

  // 使用 React Query 加载列表
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['documents', queryParams],
    queryFn: () => getDocumentList(queryParams),
  });

  // 删除 Mutation
  const deleteMutation = useMutation({
    mutationFn: (id: string) => deleteDocument(id),
    onSuccess: () => {
      message.success('文档已移入回收站（软删除）');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
    },
    onError: () => {
      message.error('删除文档失败');
    },
  });

  // 点击【查询】按钮或回车：提交当前表单，重置到第一页，并强制刷新
  const handleSearch = () => {
    const nextParams: QueryDocumentParams = {
      ...queryParams,
      ...searchForm,
      page: 1,
    };
    setQueryParams(nextParams);
    refetch();
  };

  // 点击【重置】按钮：清空表单，重置分页，并强制刷新
  const handleReset = () => {
    setSearchForm({});
    const defaultParams: QueryDocumentParams = {
      page: 1,
      pageSize: 10,
    };
    setQueryParams(defaultParams);
    refetch();
  };

  const columns = [
    {
      title: '文档标题',
      dataIndex: 'title',
      key: 'title',
      render: (text: string, record: DocumentItem) => (
        <div className="flex flex-col">
          <span
            className="font-medium text-slate-800 hover:text-indigo-600 cursor-pointer transition-colors"
            onClick={() => setPreviewId(record.id)}
          >
            {text}
          </span>
          {record.summary && (
            <span className="text-xs text-slate-400 line-clamp-1 mt-0.5">{record.summary}</span>
          )}
        </div>
      ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      key: 'status',
      width: 110,
      render: (status: DocumentStatus) => <StatusTag status={status} />,
    },
    {
      title: '字数',
      dataIndex: 'wordCount',
      key: 'wordCount',
      width: 90,
      render: (val: number) => <span className="font-mono text-slate-600">{val ?? 0}</span>,
    },
    {
      title: '互动概览',
      key: 'metrics',
      width: 140,
      render: (_: any, record: DocumentItem) => (
        <MetricBadge views={record.viewCount} likes={record.likeCount} />
      ),
    },
    {
      title: '权限范围',
      dataIndex: 'isPublic',
      key: 'isPublic',
      width: 100,
      render: (isPublic: boolean) =>
        isPublic ? (
          <Tag icon={<GlobalOutlined />} color="blue">
            公开
          </Tag>
        ) : (
          <Tag icon={<LockOutlined />}>私有</Tag>
        ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      width: 170,
      render: (val: string) => (
        <span className="text-xs text-slate-500">{new Date(val).toLocaleString()}</span>
      ),
    },
    {
      title: '操作',
      key: 'action',
      width: 160,
      fixed: 'right' as const,
      render: (_: any, record: DocumentItem) => (
        <Space size="small">
          <Tooltip title="预览正文">
            <Button
              type="text"
              icon={<EyeOutlined className="text-indigo-600" />}
              onClick={() => setPreviewId(record.id)}
            />
          </Tooltip>

          <Tooltip title="编辑">
            <Button
              type="text"
              icon={<EditOutlined className="text-amber-600" />}
              onClick={() => navigate(`/editor?id=${record.id}`)}
            />
          </Tooltip>

          <Popconfirm
            title="确认软删除该文档？"
            description="删除后两侧数据库均将标记 deleted=true"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="确认"
            cancelText="取消"
            okButtonProps={{ danger: true, loading: deleteMutation.isPending }}
          >
            <Tooltip title="删除">
              <Button type="text" danger icon={<DeleteOutlined />} />
            </Tooltip>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      {/* 顶部搜索筛选卡片 */}
      <Card className="border border-slate-200 shadow-sm rounded-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-3">
            <Input
              placeholder="搜索文档标题..."
              prefix={<SearchOutlined className="text-slate-400" />}
              value={searchForm.title}
              onChange={(e) => setSearchForm({ ...searchForm, title: e.target.value })}
              onPressEnter={handleSearch}
              className="w-64"
              allowClear
            />

            <Select
              placeholder="筛选状态"
              value={searchForm.status}
              onChange={(val) => setSearchForm({ ...searchForm, status: val })}
              className="w-36"
              allowClear
            >
              <Select.Option value={DocumentStatus.Draft}>草稿</Select.Option>
              <Select.Option value={DocumentStatus.Published}>已发布</Select.Option>
              <Select.Option value={DocumentStatus.Archived}>已归档</Select.Option>
            </Select>

            <Input
              placeholder="分类 ID"
              value={searchForm.categoryId}
              onChange={(e) => setSearchForm({ ...searchForm, categoryId: e.target.value })}
              onPressEnter={handleSearch}
              className="w-32"
              allowClear
            />

            <Button type="primary" icon={<SearchOutlined />} onClick={handleSearch} className="bg-indigo-600">
              查询
            </Button>
            <Button icon={<ReloadOutlined />} onClick={handleReset}>
              重置
            </Button>
          </div>

          <Button
            type="primary"
            icon={<PlusOutlined />}
            onClick={() => navigate('/editor')}
            className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
          >
            新建文档
          </Button>
        </div>
      </Card>

      {/* 数据表格卡片 */}
      <Card className="border border-slate-200 shadow-sm rounded-xl">
        <DataTable<DocumentItem>
          columns={columns}
          dataSource={data?.items}
          loading={isLoading}
          page={queryParams.page}
          pageSize={queryParams.pageSize}
          total={data?.total}
          onPageChange={(page, pageSize) =>
            setQueryParams((prev) => ({ ...prev, page, pageSize }))
          }
        />
      </Card>

      {/* 正文预览抽屉 */}
      <DocumentDetailModal
        documentId={previewId}
        visible={!!previewId}
        onClose={() => setPreviewId(null)}
        onEdit={(id) => navigate(`/editor?id=${id}`)}
      />
    </div>
  );
};
