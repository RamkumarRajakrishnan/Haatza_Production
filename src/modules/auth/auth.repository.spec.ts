import { Test, TestingModule } from '@nestjs/testing';
import { AuthRepository } from './auth.repository';
import { DatabaseService } from '../../database/database.service';

describe('AuthRepository', () => {
  let repository: AuthRepository;
  let db: any;

  beforeEach(async () => {
    const mockDb = {
      user: {
        findFirst: jest.fn(),
        update: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthRepository,
        { provide: DatabaseService, useValue: mockDb },
      ],
    }).compile();

    repository = module.get<AuthRepository>(AuthRepository);
    db = module.get(DatabaseService);
  });

  it('should be defined', () => {
    expect(repository).toBeDefined();
  });

  describe('findUserByIdentifier', () => {
    it('should search by email in lowercase when identifier contains @', async () => {
      db.user.findFirst.mockResolvedValue({ id: 'usr-1', email: 'user@example.com' });

      const result = await repository.findUserByIdentifier(' User@Example.com ');

      expect(result).toEqual({ id: 'usr-1', email: 'user@example.com' });
      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: 'user@example.com', mode: 'insensitive' },
          deletedAt: null,
        },
      });
    });

    it('should search by mobile number when identifier is phone', async () => {
      db.user.findFirst.mockResolvedValue({ id: 'usr-2', mobile: '9876543210' });

      const result = await repository.findUserByIdentifier(' +91 9876543210 ');

      expect(result).toEqual({ id: 'usr-2', mobile: '9876543210' });
      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          mobile: '9876543210',
          deletedAt: null,
        },
      });
    });
  });
});
