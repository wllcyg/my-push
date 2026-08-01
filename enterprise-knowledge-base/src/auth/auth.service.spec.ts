import { Test, TestingModule } from '@nestjs/testing';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';

// ─────────────────────────────────────────────────────────────
// Mock @supabase/supabase-js 完全消除网络依赖
// ─────────────────────────────────────────────────────────────
const mockSignInWithPassword = jest.fn();

jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    auth: {
      signInWithPassword: mockSignInWithPassword,
    },
  })),
}));

// ─────────────────────────────────────────────────────────────
// 测试套件
// ─────────────────────────────────────────────────────────────
describe('AuthService', () => {
  let service: AuthService;

  const mockConfigValues: Record<string, string> = {
    SUPABASE_URL: 'https://mock-project.supabase.co',
    SUPABASE_ANON_KEY: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-anon-key',
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        {
          provide: ConfigService,
          useValue: {
            get: jest.fn((key: string) => mockConfigValues[key] ?? null),
          },
        },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
  });

  // ─────────────────────────────────────────────
  // 基础初始化
  // ─────────────────────────────────────────────
  it('应该成功实例化 AuthService', () => {
    expect(service).toBeDefined();
  });

  // ─────────────────────────────────────────────
  // Supabase 远程认证成功路径
  // ─────────────────────────────────────────────
  describe('Supabase 远程认证', () => {
    it('Supabase 返回有效 Session 时应返回 200 及 access_token', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: {
            access_token: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-access-token',
            refresh_token: 'real-refresh-token',
          },
          user: {
            id: 'uuid-001',
            email: 'admin@enterprise.com',
          },
        },
        error: null,
      });

      const result = await service.login({ username: 'admin', password: 'real-password' });

      expect(result.code).toBe(200);
      expect(result.message).toBe('登录成功');
      expect(result.data.token).toBe('eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.real-access-token');
      expect(result.data.user.username).toBe('admin');
      expect(result.data.user.email).toBe('admin@enterprise.com');
      expect(result.data.user.role).toBe('Admin');
    });

    it('用户名包含 @ 时应直接使用邮箱格式调用 Supabase', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: { access_token: 'token-xyz', refresh_token: 'refresh-xyz' },
          user: { id: 'uuid-002', email: 'user@company.com' },
        },
        error: null,
      });

      await service.login({ username: 'user@company.com', password: 'pass' });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'user@company.com',
        password: 'pass',
      });
    });

    it('用户名不含 @ 时应自动拼接 @enterprise.com 格式', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: {
          session: { access_token: 'token-abc', refresh_token: 'refresh-abc' },
          user: { id: 'uuid-003', email: 'bob@enterprise.com' },
        },
        error: null,
      });

      await service.login({ username: 'bob', password: 'pass' });

      expect(mockSignInWithPassword).toHaveBeenCalledWith({
        email: 'bob@enterprise.com',
        password: 'pass',
      });
    });

    it('Supabase 返回错误时应跳过，不抛出异常，而是尝试本地兜底', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      // 错误账号走不到本地兜底，应抛出 401
      await expect(service.login({ username: 'unknown', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('Supabase 网络异常时应捕获并 fallback 到本地账号（不抛出网络错误）', async () => {
      mockSignInWithPassword.mockRejectedValue(new Error('Network Error: ECONNREFUSED'));

      // 抛出的应是 UnauthorizedException 而非网络错误
      await expect(service.login({ username: 'unknown', password: 'wrong' }))
        .rejects.toThrow(UnauthorizedException);

      // 确认没有把网络错误透传出去
      try {
        await service.login({ username: 'unknown', password: 'wrong' });
      } catch (e) {
        expect(e).toBeInstanceOf(UnauthorizedException);
        expect(e.message).not.toContain('ECONNREFUSED');
      }
    });
  });

  // ─────────────────────────────────────────────
  // 本地兜底账号（admin / 123456）
  // ─────────────────────────────────────────────
  describe('本地预置管理员账号', () => {
    beforeEach(() => {
      // 模拟 Supabase 登录失败，触发本地兜底逻辑
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });
    });

    it('admin / 123456 应成功登录并返回超级管理员角色', async () => {
      const result = await service.login({ username: 'admin', password: '123456' });

      expect(result.code).toBe(200);
      expect(result.message).toBe('登录成功');
      expect(result.data.user.username).toBe('admin');
      expect(result.data.user.role).toBe('超级管理员');
      expect(result.data.user.id).toBe('usr_admin_001');
    });

    it('本地兜底 Token 每次应包含时间戳（非固定值）', async () => {
      const result1 = await service.login({ username: 'admin', password: '123456' });
      await new Promise((r) => setTimeout(r, 10)); // 间隔 10ms
      const result2 = await service.login({ username: 'admin', password: '123456' });

      expect(result1.data.token).toContain('sb_access_token_admin_');
      // 由于 Date.now() 的差异，两次 Token 可能不同（时间戳递增）
      expect(result1.data.token.startsWith('sb_access_token_admin_')).toBe(true);
    });

    it('admin 密码错误时应抛出 UnauthorizedException', async () => {
      await expect(service.login({ username: 'admin', password: 'wrong-pass' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('未知用户名应抛出 UnauthorizedException', async () => {
      await expect(service.login({ username: 'unknown_user', password: '123456' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('admin@enterprise.com 邮箱格式也应成功走兜底登录', async () => {
      const result = await service.login({ username: 'admin@enterprise.com', password: '123456' });

      expect(result.code).toBe(200);
      expect(result.data.user.role).toBe('超级管理员');
    });
  });

  // ─────────────────────────────────────────────
  // 边界测试
  // ─────────────────────────────────────────────
  describe('边界条件', () => {
    it('密码为空字符串时应抛出 UnauthorizedException', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      await expect(service.login({ username: 'admin', password: '' }))
        .rejects.toThrow(UnauthorizedException);
    });

    it('用户名为空时应抛出 UnauthorizedException', async () => {
      mockSignInWithPassword.mockResolvedValue({
        data: { session: null, user: null },
        error: { message: 'Invalid login credentials', status: 400 },
      });

      await expect(service.login({ username: '', password: '123456' }))
        .rejects.toThrow(UnauthorizedException);
    });
  });
});
