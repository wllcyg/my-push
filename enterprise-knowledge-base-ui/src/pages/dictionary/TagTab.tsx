import React, { useState } from 'react';
import {
  Table,
  Button,
  Tag,
  Space,
  Modal,
  Form,
  Input,
  message,
  Popconfirm,
} from 'antd';
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  FireOutlined,
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getTags,
  createTag,
  updateTag,
  deleteTag,
  TagItem,
} from '../../api/dictionary';

const PRESET_COLORS = [
  '#108ee9',
  '#f50',
  '#2db7f5',
  '#87d068',
  '#722ed1',
  '#eb2f96',
  '#fa8c16',
  '#faad14',
];

export const TagTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TagItem | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: tags = [], isLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });

  const createMutation = useMutation({
    mutationFn: createTag,
    onSuccess: () => {
      message.success('标签创建成功！');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTag(id, data),
    onSuccess: () => {
      message.success('标签更新成功！');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTag,
    onSuccess: () => {
      message.success('标签已删除');
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    form.setFieldsValue({ color: '#108ee9' });
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TagItem) => {
    setEditingItem(item);
    form.setFieldsValue(item);
    setIsModalOpen(true);
  };

  const handleCloseModal = () => {
    setIsModalOpen(false);
    setEditingItem(null);
    form.resetFields();
  };

  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (editingItem) {
        updateMutation.mutate({ id: editingItem.id, data: values });
      } else {
        createMutation.mutate(values);
      }
    } catch {
      // 校验失败
    }
  };

  const columns = [
    {
      title: '标签样式预览',
      dataIndex: 'name',
      key: 'name',
      render: (name: string, record: TagItem) => (
        <Tag color={record.color || '#108ee9'} className="px-3 py-1 text-sm font-medium rounded-full border-none shadow-sm">
          {name}
        </Tag>
      ),
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
    {
      title: '使用热度 (引用次数)',
      dataIndex: 'quoteCount',
      key: 'quoteCount',
      render: (count: number) => (
        <Space className="font-semibold text-slate-700">
          <FireOutlined className="text-orange-500" />
          <span>{count} 次</span>
        </Space>
      ),
    },
    {
      title: '色值 Hex',
      dataIndex: 'color',
      key: 'color',
      render: (color?: string) => (
        <div className="flex items-center gap-2">
          <div className="w-4 h-4 rounded-full border border-slate-200" style={{ backgroundColor: color || '#108ee9' }} />
          <span className="font-mono text-xs text-slate-500">{color || '#108ee9'}</span>
        </div>
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      key: 'createdAt',
      render: (date: string) => (
        <span className="text-xs text-slate-400">{new Date(date).toLocaleString()}</span>
      ),
    },
    {
      title: '操作',
      key: 'actions',
      render: (_: any, record: TagItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined className="text-indigo-600" />}
            onClick={() => handleOpenEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除标签？"
            description="删除后无法恢复"
            onConfirm={() => deleteMutation.mutate(record.id)}
            okText="删除"
            cancelText="取消"
            okButtonProps={{ danger: true }}
          >
            <Button type="text" danger icon={<DeleteOutlined />}>
              删除
            </Button>
          </Popconfirm>
        </Space>
      ),
    },
  ];

  return (
    <div>
      <div className="flex justify-end mb-4">
        <Button
          type="primary"
          icon={<PlusOutlined />}
          onClick={handleOpenCreateModal}
          className="bg-indigo-600 hover:bg-indigo-500 border-none font-medium"
        >
          新建标签
        </Button>
      </div>

      <Table
        dataSource={tags}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`${editingItem ? '编辑' : '新建'}标签字典`}
        open={isModalOpen}
        onOk={handleSubmit}
        onCancel={handleCloseModal}
        confirmLoading={createMutation.isPending || updateMutation.isPending}
        okText="保存"
        cancelText="取消"
        destroyOnClose
      >
        <Form form={form} layout="vertical" className="mt-4">
          <Form.Item
            name="name"
            label="标签名称"
            rules={[{ required: true, message: '请输入标签名称' }]}
          >
            <Input placeholder="例如：DOCX / 架构设计" />
          </Form.Item>

          <Form.Item name="color" label="标签色值 (Hex Color)">
            <div className="space-y-2">
              <Input placeholder="#108ee9" />
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-400">预置快捷配色：</span>
                {PRESET_COLORS.map((hex) => (
                  <div
                    key={hex}
                    onClick={() => form.setFieldsValue({ color: hex })}
                    className="w-5 h-5 rounded-full cursor-pointer hover:scale-110 transition-transform shadow-xs"
                    style={{ backgroundColor: hex }}
                  />
                ))}
              </div>
            </div>
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
