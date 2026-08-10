import { Injectable, Logger } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

export interface UserCheckRecord {
  id: string;
  email: string | null;
  mobile: string;
  status: string;
}

@Injectable()
export class UserRepository {
  private readonly logger = new Logger(UserRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Find an active, non-soft-deleted user by email, phone, or both.
   * Parameterized query via Prisma ensures protection against SQL injection.
   */
  async findByEmailOrPhone(
    email?: string,
    phoneNumber?: string,
  ): Promise<UserCheckRecord | null> {
    if (!email && !phoneNumber) {
      return null;
    }

    const conditions: any[] = [];

    if (email) {
      conditions.push({
        email: {
          equals: email.toLowerCase(),
          mode: 'insensitive',
        },
      });
    }

    if (phoneNumber) {
      conditions.push({
        mobile: phoneNumber,
      });
    }

    this.logger.debug(
      `Executing findByEmailOrPhone query for email: ${email || 'N/A'}, phone: ${phoneNumber || 'N/A'}`,
    );

    const user = await this.db.user.findFirst({
      where: {
        OR: conditions,
      },
      select: {
        id: true,
        email: true,
        mobile: true,
        status: true,
      },
    });

    if (!user) {
      return null;
    }

    return {
      id: user.id,
      email: user.email,
      mobile: user.mobile,
      status: user.status,
    };
  }
}
