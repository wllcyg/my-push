import { Test, TestingModule } from '@nestjs/testing';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: AuthService;

  const mockAuthService = {
    login: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
    authService = module.get<AuthService>(AuthService);
  });

  it('应该成功初始化 AuthController', () => {
    expect(controller).toBeDefined();
  });

  it('POST /auth/login 应当正确转交 AuthDTO 给 AuthService.login', async () => {
    const loginDto = { username: 'admin', password: '123456' };
    const mockResponse = {
      code: 200,
      message: '登录成功',
      data: { token: 'mock-token', user: { username: 'admin' } },
    };

    mockAuthService.login.mockResolvedValue(mockResponse);

    const res = await controller.login(loginDto);

    expect(authService.login).toHaveBeenCalledWith(loginDto);
    expect(res).toEqual(mockResponse);
  });
});
