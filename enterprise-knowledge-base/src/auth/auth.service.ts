import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);
  private supabase: SupabaseClient;

  constructor(private readonly configService: ConfigService) {
    const supabaseUrl =
      this.configService.get<string>('SUPABASE_URL') ||
      'https://drhaetogukdhfwyrzyeq.supabase.co';
    const supabaseKey =
      this.configService.get<string>('SUPABASE_ANON_KEY') ||
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-key';

    this.supabase = createClient(supabaseUrl, supabaseKey);
  }

  /**
   * Supabase 账号密码登录
   */
  async login(loginDto: LoginDto) {
    const { username, password } = loginDto;
    this.logger.log(`🔑 收到用户登录请求: ${username}`);

    // 将普通用户名转换为符合标准的 Supabase Auth 邮箱格式
    const email = username.includes('@') ? username : `${username}@enterprise.com`;

    try {
      // 1. 调用 Supabase 真实 Auth 服务登录
      const { data, error } = await this.supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (!error && data?.session) {
        this.logger.log(`✅ Supabase 远程认证成功: ${email}`);
        return {
          code: 200,
          message: '登录成功',
          data: {
            token: data.session.access_token,
            refreshToken: data.session.refresh_token,
            user: {
              id: data.user.id,
              username: username,
              email: data.user.email,
              role: 'Admin',
              avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=' + username,
            },
          },
        };
      }
    } catch (err: any) {
      this.logger.warn(`Supabase 接口连接警告: ${err.message}`);
    }

    // 2. 预置快捷测试账号校验 (默认快捷账户: admin / 123456)
    if (
      (username === 'admin' || username === 'admin@enterprise.com') &&
      password === '123456'
    ) {
      this.logger.log(`✅ 预设管理员本地兜底登录成功: ${username}`);
      return {
        code: 200,
        message: '登录成功',
        data: {
          token: `sb_access_token_admin_${Date.now()}`,
          refreshToken: `sb_refresh_token_${Date.now()}`,
          user: {
            id: 'usr_admin_001',
            username: 'admin',
            email: 'admin@enterprise.com',
            role: '超级管理员',
            avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=admin',
          },
        },
      };
    }

    // 3. 校验失败抛出 401 异常
    throw new UnauthorizedException('账号或密码错误（默认测试账号：admin / 123456）');
  }
}
