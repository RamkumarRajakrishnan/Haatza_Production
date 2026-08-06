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
import { OtpChannel, OtpIdentifierType, OtpPurpose, LoginStatus, UserRole } from '@prisma/client';
import { DatabaseService } from '../../database/database.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { GenerateOtpDto } from './dto/generate-otp.dto';
import { VerifyOtpDto } from './dto/verify-otp.dto';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

import { AuthRepository } from './auth.repository';
import { CheckUserDto } from './dto/check-user.dto';
import { CheckUserResponseDto, IdentifierType } from './dto/check-user-response.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
  ) {}

  /**
   * Check if a user exists by email or phone number identifier before login or registration.
   */
  async checkUser(data: CheckUserDto): Promise<CheckUserResponseDto> {
    const rawIdentifier = data.identifier?.trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Identifier is required.');
    }

    const isEmail = rawIdentifier.includes('@');
    const identifierType: IdentifierType = isEmail ? 'EMAIL' : 'PHONE';

    this.logger.log(
      `Checking user existence for ${identifierType} identifier: ${
        isEmail ? rawIdentifier.toLowerCase() : rawIdentifier
      }`,
    );

    const user = await this.authRepository.findMinimalUserByIdentifier(rawIdentifier);

    if (!user) {
      return {
        success: true,
        message: 'User not found.',
        data: {
          exists: false,
          identifierType,
          nextStep: 'REGISTER',
        },
      };
    }

    const isActive = user.status === 'ACTIVE';
    const emailVerified = !!user.emailVerifiedAt;
    const phoneVerified = !!user.phoneVerifiedAt;

    return {
      success: true,
      message: 'User found.',
      data: {
        exists: true,
        userId: user.id,
        identifierType,
        userType: user.role,
        isActive,
        emailVerified,
        phoneVerified,
        nextStep: 'LOGIN',
      },
    };
  }


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

    const isBuyerBool =
      data.buyer === true || data.role === UserRole.BUYER;

    const userRole = data.role || (isBuyerBool ? UserRole.BUYER : UserRole.SELLER);

    const roleRecord = await this.database.role.findFirst({
      where: {
        OR: [{ name: userRole }, { code: userRole.toLowerCase() }],
      },
    });

    const isSellerBool = userRole === UserRole.SELLER || userRole === UserRole.SELLER_OWNER || userRole === UserRole.SELLER_STAFF;

    const user = await this.database.user.create({
      data: {
        name: data.name,
        mobile: data.mobile,
        email: data.email,
        password: hashedPassword,
        role: userRole,
        isBuyer: isBuyerBool,
        isSeller: isSellerBool,
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
    const rawIdentifier = data.identifier || data.mobile;

    if (!rawIdentifier) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email/phone number or password.',
      });
    }

    const user = await this.authRepository.findUserByIdentifier(rawIdentifier);

    if (!user) {
      this.recordLoginHistory({
        identifier: rawIdentifier,
        status: LoginStatus.FAILED,
        failureReason: 'User not found',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email/phone number or password.',
      });
    }

    // Security Check 1: Account Lockout Check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.logger.warn(`Login attempt blocked for locked account ID: ${user.id}`);
      throw new UnauthorizedException({
        success: false,
        message: 'Account is locked due to multiple failed login attempts. Please try again later.',
      });
    }

    // Security Check 2: Account Status Check
    if (user.status !== 'ACTIVE') {
      this.logger.warn(`Login attempt for inactive user ID: ${user.id}, Status: ${user.status}`);
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email/phone number or password.',
      });
    }

    // Password Verification via bcrypt
    const isPasswordValid = await bcrypt.compare(data.password, user.password);

    if (!isPasswordValid) {
      const lockResult = await this.authRepository.incrementFailedLoginAttempts(
        user.id,
        user.failedLoginAttempts,
      );

      this.recordLoginHistory({
        userId: user.id,
        identifier: rawIdentifier,
        status: LoginStatus.FAILED,
        failureReason: lockResult.isLocked
          ? 'Invalid password - Account Locked'
          : 'Invalid password',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      if (lockResult.isLocked) {
        this.logger.warn(`Account ID: ${user.id} has been locked after 5 failed attempts.`);
      }

      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email/phone number or password.',
      });
    }

    // Successful Authentication
    await this.authRepository.resetLoginAttemptsAndRecordLogin(user.id);

    const payload = {
      sub: user.id,
      role: user.role,
      mobile: user.mobile,
      email: user.email,
      jti: crypto.randomUUID(),
    };

    const refreshSecret =
      this.configService.get<string>('JWT_REFRESH_SECRET') ||
      process.env.JWT_REFRESH_SECRET;

    if (!refreshSecret) {
      throw new Error('JWT_REFRESH_SECRET environment variable is missing.');
    }

    const expiresInSeconds = 3600; // 1 hour

    const accessToken = await this.jwtService.signAsync(payload, { expiresIn: `${expiresInSeconds}s` });
    const refreshToken = this.jwtService.sign(payload, {
      secret: refreshSecret,
      expiresIn: '7d',
    });

    const tokenHash = this.hashToken(refreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    const session = await this.database.userSession.create({
      data: {
        userId: user.id,
        refreshTokenHash: tokenHash,
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
        deviceName: reqMeta?.userAgent ? reqMeta.userAgent.substring(0, 100) : 'Unknown Device',
        deviceType: reqMeta?.userAgent ? 'WEB' : 'MOBILE',
        isActive: true,
        expiresAt,
      },
    });

    this.recordSuccessSideEffects({
      userId: user.id,
    });

    this.logger.log(`User ${user.id} logged in successfully.`);

    return {
      success: true,
      message: 'Login successful.',
      accessToken,
      refreshToken,
      expiresIn: expiresInSeconds,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        phoneNumber: user.mobile,
        role: user.role,
        status: user.status,
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

  private recordSuccessSideEffects(data: { userId: string }) {
    setImmediate(async () => {
      try {
        await this.database.user.update({
          where: { id: data.userId },
          data: { lastLoginAt: new Date() },
        });
      } catch (err) {
        this.logger.warn('Async success login side-effects failed', err);
      }
    });
  }

  async refreshToken(token: string) {
    const incomingHash = this.hashToken(token);

    const session = await this.database.userSession.findUnique({
      where: { refreshTokenHash: incomingHash },
      include: { user: true },
    });

    if (!session || !session.user) {
      throw new UnauthorizedException('Invalid refresh token');
    }

    if (!session.isActive || session.revokedAt) {
      throw new UnauthorizedException('Session has been revoked');
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException('Refresh token has expired');
    }

    const newPayload = {
      sub: session.user.id,
      mobile: session.user.mobile,
      role: session.user.role,
    };

    const newAccessToken = this.jwtService.sign(newPayload);
    const newRefreshToken = this.jwtService.sign(newPayload, {
      expiresIn: '7d',
    });

    const newHash = this.hashToken(newRefreshToken);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await this.database.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        expiresAt,
        lastActivityAt: new Date(),
        updatedAt: new Date(),
      },
    });

    return {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    };
  }

  async logout(token: string) {
    const tokenHash = this.hashToken(token);

    const session = await this.database.userSession.findUnique({
      where: { refreshTokenHash: tokenHash },
    });

    if (session) {
      await this.database.userSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
        },
      });
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
