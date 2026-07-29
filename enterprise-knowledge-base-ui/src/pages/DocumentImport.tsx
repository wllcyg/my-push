import React, { useState } from 'react';
import {
  Card,
  Form,
  Input,
  Select,
  Switch,
  Button,
  Upload,
  message,
  Spin,
  Space,
  Tag,
  Result,
  Alert,
  Divider,
} from 'antd';
import {
  CloudUploadOutlined,
  InboxOutlined,
  ArrowLeftOutlined,
  FileTextOutlined,
  CheckCircleOutlined,
  SyncOutlined,
  ThunderboltOutlined,
} from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getCategories, getTeams, getTags } from '../api/dictionary';
import { uploadAndParseDocument, UploadParseResult } from '../api/document';

const { TextArea } = Input;
const { Option } = Select;

export const DocumentImport: React.FC = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm();
  const [fileList, setFileList] = useState<any[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [progressText, setProgressText] = useState('');
  const [parseResult, setParseResult] = useState<UploadParseResult | null>(null);

  // 1. 加载分类字典
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  // 2. 加载团队字典
  const { data: teams = [] } = useQuery({
    queryKey: ['teams'],
    queryFn: getTeams,
  });

  // 3. 加载标签字典
  const { data: tags = [] } = useQuery({
    queryKey: ['tags'],
    queryFn: getTags,
  });

  // 处理提交表单与文件直传上传
  const handleSubmit = async () => {
    try {
      const values = await form.validateFields();
      if (fileList.length === 0) {
        message.warning('请选择需要上传解析的文件');
        return;
      }

      setSubmitting(true);
      setProgressText('初始化上传请求...');
      const rawFile = fileList[0].originFileObj || fileList[0];

      const tagsStr = values.tags
        ? Array.isArray(values.tags)
          ? values.tags.join(',')
          : values.tags
        : undefined;

      const meta = {
        title: values.title?.trim(),
        summary: values.summary?.trim(),
        categoryId: values.categoryId,
        teamId: values.teamId,
        coverImage: values.coverUrl?.trim(),
        isPublic: values.isPublic,
        tags: tagsStr,
      };

      // 执行端到端直传 R2 + 投递 MQ
      const res = await uploadAndParseDocument(rawFile, meta, (stepText) => {
        setProgressText(stepText);
      });

      setParseResult(res);
      message.success('文件直传 R2 成功，解析任务已发布至 MQ 队列！');
    } catch (err: any) {
      const errMsg = err?.response?.data?.message || err.message || '上传处理失败';
      message.error(`提交失败: ${errMsg}`);
    } finally {
      setSubmitting(false);
      setProgressText('');
    }
  };

  // 重新继续上传新文件
  const handleReset = () => {
    form.resetFields();
    setFileList([]);
    setParseResult(null);
  };

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* 页头导航 */}
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
          <div className="flex items-center gap-2">
            <CloudUploadOutlined className="text-indigo-600 text-lg" />
            <h2 className="text-lg font-bold text-slate-800 m-0">智能文档导入与 MQ 异步解析</h2>
          </div>
        </div>

        <Tag color="purple" icon={<ThunderboltOutlined />}>
          RabbitMQ 队列架构
        </Tag>
      </div>

      {parseResult ? (
        /* 解析任务已投递给 MQ 的反馈卡片 */
        <Card className="border border-slate-200 shadow-sm rounded-xl py-8">
          <Result
            status="success"
            title="文件上传成功，解析任务已入队"
            subTitle={
              <div className="text-slate-500 text-sm max-w-xl mx-auto space-y-2 mt-2">
                <p>已将文件上传至 Cloudflare R2 存储，并向 RabbitMQ 成功发布消费任务。</p>
                <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 text-left space-y-1 font-mono text-xs text-slate-700">
                  <div>
                    <span className="text-slate-400">文档 ID:</span> {parseResult.documentId}
                  </div>
                  <div>
                    <span className="text-slate-400">文档标题:</span> {parseResult.title}
                  </div>
                  <div>
                    <span className="text-slate-400">文件大小:</span> {(parseResult.fileSize / 1024).toFixed(1)} KB ({parseResult.fileExtension})
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-slate-400">当前状态:</span>
                    <Tag color="processing" icon={<SyncOutlined spin />}>
                      后台解析中 (Parsing)
                    </Tag>
                  </div>
                </div>
              </div>
            }
            extra={[
              <Button
                type="primary"
                key="list"
                onClick={() => navigate('/documents')}
                className="bg-indigo-600 hover:bg-indigo-500 shadow-sm"
              >
                前往文档列表查看状态
              </Button>,
              <Button key="again" onClick={handleReset}>
                继续导入新文件
              </Button>,
            ]}
          />
        </Card>
      ) : (
        /* 主导入表单：基本信息配置 + 文件选择区 */
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* 左侧：基本信息配置 */}
          <div className="lg:col-span-7">
            <Card
              className="border border-slate-200 shadow-sm rounded-xl"
              title={
                <div className="font-semibold text-slate-800 text-base">基本信息配置</div>
              }
            >
              <Form
                form={form}
                layout="vertical"
                initialValues={{ isPublic: false }}
                requiredMark="optional"
              >
                <Form.Item
                  name="title"
                  label={<span className="font-medium text-slate-700">文档标题</span>}
                  help="若留空，系统将自动使用文件原名作为文档标题"
                >
                  <Input placeholder="输入清晰简洁的文档标题" maxLength={100} showCount />
                </Form.Item>

                <Form.Item
                  name="summary"
                  label={<span className="font-medium text-slate-700">文档摘要</span>}
                >
                  <TextArea
                    rows={3}
                    placeholder="建议填写 200 字以内的摘要，空置时系统将从解析正文中自动截取"
                    maxLength={300}
                    showCount
                  />
                </Form.Item>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Form.Item
                    name="categoryId"
                    label={<span className="font-medium text-slate-700">所属分类</span>}
                  >
                    <Select placeholder="选择分类字典" allowClear>
                      {categories.map((c) => (
                        <Option key={c.id} value={c.id}>
                          {c.name} ({c.code})
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>

                  <Form.Item
                    name="teamId"
                    label={<span className="font-medium text-slate-700">所属团队</span>}
                  >
                    <Select placeholder="选择团队字典" allowClear>
                      {teams.map((t) => (
                        <Option key={t.id} value={t.id}>
                          {t.name}
                        </Option>
                      ))}
                    </Select>
                  </Form.Item>
                </div>

                <Form.Item
                  name="tags"
                  label={<span className="font-medium text-slate-700">文档标签</span>}
                >
                  <Select
                    mode="tags"
                    placeholder="选择现有标签或直接输入后按回车"
                    allowClear
                    tokenSeparators={[',']}
                  >
                    {tags.map((tg) => (
                      <Option key={tg.id} value={tg.name}>
                        {tg.name}
                      </Option>
                    ))}
                  </Select>
                </Form.Item>

                <Form.Item
                  name="coverUrl"
                  label={<span className="font-medium text-slate-700">封面图 URL</span>}
                >
                  <Input placeholder="https://example.com/cover.png" />
                </Form.Item>

                <Form.Item
                  name="isPublic"
                  label={<span className="font-medium text-slate-700">公开权限</span>}
                  valuePropName="checked"
                >
                  <Switch
                    checkedChildren="公开"
                    unCheckedChildren="私有"
                    className="bg-slate-300"
                  />
                </Form.Item>
              </Form>
            </Card>
          </div>

          {/* 右侧：文件上传拖拽与提交操作区 */}
          <div className="lg:col-span-5 space-y-6">
            <Card
              className="border border-slate-200 shadow-sm rounded-xl overflow-hidden"
              title={
                <div className="font-semibold text-slate-800 text-base flex items-center gap-2">
                  <FileTextOutlined className="text-indigo-600" />
                  <span>上传待解析文件</span>
                </div>
              }
            >
              <Upload.Dragger
                name="file"
                multiple={false}
                fileList={fileList}
                beforeUpload={(file) => {
                  setFileList([file]);
                  // 自动将文件名填充到标题栏（若标题未填写）
                  if (!form.getFieldValue('title')) {
                    const rawName = file.name.replace(/\.[^/.]+$/, '');
                    form.setFieldsValue({ title: rawName });
                  }
                  return false; // 阻止自动上传，等待用户手动点提交
                }}
                onRemove={() => setFileList([])}
                accept=".csv,.xlsx,.xls,.docx,.doc,.pdf,.md,.txt"
                style={{
                  background: '#f8fafc',
                  border: '2px dashed #cbd5e1',
                  borderRadius: '12px',
                  padding: '24px 16px',
                }}
              >
                <p className="ant-upload-drag-icon text-indigo-500 text-4xl mb-3">
                  <InboxOutlined />
                </p>
                <p className="text-slate-700 font-semibold text-sm mb-1">
                  点击或拖拽本地文档至此处
                </p>
                <p className="text-slate-400 text-xs m-0">
                  支持 CSV (.csv)、Excel (.xlsx, .xls)、Word (.docx)、PDF、Markdown、TXT
                </p>
              </Upload.Dragger>

              <Alert
                message="R2 存储直传 & MQ 异步协同机制"
                description="文件通过 R2 预签名凭证直传至对象存储，不占用服务器中转带宽；上传完成后自动触发 RabbitMQ 后台解析。"
                type="info"
                showIcon
                className="mt-4 border-indigo-100 bg-indigo-50/50 text-xs"
              />

              <div className="mt-6">
                <Button
                  type="primary"
                  block
                  size="large"
                  icon={<CloudUploadOutlined />}
                  loading={submitting}
                  onClick={handleSubmit}
                  className="bg-indigo-600 hover:bg-indigo-500 shadow-md shadow-indigo-200 font-semibold h-11"
                >
                  {submitting ? progressText || '正在处理中...' : '直传 R2 存储并开始后台解析'}
                </Button>
              </div>
            </Card>
          </div>
        </div>
      )}
    </div>
  );
};

export default DocumentImport;
