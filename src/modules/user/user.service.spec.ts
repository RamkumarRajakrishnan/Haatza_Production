import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { UserService } from './user.service';
import { UserRepository } from './user.repository';
import { DatabaseService } from '../../database/database.service';

describe('UserService', () => {
  let service: UserService;
  let repository: jest.Mocked<UserRepository>;

  beforeEach(async () => {
    const mockRepository = {
      findByEmailOrPhone: jest.fn(),
    };

    const mockDatabaseService = {
      user: {
        findUnique: jest.fn(),
        update: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserService,
        { provide: UserRepository, useValue: mockRepository },
        { provide: DatabaseService, useValue: mockDatabaseService },
      ],
    }).compile();

    service = module.get<UserService>(UserService);
    repository = module.get(UserRepository);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('checkUserExists', () => {
    it('should throw BadRequestException if neither email nor phoneNumber is provided', async () => {
      await expect(service.checkUserExists({})).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should return user exists response when user is found by email', async () => {
      repository.findByEmailOrPhone.mockResolvedValue({
        id: 'usr-123',
        email: 'test@example.com',
        mobile: '9876543210',
        status: 'ACTIVE',
      });

      const result = await service.checkUserExists({ email: 'test@example.com' });

      expect(result).toEqual({
        success: true,
        exists: true,
        user: {
          id: 'usr-123',
          email: 'test@example.com',
          phoneNumber: '9876543210',
          status: 'ACTIVE',
        },
        message: 'User found.',
      });
      expect(repository.findByEmailOrPhone).toHaveBeenCalledWith(
        'test@example.com',
        undefined,
      );
    });

    it('should return user exists response when user is found by phoneNumber', async () => {
      repository.findByEmailOrPhone.mockResolvedValue({
        id: 'usr-456',
        email: 'john@example.com',
        mobile: '9876543210',
        status: 'ACTIVE',
      });

      const result = await service.checkUserExists({ phoneNumber: '9876543210' });

      expect(result).toEqual({
        success: true,
        exists: true,
        user: {
          id: 'usr-456',
          email: 'john@example.com',
          phoneNumber: '9876543210',
          status: 'ACTIVE',
        },
        message: 'User found.',
      });
    });

    it('should return user does not exist response when no user is found', async () => {
      repository.findByEmailOrPhone.mockResolvedValue(null);

      const result = await service.checkUserExists({
        email: 'unknown@example.com',
        phoneNumber: '9000000000',
      });

      expect(result).toEqual({
        success: true,
        exists: false,
        user: null,
        message: 'User does not exist.',
      });
    });
  });
});
