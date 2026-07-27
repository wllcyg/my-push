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
} from '@ant-design/icons';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';

const { Header, Sider, Content } = Layout;

export const MainLayout: React.FC = () => {
  const [collapsed, setCollapsed] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const menuItems = [
    {
      key: '/documents',
      icon: <FileTextOutlined className="text-indigo-500" />,
      label: '文档管理',
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
                { title: location.pathname.includes('/editor') ? '在线编辑' : '文档列表' },
              ]}
            />
          </div>

          <div className="flex items-center gap-4">
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
                  { key: 'profile', label: '个人中心' },
                  { key: 'logout', label: '退出登录', danger: true },
                ],
              }}
              placement="bottomRight"
            >
              <Space className="cursor-pointer hover:bg-slate-100 px-2 py-1 rounded-lg transition-colors">
                <Avatar icon={<UserOutlined />} className="bg-indigo-50 text-indigo-600" />
                <span className="text-sm font-medium text-slate-700">系统管理员</span>
              </Space>
            </Dropdown>
          </div>
        </Header>

        {/* 页面主主体内容区 */}
        <Content className="m-6 min-h-[calc(100vh-112px)]">
          <Outlet />
        </Content>
      </Layout>
    </Layout>
  );
};
