import React, { useState } from 'react';
import { Form, Input, Button, Card, message } from 'antd';
import { UserOutlined, LockOutlined, BookOutlined, ArrowRightOutlined } from '@ant-design/icons';
import { useNavigate, useLocation } from 'react-router-dom';
import { loginApi } from '../api/auth';

export const LoginPage: React.FC = () => {
  const [loading, setLoading] = useState(false);
  const [form] = Form.useForm();
  const navigate = useNavigate();
  const location = useLocation();

  // 获取原本想访问的目标页面
  const from = (location.state as any)?.from?.pathname || '/documents';

  const onFinish = async (values: any) => {
    setLoading(true);
    try {
      const data = await loginApi(values.username, values.password);
      localStorage.setItem('sb_access_token', data.token);
      localStorage.setItem('user_info', JSON.stringify(data.user));
      
      message.success(`欢迎回来，${data.user.username}！`);
      navigate(from, { replace: true });
    } catch (err: any) {
      const errMsg = err.response?.data?.message || '登录失败，请检查账号密码';
      message.error(errMsg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-gradient-to-br from-slate-50 via-indigo-50/50 to-slate-100 p-4 relative overflow-hidden select-none">
      {/* 柔和科技感微光气泡 */}
      <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-200/40 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-blue-200/40 rounded-full blur-3xl pointer-events-none" />

      <Card
        className="w-full max-w-md bg-white/90 backdrop-blur-xl border border-slate-200/80 shadow-2xl shadow-slate-200/60 rounded-2xl p-4 sm:p-6"
        variant="borderless"
      >
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-indigo-600 to-indigo-500 text-white mb-4 shadow-lg shadow-indigo-200">
            <BookOutlined className="text-2xl" />
          </div>
          <h1 className="text-2xl font-extrabold text-slate-800 tracking-tight m-0">
            企业知识库系统
          </h1>
          <p className="text-slate-500 text-xs sm:text-sm mt-2">
            安全认证登录与 RAG 智脑协同控制台
          </p>
        </div>

        <Form
          form={form}
          name="login_form"
          layout="vertical"
          onFinish={onFinish}
          autoComplete="off"
          size="large"
        >
          <Form.Item
            name="username"
            rules={[{ required: true, message: '请输入账号或邮箱' }]}
          >
            <Input
              prefix={<UserOutlined className="text-slate-400 mr-2" />}
              placeholder="账号 / 邮箱"
              className="bg-slate-50/80 border-slate-200 text-slate-800 hover:border-indigo-500 focus:border-indigo-600 placeholder-slate-400 rounded-xl"
            />
          </Form.Item>

          <Form.Item
            name="password"
            rules={[{ required: true, message: '请输入密码' }]}
          >
            <Input.Password
              prefix={<LockOutlined className="text-slate-400 mr-2" />}
              placeholder="密码"
              className="bg-slate-50/80 border-slate-200 text-slate-800 hover:border-indigo-500 focus:border-indigo-600 placeholder-slate-400 rounded-xl"
            />
          </Form.Item>

          <Form.Item className="mt-8 mb-2">
            <Button
              type="primary"
              htmlType="submit"
              loading={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 border-none font-semibold rounded-xl text-white shadow-md shadow-indigo-200 flex items-center justify-center gap-2 group"
            >
              登录系统 <ArrowRightOutlined className="group-hover:translate-x-1 transition-transform" />
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
};
