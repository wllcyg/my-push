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
  getTeams,
  createTeam,
  updateTeam,
  deleteTeam,
  TeamItem,
} from '../../api/dictionary';

export const TeamTab: React.FC = () => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TeamItem | null>(null);
  const [form] = Form.useForm();
  const queryClient = useQueryClient();

  const { data: teams = [], isLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  const createMutation = useMutation({
    mutationFn: createTeam,
    onSuccess: () => {
      message.success('团队创建成功！');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '创建失败');
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateTeam(id, data),
    onSuccess: () => {
      message.success('团队更新成功！');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
      handleCloseModal();
    },
    onError: (err: any) => {
      message.error(err?.response?.data?.message || '更新失败');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: deleteTeam,
    onSuccess: () => {
      message.success('团队已删除');
      queryClient.invalidateQueries({ queryKey: ['teams'] });
    },
  });

  const handleOpenCreateModal = () => {
    setEditingItem(null);
    form.resetFields();
    setIsModalOpen(true);
  };

  const handleOpenEditModal = (item: TeamItem) => {
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
      title: '团队名称',
      dataIndex: 'name',
      key: 'name',
      render: (text: string) => <span className="font-semibold text-slate-800">{text}</span>,
    },
    {
      title: '团队 Code',
      dataIndex: 'code',
      key: 'code',
      render: (code: string) => <Tag color="amber">{code}</Tag>,
    },
    {
      title: 'ID',
      dataIndex: 'id',
      key: 'id',
      render: (id: string) => <span className="font-mono text-xs text-slate-400">{id}</span>,
    },
    {
      title: '团队说明',
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
      render: (_: any, record: TeamItem) => (
        <Space size="middle">
          <Button
            type="text"
            icon={<EditOutlined className="text-indigo-600" />}
            onClick={() => handleOpenEditModal(record)}
          >
            编辑
          </Button>
          <Popconfirm
            title="确认删除团队？"
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
          新建团队
        </Button>
      </div>

      <Table
        dataSource={teams}
        columns={columns}
        rowKey="id"
        loading={isLoading}
        pagination={{ pageSize: 10 }}
      />

      <Modal
        title={`${editingItem ? '编辑' : '新建'}团队字典`}
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
            label="团队名称"
            rules={[{ required: true, message: '请输入团队名称' }]}
          >
            <Input placeholder="例如：核心研发组" />
          </Form.Item>

          <Form.Item
            name="code"
            label="团队 Code (英文唯一标识)"
            rules={[{ required: true, message: '请输入编码 Code' }]}
          >
            <Input placeholder="例如：team_dev" disabled={!!editingItem} />
          </Form.Item>

          <Form.Item name="remark" label="描述备注">
            <Input.TextArea rows={3} placeholder="简要说明使用场景" />
          </Form.Item>
        </Form>
      </Modal>
    </div>
  );
};
