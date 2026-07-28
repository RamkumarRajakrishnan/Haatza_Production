import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';
import { JwtService } from '@nestjs/jwt';
import { OtpChannel, OtpIdentifierType, OtpPurpose, LoginStatus } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
  ) {}

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(data: RegisterDto) {
    const existingUser = await this.database.user.findUnique({
      where: {
        mobile: data.mobile,
      },
    });

    if (existingUser) {
      throw new ConflictException('Mobile number already registered');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const roleRecord = await this.database.role.findFirst({
      where: {
        OR: [{ name: data.role }, { code: data.role.toLowerCase() }],
      },
    });

    const user = await this.database.user.create({
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

  async login(
    data: LoginDto,
    reqMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const user = await this.database.user.findUnique({
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

    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const [accessToken, refreshToken] = await Promise.all([
      this.jwtService.signAsync(payload, { expiresIn: '15m' }),
      this.jwtService.signAsync(payload, {
        secret: refreshSecret,
        expiresIn: '30d',
      }),
    ]);

    const tokenHash = this.hashToken(refreshToken);
    const sessionTokenHash = this.hashToken(accessToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    const session = await this.database.userSession.create({
      data: {
        userId: user.id,
        sessionTokenHash,
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
        expiresAt,
      },
    });

    await this.database.refreshToken.create({
      data: {
        userId: user.id,
        sessionId: session.id,
        tokenHash,
        expiresAt,
      },
    });

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
    status: LoginStatus;
    failureReason?: string;
    ipAddress?: string;
    userAgent?: string;
    deviceName?: string;
  }) {
    setImmediate(async () => {
      try {
        await this.database.userLoginHistory.create({
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

        const existingDevice = await this.database.userDevice.findFirst({
          where: { userId: data.userId, deviceUuid },
          select: { id: true },
        });

        let deviceName = 'Unknown Device';
        if (existingDevice) {
          await this.database.userDevice.update({
            where: { id: existingDevice.id },
            data: { lastSeenAt: new Date() },
          });
        } else {
          deviceName = data.reqMeta?.userAgent
            ? data.reqMeta.userAgent.substring(0, 100)
            : 'Unknown Device';
          await this.database.userDevice.create({
            data: {
              userId: data.userId,
              deviceUuid,
              deviceName,
              platform: data.reqMeta?.userAgent ? 'WEB' : 'MOBILE',
            },
          });
        }

        await Promise.allSettled([
          this.database.user.update({
            where: { id: data.userId },
            data: { refreshToken: data.refreshToken, lastLoginAt: new Date() },
          }),
          this.database.userLoginHistory.create({
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

  async refreshToken(token: string) {
    const incomingHash = this.hashToken(token);

    const storedToken = await this.database.refreshToken.findUnique({
      where: { tokenHash: incomingHash },
      include: { user: true, session: true },
    });

    const user = storedToken
      ? storedToken.user
      : await this.database.user.findFirst({
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

    const refreshSecret = this.configService.getOrThrow<string>('JWT_REFRESH_SECRET');

    const newRefreshToken = await this.jwtService.signAsync(payload, {
      secret: refreshSecret,
      expiresIn: '30d',
    });

    const newTokenHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);

    if (storedToken) {
      const newTokenRecord = await this.database.refreshToken.create({
        data: {
          userId: user.id,
          sessionId: storedToken.sessionId,
          deviceId: storedToken.deviceId,
          tokenHash: newTokenHash,
          expiresAt,
        },
      });

      await this.database.refreshToken.update({
        where: { id: storedToken.id },
        data: {
          revokedAt: new Date(),
          replacedByTokenId: newTokenRecord.id,
        },
      });
    }

    await this.database.user.update({
      where: { id: user.id },
      data: { refreshToken: newRefreshToken },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    const tokenHash = this.hashToken(token);

    const storedToken = await this.database.refreshToken.findUnique({
      where: { tokenHash },
    });

    if (storedToken) {
      await this.database.refreshToken.update({
        where: { id: storedToken.id },
        data: { revokedAt: new Date() },
      });

      await this.database.userSession.update({
        where: { id: storedToken.sessionId },
        data: { revokedAt: new Date() },
      });

      await this.database.user.update({
        where: { id: storedToken.userId },
        data: { refreshToken: null },
      });
    } else {
      const user = await this.database.user.findFirst({
        where: { refreshToken: token },
      });

      if (user) {
        await this.database.user.update({
          where: { id: user.id },
          data: { refreshToken: null },
        });
      }
    }

    return {
      message: 'Logged out successfully',
    };
  }

  async forgotPassword(dto: ForgotPasswordDto) {
    const user = await this.database.user.findFirst({
      where: {
        OR: [{ mobile: dto.identifier }, { email: dto.identifier }],
      },
    });

    if (!user) {
      throw new NotFoundException('User with provided identifier not found');
    }

    return this.generateOtp({
      identifier: dto.identifier,
      purpose: OtpPurpose.FORGOT_PASSWORD,
      channel: dto.identifier.includes('@') ? OtpChannel.EMAIL : OtpChannel.SMS,
    });
  }

  async generateOtp(dto: GenerateOtpDto) {
    const isEmail = dto.identifier.includes('@');
    const identifierType = isEmail ? OtpIdentifierType.EMAIL : OtpIdentifierType.PHONE;
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = crypto.createHash('sha256').update(rawOtp).digest('hex');
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const existingUser = await this.database.user.findFirst({
      where: isEmail ? { email: dto.identifier } : { mobile: dto.identifier },
      select: { id: true },
    });

    const otpRecord = await this.database.otpVerification.create({
      data: {
        userId: existingUser?.id ?? null,
        identifier: dto.identifier,
        identifierType,
        otpHash,
        purpose: dto.purpose ?? OtpPurpose.LOGIN,
        channel: dto.channel ?? OtpChannel.SMS,
        expiresAt,
      },
    });

    this.logger.log(`Generated OTP for ${dto.identifier}: ${rawOtp}`);

    return {
      success: true,
      otpId: otpRecord.id,
      expiresAt: otpRecord.expiresAt,
      message: 'OTP generated and sent successfully',
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
    const otpHash = crypto.createHash('sha256').update(dto.otp).digest('hex');

    const otpRecord = await this.database.otpVerification.findFirst({
      where: {
        identifier: dto.identifier,
        purpose: dto.purpose ?? OtpPurpose.LOGIN,
        isVerified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      throw new BadRequestException('No active OTP request found for this identifier');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    if (otpRecord.attemptCount >= otpRecord.maxAttempts) {
      throw new BadRequestException('Maximum OTP verification attempts exceeded');
    }

    if (otpRecord.otpHash !== otpHash) {
      await this.database.otpVerification.update({
        where: { id: otpRecord.id },
        data: { attemptCount: otpRecord.attemptCount + 1 },
      });
      throw new BadRequestException('Invalid OTP code');
    }

    await this.database.otpVerification.update({
        where: { id: otpRecord.id },
        data: { isVerified: true, verifiedAt: new Date() },
    });

    return {
      success: true,
      verified: true,
      message: 'OTP verified successfully',
    };
  }

  async resendOtp(dto: GenerateOtpDto) {
    return this.generateOtp(dto);
  }
}
