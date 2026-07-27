import React, { useState } from 'react';
import { Card, Tabs, Button, Tooltip } from 'antd';
import {
  FolderOutlined,
  TeamOutlined,
  TagsOutlined,
  ReloadOutlined,
} from '@ant-design/icons';
import { useQueryClient } from '@tanstack/react-query';
import { CategoryTab } from './dictionary/CategoryTab';
import { TeamTab } from './dictionary/TeamTab';
import { TagTab } from './dictionary/TagTab';

export const DictionaryManagement: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'category' | 'team' | 'tag'>('category');
  const queryClient = useQueryClient();

  const handleRefresh = () => {
    const keyMap = {
      category: 'categories',
      team: 'teams',
      tag: 'tags',
    };
    queryClient.invalidateQueries({ queryKey: [keyMap[activeTab]] });
  };

  return (
    <div className="space-y-6">
      {/* 顶部页头标题 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-slate-800 tracking-tight m-0">字典数据管理</h2>
          <p className="text-slate-500 text-sm mt-1">
            统一维护知识库的分类、团队组织以及全局标签词库
          </p>
        </div>

        <Tooltip title="刷新当前列表数据">
          <Button icon={<ReloadOutlined />} onClick={handleRefresh} />
        </Tooltip>
      </div>

      {/* Tabs 选项卡拆分组件 */}
      <Card className="border border-slate-200/80 shadow-sm rounded-xl overflow-hidden">
        <Tabs
          activeKey={activeTab}
          onChange={(key) => setActiveTab(key as any)}
          items={[
            {
              key: 'category',
              label: (
                <span className="flex items-center gap-2 px-2">
                  <FolderOutlined className="text-emerald-500" />
                  分类字典
                </span>
              ),
              children: <CategoryTab />,
            },
            {
              key: 'team',
              label: (
                <span className="flex items-center gap-2 px-2">
                  <TeamOutlined className="text-amber-500" />
                  团队字典
                </span>
              ),
              children: <TeamTab />,
            },
            {
              key: 'tag',
              label: (
                <span className="flex items-center gap-2 px-2">
                  <TagsOutlined className="text-purple-500" />
                  标签字典
                </span>
              ),
              children: <TagTab />,
            },
          ]}
        />
      </Card>
    </div>
  );
};

export default DictionaryManagement;
