import { Injectable, Logger } from '@nestjs/common';
import { User, UserStatus } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class AuthRepository {
  private readonly logger = new Logger(AuthRepository.name);

  constructor(private readonly db: DatabaseService) { }

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
      },
    });
  }

  /**
   * Finds an active user where BOTH email and mobile match the exact same user record.
   */
  async findUserByEmailAndMobile(email: string, mobile: string): Promise<User | null> {
    if (!email || !mobile) {
      return null;
    }

    const normalizedEmail = email.trim().toLowerCase();

    let cleanedPhone = mobile.trim().replace(/[\s\-\(\)\+]/g, '');
    if (cleanedPhone.startsWith('91') && cleanedPhone.length === 12) {
      cleanedPhone = cleanedPhone.substring(2);
    }

    this.logger.debug(`Searching user matching both email (${normalizedEmail}) and mobile (${cleanedPhone})`);

    return this.db.user.findFirst({
      where: {
        email: {
          equals: normalizedEmail,
          mode: 'insensitive',
        },
        OR: [
          { mobile: cleanedPhone },
          { mobile: `+91${cleanedPhone}` },
          { mobile: `91${cleanedPhone}` },
        ],
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
      isEmployee: true,
      emailVerifiedAt: true,
      phoneVerifiedAt: true,
    };

    if (isEmail) {
      const normalizedEmail = trimmed.toLowerCase();
      return this.db.user.findFirst({
        where: {
          email: { equals: normalizedEmail, mode: 'insensitive' },
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

  /**
   * Find active roles assigned to user via user_role JOIN role_master.
   * Strictly restricted to users with isEmployee === true.
   */
  async findUserAssignedRoles(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { isEmployee: true },
    });

    if (!user || user.isEmployee !== true) {
      return [];
    }

    const assignments = await this.db.userRoleMapping.findMany({
      where: {
        userId,
        isActive: true,
        role: {
          isActive: true,
        },
      },
      select: {
        role: {
          select: {
            id: true,
            roleCode: true,
            roleName: true,
            isActive: true,
          },
        },
      },
    });

    return assignments.map((a) => a.role);
  }

  /**
   * Verify if a specific role is assigned to a user and is active.
   * Strictly restricted to users with isEmployee === true.
   */
  async findUserRoleById(userId: string, roleId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: { isEmployee: true },
    });

    if (!user || user.isEmployee !== true) {
      return null;
    }

    const assignment = await this.db.userRoleMapping.findFirst({
      where: {
        userId,
        roleId,
        isActive: true,
        role: {
          isActive: true,
        },
      },
      select: {
        role: {
          select: {
            id: true,
            roleCode: true,
            roleName: true,
            isActive: true,
          },
        },
      },
    });

    return assignment?.role || null;
  }

  /**
   * Find permissions (pages) for a specific role ID from role_page_master.
   */
  async findRolePagesByRoleId(roleId: string) {
    return this.db.rolePageMaster.findMany({
      where: {
        roleId,
      },
      select: {
        pageCode: true,
        pageName: true,
        route: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
    });
  }

  /**
   * Find permissions (pages) for a specific role code from role_page_master.
   */
  async findRolePagesByRoleCode(roleCode: string) {
    const role = await this.db.roleMaster.findFirst({
      where: {
        roleCode: { equals: roleCode, mode: 'insensitive' },
        isActive: true,
      },
      select: {
        id: true,
        roleCode: true,
        roleName: true,
      },
    });

    if (!role) return null;

    const pages = await this.db.rolePageMaster.findMany({
      where: { roleId: role.id },
      select: {
        pageCode: true,
        pageName: true,
        route: true,
        canView: true,
        canCreate: true,
        canEdit: true,
        canDelete: true,
      },
    });

    return { role, pages };
  }
}
