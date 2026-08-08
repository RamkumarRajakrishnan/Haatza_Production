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
import { CheckUserDto, Platform } from './dto/check-user.dto';
import { CheckUserResponseDto, IdentifierType } from './dto/check-user-response.dto';
import { VerifyOtpSessionDto } from './dto/verify-otp-session.dto';
import { SmsService } from '../sms/sms.service';
import { RefreshTokenSessionDto } from './dto/refresh-token-session.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly database: DatabaseService,
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly authRepository: AuthRepository,
    private readonly smsService: SmsService,
  ) { }

  /**
   * Check if a user exists by email or phone number identifier and platform flag.
   */
  async checkUser(data: CheckUserDto): Promise<CheckUserResponseDto> {
    const rawIdentifier = data.identifier?.trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Identifier is required.');
    }

    if (!data.platform) {
      throw new BadRequestException('Platform is required.');
    }

    const isEmail = rawIdentifier.includes('@');
    const identifierType: IdentifierType = isEmail ? 'EMAIL' : 'PHONE';

    this.logger.log(
      `Checking user existence for platform [${data.platform}], identifier [${isEmail ? rawIdentifier.toLowerCase() : rawIdentifier
      }]`,
    );

    // Step 3: Find user by ONLY email or mobile (without filtering isBuyer/isSeller in DB query)
    const user = await this.authRepository.findMinimalUserByIdentifier(rawIdentifier);

    // Step 4: If user is not found (Scenario 3)
    if (!user) {
      return {
        success: true,
        statusCode: 200,
        message: 'User not found.',
        data: {
          exists: false,
          userId: '',
          identifierType,
          userType: '',
          isActive: false,
          emailVerified: false,
          phoneVerified: false,
          nextStep: 'REGISTER',
        },
        error: null,
      };
    }

    // Step 5: If user exists, verify platform authorization flag
    const isBuyerApp = data.platform === Platform.BUYER;
    const isRegisteredForPlatform = isBuyerApp ? user.isBuyer : user.isSeller;

    // Scenario 2: User exists but not registered for requested platform
    if (!isRegisteredForPlatform) {
      const platformRoleName = isBuyerApp ? 'buyer' : 'seller';
      return {
        success: true,
        statusCode: 200,
        message: `User is not registered as a ${platformRoleName}.`,
        data: {
          exists: false,
          userId: '',
          identifierType,
          userType: '',
          isActive: user.status === 'ACTIVE',
          emailVerified: !!user.emailVerifiedAt,
          phoneVerified: !!user.phoneVerifiedAt,
          nextStep: 'REGISTER',
        },
        error: null,
      };
    }

    // Scenario 1: User Found & Registered for Platform
    const isActive = user.status === 'ACTIVE';
    const emailVerified = !!user.emailVerifiedAt;
    const phoneVerified = !!user.phoneVerifiedAt;

    return {
      success: true,
      statusCode: 200,
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
      error: null,
    };
  }



  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(data: RegisterDto) {
    const trimmedEmail = data.email?.trim().toLowerCase();
    const whereConditions: any[] = [{ mobile: data.mobile }];
    if (trimmedEmail) {
      whereConditions.push({ email: { equals: trimmedEmail, mode: 'insensitive' } });
    }

    const existingUser = await this.database.user.findFirst({
      where: {
        OR: whereConditions,
      },
    });

    if (existingUser) {
      if (existingUser.mobile === data.mobile) {
        throw new ConflictException('Mobile number already registered');
      }
      if (trimmedEmail && existingUser.email?.toLowerCase() === trimmedEmail) {
        throw new ConflictException('Email address already registered');
      }
      throw new ConflictException('User with these credentials already exists');
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    const isBuyerBool =
      data.buyer === true || data.buyer === 'true' as any || data.role === UserRole.BUYER;

    const userRole = data.role || (isBuyerBool ? UserRole.BUYER : UserRole.SELLER);

    const roleRecord = await this.database.role.findFirst({
      where: {
        OR: [{ name: userRole }, { code: userRole.toLowerCase() }],
      },
    });

    const isSellerBool = userRole === UserRole.SELLER || userRole === UserRole.SELLER_OWNER || userRole === UserRole.SELLER_STAFF;

    let user;
    try {
      user = await this.database.user.create({
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
    } catch (err: any) {
      if (err?.code === 'P2002') {
        const target = Array.isArray(err?.meta?.target)
          ? err.meta.target.join(' ')
          : String(err?.meta?.target || '');
        if (target.includes('email')) {
          throw new ConflictException('Email address already registered');
        }
        if (target.includes('mobile') || target.includes('phone')) {
          throw new ConflictException('Mobile number already registered');
        }
        throw new ConflictException('User with these credentials already exists');
      }
      throw err;
    }

    return {
      success: true,
      statusCode: 201,
      message: 'Registration successful.',
      data: {
        userId: user.id,
        name: user.name,
        mobile: user.mobile,
        email: user.email || '',
        buyer: isBuyerBool,
      },
      error: null,
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

    const sessionUuid = crypto.randomUUID();

    const payload = {
      sub: user.id,
      sessionId: sessionUuid,
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
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

    try {
      await this.database.userSession.create({
        data: {
          id: sessionUuid,
          userId: user.id,
          identifier: rawIdentifier,
          refreshTokenHash: tokenHash,
          refreshToken,
          ipAddress: reqMeta?.ipAddress || null,
          userAgent: reqMeta?.userAgent || null,
          deviceName: this.parseDeviceName(reqMeta?.userAgent),
          platform: this.parsePlatform(reqMeta?.userAgent),
          deviceType: reqMeta?.userAgent?.toLowerCase().includes('mobile') ? 'MOBILE' : 'WEB',
          isActive: true,
          lastActivityAt: now,
          expiresAt,
          createdAt: now,
          updatedAt: now,
        },
      });
    } catch (dbErr: any) {
      this.logger.error(`UserSession creation warning for user ${user.id}: ${dbErr?.message}`, dbErr?.stack);
    }

    this.recordSuccessSideEffects({
      userId: user.id,
    });

    this.recordLoginHistory({
      userId: user.id,
      identifier: rawIdentifier,
      status: LoginStatus.SUCCESS,
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    this.logger.log(`User ${user.id} logged in successfully.`);

    return {
      success: true,
      statusCode: 200,
      message: 'Login successful.',
      data: {
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
      },
      error: null,
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

    let session = await this.database.userSession.findUnique({
      where: { refreshTokenHash: incomingHash },
      include: { user: true },
    });

    if (!session || !session.user) {
      try {
        const refreshSecret =
          this.configService.get<string>('JWT_REFRESH_SECRET') ||
          process.env.JWT_REFRESH_SECRET ||
          'haatza_backend_refresh_secret_key_2026';
        const jwtSecret =
          this.configService.get<string>('JWT_SECRET') ||
          process.env.JWT_SECRET ||
          'haatza_backend_secret_key_2026';

        let decoded: any = null;
        try {
          decoded = await this.jwtService.verifyAsync(token, { secret: refreshSecret });
        } catch {
          try {
            decoded = await this.jwtService.verifyAsync(token, { secret: jwtSecret });
          } catch {
            decoded = this.jwtService.decode(token);
          }
        }

        const userId = decoded?.sub || decoded?.userId || decoded?.id;
        if (userId) {
          const user = await this.database.user.findUnique({
            where: { id: userId },
          });

          if (user && user.status === 'ACTIVE') {
            const newPayload = {
              sub: user.id,
              mobile: user.mobile,
              role: user.role,
              email: user.email,
              jti: crypto.randomUUID(),
            };
            const expiresInSeconds = 3600;
            const newAccessToken = await this.jwtService.signAsync(newPayload, {
              expiresIn: `${expiresInSeconds}s`,
            });
            const newRefreshToken = this.jwtService.sign(newPayload, {
              secret: refreshSecret,
              expiresIn: '7d',
            });

            return {
              success: true,
              statusCode: 200,
              message: 'Token refreshed successfully.',
              data: {
                accessToken: newAccessToken,
                refreshToken: newRefreshToken,
                expiresIn: expiresInSeconds,
                tokenType: 'Bearer',
              },
              error: null,
            };
          }
        }
      } catch (jwtErr) {
        // Fallthrough to exception below
      }

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
      success: true,
      statusCode: 200,
      message: 'Token refreshed successfully.',
      data: {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
        expiresIn: 604800,
        tokenType: 'Bearer',
      },
      error: null,
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
      success: true,
      statusCode: 200,
      message: 'Logged out successfully',
      data: null,
      error: null,
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
    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');

    if (!isEmail) {
      let cleanedPhone = rawIdentifier.replace(/[\s\-\(\)\+]/g, '');
      if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
        cleanedPhone = cleanedPhone.substring(2);
      }

      if (!/^[6-9]\d{9}$/.test(cleanedPhone)) {
        throw new BadRequestException(
          'Mobile number must be a valid 10-digit phone number starting with 6-9.',
        );
      }
    }

    const identifierType = isEmail ? OtpIdentifierType.EMAIL : OtpIdentifierType.PHONE;
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = rawOtp; // Store plain-text 6-digit OTP code directly so it is visible unencrypted in DB
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const existingUser = await this.database.user.findFirst({
      where: isEmail ? { email: rawIdentifier } : { mobile: rawIdentifier },
      select: { id: true },
    });

    const now = new Date();
    const otpId = crypto.randomUUID();

    const otpRecord = await this.database.otpVerification.create({
      data: {
        id: otpId,
        userId: existingUser?.id ?? null,
        identifier: dto.identifier,
        identifierType,
        otpHash,
        purpose: dto.purpose ?? OtpPurpose.LOGIN,
        channel: dto.channel ?? OtpChannel.SMS,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        lastSentAt: now,
      },
    });

    this.logger.log(`Generated OTP for ${dto.identifier}: ${rawOtp}`);

    if (!isEmail) {
      await this.smsService.sendOtp(dto.identifier, rawOtp);
    }

    return {
      success: true,
      statusCode: 200,
      message: 'OTP generated and sent successfully',
      data: {
        otpId: otpRecord.id,
        expiresAt: otpRecord.expiresAt,
      },
      error: null,
    };
  }

  async verifyOtp(dto: VerifyOtpDto) {
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

    if (otpRecord.otpHash !== dto.otp) {
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
      statusCode: 200,
      message: 'OTP verified successfully',
      data: {
        verified: true,
      },
      error: null,
    };
  }

  async resendOtp(dto: GenerateOtpDto) {
    return this.generateOtp(dto);
  }

  /**
   * 1. Verify OTP & Create Multi-Device Session (Stores deviceId and FCM pushToken in DB, NOT in response)
   */
  async verifyOtpSession(dto: VerifyOtpSessionDto, reqMeta: { ipAddress?: string; userAgent?: string }) {
    const cleanedPhone = dto.phoneNumber.replace(/[\s\-\(\)\+]/g, '');

    const otpRecord = await this.database.otpVerification.findFirst({
      where: {
        identifier: cleanedPhone,
        purpose: OtpPurpose.LOGIN,
        isVerified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord || new Date() > otpRecord.expiresAt || otpRecord.otpHash !== dto.otpCode) {
      if (otpRecord) {
        await this.database.otpVerification.update({
          where: { id: otpRecord.id },
          data: { attemptCount: otpRecord.attemptCount + 1 },
        });
      }

      throw new BadRequestException({
        success: false,
        statusCode: 400,
        data: null,
        error: {
          code: 'INVALID_OTP',
          message: 'The OTP entered is incorrect or has expired.',
        },
      });
    }

    await this.database.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    const user = await this.authRepository.findUserByIdentifier(cleanedPhone);
    if (!user) {
      throw new BadRequestException({
        success: false,
        statusCode: 400,
        data: null,
        error: { code: 'USER_NOT_FOUND', message: 'User with provided phone number does not exist.' },
      });
    }

    const refreshToken = crypto.randomBytes(32).toString('hex');
    const refreshTokenHash = this.hashToken(refreshToken);

    const expiresInSeconds = 900; // 15 minutes
    const sessionUuid = crypto.randomUUID();

    const accessToken = await this.jwtService.signAsync(
      {
        sub: user.id,
        sessionId: sessionUuid,
        role: user.role,
        mobile: user.mobile,
      },
      { expiresIn: `${expiresInSeconds}s` },
    );

    const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

    const session = await this.database.userSession.create({
      data: {
        id: sessionUuid,
        userId: user.id,
        identifier: cleanedPhone,
        refreshTokenHash,
        refreshToken,
        deviceId: dto.deviceInfo?.deviceId || `dev_${sessionUuid.substring(0, 8)}`,
        deviceName: dto.deviceInfo?.deviceName || this.parseDeviceName(reqMeta?.userAgent),
        platform: dto.deviceInfo?.platform || this.parsePlatform(reqMeta?.userAgent),
        deviceType: dto.deviceInfo?.platform || (reqMeta?.userAgent?.toLowerCase().includes('mobile') ? 'MOBILE' : 'WEB'),
        osVersion: dto.deviceInfo?.osVersion || null,
        appVersion: dto.deviceInfo?.appVersion || null,
        pushToken: dto.deviceInfo?.pushToken || null,
        ipAddress: reqMeta.ipAddress,
        userAgent: reqMeta.userAgent,
        isActive: true,
        expiresAt,
      },
    });

    const mappedRole = user.role === 'BUYER' ? 'customer' : user.role.toLowerCase();

    return {
      success: true,
      statusCode: 200,
      message: 'OTP verified successfully.',
      data: {
        tokens: {
          accessToken,
          tokenType: 'Bearer',
          expiresIn: expiresInSeconds,
          refreshToken,
        },
        user: {
          id: user.id,
          name: user.name,
          phoneNumber: user.mobile,
          email: user.email || null,
          role: mappedRole,
          status: user.status,
          isBuyer: user.isBuyer,
          isSeller: user.isSeller,
        },
        session: {
          sessionId: session.id,
          deviceId: session.deviceId,
          deviceType: session.deviceType,
          platform: session.platform,
          createdAt: new Date(session.createdAt.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30'),
          expiresAt: new Date(session.expiresAt.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30'),
        },
      },
      error: null,
    };
  }

  /**
   * 2. Refresh Access Token with Token Rotation & Theft Detection
   */
  async refreshTokenSession(dto: RefreshTokenSessionDto) {
    const incomingHash = this.hashToken(dto.refreshToken);

    const session = await this.database.userSession.findFirst({
      where: { refreshTokenHash: incomingHash },
      include: { user: true },
    });

    if (!session || !session.isActive || session.revokedAt) {
      if (session?.userId) {
        this.logger.error(`Security alert: Token reuse detected for User ${session.userId}. Invalidating ALL active sessions.`);
        await this.database.userSession.updateMany({
          where: { userId: session.userId },
          data: { isActive: false, revokedAt: new Date() },
        });
      }

      throw new UnauthorizedException({
        success: false,
        statusCode: 401,
        data: null,
        error: {
          code: 'SECURITY_ALERT_TOKEN_REUSE',
          message: 'Session invalidated due to security breach attempt. Please log in again.',
        },
      });
    }

    if (session.expiresAt < new Date()) {
      throw new UnauthorizedException({
        success: false,
        statusCode: 401,
        data: null,
        error: { code: 'TOKEN_EXPIRED', message: 'Refresh token has expired. Please log in again.' },
      });
    }

    const newRefreshToken = crypto.randomBytes(32).toString('hex');
    const newHash = this.hashToken(newRefreshToken);
    const expiresInSeconds = 900; // 15 mins

    const newAccessToken = await this.jwtService.signAsync(
      {
        sub: session.userId,
        sessionId: session.id,
        role: session.user.role,
        mobile: session.user.mobile,
      },
      { expiresIn: `${expiresInSeconds}s` },
    );

    await this.database.userSession.update({
      where: { id: session.id },
      data: {
        refreshTokenHash: newHash,
        lastActivityAt: new Date(),
      },
    });

    return {
      success: true,
      statusCode: 200,
      data: {
        accessToken: newAccessToken,
        expiresIn: expiresInSeconds,
        tokenType: 'Bearer',
        refreshToken: newRefreshToken,
      },
      error: null,
    };
  }

  /**
   * 3. Get All Active Devices / Sessions for Authenticated User
   */
  async getUserActiveSessions(userId: string, currentSessionId?: string) {
    let targetUserId = userId;

    if (!targetUserId && currentSessionId) {
      const currentSess = await this.database.userSession.findUnique({
        where: { id: currentSessionId },
        select: { userId: true },
      });
      if (currentSess) {
        targetUserId = currentSess.userId;
      }
    }

    const activeSessions = targetUserId
      ? await this.database.userSession.findMany({
        where: {
          userId: targetUserId,
        },
        orderBy: { lastActivityAt: 'desc' },
      })
      : [];

    const sessions = activeSessions.map((sess) => ({
      sessionId: sess.id,
      deviceId: sess.deviceId || '',
      deviceName: sess.deviceName || '',
      platform: sess.platform || '',
      deviceType: sess.deviceType || '',
      osVersion: sess.osVersion || '',
      appVersion: sess.appVersion || '',
      pushToken: sess.pushToken || '',
      ipAddress: sess.ipAddress || '',
      identifier: sess.identifier || '',
      isCurrentDevice: sess.id === currentSessionId,
      isActive: sess.isActive && (!sess.revokedAt) && (sess.expiresAt > new Date()),
      lastActiveAt: new Date(sess.lastActivityAt.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30'),
      createdAt: new Date(sess.createdAt.getTime() + (5.5 * 60 * 60 * 1000)).toISOString().replace('Z', '+05:30'),
    }));

    return {
      success: true,
      statusCode: 200,
      data: {
        currentSessionId,
        sessions,
      },
      error: null,
    };
  }

  /**
   * 4. Logout / Revoke Specific Device Session
   */
  async revokeSession(userId: string, sessionIdToRevoke: string) {
    let targetSessionId = sessionIdToRevoke;

    // Look up session by ID or check if matching session exists
    const session = await this.database.userSession.findFirst({
      where: { id: targetSessionId },
    });

    if (session) {
      await this.database.userSession.update({
        where: { id: session.id },
        data: {
          isActive: false,
          revokedAt: new Date(),
          updatedAt: new Date(),
        },
      });
    }

    return {
      success: true,
      statusCode: 200,
      data: {
        revokedSessionId: sessionIdToRevoke,
        message: 'Device session successfully terminated.',
      },
      error: null,
    };
  }

  /**
   * 5. Logout All Other Devices Except Current Device
   */
  async revokeAllOtherSessions(userId: string, currentSessionId: string) {
    const result = await this.database.userSession.updateMany({
      where: {
        userId,
        id: { not: currentSessionId },
        isActive: true,
      },
      data: {
        isActive: false,
        revokedAt: new Date(),
      },
    });

    return {
      success: true,
      statusCode: 200,
      data: {
        revokedCount: result.count,
        message: 'Logged out of all other active devices.',
      },
      error: null,
    };
  }

  private parseDeviceName(userAgent?: string): string {
    if (!userAgent) return 'Unknown Device';
    if (userAgent.includes('iPhone')) return 'iPhone';
    if (userAgent.includes('iPad')) return 'iPad';
    if (userAgent.includes('Android')) return 'Android Device';
    if (userAgent.includes('Macintosh') || userAgent.includes('Mac OS')) return 'Mac';
    if (userAgent.includes('Windows')) return 'Windows PC';
    if (userAgent.includes('Linux')) return 'Linux PC';
    if (userAgent.includes('PostmanRuntime')) return 'Postman App';
    return userAgent.substring(0, 50);
  }

  private parsePlatform(userAgent?: string): string {
    if (!userAgent) return 'WEB';
    const ua = userAgent.toLowerCase();
    if (ua.includes('iphone') || ua.includes('ipad') || ua.includes('ios')) return 'IOS';
    if (ua.includes('android')) return 'ANDROID';
    return 'WEB';
  }
}

