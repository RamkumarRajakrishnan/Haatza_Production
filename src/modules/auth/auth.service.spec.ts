import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { DatabaseService } from '../../database/database.service';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockAuthRepository = {
      findUserByIdentifier: jest.fn(),
      incrementFailedLoginAttempts: jest.fn(),
      resetLoginAttemptsAndRecordLogin: jest.fn(),
    };

    const mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
        findFirst: jest.fn(),
      },
      role: {
        findFirst: jest.fn(),
      },
      userSession: {
        create: jest.fn().mockResolvedValue({ id: 'sess-1' }),
      },
      refreshToken: {
        create: jest.fn().mockResolvedValue({ id: 'rt-1' }),
      },
      userLoginHistory: {
        create: jest.fn(),
      },
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('mocked_token'),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'test_refresh_secret';
        if (key === 'JWT_SECRET') return 'test_jwt_secret';
        return null;
      }),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: AuthRepository, useValue: mockAuthRepository },
        { provide: DatabaseService, useValue: mockDatabaseService },
        { provide: JwtService, useValue: mockJwtService },
        { provide: ConfigService, useValue: mockConfigService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    authRepository = module.get(AuthRepository);
    jwtService = module.get(JwtService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('login', () => {
    it('should throw UnauthorizedException if user is not found', async () => {
      authRepository.findUserByIdentifier.mockResolvedValue(null);

      await expect(
        service.login({ identifier: 'unknown@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is locked', async () => {
      authRepository.findUserByIdentifier.mockResolvedValue({
        id: 'usr-locked',
        lockedUntil: new Date(Date.now() + 100000),
      } as any);

      await expect(
        service.login({ identifier: 'locked@example.com', password: 'pass' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user details on successful login', async () => {
      const hashedPassword = await bcrypt.hash('Secret123!', 10);
      authRepository.findUserByIdentifier.mockResolvedValue({
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        mobile: '9876543210',
        password: hashedPassword,
        role: 'BUYER',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      } as any);

      const result = await service.login({
        identifier: 'john@example.com',
        password: 'Secret123!',
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('mocked_token');
      expect(result.refreshToken).toBe('mocked_token');
      expect(result.user).toEqual({
        id: 'usr-1',
        name: 'John Doe',
        email: 'john@example.com',
        phoneNumber: '9876543210',
        role: 'BUYER',
        status: 'ACTIVE',
      });
      expect(authRepository.resetLoginAttemptsAndRecordLogin).toHaveBeenCalledWith('usr-1');
    });
  });
});
