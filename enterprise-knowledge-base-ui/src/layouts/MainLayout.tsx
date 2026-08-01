import React, { useState } from 'react';
import { Layout, Menu, Avatar, Dropdown, Space, Breadcrumb, Button } from 'antd';
import {
  FileTextOutlined,
  FolderOutlined,
  TeamOutlined,
  SettingOutlined,
  MenuUnfoldOutlined,
  MenuFoldOutlined,
  UserOutlined,
  BellOutlined,
  PlusOutlined,
  BookOutlined,
  AppstoreOutlined,
  CloudUploadOutlined,
  RobotOutlined,
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import { AIChatDrawer } from '../components/AIChatDrawer';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [aiDrawerOpen, setAiDrawerOpen] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/documents',
      icon: <FileTextOutlined className="text-indigo-500" />,
      label: '文档管理',
    },
    {
      key: '/import',
      icon: <CloudUploadOutlined className="text-blue-500" />,
      label: '文件导入解析',
    },
    {
      key: '/dictionary',
      icon: <AppstoreOutlined className="text-purple-500" />,
      label: '字典管理',
    },
    {
      key: '/categories',
      icon: <FolderOutlined className="text-emerald-500" />,
      label: '分类空间',
    },
    {
      key: '/teams',
      icon: <TeamOutlined className="text-amber-500" />,
      label: '团队协作',
    },
    {
      key: '/settings',
      icon: <SettingOutlined className="text-slate-400" />,
      label: '系统配置',
    },
  ];

  const getBreadcrumbTitle = () => {
    if (location.pathname.includes('/editor')) return '在线编辑';
    if (location.pathname.includes('/import')) return '文件导入解析';
    if (location.pathname.includes('/dictionary')) return '字典数据管理';
    if (location.pathname.includes('/categories')) return '分类空间';
    if (location.pathname.includes('/teams')) return '团队协作';
    if (location.pathname.includes('/settings')) return '系统配置';
    return '文档管理';
  };

  // 读取当前登录用户信息
  const userInfoStr = localStorage.getItem('user_info');
  const currentUser = userInfoStr ? JSON.parse(userInfoStr) : { username: '系统管理员', role: '超级管理员' };

  const handleLogout = () => {
    localStorage.removeItem('sb_access_token');
    localStorage.removeItem('user_info');
    navigate('/login');
  };

  return (
    <Layout className="min-h-screen bg-slate-50">
      {/* 侧边栏 */}
      <Sider
        trigger={null}
        collapsible
        collapsed={collapsed}
        theme="light"
        width={240}
        className="border-r border-slate-200/80 shadow-sm z-20"
      >
        <div className="flex items-center gap-3 px-5 py-4 border-b border-slate-100">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-indigo-600 to-indigo-400 flex items-center justify-center text-white shadow-md shadow-indigo-200 shrink-0">
            <BookOutlined className="text-lg" />
          </div>
          {!collapsed && (
            <div className="flex flex-col">
              <span className="font-bold text-slate-800 text-base tracking-tight leading-tight">
                企业知识库
              </span>
              <span className="text-xs text-slate-400 font-medium">Knowledge Hub v1.0</span>
            </div>
          )}
        </div>

        <div className="px-3 py-3">
          <Menu
            mode="inline"
            selectedKeys={[location.pathname]}
            onClick={({ key }) => navigate(key)}
            items={menuItems}
            className="border-none font-medium text-slate-600"
          />
        </div>
      </Sider>

      <Layout className="bg-slate-50">
        {/* 顶部 Header */}
        <Header className="bg-white/80 backdrop-blur-md border-b border-slate-200/80 px-6 flex items-center justify-between sticky top-0 z-10 h-16">
          <div className="flex items-center gap-4">
            <Button
              type="text"
              icon={collapsed ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(!collapsed)}
              className="text-slate-600 hover:text-indigo-600"
            />
            <Breadcrumb
              items={[
                { title: '控制台' },
                { title: getBreadcrumbTitle() },
              ]}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button
              type="primary"
              icon={<RobotOutlined />}
              onClick={() => setAiDrawerOpen(true)}
              className="bg-gradient-to-r from-emerald-600 to-teal-500 hover:from-emerald-500 hover:to-teal-400 border-none shadow-sm shadow-emerald-200 font-medium flex items-center gap-1"
            >
              AI 问答助手
            </Button>

            <Button
              icon={<CloudUploadOutlined />}
              onClick={() => navigate('/import')}
              className="border-slate-300 text-slate-700 hover:text-indigo-600 hover:border-indigo-600 font-medium flex items-center"
            >
              导入文件
            </Button>

            <Button
              type="primary"
              icon={<PlusOutlined />}
              onClick={() => navigate('/editor')}
              className="bg-indigo-600 hover:bg-indigo-500 border-none shadow-sm shadow-indigo-200 font-medium flex items-center"
            >
              新建文档
            </Button>

            <Button
              type="text"
              icon={<BellOutlined className="text-slate-500 text-lg" />}
              className="hover:bg-slate-100 rounded-full"
            />

            <Dropdown
              menu={{
                items: [
                  { key: 'profile', label: `账号: ${currentUser.username}` },
                  { key: 'logout', label: '退出登录', danger: true, onClick: handleLogout },
                ],
              }}
              placement="bottomRight"
            >
              <Space className="cursor-pointer hover:bg-slate-100 px-2.5 py-1.5 rounded-xl transition-colors">
                <Avatar
                  src={currentUser.avatar}
                  icon={<UserOutlined />}
                  className="bg-indigo-100 text-indigo-600 border border-indigo-200"
                />
                <div className="hidden sm:flex flex-col items-start leading-tight">
                  <span className="text-xs font-semibold text-slate-800">{currentUser.username}</span>
                  <span className="text-[10px] text-slate-400 font-medium">{currentUser.role || 'Admin'}</span>
                </div>
              </Space>
            </Dropdown>
          </div>
        </Header>

        {/* 页面主主体内容区 */}
        <Content className="m-6 min-h-[calc(100vh-112px)]">
          <Outlet />
        </Content>

        {/* AI 问答助手抽屉 */}
        <AIChatDrawer open={aiDrawerOpen} onClose={() => setAiDrawerOpen(false)} />
      </Layout>
    </Layout>
  );
};
