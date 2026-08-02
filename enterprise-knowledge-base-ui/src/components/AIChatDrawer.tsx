import React, { useState, useRef, useEffect } from 'react';
import { Drawer, Input, Button, Avatar, Tag, Empty } from 'antd';
import {
  RobotOutlined,
  UserOutlined,
  SendOutlined,
  ClearOutlined,
  PauseOutlined,
} from '@ant-design/icons';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { useChat } from '@ai-sdk/react';
import { TextStreamChatTransport } from 'ai';
import { API_BASE_URL } from '../api/client';

interface AIChatDrawerProps {
  open: boolean;
  onClose: () => void;
}

export const AIChatDrawer: React.FC<AIChatDrawerProps> = ({ open, onClose }) => {
  const [input, setInput] = useState('');
  // 维护由后端分配/透传的唯一 Session ID（初始为空，由后端首轮响应返回并继承）
  const [sessionId, setSessionId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // 使用 useChat 的 stop 方法，支持客户端中断 HTTP 流式连接 (AbortController)
  const { messages, sendMessage, status, stop, setMessages } = useChat({
    transport: new TextStreamChatTransport({
      api: `${API_BASE_URL}/agent/chat`,
      headers: (): Record<string, string> => {
        const token = localStorage.getItem('sb_access_token');
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      // 向后端发送请求时带着当前维持的 sessionId
      body: sessionId ? { sessionId } : {},
      // 拦截后端的 Response Header，捕获后端自动发出的 X-Session-Id
      fetch: async (url, init) => {
        const res = await fetch(url, init);
        const serverSessionId = res.headers.get('X-Session-Id');
        if (serverSessionId) {
          setSessionId(serverSessionId);
        }
        return res;
      },
    }),
  });

  const isLoading = status === 'submitted' || status === 'streaming';

  // 自动滚动至最新消息
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isLoading]);

  const handleClear = () => {
    setMessages([]);
    setSessionId(null); // 清空对话时重置，由后端在下一轮发消息时重新生产新会话 ID
  };

  const onSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!input.trim() || isLoading) return;

    sendMessage({ text: input.trim() });
    setInput('');
  };

  // 从 UIMessage 的 parts 结构中安全提取文本内容
  const getMessageContent = (m: any): string => {
    if (typeof m.content === 'string' && m.content) return m.content;
    if (Array.isArray(m.parts)) {
      return m.parts
        .filter((part: any) => part.type === 'text' && part.text)
        .map((part: any) => part.text)
        .join('');
    }
    return '';
  };

  return (
    <Drawer
      title={
        <div className="flex flex-col gap-2 pr-2">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <span className="flex items-center justify-center w-10 h-10 rounded-xl bg-emerald-600 text-white shadow-sm shrink-0">
                <RobotOutlined className="text-lg" />
              </span>
              <span className="font-bold text-slate-900 text-lg truncate">
                AI 知识库智能助手
              </span>
            </div>
            {messages.length > 0 && (
              <Button
                type="text"
                size="small"
                icon={<ClearOutlined />}
                onClick={handleClear}
                className="text-slate-400 hover:text-rose-500 shrink-0"
              >
                清空对话
              </Button>
            )}
          </div>
          <Tag
            color="green"
            className="!m-0 w-fit !rounded-full !text-xs !px-3 !py-0.5 !leading-5"
          >
            LangGraph + Vercel AI SDK
          </Tag>
        </div>
      }
      width="min(760px, 92vw)"
      open={open}
      onClose={onClose}
      styles={{
        header: { padding: '18px 20px 16px' },
        body: { padding: 0, display: 'flex', flexDirection: 'column' },
      }}
    >
      <div className="flex flex-col h-full bg-slate-50">
        {/* 聊天气泡滚动视图 */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
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
            <>
              {messages.map((m, index) => {
                const textContent = getMessageContent(m);
                const isLastAssistantMessage =
                  m.role === 'assistant' && index === messages.length - 1;

                return (
                  <div
                    key={m.id || index}
                    className={`flex items-start gap-3 ${
                      m.role === 'user' ? 'flex-row-reverse' : 'flex-row'
                    }`}
                  >
                    <Avatar
                      size={36}
                      icon={m.role === 'user' ? <UserOutlined /> : <RobotOutlined />}
                      className={
                        m.role === 'user'
                          ? 'bg-indigo-600 shrink-0 shadow-sm'
                          : 'bg-emerald-600 shrink-0 shadow-sm'
                      }
                    />

                    <div
                      className={`max-w-[85%] px-5 py-4 rounded-2xl text-sm ${
                        m.role === 'user'
                          ? 'bg-indigo-600 text-white shadow-sm'
                          : 'bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)]'
                      }`}
                    >
                      {/* 支持 Markdown 渲染 */}
                      {textContent ? (
                        <div
                          className={`prose-chat max-w-none break-words ${
                            m.role === 'user' ? 'prose-chat-invert' : ''
                          }`}
                        >
                          <ReactMarkdown remarkPlugins={[remarkGfm]}>
                            {textContent}
                          </ReactMarkdown>
                          {/* 流式打字生成中的打字机光标动画 */}
                          {isLoading && isLastAssistantMessage && (
                            <span className="inline-block w-2 h-4 ml-1 bg-emerald-500 animate-pulse align-middle rounded-sm" />
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center gap-2 py-0.5 text-xs text-slate-400">
                          <span>AI 正在思考并检索知识库...</span>
                          <div className="flex items-center gap-1">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}

              {/* 当在等待首字响应（意图识别/向量检索阶段），还没有出现 assistant 消息或内容为空时，展示 Loading 思考气泡 */}
              {isLoading &&
                (messages.length === 0 ||
                  messages[messages.length - 1].role === 'user' ||
                  (messages[messages.length - 1].role === 'assistant' &&
                    !getMessageContent(messages[messages.length - 1]))) && (
                  <div className="flex items-start gap-3 flex-row">
                    <Avatar
                      size={36}
                      icon={<RobotOutlined />}
                      className="bg-emerald-600 shrink-0 shadow-sm"
                    />
                    <div className="max-w-[85%] px-5 py-4 rounded-2xl text-sm bg-white text-slate-800 shadow-[0_1px_2px_rgba(15,23,42,0.06),0_4px_12px_rgba(15,23,42,0.04)] flex items-center gap-2.5">
                      <span className="text-slate-500 text-xs font-medium">
                        AI 正在思考并检索知识库...
                      </span>
                      <div className="flex items-center gap-1.5 py-0.5">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.3s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce [animation-delay:-0.15s]" />
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-bounce" />
                      </div>
                    </div>
                  </div>
                )}
            </>
          )}
        </div>

        {/* 底部输入框 */}
        <div className="px-5 py-4 bg-white border-t border-slate-200">
          <form onSubmit={onSubmit} className="flex gap-3 items-end">
            <Input.TextArea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="输入问题，Enter 发送，Shift + Enter 换行"
              autoSize={{ minRows: 1, maxRows: 5 }}
              onPressEnter={(e) => {
                if (!e.shiftKey) {
                  e.preventDefault();
                  onSubmit();
                }
              }}
              className="!rounded-2xl !py-3 !px-4 !text-[15px] resize-none"
            />
            {isLoading ? (
              <Button
                type="primary"
                danger
                onClick={() => stop()}
                icon={<PauseOutlined className="text-lg" />}
                title="停止生成"
                className="!rounded-2xl !h-12 !w-12 shrink-0 !flex !items-center !justify-center !border-none !shadow-none !bg-rose-500 hover:!bg-rose-600 !text-white"
              />
            ) : (
              <Button
                type="primary"
                htmlType="submit"
                icon={<SendOutlined className="text-lg" />}
                disabled={!input.trim()}
                className={`!rounded-2xl !h-12 !w-12 shrink-0 !flex !items-center !justify-center !border-none !shadow-none ${
                  input.trim()
                    ? '!bg-emerald-600 hover:!bg-emerald-500 !text-white'
                    : '!bg-slate-200 !text-slate-400 !cursor-not-allowed'
                }`}
              />
            )}
          </form>
        </div>
      </div>
    </Drawer>
  );
};
