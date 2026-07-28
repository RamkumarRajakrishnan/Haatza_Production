import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { DatabaseService } from '../../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const LoginStatus = {
  SUCCESS: 'SUCCESS',
  FAILED: 'FAILED',
} as const;

@Injectable()
export class AuthService {
  constructor(
    private database: DatabaseService,
    private jwtService: JwtService,
  ) {}

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private get db(): any {
    return this.database as any;
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(data: RegisterDto) {
    const existingUser = await this.db.user.findUnique({
      where: {
        mobile: data.mobile,
      },
    });

    if (existingUser) {
      throw new ConflictException('Mobile number already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    // Look up corresponding Role record from DB if available
    const roleRecord = await this.db.role.findFirst({
      where: {
        OR: [{ name: data.role }, { code: data.role.toLowerCase() }],
      },
    });

    const user = await this.db.user.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email,
        password: hashedPassword,
        role: data.role,
        roleId: roleRecord ? roleRecord.id : null,
      },
    });

    return {
      message: 'Registration successful',
      userId: user.id,
    };
  }

  private readonly logger = new Logger(AuthService.name);

  async login(
    data: LoginDto,
    reqMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.db.user.findUnique({
      where: {
        mobile: data.mobile,
      },
      select: {
        id: true,
        name: true,
        mobile: true,
        password: true,
        role: true,
        status: true,
      },
    });

    if (!user) {
      this.recordLoginHistory({
        identifier: data.mobile,
        status: LoginStatus.FAILED,
        failureReason: 'User not found',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      throw new UnauthorizedException('Invalid mobile or password');
    }

    if (user.status !== 'ACTIVE') {
      throw new UnauthorizedException('Account is not active');
    }

    const passwordMatch = await bcrypt.compare(data.password, user.password);

    if (!passwordMatch) {
      this.recordLoginHistory({
        userId: user.id,
        identifier: data.mobile,
        status: LoginStatus.FAILED,
        failureReason: 'Invalid password',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      throw new UnauthorizedException('Invalid mobile or password');
    }

    const payload = {
      sub: user.id,
      role: user.role,
      mobile: user.mobile,
      jti: crypto.randomUUID(),
    };

    const refreshSecret =
      process.env.JWT_REFRESH_SECRET ||
      'haatza_backend_refresh_secret_key_2026';

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '30d',
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const sessionTokenHash = this.hashToken(accessToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    // Mandatory Security State Writes
    const session = await this.db.userSession.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
        expiresAt,
      },
    });

    await this.db.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        expiresAt,
      },
    });

    // Non-critical side-effects executed asynchronously without delaying login response
    this.recordSuccessSideEffects({
      userId: user.id,
      mobile: data.mobile,
      sessionId: session.id,
      refreshToken,
      reqMeta,
    });

    return {
      message: 'Login successful',
      accessToken,
      refreshToken,
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        role: user.role,
      },
    };
  }

  private recordLoginHistory(data: {
    userId?: string;
    identifier: string;
    status: string;
    failureReason?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    setImmediate(async () => {
      try {
        await this.db.userLoginHistory.create({
          data: {
            userId: data.userId,
            identifier: data.identifier,
            status: data.status,
            failureReason: data.failureReason,
            ipAddress: data.ipAddress,
            userAgent: data.userAgent,
            deviceName: data.deviceName,
          },
        });
      } catch (err) {
        this.logger.warn('Failed to record login history asynchronously', err);
      }
    });
  }

  private recordSuccessSideEffects(data: {
    userId: string;
    mobile: string;
    sessionId: string;
    refreshToken: string;
    reqMeta?: { ipAddress?: string; userAgent?: string };
  }) {
    setImmediate(async () => {
      try {
        const deviceUuid = data.reqMeta?.userAgent
          ? crypto.createHash('md5').update(data.reqMeta.userAgent).digest('hex')
          : 'default_device';

        const existingDevice = await this.db.userDevice.findFirst({
          where: { userId: data.userId, deviceUuid },
          select: { id: true },
        });

        let deviceName = 'Unknown Device';
        if (existingDevice) {
          await this.db.userDevice.update({
            where: { id: existingDevice.id },
            data: { lastSeenAt: new Date() },
          });
        } else {
          deviceName = data.reqMeta?.userAgent
            ? data.reqMeta.userAgent.substring(0, 100)
            : 'Unknown Device';
          await this.db.userDevice.create({
            data: {
              userId: data.userId,
              deviceUuid,
              deviceName,
              platform: data.reqMeta?.userAgent ? 'WEB' : 'MOBILE',
            },
          });
        }

        await Promise.allSettled([
          this.db.user.update({
            where: { id: data.userId },
            data: { refreshToken: data.refreshToken, lastLoginAt: new Date() },
          }),
          this.db.userLoginHistory.create({
            data: {
              userId: data.userId,
              identifier: data.mobile,
              status: LoginStatus.SUCCESS,
              ipAddress: data.reqMeta?.ipAddress,
              userAgent: data.reqMeta?.userAgent,
              deviceName,
              sessionId: data.sessionId,
            },
          }),
        ]);
      } catch (err) {
        this.logger.warn('Async success login side-effects failed', err);
      }
    });
  }


  // Refresh Access Token & Rotate Refresh Token
  async refreshToken(token: string) {
    const incomingHash = this.hashToken(token);

    // 1. Search in RefreshToken table
    const storedToken = await this.db.refreshToken.findUnique({
      where: { tokenHash: incomingHash },
      include: { user: true, session: true },
    });

    const user = storedToken
      ? storedToken.user
      : await this.db.user.findFirst({
          where: { refreshToken: token },
        });

    if (!user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (storedToken) {
      if (
        storedToken.revokedAt ||
        (storedToken.session && storedToken.session.revokedAt)
      ) {
        throw new UnauthorizedException(
          'Refresh token or session has been revoked',
        );
      }

      if (new Date() > storedToken.expiresAt) {
        throw new UnauthorizedException('Refresh token expired');
      }
    }

    const payload = {
      sub: user.id,
      role: user.role,
      mobile: user.mobile,
    };

    const newAccessToken = await this.jwtService.signAsync(payload, {
      expiresIn: '15m',
    });

    const newRefreshToken = await this.jwtService.signAsync(payload, {
      secret:
        process.env.JWT_REFRESH_SECRET ||
        'haatza_backend_refresh_secret_key_2026',
      expiresIn: '30d',
    });

    const newTokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    // Rotate token: revoke old token and insert new RefreshToken record
    if (storedToken) {
      const newTokenRecord = await this.db.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: storedToken.sessionId,
          deviceId: storedToken.deviceId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      });

      await this.db.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: newTokenRecord.id,
        },
      });
    }

    // Update legacy refreshToken on user model
    await this.db.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  // Logout & Revoke Session
  async logout(token: string) {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.db.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken) {
      await this.db.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      await this.db.userSession.update({
        where: { id: storedToken.sessionId },
        data: { revokedAt: new Date() },
      });

      await this.db.user.update({
        where: { id: storedToken.userId },
        data: { refreshToken: null },
      });
    } else {
      const user = await this.db.user.findFirst({
        where: { refreshToken: token },
      });

      if (user) {
        await this.db.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
      }
    }

    return {
      message: 'Logged out successfully',
    };
  }
}
