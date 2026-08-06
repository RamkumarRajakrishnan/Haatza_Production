import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AuthRepository } from './auth.repository';
import { DatabaseService } from '../../database/database.service';
import { Platform } from './dto/check-user.dto';

describe('AuthService', () => {
  let service: AuthService;
  let authRepository: jest.Mocked<AuthRepository>;
  let jwtService: jest.Mocked<JwtService>;

  beforeEach(async () => {
    const mockAuthRepository = {
      findUserByIdentifier: jest.fn(),
      findMinimalUserByIdentifier: jest.fn(),
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
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `sess_${Date.now()}`, ...data })),
      },
      refreshToken: {
        create: jest.fn().mockImplementation(({ data }) => Promise.resolve({ id: `rt_${Date.now()}`, ...data })),
      },
      userLoginHistory: {
        create: jest.fn(),
      },
    };

    const mockJwtService = {
      signAsync: jest.fn().mockResolvedValue('jwt_token_stub'),
      sign: jest.fn().mockReturnValue('jwt_token_stub'),
    };

    const mockConfigService = {
      get: jest.fn((key: string) => {
        if (key === 'JWT_REFRESH_SECRET') return 'env_jwt_refresh_secret';
        if (key === 'JWT_SECRET') return 'env_jwt_secret';
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
        service.login({ identifier: 'test_unregistered@domain.test', password: 'test_password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw UnauthorizedException if account is locked', async () => {
      authRepository.findUserByIdentifier.mockResolvedValue({
        id: 'user_locked_id',
        lockedUntil: new Date(Date.now() + 600000),
      } as any);

      await expect(
        service.login({ identifier: 'test_locked@domain.test', password: 'test_password' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should return tokens and user details on successful login', async () => {
      const rawPassword = 'SecurePassword123!';
      const hashedPassword = await bcrypt.hash(rawPassword, 10);
      const mockUser = {
        id: 'user_active_id',
        name: 'Test Account',
        email: 'user@domain.test',
        mobile: '1000000000',
        password: hashedPassword,
        role: 'BUYER',
        status: 'ACTIVE',
        failedLoginAttempts: 0,
        lockedUntil: null,
      };

      authRepository.findUserByIdentifier.mockResolvedValue(mockUser as any);

      const result = await service.login({
        identifier: mockUser.email,
        password: rawPassword,
      });

      expect(result.success).toBe(true);
      expect(result.accessToken).toBe('jwt_token_stub');
      expect(result.refreshToken).toBe('jwt_token_stub');
      expect(result.user).toEqual({
        id: mockUser.id,
        name: mockUser.name,
        email: mockUser.email,
        phoneNumber: mockUser.mobile,
        role: mockUser.role,
        status: mockUser.status,
      });
      expect(authRepository.resetLoginAttemptsAndRecordLogin).toHaveBeenCalledWith(mockUser.id);
    });
  });

  describe('checkUser', () => {
    it('should return exists: false and nextStep: REGISTER when user does not exist', async () => {
      authRepository.findMinimalUserByIdentifier.mockResolvedValue(null);

      const result = await service.checkUser({
        identifier: 'non_existent@domain.test',
        platform: Platform.BUYER,
      });

      expect(result).toEqual({
        success: true,
        message: 'User not found.',
        data: {
          exists: false,
          userId: '',
          identifierType: 'EMAIL',
          userType: '',
          isActive: '',
          emailVerified: '',
          phoneVerified: '',
          nextStep: 'REGISTER',
        },
      });
    });

    it('Case 1: should return LOGIN when user is buyer and request platform is BUYER', async () => {
      const mockUser = {
        id: 'usr_buyer_1',
        email: 'buyer@domain.test',
        mobile: '1000000001',
        role: 'BUYER',
        status: 'ACTIVE',
        isBuyer: true,
        isSeller: false,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      };

      authRepository.findMinimalUserByIdentifier.mockResolvedValue(mockUser as any);

      const result = await service.checkUser({
        identifier: mockUser.email,
        platform: Platform.BUYER,
      });

      expect(result).toEqual({
        success: true,
        message: 'User found.',
        data: {
          exists: true,
          userId: mockUser.id,
          identifierType: 'EMAIL',
          userType: mockUser.role,
          isActive: true,
          emailVerified: true,
          phoneVerified: true,
          nextStep: 'LOGIN',
        },
      });
    });

    it('Case 2: should return REGISTER when user is buyer-only but request platform is SELLER', async () => {
      const mockUser = {
        id: 'usr_buyer_1',
        email: 'buyer@domain.test',
        mobile: '1000000001',
        role: 'BUYER',
        status: 'ACTIVE',
        isBuyer: true,
        isSeller: false,
      };

      authRepository.findMinimalUserByIdentifier.mockResolvedValue(mockUser as any);

      const result = await service.checkUser({
        identifier: mockUser.email,
        platform: Platform.SELLER,
      });

      expect(result).toEqual({
        success: true,
        message: 'User is not registered as a seller.',
        data: {
          exists: false,
          userId: '',
          identifierType: 'EMAIL',
          userType: '',
          isActive: '',
          emailVerified: '',
          phoneVerified: '',
          nextStep: 'REGISTER',
        },
      });
    });

    it('Case 3: should return LOGIN for both BUYER and SELLER platforms when isBuyer=true and isSeller=true', async () => {
      const mockUser = {
        id: 'usr_both_1',
        email: 'both@domain.test',
        mobile: '1000000002',
        role: 'SELLER',
        status: 'ACTIVE',
        isBuyer: true,
        isSeller: true,
        emailVerifiedAt: new Date(),
        phoneVerifiedAt: new Date(),
      };

      authRepository.findMinimalUserByIdentifier.mockResolvedValue(mockUser as any);

      const buyerResult = await service.checkUser({
        identifier: mockUser.email,
        platform: Platform.BUYER,
      });
      expect(buyerResult.data.nextStep).toBe('LOGIN');
      expect(buyerResult.data.exists).toBe(true);

      const sellerResult = await service.checkUser({
        identifier: mockUser.email,
        platform: Platform.SELLER,
      });
      expect(sellerResult.data.nextStep).toBe('LOGIN');
      expect(sellerResult.data.exists).toBe(true);
    });
  });
});

