import { Injectable, Logger } from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly db: DatabaseService) {}

  /**
   * Automatically detects whether rawIdentifier is an email or phone number,
   * normalizes input, and finds active non-deleted user using parameterized query.
   */
  async findUserByIdentifier(rawIdentifier: string): Promise<User | null> {
    if (!rawIdentifier) {
      return null;
    }

    const trimmed = rawIdentifier.trim();
    const isEmail = trimmed.includes('@');

    if (isEmail) {
      const normalizedEmail = trimmed.toLowerCase();
      this.logger.debug(`Searching user by email: ${normalizedEmail}`);
      return this.db.user.findFirst({
        where: {
          email: {
            equals: normalizedEmail,
            mode: 'insensitive',
          },
          deletedAt: null,
        },
      });
    }

    // Phone number normalization: remove spaces, dashes, +91/91 prefix
    let cleanedPhone = trimmed.replace(/[\s\-\(\)\+]/g, '');
    if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
      cleanedPhone = cleanedPhone.substring(2);
    }

    this.logger.debug(`Searching user by mobile: ${cleanedPhone}`);
    return this.db.user.findFirst({
      where: {
        mobile: cleanedPhone,
        deletedAt: null,
      },
    });
  }

  /**
   * Optimized user lookup selecting ONLY required fields for check-user endpoint.
   */
  async findMinimalUserByIdentifier(rawIdentifier: string) {
    if (!rawIdentifier) return null;

    const trimmed = rawIdentifier.trim();
    const isEmail = trimmed.includes('@');

    const select = {
      id: true,
      email: true,
      mobile: true,
      role: true,
      status: true,
      isBuyer: true,
      isSeller: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    };

    if (isEmail) {
      const normalizedEmail = trimmed.toLowerCase();
      return this.db.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
          deletedAt: null,
        },
        select,
      });
    }

    let cleanedPhone = trimmed.replace(/[\s\-\(\)\+]/g, '');
    if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
      cleanedPhone = cleanedPhone.substring(2);
    }

    return this.db.user.findFirst({
      where: {
        mobile: cleanedPhone,
        deletedAt: null,
      },
      select,
    });
  }


  async incrementFailedLoginAttempts(
    userId: string,
    currentAttempts: number,
    lockoutDurationMinutes = 15,
  ): Promise<{ attempts: number; isLocked: boolean; lockedUntil: Date | null }> {
    const newAttempts = currentAttempts + 1;
    let lockedUntil: Date | null = null;
    let isLocked = false;

    if (newAttempts >= 5) {
      lockedUntil = new Date(Date.now() + lockoutDurationMinutes * 60 * 1000);
      isLocked = true;
    }

    await this.db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: newAttempts,
        lockedUntil: lockedUntil,
      },
    });

    return { attempts: newAttempts, isLocked, lockedUntil };
  }

  async resetLoginAttemptsAndRecordLogin(userId: string): Promise<void> {
    await this.db.user.update({
      where: { id: userId },
      data: {
        failedLoginAttempts: 0,
        lockedUntil: null,
        lastLoginAt: new Date(),
      },
    });
  }
}
