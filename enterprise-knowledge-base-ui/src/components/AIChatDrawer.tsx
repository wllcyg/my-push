import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, Avatar, Tag, Spin, Empty } from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  ClearOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
}

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 自动滚动至最新消息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleClear = () => {
    setMessages([]);
  };

  const handleSend = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
    };

    const newMessages = [...messages, userMessage];
    setMessages(newMessages);
    setInput('');
    setIsLoading(true);

    const assistantMsgId = (Date.now() + 1).toString();
    setMessages((prev) => [
      ...prev,
      { id: assistantMsgId, role: 'assistant', content: '' },
    ]);

    try {
      const response = await fetch('http://localhost:3000/agent/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({ role: m.role, content: m.content })),
        }),
      });

      if (!response.body) {
        throw new Error('ReadableStream not supported by browser.');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let accumulatedContent = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunkStr = decoder.decode(value, { stream: true });
        const lines = chunkStr.split('\n');

        for (const line of lines) {
          if (line.startsWith('0:')) {
            try {
              // 解析 AG-UI 0:"text"\n 格式
              const textChunk = JSON.parse(line.slice(2));
              accumulatedContent += textChunk;
              setMessages((prev) =>
                prev.map((msg) =>
                  msg.id === assistantMsgId
                    ? { ...msg, content: accumulatedContent }
                    : msg,
                ),
              );
            } catch (err) {
              // 忽略行尾截断的 JSON 解析异常
            }
          }
        }
      }
    } catch (err: any) {
      console.error('❌ Agent 问答流通信异常:', err);
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === assistantMsgId
            ? { ...msg, content: '❌ 抱歉，问答服务通信异常，请检查后端服务是否启动。' }
            : msg,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Drawer
      title={
        <div className="flex items-center justify-between pr-4">
          <div className="flex items-center gap-2 text-slate-800">
            <RobotOutlined className="text-emerald-600 text-lg" />
            <span className="font-semibold">AI 知识库智能助手</span>
            <Tag color="green" className="ml-1">
              LangChain + AG-UI
            </Tag>
          </div>
          {messages.length > 0 && (
            <Button
              type="text"
              size="small"
              icon={<ClearOutlined />}
              onClick={handleClear}
              className="text-slate-400 hover:text-rose-500"
            >
              清空对话
            </Button>
          )}
        </div>
      }
      width={480}
      open={open}
      onClose={onClose}
      styles={{ body: { padding: 0, display: 'flex', flexDirection: 'column' } }}
    >
      <div className="flex flex-col h-full bg-slate-50">
        {/* 聊天气泡滚动视图 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-slate-400 my-16">
              <Empty
                image={Empty.PRESENTED_IMAGE_SIMPLE}
                description={
                  <div className="space-y-1">
                    <p className="font-medium text-slate-600">向 AI 助手提问任意问题</p>
                    <p className="text-xs text-slate-400">
                      支持检索简历背景、技术规范与企业知识文档
                    </p>
                  </div>
                }
              />
            </div>
          ) : (
            messages.map((m) => (
              <div
                key={m.id}
                className={`flex gap-3 ${
                  m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                }`}
              >
                <Avatar
                  icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                  className={
                    m.role === 'user'
                      ? 'bg-indigo-600 shrink-0'
                      : 'bg-emerald-600 shrink-0'
                  }
                />

                <div
                  className={`max-w-[85%] p-3.5 rounded-2xl text-sm shadow-sm ${
                    m.role === 'user'
                      ? 'bg-indigo-600 text-white rounded-tr-none'
                      : 'bg-white text-slate-800 border border-slate-100 rounded-tl-none'
                  }`}
                >
                  {/* 支持 Markdown 渲染 */}
                  <div className="prose prose-sm max-w-none break-words leading-relaxed">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                </div>
              </div>
            ))
          )}

          {/* 打字机生成 Loading 动效 */}
          {isLoading && (
            <div className="flex items-center gap-2 text-slate-400 text-xs pl-2">
              <Spin size="small" />
              <span>AI 正在检索知识库思考并作答...</span>
            </div>
          )}
        </div>

        {/* 底部输入框 */}
        <div className="p-3.5 bg-white border-t border-slate-200">
          <form onSubmit={handleSend} className="flex gap-2 items-end">
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="请输入您的问题... (Enter 发送)"
              autoSize={{ minRows: 1, maxRows: 4 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              className="rounded-xl resize-none"
            />
            <Button
              type="primary"
              htmlType="submit"
              icon={<SendOutlined />}
              loading={isLoading}
              className="bg-emerald-600 hover:bg-emerald-500 rounded-xl h-10 px-4"
            />
          </form>
        </div>
      </div>
    </Drawer>
  );
};
