import React, { useState } from 'react';
import {
  Form,
  Input,
  Switch,
  Button,
  Card,
  message,
  Space,
  Divider,
  Spin,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  FileMarkdownOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreateDocumentInput,
  DocumentStatus,
  createDocument,
  getDocumentDetail,
  updateDocument,
} from '@/api/document';

const { TextArea } = Input;

export const DocumentEditor: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [content, setContent] = useState('');

  // 加载现存文档详情 (React Query)
  const { isLoading: detailLoading } = useQuery({
    queryKey: ['document', editId],
    queryFn: async () => {
      const doc = await getDocumentDetail(editId!);
      form.setFieldsValue({
        title: doc.title,
        summary: doc.summary,
        categoryId: doc.categoryId,
        teamId: doc.teamId,
        authorId: doc.authorId,
        coverImage: doc.coverImage,
        tags: doc.tags,
        isPublic: doc.isPublic,
      });
      setContent(doc.content || '');
      return doc;
    },
    enabled: !!editId,
  });

  // 创建/更新 Mutation
  const saveMutation = useMutation({
    mutationFn: async ({
      payload,
      status,
    }: {
      payload: CreateDocumentInput;
      status: DocumentStatus;
    }) => {
      if (editId) {
        return updateDocument(editId, payload);
      }
      return createDocument(payload);
    },
    onSuccess: (_, variables) => {
      const isPublish = variables.status === DocumentStatus.Published;
      message.success(isPublish ? '文档发布成功！' : '草稿保存成功！');
      queryClient.invalidateQueries({ queryKey: ['documents'] });
      if (editId) {
        queryClient.invalidateQueries({ queryKey: ['document', editId] });
      }
      navigate('/documents');
    },
    onError: (err: any) => {
      message.error(`保存失败: ${err?.response?.data?.message || err.message}`);
    },
  });

  const handleSave = async (status: DocumentStatus) => {
    const values = await form.validateFields();
    const payload: CreateDocumentInput = {
      ...values,
      content,
      status,
    };
    saveMutation.mutate({ payload, status });
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between bg-white p-4 rounded-xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-3">
          <Button
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate('/documents')}
            className="text-slate-600 hover:text-indigo-600"
          >
            返回列表
          </Button>
          <Divider type="vertical" />
          <h2 className="text-lg font-bold text-slate-800 m-0">
            {editId ? '编辑知识库文档' : '新建知识库文档'}
          </h2>
        </div>

        <Space>
          <Button
            icon={<SaveOutlined />}
            loading={saveMutation.isPending}
            onClick={() => handleSave(DocumentStatus.Draft)}
          >
            保存草稿
          </Button>
          <Button
            type="primary"
            icon={<SendOutlined />}
            loading={saveMutation.isPending}
            onClick={() => handleSave(DocumentStatus.Published)}
            className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
          >
            保存并发布
          </Button>
        </Space>
      </div>

      {detailLoading ? (
        <div className="flex justify-center items-center py-20 bg-white rounded-xl border border-slate-200">
          <Spin size="large" tip="React Query 加载编辑文档数据中..." />
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* 左侧元数据表单 */}
          <Card className="lg:col-span-1 border border-slate-200 shadow-sm rounded-xl" title="基本信息配置">
            <Form form={form} layout="vertical" initialValues={{ isPublic: false }}>
              <Form.Item
                name="title"
                label="文档标题"
                rules={[{ required: true, message: '请输入文档标题' }]}
              >
                <Input placeholder="输入清晰简洁的文档标题" maxLength={100} showCount />
              </Form.Item>

              <Form.Item name="summary" label="文档摘要">
                <TextArea
                  rows={3}
                  placeholder="建议填写 200 字以内的摘要，空置时系统将从正文中自动截取"
                  maxLength={300}
                  showCount
                />
              </Form.Item>

              <Form.Item name="categoryId" label="分类 ID">
                <Input placeholder="例如: 1001" />
              </Form.Item>

              <Form.Item name="teamId" label="所属团队 ID">
                <Input placeholder="例如: 2001" />
              </Form.Item>

              <Form.Item name="tags" label="文档标签">
                <Input placeholder="多个标签用英文逗号分隔 (如: React, NestJS)" />
              </Form.Item>

              <Form.Item name="coverImage" label="封面图 URL">
                <Input placeholder="https://example.com/cover.png" />
              </Form.Item>

              <Form.Item name="isPublic" label="公开权限" valuePropName="checked">
                <Switch checkedChildren="公开" unCheckedChildren="私有" />
              </Form.Item>
            </Form>
          </Card>

          {/* 右侧 Markdown 编辑区域 */}
          <Card
            className="lg:col-span-2 border border-slate-200 shadow-sm rounded-xl"
            title={
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <FileMarkdownOutlined className="text-indigo-600 text-lg" />
                  <span>Markdown 正文编辑器</span>
                </div>
                <span className="text-xs text-slate-400 font-normal">
                  已输入 {content.length} 字符
                </span>
              </div>
            }
          >
            <TextArea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={18}
              placeholder="# 编写文档正文...&#10;&#10;支持标准 Markdown 语法排版"
              className="font-mono text-slate-800 text-sm p-4 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
          </Card>
        </div>
      )}
    </div>
  );
};
