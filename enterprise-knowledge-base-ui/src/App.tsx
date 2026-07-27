import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { ConfigProvider, Card } from 'antd';
import zhCN from 'antd/locale/zh_CN';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { MainLayout } from './layouts/MainLayout';
import { DocumentList } from './pages/DocumentList';
import { DocumentEditor } from './pages/DocumentEditor';
import { DictionaryManagement } from './pages/DictionaryManagement';

// 全局 React Query 客户端配置
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5, // 数据 5 分钟内不过期
      refetchOnWindowFocus: false, // 窗口获得焦点时不自动重刷
      retry: 1,
    },
  },
});

const PlaceholderPage: React.FC<{ title: string }> = ({ title }) => (
  <Card className="border border-slate-200 shadow-sm rounded-xl py-12 text-center">
    <h3 className="text-xl font-bold text-slate-700 m-0">{title}</h3>
    <p className="text-slate-400 text-sm mt-2">该模块功能正在研发迭代中，敬请期待...</p>
  </Card>
);

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <ConfigProvider
        locale={zhCN}
        theme={{
          token: {
            colorPrimary: '#4f46e5',
            borderRadius: 8,
            fontFamily: "'Inter', sans-serif",
          },
        }}
      >
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<MainLayout />}>
              <Route index element={<Navigate to="/documents" replace />} />
              <Route path="documents" element={<DocumentList />} />
              <Route path="editor" element={<DocumentEditor />} />
              <Route path="dictionary" element={<DictionaryManagement />} />
              <Route path="categories" element={<PlaceholderPage title="分类空间模块" />} />
              <Route path="teams" element={<PlaceholderPage title="团队协作模块" />} />
              <Route path="settings" element={<PlaceholderPage title="系统配置模块" />} />
            </Route>
          </Routes>
        </BrowserRouter>
      </ConfigProvider>
    </QueryClientProvider>
  );
};

export default App;
