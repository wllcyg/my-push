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
  Select,
  Upload,
  Tag,
} from 'antd';
import {
  ArrowLeftOutlined,
  SaveOutlined,
  SendOutlined,
  FileMarkdownOutlined,
  InboxOutlined,
  CloudUploadOutlined,
} from '@ant-design/icons';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  CreateDocumentInput,
  DocumentStatus,
  createDocument,
  getDocumentDetail,
  updateDocument,
  uploadAndParseDocument,
} from '@/api/document';
import { getCategories, getTeams, getTags } from '@/api/dictionary';

const { TextArea } = Input;

export const DocumentEditor: React.FC = () => {
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams] = useSearchParams();
  const editId = searchParams.get('id');

  const [content, setContent] = useState('');
  const [uploading, setUploading] = useState(false);

  // 1. 加载分类、团队、标签字典
  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const { data: teams = [], isLoading: teamsLoading } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  const { data: tagItems = [], isLoading: tagsLoading } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });

  // 2. 加载现存文档详情 (React Query)
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
        tags: doc.tags ? doc.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
        isPublic: doc.isPublic,
      });
      setContent(doc.content || '');
      return doc;
    },
    enabled: !!editId,
  });

  // 3. 创建/更新 Mutation
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
    
    // 将数组类型的 tags 转化为逗号分隔的字符串
    const tagsString = Array.isArray(values.tags) ? values.tags.join(',') : values.tags || '';

    const payload: CreateDocumentInput = {
      ...values,
      tags: tagsString,
      content,
      status,
    };
    saveMutation.mutate({ payload, status });
  };

  // 4. 处理文件上传并提取文档内容与元数据
  const handleCustomUpload = async (options: any) => {
    const { file, onSuccess, onError } = options;
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file as File);

      // 如果当前表单已有选中值，一起发给后端
      const currentValues = form.getFieldsValue();
      if (currentValues.categoryId) formData.append('categoryId', currentValues.categoryId);
      if (currentValues.teamId) formData.append('teamId', currentValues.teamId);

      // 1. 调用上传解析（后端会自动落库并存入 R2 + Mongo + Postgres）
      const uploadRes = await uploadAndParseDocument(formData);

      // 2. 根据返回的 documentId 查询完整文档详情 (包含完整 Markdown 正文)
      const fullDoc = await getDocumentDetail(uploadRes.documentId);

      // 3. 回显解析出的标题、摘要、分类、标签及正文
      form.setFieldsValue({
        title: fullDoc.title || form.getFieldValue('title'),
        summary: fullDoc.summary || form.getFieldValue('summary'),
        categoryId: fullDoc.categoryId || form.getFieldValue('categoryId'),
        teamId: fullDoc.teamId || form.getFieldValue('teamId'),
        tags: fullDoc.tags
          ? fullDoc.tags.split(',').map((t) => t.trim()).filter(Boolean)
          : form.getFieldValue('tags'),
      });

      if (fullDoc.content) {
        setContent(fullDoc.content);
      }

      message.success('文件上传与解析成功！已为您生成文档草稿并提取全文');
      
      // 4. 切换为编辑模式路由（后续点击“保存/发布”将进行更新 update，而非重复 create）
      navigate(`/editor?id=${uploadRes.documentId}`, { replace: true });
      queryClient.invalidateQueries({ queryKey: ['documents'] });

      onSuccess(uploadRes);
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err.message || '文件解析失败';
      message.error(`上传失败: ${errMsg}`);
      onError(err);
    } finally {
      setUploading(false);
    }
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
          {/* 左侧元数据配置与上传区 */}
          <div className="lg:col-span-1 space-y-6">
            {/* 文件导入/解析拖拽区 */}
            <Card
              className="border border-slate-200 shadow-sm rounded-xl overflow-hidden"
              title={
                <div className="flex items-center gap-2 text-indigo-600 text-sm font-semibold">
                  <CloudUploadOutlined className="text-base" />
                  <span>上传文件智能解析导入</span>
                </div>
              }
            >
              <Upload.Dragger
                name="file"
                multiple={false}
                showUploadList={false}
                customRequest={handleCustomUpload}
                disabled={uploading}
                accept=".md,.txt,.pdf,.docx,.doc"
                style={{
                  background: '#f8fafc',
                  border: '1px dashed #cbd5e1',
                  borderRadius: '10px',
                  padding: '12px',
                }}
              >
                <div className="py-2">
                  <p className="ant-upload-drag-icon text-indigo-500 text-3xl mb-2">
                    {uploading ? <Spin /> : <InboxOutlined />}
                  </p>
                  <p className="text-slate-700 text-sm font-medium m-0">
                    点击或拖拽本地文档至此处
                  </p>
                  <p className="text-slate-400 text-xs mt-1 mb-0">
                    支持 Markdown (.md)、Word (.docx)、PDF、TXT 文件解析
                  </p>
                </div>
              </Upload.Dragger>
            </Card>

            {/* 基本信息配置 */}
            <Card
              className="border border-slate-200 shadow-sm rounded-xl"
              title="基本信息配置"
            >
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

                {/* 分类字典选择 */}
                <Form.Item name="categoryId" label="所属分类">
                  <Select
                    placeholder="选择分类字典"
                    loading={categoriesLoading}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={categories.map((c) => ({
                      label: `${c.name} (${c.code})`,
                      value: c.id,
                    }))}
                  />
                </Form.Item>

                {/* 团队字典选择 */}
                <Form.Item name="teamId" label="所属团队">
                  <Select
                    placeholder="选择团队字典"
                    loading={teamsLoading}
                    allowClear
                    showSearch
                    optionFilterProp="label"
                    options={teams.map((t) => ({
                      label: `${t.name} (${t.code})`,
                      value: t.id,
                    }))}
                  />
                </Form.Item>

                {/* 标签字典选择 */}
                <Form.Item name="tags" label="文档标签">
                  <Select
                    mode="tags"
                    placeholder="选择现有标签或直接输入"
                    loading={tagsLoading}
                    allowClear
                    options={tagItems.map((t) => ({
                      label: t.name,
                      value: t.name,
                    }))}
                    tagRender={(props) => {
                      const { label, closable, onClose } = props;
                      const tagObj = tagItems.find((item) => item.name === label);
                      return (
                        <Tag
                          color={tagObj?.color || 'indigo'}
                          closable={closable}
                          onClose={onClose}
                          style={{ marginRight: 3 }}
                        >
                          {label}
                        </Tag>
                      );
                    }}
                  />
                </Form.Item>

                <Form.Item name="coverImage" label="封面图 URL">
                  <Input placeholder="https://example.com/cover.png" />
                </Form.Item>

                <Form.Item name="isPublic" label="公开权限" valuePropName="checked">
                  <Switch checkedChildren="公开" unCheckedChildren="私有" />
                </Form.Item>
              </Form>
            </Card>
          </div>

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
              rows={22}
              placeholder="# 编写文档正文...&#10;&#10;支持标准 Markdown 语法排版，亦可通过左侧拖拽上传文档自动导入"
              className="font-mono text-slate-800 text-sm p-4 bg-slate-50 border-slate-200 focus:bg-white transition-colors"
            />
          </Card>
        </div>
      )}
    </div>
  );
};
