import { Test, TestingModule } from '@nestjs/testing';
import { UserController } from './user.controller';
import { UserService } from './user.service';

describe('UserController', () => {
  let controller: UserController;
  let service: jest.Mocked<UserService>;

  beforeEach(async () => {
    const mockUserService = {
      checkUserExists: jest.fn(),
      getUserProfile: jest.fn(),
      updateUserProfile: jest.fn(),
      getAllUsers: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [UserController],
      providers: [{ provide: UserService, useValue: mockUserService }],
    }).compile();

    controller = module.get<UserController>(UserController);
    service = module.get(UserService);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('checkUser', () => {
    it('should call userService.checkUserExists with query dto', async () => {
      const email = 'user@domain.test';
      const phoneNumber = '1000000005';
      const queryDto = { email, phoneNumber };
      const expectedResult = {
        success: true,
        exists: true,
        user: {
          id: 'user_id_stub',
          email,
          phoneNumber,
          status: 'ACTIVE',
        },
        message: 'User found.',
      };

      service.checkUserExists.mockResolvedValue(expectedResult);

      const response = await controller.checkUser(queryDto);

      expect(response).toEqual(expectedResult);
      expect(service.checkUserExists).toHaveBeenCalledWith(queryDto);
    });
  });
});
