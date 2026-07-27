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
} from '@ant-design/icons';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  getCategories,
  createCategory,
  updateCategory,
  deleteCategory,
  CategoryItem,
} from '../../api/dictionary';

export const CategoryTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<CategoryItem | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const createMutation = useMutation({
    mutationFn: createCategory,
    onSuccess: () => {
      message.success('分类创建成功！');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateCategory(id, data),
    onSuccess: () => {
      message.success('分类更新成功！');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteCategory,
    onSuccess: () => {
      message.success('分类已删除');
      queryClient.invalidateQueries({ queryKey: ['categories'] });
    },
  });

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: CategoryItem) => {
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
      title: '分类名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-semibold text-slate-800">{text}</span>,
    },
    {
      title: '标识 Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="geekblue">{code}</Tag>,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
    {
      title: '描述备注',
      dataIndex: 'remark',
      key: 'remark',
      render: (text?: string) => <span className="text-slate-500 text-sm">{text || '-'}</span>,
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
      render: (_: any, record: CategoryItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined className="text-indigo-600" />}
            onClick={() => handleOpenEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除分类？"
            description="删除后可能影响关联该分类的文档"
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
          新建分类
        </Button>
      </div>

      <Table
        dataSource={categories}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`${editingItem ? '编辑' : '新建'}分类字典`}
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
            label="分类名称"
            rules={[{ required: true, message: '请输入分类名称' }]}
          >
            <Input placeholder="例如：技术文档" />
          </Form.Item>

          <Form.Item
            name="code"
            label="标识 Code (英文唯一标识)"
            rules={[{ required: true, message: '请输入编码 Code' }]}
          >
            <Input placeholder="例如：cat_tech" disabled={!!editingItem} />
          </Form.Item>

          <Form.Item name="remark" label="描述备注">
            <Input.TextArea rows={3} placeholder="简要说明使用场景" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
