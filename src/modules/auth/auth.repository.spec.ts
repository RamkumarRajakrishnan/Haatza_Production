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
      const email = 'user@domain.test';
      db.user.findFirst.mockResolvedValue({ id: 'user_id_1', email });

      const result = await repository.findUserByIdentifier(` ${email.toUpperCase()} `);

      expect(result).toEqual({ id: 'user_id_1', email });
      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          email: { equals: email, mode: 'insensitive' },
        },
      });
    });

    it('should search by mobile number when identifier is phone', async () => {
      const phone = '1000000002';
      db.user.findFirst.mockResolvedValue({ id: 'user_id_2', mobile: phone });

      const result = await repository.findUserByIdentifier(` +91 ${phone} `);

      expect(result).toEqual({ id: 'user_id_2', mobile: phone });
      expect(db.user.findFirst).toHaveBeenCalledWith({
        where: {
          mobile: phone,
        },
      });
    });
  });
});
