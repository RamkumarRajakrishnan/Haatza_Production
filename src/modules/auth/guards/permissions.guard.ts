import { CanActivate, ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from '../decorators/permissions.decorator';
import { DatabaseService } from '../../../database/database.service';

interface RequestWithUser {
  user?: {
    id?: string;
    role?: string;
  };
}

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(
    private reflector: Reflector,
    private database: DatabaseService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );

    if (!requiredPermissions || requiredPermissions.length === 0) {
      return true;
    }

    const request = context.switchToHttp().getRequest<RequestWithUser>();
    const user = request.user;
    if (!user || !user.id) {
      return false;
    }

    // Fetch user with userRole and role permissions
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const dbUser = (await (this.database.user as any).findUnique({
      where: { id: user.id },
      include: {
        userRole: {
          include: {
            permissions: {
              include: {
                permission: true,
              },
            },
          },
        },
      },
    })) as {
      userRole?: {
        permissions: Array<{
          permission: {
            code: string;
          };
        }>;
      } | null;
    } | null;

    if (!dbUser || !dbUser.userRole) {
      return false;
    }

    const userPermissionCodes = dbUser.userRole.permissions.map(
      (rp) => rp.permission.code,
    );

    return requiredPermissions.every((permission) =>
      userPermissionCodes.includes(permission),
    );
  }
}
