import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { UserRepository } from './user.repository';
import { CheckUserQueryDto } from './dto/check-user-query.dto';
import { CheckUserResponseDto } from './dto/check-user-response.dto';

@Injectable()
export class UserService {
  private readonly logger = new Logger(UserService.name);

  constructor(
    private readonly db: DatabaseService,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Check whether a user exists by email, phoneNumber, or both.
   */
  async checkUserExists(
    query: CheckUserQueryDto,
  ): Promise<CheckUserResponseDto> {
    const { email, phoneNumber } = query;

    // Validation: At least one parameter must be provided
    if (!email && !phoneNumber) {
      this.logger.warn('Check user attempt failed: Neither email nor phoneNumber provided.');
      throw new BadRequestException({
        success: false,
        message: 'Either email or phoneNumber is required.',
      });
    }

    this.logger.log(
      `Checking user existence for email: [${email || 'N/A'}], phoneNumber: [${phoneNumber || 'N/A'}]`,
    );

    const user = await this.userRepository.findByEmailOrPhone(email, phoneNumber);

    if (user) {
      this.logger.log(`User found with ID: ${user.id}`);
      return {
        success: true,
        exists: true,
        user: {
          id: user.id,
          email: user.email,
          phoneNumber: user.mobile,
          status: user.status,
        },
        message: 'User found.',
      };
    }

    this.logger.log('User check completed: User does not exist.');
    return {
      success: true,
      exists: false,
      user: null,
      message: 'User does not exist.',
    };
  }

  async getUserProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        companyName: true,
        role: true,
        status: true,
        address: true,
        pincode: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return user;
  }

  async updateUserProfile(userId: string, data: any) {
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.address && { address: data.address }),
        ...(data.pincode && { pincode: data.pincode }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        status: true,
        address: true,
        pincode: true,
        city: true,
        state: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.db.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
