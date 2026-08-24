import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
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
import { ResetPasswordDto } from './dto/reset-password.dto';
import { SelectRoleDto } from './dto/select-role.dto';
import { SwitchRoleDto } from './dto/switch-role.dto';
import { EmployeeLoginDto } from './dto/employee-login.dto';

import { AuthRepository } from './auth.repository';
import { CheckUserDto, Platform } from './dto/check-user.dto';
import { CheckUserResponseDto, IdentifierType } from './dto/check-user-response.dto';
import { VerifyOtpSessionDto } from './dto/verify-otp-session.dto';
import { SmsService } from '../../integrations/sms/sms.service';
import { RefreshTokenSessionDto } from './dto/refresh-token-session.dto';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  // Temporary in-memory store for pending registrations (cleared after OTP verification)
  private readonly pendingRegistrations = new Map<string, {
    mobile: string;
    email: string;
    password: string;
    role?: UserRole;
    buyer?: boolean;
    employee?: boolean;
    isEmployee?: boolean;
    name?: string;
    gender?: string;
    expiresAt: Date;
  }>();

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
    const rawIdentifier = (data.identifier || data.email || data.mobile)?.trim();
    if (!rawIdentifier) {
      throw new BadRequestException('Identifier, email, or mobile is required.');
    }

    const isEmail = rawIdentifier.includes('@');
    const identifierType: IdentifierType = isEmail ? 'EMAIL' : 'PHONE';

    this.logger.log(
      `Checking user existence for platform [${data.platform || 'ANY'}], identifier [${isEmail ? rawIdentifier.toLowerCase() : rawIdentifier
      }]`,
    );

    // Step 3: Find user by identifier / email / mobile
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

    // Step 4b: If mobile parameter is optionally provided, verify it matches the found user's registered phone
    if (data.mobile) {
      let cleanedInputPhone = data.mobile.trim().replace(/[\s\-\(\)\+]/g, '');
      if (cleanedInputPhone.startsWith('91') && cleanedInputPhone.length === 12) {
        cleanedInputPhone = cleanedInputPhone.substring(2);
      }

      let cleanedUserPhone = user.mobile ? user.mobile.trim().replace(/[\s\-\(\)\+]/g, '') : '';
      if (cleanedUserPhone.startsWith('91') && cleanedUserPhone.length === 12) {
        cleanedUserPhone = cleanedUserPhone.substring(2);
      }

      if (cleanedInputPhone !== cleanedUserPhone) {
        this.logger.warn(
          `CheckUser mobile mismatch: input mobile [${data.mobile}] does not match user [${user.id}] mobile [${user.mobile}]`,
        );
        return {
          success: true,
          statusCode: 200,
          message: 'User not found with provided mobile number.',
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
    }

    // Step 4c: If email parameter is optionally provided, verify it matches the found user's registered email
    if (data.email && user.email) {
      if (data.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
        return {
          success: true,
          statusCode: 200,
          message: 'User not found with provided email address.',
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
    }

    // Step 5: If user exists, verify platform authorization flag
    let isRegisteredForPlatform = true;
    if (data.platform === Platform.BUYER) {
      isRegisteredForPlatform = user.isBuyer;
    } else if (data.platform === Platform.EMPLOYEE) {
      isRegisteredForPlatform = user.isEmployee || user.role === 'EMPLOYEE';
    } else if (data.platform === Platform.SELLER) {
      isRegisteredForPlatform = user.isSeller || user.isEmployee;
    }

    // Scenario 2: User exists but not registered for requested platform
    if (!isRegisteredForPlatform) {
      const platformRoleName = (data.platform || 'requested platform').toLowerCase();
      return {
        success: true,
        statusCode: 200,
        message: `User is not registered for ${platformRoleName}.`,
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
    const isPhone = identifierType === 'PHONE';
    const authMethod = isPhone ? 'OTP' : 'PASSWORD';
    const nextStep = isPhone ? 'VERIFY_OTP' : 'LOGIN';

    return {
      success: true,
      statusCode: 200,
      message: 'User found.',
      data: {
        exists: true,
        userId: user.id,
        identifierType,
        authMethod,
        userType: user.isEmployee ? 'EMPLOYEE' : (user.isSeller ? 'SELLER' : 'BUYER'),
        isBuyer: user.isBuyer,
        isSeller: user.isSeller,
        isEmployee: user.isEmployee,
        isActive,
        emailVerified,
        phoneVerified,
        nextStep,
      },
      error: null,
    };
  }



  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  async register(data: RegisterDto) {
    // email is now required — always deduplicate on both mobile and email
    const trimmedEmail = data.email.trim().toLowerCase();
    const existingUser = await this.database.user.findFirst({
      where: {
        OR: [
          { mobile: data.mobile },
          { email: { equals: trimmedEmail, mode: 'insensitive' } },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.mobile === data.mobile) {
        throw new ConflictException('Mobile number already registered');
      }
      if (existingUser.email?.toLowerCase() === trimmedEmail) {
        throw new ConflictException('Email address already registered');
      }
      throw new ConflictException('User with these credentials already exists');
    }

    // Store registration data temporarily — user is created only after OTP verification
    this.pendingRegistrations.set(data.mobile, {
      mobile: data.mobile,
      email: trimmedEmail,
      password: data.password,
      role: data.role,
      buyer: data.buyer,
      employee: (data as any).employee,
      isEmployee: (data as any).isEmployee,
      name: data.name,
      gender: data.gender,
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // expires in 15 minutes
    });

    // Send OTP to mobile for verification
    let otpData: any = null;
    try {
      const otpResult = await this.generateOtp({
        identifier: data.mobile,
        purpose: OtpPurpose.REGISTRATION,
        channel: OtpChannel.SMS,
      });
      otpData = otpResult.data;
    } catch (otpErr: any) {
      this.pendingRegistrations.delete(data.mobile);
      this.logger.warn(`Failed to generate registration OTP for ${data.mobile}: ${otpErr?.message}`);
      throw new BadRequestException('Failed to send OTP. Please try again.');
    }

    return {
      success: true,
      statusCode: 200,
      message: 'OTP sent to your mobile number. Please verify to complete registration.',
      data: {
        mobile: data.mobile,
        email: trimmedEmail,
        otp: otpData,
        nextStep: 'VERIFY_OTP',
      },
      error: null,
    };
  }

  async login(
    data: LoginDto,
    reqMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const rawIdentifier = data.identifier || data.mobile || data.phone;

    if (!rawIdentifier) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email/phone number or password.',
      });
    }

    const isEmail = rawIdentifier.includes('@');
    if (isEmail && !data.password) {
      throw new BadRequestException('Password is required for email login.');
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

    if (!isEmail) {
      // 1. Mobile login flow - generate and send OTP
      let otpData: any = null;
      try {
        const otpResult = await this.generateOtp({
          identifier: user.mobile || rawIdentifier,
          purpose: OtpPurpose.LOGIN,
          channel: OtpChannel.SMS,
        });
        otpData = otpResult.data;
      } catch (otpErr: any) {
        this.logger.warn(`Failed to generate login OTP for ${rawIdentifier}: ${otpErr?.message}`);
        throw new BadRequestException('Failed to send OTP. Please try again.');
      }

      return {
        success: true,
        statusCode: 200,
        message: 'OTP sent to your mobile number. Please verify to complete login.',
        data: {
          mobile: user.mobile || rawIdentifier,
          email: user.email || '',
          otp: otpData,
          nextStep: 'VERIFY_OTP',
        },
        error: null,
      };
    }

    // Password Verification (Plaintext comparison with bcrypt fallback for legacy hashed passwords)
    const isPasswordValid =
      data.password &&
      (data.password === user.password ||
        (user.password?.startsWith('$2') ? await bcrypt.compare(data.password, user.password) : false));

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
          gender: user.gender || '',
          email: user.email,
          phoneNumber: user.mobile,
          status: user.status,
          role: user.role,
          isEmployee: user.isEmployee,
          is_employee: user.isEmployee,
          isBuyer: user.isBuyer,
          is_buyer: user.isBuyer,
          isSeller: user.isSeller,
          is_seller: user.isSeller,
        },
      },
      error: null,
    };
  }

  async employeeLogin(
    data: EmployeeLoginDto,
    reqMeta?: { ipAddress?: string; userAgent?: string },
  ) {
    const email = data.email?.trim().toLowerCase();

    if (!email) {
      throw new BadRequestException('Email is required.');
    }

    const user = await this.database.user.findFirst({
      where: { email: { equals: email, mode: 'insensitive' } },
    });

    if (!user) {
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Role check: must be an employee or admin
    if (!user.isEmployee && user.role !== UserRole.EMPLOYEE && user.role !== UserRole.ADMIN) {
      throw new ForbiddenException({
        success: false,
        message: 'Access denied. You are not authorized to login as an employee.',
      });
    }

    // Security Check 1: Account Lockout Check
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      this.logger.warn(`Employee login attempt blocked for locked account ID: ${user.id}`);
      throw new UnauthorizedException({
        success: false,
        message: 'Account is locked due to multiple failed login attempts. Please try again later.',
      });
    }

    // Security Check 2: Account Status Check
    if (user.status !== 'ACTIVE') {
      this.logger.warn(`Employee login attempt for inactive user ID: ${user.id}, Status: ${user.status}`);
      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email or password.',
      });
    }

    // Password Verification
    const isPasswordValid =
      data.password &&
      (data.password === user.password ||
        (user.password?.startsWith('$2') ? await bcrypt.compare(data.password, user.password) : false));

    if (!isPasswordValid) {
      const lockResult = await this.authRepository.incrementFailedLoginAttempts(
        user.id,
        user.failedLoginAttempts,
      );

      this.recordLoginHistory({
        userId: user.id,
        identifier: email,
        status: LoginStatus.FAILED,
        failureReason: lockResult.isLocked
          ? 'Invalid password - Account Locked'
          : 'Invalid password',
        ipAddress: reqMeta?.ipAddress,
        userAgent: reqMeta?.userAgent,
      });

      throw new UnauthorizedException({
        success: false,
        message: 'Invalid email or password.',
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
      process.env.JWT_REFRESH_SECRET ||
      'haatza_refresh_secret';

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
          identifier: email,
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
      identifier: email,
      status: LoginStatus.SUCCESS,
      ipAddress: reqMeta?.ipAddress,
      userAgent: reqMeta?.userAgent,
    });

    this.logger.log(`Employee ${user.id} logged in successfully.`);

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
          gender: user.gender || '',
          email: user.email,
          phoneNumber: user.mobile,
          status: user.status,
          role: user.role,
          isEmployee: user.isEmployee,
          is_employee: user.isEmployee,
          isBuyer: user.isBuyer,
          is_buyer: user.isBuyer,
          isSeller: user.isSeller,
          is_seller: user.isSeller,
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

    if (!session.isActive) {
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
      await this.database.userSession.delete({
        where: { id: session.id },
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
    const rawId = (dto.identifier || dto.email || dto.mobile || '').trim();
    const rawEmail = dto.email?.trim().toLowerCase();
    const rawMobile = dto.mobile?.trim();

    let user: any = null;

    if (rawEmail && rawMobile) {
      // Enforce strict matching: both email and mobile must belong to the exact same user
      user = await this.database.user.findFirst({
        where: {
          email: { equals: rawEmail, mode: 'insensitive' },
          mobile: rawMobile,
        },
      });

      if (!user) {
        // Check if email or mobile exist independently to give a helpful error message
        const userByEmail = await this.database.user.findFirst({
          where: { email: { equals: rawEmail, mode: 'insensitive' } },
        });
        const userByMobile = await this.database.user.findFirst({
          where: { mobile: rawMobile },
        });

        if (userByEmail || userByMobile) {
          throw new BadRequestException(
            'The provided email address and mobile number do not match the same account.',
          );
        }
        throw new NotFoundException('User with provided credentials not found.');
      }
    } else {
      user = await this.database.user.findFirst({
        where: {
          OR: [
            ...(rawEmail ? [{ email: { equals: rawEmail, mode: 'insensitive' as const } }] : []),
            ...(rawMobile ? [{ mobile: rawMobile }] : []),
            ...(rawId ? [{ email: { equals: rawId.toLowerCase(), mode: 'insensitive' as const } }, { mobile: rawId }] : []),
          ],
        },
      });

      if (!user) {
        throw new NotFoundException('User with provided credentials not found.');
      }
    }

    const targetMobile = user.mobile || rawMobile;

    const otpResult = await this.generateOtp({
      identifier: targetMobile,
      purpose: OtpPurpose.FORGOT_PASSWORD,
      channel: OtpChannel.SMS,
    });

    return {
      ...otpResult,
      message: `OTP sent via SMS to mobile number ending in ${targetMobile.slice(-4)}`,
      data: {
        ...(otpResult.data || {}),
        mobile: targetMobile,
        email: user.email || dto.email,
      },
    };
  }

  async resetPassword(dto: ResetPasswordDto) {
    let email = dto.email?.trim();
    let mobile = dto.mobile?.trim();
    let identifierFromToken: string | null = null;

    if (dto.token) {
      try {
        const decoded = this.jwtService.verify(dto.token);
        if (decoded && decoded.identifier) {
          identifierFromToken = String(decoded.identifier).trim();
        }
      } catch (err) {
        throw new BadRequestException('Invalid or expired password reset token.');
      }
    }

    const targetIdentifier = identifierFromToken || dto.identifier?.trim() || email || mobile;

    if (!targetIdentifier) {
      throw new BadRequestException('Identifier, email, mobile, or reset token is required.');
    }

    if (dto.confirmPassword && dto.password !== dto.confirmPassword) {
      throw new BadRequestException('New password and confirmation password do not match.');
    }

    let cleanedPhone = targetIdentifier.replace(/[\s\-\(\)\+]/g, '');
    if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
      cleanedPhone = cleanedPhone.substring(2);
    }

    // 1. Locate User First
    let user = await this.authRepository.findUserByIdentifier(targetIdentifier);
    if (!user && (email || mobile)) {
      user = await this.database.user.findFirst({
        where: {
          OR: [
            ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : []),
            ...(mobile ? [{ mobile }] : []),
            ...(cleanedPhone ? [{ mobile: cleanedPhone }] : []),
          ],
        },
      });
    }

    if (!user) {
      throw new NotFoundException('User with provided credentials not found.');
    }

    // 2. Validate OTP Verification
    let isOtpValid = false;

    // Check A: Direct OTP passed in reset-password body
    const inputOtp = String(dto.otp || (dto as any).otpCode || '').trim();
    if (inputOtp) {
      const userIdsToMatch: string[] = [targetIdentifier, cleanedPhone, user.mobile, user.email].filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      );

      const matchingOtp = await this.database.otpVerification.findFirst({
        where: {
          OR: [
            ...userIdsToMatch.map((id) => ({ identifier: id })),
            { userId: user.id },
          ],
          otpHash: inputOtp,
        },
        orderBy: { createdAt: 'desc' },
      });

      if (matchingOtp) {
        isOtpValid = true;
        await this.database.otpVerification.update({
          where: { id: matchingOtp.id },
          data: { isVerified: true, verifiedAt: new Date() },
        });
      }
    }

    // Check B: Prior OTP Verification Check across user.id, mobile, email, or identifier
    if (!isOtpValid) {
      const userIdsToMatch: string[] = [targetIdentifier, cleanedPhone, user.mobile, user.email].filter(
        (id): id is string => typeof id === 'string' && id.trim().length > 0,
      );

      const verifiedOtpRecord = await this.database.otpVerification.findFirst({
        where: {
          OR: [
            ...userIdsToMatch.map((id) => ({ identifier: id })),
            { userId: user.id },
          ],
          isVerified: true,
        },
        orderBy: { updatedAt: 'desc' },
      });

      if (verifiedOtpRecord) {
        isOtpValid = true;
      }
    }

    if (!isOtpValid && !dto.token) {
      throw new BadRequestException(
        'OTP verification required. Please request and verify an OTP code before resetting your password.',
      );
    }

    await this.database.user.update({
      where: { id: user.id },
      data: {
        password: dto.password,
        passwordChangedAt: new Date(),
        failedLoginAttempts: 0,
        lockedUntil: null,
      },
    });

    this.logger.log(`Password reset successfully for user ID: ${user.id}`);

    return {
      success: true,
      statusCode: 200,
      message: 'Password reset successfully. You can now login with your new password.',
      data: {
        userId: user.id,
        mobile: user.mobile,
        email: user.email || '',
        reset: true,
      },
    };
  }

  async generateOtp(dto: GenerateOtpDto) {
    const rawIdentifier = dto.identifier.trim();
    const isEmail = rawIdentifier.includes('@');

    let normalizedIdentifier = rawIdentifier;
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
      normalizedIdentifier = cleanedPhone;
    } else {
      normalizedIdentifier = rawIdentifier.toLowerCase();
    }

    let targetPurpose: OtpPurpose = OtpPurpose.LOGIN;
    if (dto.purpose) {
      const pStr = String(dto.purpose).trim().toUpperCase();
      if (pStr === 'FORGOT_PASSWORD' || pStr === 'FORGOTPASSWORD') {
        targetPurpose = OtpPurpose.FORGOT_PASSWORD;
      } else if (pStr === 'REGISTRATION' || pStr === 'REGISTER') {
        targetPurpose = OtpPurpose.REGISTRATION;
      } else if (pStr === 'EMAIL_VERIFICATION') {
        targetPurpose = OtpPurpose.EMAIL_VERIFICATION;
      } else if (pStr === 'MOBILE_VERIFICATION') {
        targetPurpose = OtpPurpose.MOBILE_VERIFICATION;
      } else {
        targetPurpose = OtpPurpose.LOGIN;
      }
    }

    // Invalidate older unverified OTPs for this identifier so only the latest OTP is active
    try {
      await this.database.otpVerification.updateMany({
        where: {
          OR: [
            { identifier: normalizedIdentifier },
            { identifier: rawIdentifier },
          ],
          isVerified: false,
        },
        data: {
          isVerified: true,
        },
      });
    } catch (e: any) {
      this.logger.warn(`Older OTP invalidation warning: ${e.message}`);
    }

    const identifierType = isEmail ? OtpIdentifierType.EMAIL : OtpIdentifierType.PHONE;
    const rawOtp = Math.floor(100000 + Math.random() * 900000).toString();
    const otpHash = rawOtp; // Store plain-text 6-digit OTP code
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    const existingUser = await this.database.user.findFirst({
      where: isEmail
        ? { email: { equals: normalizedIdentifier, mode: 'insensitive' } }
        : { OR: [{ mobile: normalizedIdentifier }, { mobile: rawIdentifier }] },
      select: { id: true },
    });

    const now = new Date();
    const otpId = crypto.randomUUID();

    const otpRecord = await this.database.otpVerification.create({
      data: {
        id: otpId,
        userId: existingUser?.id ?? null,
        identifier: normalizedIdentifier,
        identifierType,
        otpHash,
        purpose: targetPurpose,
        channel: dto.channel ?? OtpChannel.SMS,
        expiresAt,
        createdAt: now,
        updatedAt: now,
        lastSentAt: now,
      },
    });

    this.logger.log(`Generated OTP for ${normalizedIdentifier} (${targetPurpose}): ${rawOtp}`);

    if (!isEmail) {
      try {
        await this.smsService.sendOtp(normalizedIdentifier, rawOtp);
      } catch (smsErr: any) {
        this.logger.error(`SMS dispatch warning for ${normalizedIdentifier}: ${smsErr?.message}`);
      }
    }

    return {
      success: true,
      statusCode: 200,
      message: 'OTP generated and sent successfully',
      data: {
        otpId: otpRecord.id,
        expiresAt: otpRecord.expiresAt,
      },
    };
  }

  async verifyOtp(dto: VerifyOtpDto, reqMeta?: { ipAddress?: string; userAgent?: string }) {
    const rawIdentifier = (
      dto.identifier ||
      dto.mobile ||
      dto.phone ||
      dto.email ||
      ''
    ).trim();

    const targetOtp = (dto.otp || dto.otpCode || '').trim();

    if (!rawIdentifier || !targetOtp) {
      throw new BadRequestException('Identifier and OTP code are required');
    }

    const isEmail = rawIdentifier.includes('@');
    let normalizedIdentifier = rawIdentifier;
    if (!isEmail) {
      let cleanedPhone = rawIdentifier.replace(/[\s\-\(\)\+]/g, '');
      if (cleanedPhone.length === 12 && cleanedPhone.startsWith('91')) {
        cleanedPhone = cleanedPhone.substring(2);
      }
      normalizedIdentifier = cleanedPhone;
    } else {
      normalizedIdentifier = rawIdentifier.toLowerCase();
    }

    let targetPurpose: OtpPurpose = OtpPurpose.LOGIN;
    if (dto.purpose) {
      const pStr = String(dto.purpose).trim().toUpperCase().replace(/[\s\-]/g, '_');
      if (pStr === 'FORGOT_PASSWORD' || pStr === 'FORGOTPASSWORD') {
        targetPurpose = OtpPurpose.FORGOT_PASSWORD;
      } else if (pStr === 'REGISTRATION' || pStr === 'REGISTER') {
        targetPurpose = OtpPurpose.REGISTRATION;
      } else if (pStr === 'EMAIL_VERIFICATION' || pStr === 'EMAILVERIFICATION') {
        targetPurpose = OtpPurpose.EMAIL_VERIFICATION;
      } else if (pStr === 'MOBILE_VERIFICATION' || pStr === 'MOBILEVERIFICATION') {
        targetPurpose = OtpPurpose.MOBILE_VERIFICATION;
      } else {
        targetPurpose = OtpPurpose.LOGIN;
      }
    }

    let otpRecord = await this.database.otpVerification.findFirst({
      where: {
        OR: [
          { identifier: normalizedIdentifier },
          { identifier: rawIdentifier },
          { identifier: { equals: rawIdentifier, mode: 'insensitive' } },
        ],
        purpose: targetPurpose,
        isVerified: false,
      },
      orderBy: { createdAt: 'desc' },
    });

    // Fallback: search for latest active OTP for identifier regardless of exact purpose match
    if (!otpRecord) {
      otpRecord = await this.database.otpVerification.findFirst({
        where: {
          OR: [
            { identifier: normalizedIdentifier },
            { identifier: rawIdentifier },
            { identifier: { equals: rawIdentifier, mode: 'insensitive' } },
          ],
          isVerified: false,
        },
        orderBy: { createdAt: 'desc' },
      });
    }

    if (!otpRecord) {
      throw new BadRequestException('No active OTP request found for this identifier');
    }

    if (new Date() > otpRecord.expiresAt) {
      throw new BadRequestException('OTP has expired');
    }

    const isValidOtp = String(otpRecord.otpHash).trim() === targetOtp;

    if (!isValidOtp) {
      throw new BadRequestException('Invalid OTP code');
    }

    await this.database.otpVerification.update({
      where: { id: otpRecord.id },
      data: { isVerified: true, verifiedAt: new Date() },
    });

    // Find user by identifier if exists
    const user = await this.database.user.findFirst({
      where: {
        OR: [
          { email: { equals: rawIdentifier, mode: 'insensitive' } },
          { mobile: rawIdentifier },
          { mobile: normalizedIdentifier },
        ],
      },
    });

    // If OTP purpose is REGISTRATION, create the user from pending registration data
    if (targetPurpose === OtpPurpose.REGISTRATION) {
      const pending = this.pendingRegistrations.get(normalizedIdentifier)
        || this.pendingRegistrations.get(rawIdentifier);

      if (!pending) {
        throw new BadRequestException('Registration session expired or not found. Please register again.');
      }

      if (new Date() > pending.expiresAt) {
        this.pendingRegistrations.delete(normalizedIdentifier);
        throw new BadRequestException('Registration session expired. Please register again.');
      }

      const isEmployeeBool =
        pending.employee === true ||
        (pending.employee as any) === 'true' ||
        pending.isEmployee === true ||
        (pending.isEmployee as any) === 'true' ||
        pending.role === UserRole.EMPLOYEE;

      const isBuyerBool =
        (pending.buyer === true || (pending.buyer as any) === 'true' || pending.role === UserRole.BUYER) &&
        !isEmployeeBool;

      const userRole = pending.role || (isEmployeeBool ? UserRole.EMPLOYEE : (isBuyerBool ? UserRole.BUYER : UserRole.SELLER));

      const roleRecord = await this.database.role.findFirst({
        where: { OR: [{ name: userRole }, { code: userRole.toLowerCase() }] },
      });

      const isSellerBool =
        (userRole === UserRole.SELLER || userRole === UserRole.SELLER_OWNER || userRole === UserRole.SELLER_STAFF) &&
        !isEmployeeBool;

      const finalIsEmployeeBool = isEmployeeBool || userRole === UserRole.EMPLOYEE;

      let createdUser: any;
      try {
        createdUser = await this.database.user.create({
          data: {
            name: pending.name || '',
            gender: pending.gender || null,
            mobile: pending.mobile,
            email: pending.email,
            password: pending.password,
            role: userRole,
            isBuyer: isBuyerBool,
            isSeller: isSellerBool,
            isEmployee: finalIsEmployeeBool,
            roleId: roleRecord ? roleRecord.id : null,
            phoneVerifiedAt: new Date(), // mark phone as verified immediately
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          const target = Array.isArray(err?.meta?.target)
            ? err.meta.target.join(' ')
            : String(err?.meta?.target || '');
          if (target.includes('email')) throw new ConflictException('Email address already registered');
          if (target.includes('mobile') || target.includes('phone')) throw new ConflictException('Mobile number already registered');
          throw new ConflictException('User with these credentials already exists');
        }
        throw err;
      }

      // Clear pending registration data
      this.pendingRegistrations.delete(normalizedIdentifier);
      this.pendingRegistrations.delete(rawIdentifier);

      const sessionUuid = crypto.randomUUID();
      const payload = {
        sub: createdUser.id,
        sessionId: sessionUuid,
        role: createdUser.role,
        mobile: createdUser.mobile,
        email: createdUser.email,
        jti: crypto.randomUUID(),
      };

      const refreshSecret =
        this.configService.get<string>('JWT_REFRESH_SECRET') ||
        process.env.JWT_REFRESH_SECRET ||
        'haatza_refresh_secret';

      const expiresInSeconds = 3600;
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
            userId: createdUser.id,
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
        this.logger.error(`UserSession creation warning for user ${createdUser?.id}: ${dbErr?.message}`);
      }

      return {
        success: true,
        message: 'Registration successful.',
        data: {
          userId: createdUser.id || '',
          mobile: createdUser.mobile || '',
          email: createdUser.email || '',
          buyer: isBuyerBool,
          seller: isSellerBool,
          employee: finalIsEmployeeBool,
          accessToken: accessToken || '',
          refreshToken: refreshToken || '',
          expiresIn: expiresInSeconds || 0,
          user: {
            id: createdUser.id || '',
            name: createdUser.name || '',
            gender: createdUser.gender || '',
            email: createdUser.email || '',
            phoneNumber: createdUser.mobile || '',
            status: createdUser.status || 'ACTIVE',
            role: createdUser.role || 'SELLER',
            isEmployee: createdUser.isEmployee ?? false,
            isBuyer: createdUser.isBuyer ?? false,
            isSeller: createdUser.isSeller ?? false,
          },
          nextStep: 'HOME',
        },
      };
    }

    // If OTP purpose is LOGIN or other, update user verification timestamp
    if (user) {
      const isEmailId = rawIdentifier.includes('@');
      await this.database.user.update({
        where: { id: user.id },
        data: isEmailId ? { emailVerifiedAt: new Date() } : { phoneVerifiedAt: new Date() },
      }).catch(err => this.logger.warn(`Failed to update verification timestamp: ${err.message}`));
    }

    let accessToken = '';
    let refreshToken = '';
    let expiresInSeconds = 0;

    if (targetPurpose === OtpPurpose.LOGIN) {
      if (!user) {
        throw new BadRequestException('User not found for this identifier. Please register first.');
      }

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
        process.env.JWT_REFRESH_SECRET ||
        'haatza_refresh_secret';

      expiresInSeconds = 3600;
      accessToken = await this.jwtService.signAsync(payload, { expiresIn: `${expiresInSeconds}s` });
      refreshToken = this.jwtService.sign(payload, {
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
        this.logger.error(`UserSession creation warning for user ${user?.id}: ${dbErr?.message}`);
      }
    }

    let message = 'OTP verified successfully.';
    if (targetPurpose === OtpPurpose.LOGIN) {
      message = 'Login successful.';
    }

    return {
      success: true,
      message,
      data: {
        userId: user?.id || '',
        mobile: user?.mobile || '',
        email: user?.email || '',
        buyer: user?.isBuyer ?? false,
        seller: user?.isSeller ?? false,
        employee: user?.isEmployee ?? false,
        accessToken: accessToken || '',
        refreshToken: refreshToken || '',
        expiresIn: expiresInSeconds || 0,
        user: {
          id: user?.id || '',
          name: user?.name || '',
          gender: user?.gender || '',
          email: user?.email || '',
          phoneNumber: user?.mobile || '',
          status: user?.status || 'ACTIVE',
          role: user?.role || 'SELLER',
          isEmployee: user?.isEmployee ?? false,
          isBuyer: user?.isBuyer ?? false,
          isSeller: user?.isSeller ?? false,
        },
        nextStep: targetPurpose === OtpPurpose.FORGOT_PASSWORD ? 'RESET_PASSWORD' : 'HOME',
      },
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
          isEmployee: user.isEmployee,
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

    if (!session || !session.isActive) {
      if (session?.userId) {
        this.logger.error(`Security alert: Token reuse detected for User ${session.userId}. Invalidating ALL active sessions.`);
        await this.database.userSession.deleteMany({
          where: { userId: session.userId },
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
      isActive: sess.isActive && (sess.expiresAt > new Date()),
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
      await this.database.userSession.delete({
        where: { id: session.id },
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
    const result = await this.database.userSession.deleteMany({
      where: {
        userId,
        id: { not: currentSessionId },
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

  /**
   * Returns the page-level permission matrix for a given user role.
   * Used by the Employee Portal frontend for dynamic RBAC (sidebar, route guards, action buttons).
   */
  getUserPermissions(role: string): {
    role: string;
    pages: Array<{
      pageCode: string;
      pageName: string;
      route: string;
      canView: boolean;
      canCreate: boolean;
      canEdit: boolean;
      canDelete: boolean;
    }>;
  } {
    const normalizedRole = (role || 'EMPLOYEE').toUpperCase();

    const isAdmin = normalizedRole === 'ADMIN';
    const isHR = normalizedRole === 'HR';
    const isManager = normalizedRole === 'MANAGER';

    const pages = [
      {
        pageCode: 'DASHBOARD',
        pageName: 'Dashboard',
        route: '/dashboard',
        canView: true,
        canCreate: false,
        canEdit: false,
        canDelete: false,
      },
      {
        pageCode: 'EMPLOYEES',
        pageName: 'Employees',
        route: '/employees',
        canView: isAdmin || isHR || isManager,
        canCreate: isAdmin || isHR,
        canEdit: isAdmin || isHR,
        canDelete: isAdmin,
      },
      {
        pageCode: 'ROLES',
        pageName: 'Roles & Permissions',
        route: '/roles',
        canView: isAdmin,
        canCreate: isAdmin,
        canEdit: isAdmin,
        canDelete: isAdmin,
      },
    ];

    return { role: normalizedRole, pages };
  }

  // =========================================================================
  // RBAC ROLE SELECTION & PERMISSIONS ENGINE
  // =========================================================================

  /**
   * API 1: Return ONLY the active roles assigned to the currently authenticated user.
   */
  async getUserRoles(userId: string) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('User account is inactive.');
    }

    const roles = await this.authRepository.findUserAssignedRoles(userId);

    return {
      success: true,
      message: 'Roles retrieved successfully',
      data: {
        roles: roles.map((r) => ({
          roleId: r.id,
          roleCode: r.roleCode,
          roleName: r.roleName,
        })),
      },
    };
  }

  /**
   * API 2: Allow the authenticated user to select one of their assigned roles.
   */
  async selectRole(userId: string, dto: SelectRoleDto) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: { id: true, mobile: true, email: true, status: true },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    if (user.status !== 'ACTIVE') {
      throw new ForbiddenException('User account is inactive.');
    }

    // Verify role assignment & role active status in database
    const assignedRole = await this.authRepository.findUserRoleById(userId, dto.roleId);

    if (!assignedRole) {
      this.logger.warn(`Role selection rejected: User [${userId}] attempted to select unassigned or inactive role [${dto.roleId}]`);
      throw new ForbiddenException('The requested role is not assigned to your account or is inactive.');
    }

    // Generate new Access Token containing selected role context
    const accessToken = this.jwtService.sign({
      sub: user.id,
      role: assignedRole.roleCode,
      roleId: assignedRole.id,
      mobile: user.mobile,
    });

    this.logger.log(`Role [${assignedRole.roleCode}] selected successfully for User [${user.id}]`);

    return {
      success: true,
      message: 'Role selected successfully',
      data: {
        role: {
          roleId: assignedRole.id,
          roleCode: assignedRole.roleCode,
          roleName: assignedRole.roleName,
        },
        accessToken,
      },
    };
  }

  /**
   * API 3: Return page-level and action-level permissions for the currently selected role.
   */
  async getPermissions(userId: string, currentRoleCode?: string, currentRoleId?: string) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    let targetRole: { id: string; roleCode: string; roleName: string } | null = null;

    if (currentRoleId) {
      targetRole = await this.authRepository.findUserRoleById(userId, currentRoleId);
    }

    if (!targetRole && currentRoleCode) {
      const assignedRoles = await this.authRepository.findUserAssignedRoles(userId);
      targetRole = assignedRoles.find((r) => r.roleCode.toUpperCase() === currentRoleCode.toUpperCase()) || null;
    }

    if (!targetRole) {
      const assignedRoles = await this.authRepository.findUserAssignedRoles(userId);
      targetRole = assignedRoles[0] || null;
    }

    if (!targetRole) {
      throw new ForbiddenException('No active role assignment found for user.');
    }

    const pages = await this.authRepository.findRolePagesByRoleId(targetRole.id);

    return {
      success: true,
      message: 'Permissions retrieved successfully',
      data: {
        role: {
          roleId: targetRole.id,
          roleCode: targetRole.roleCode,
          roleName: targetRole.roleName,
        },
        pages: pages.map((p) => ({
          pageCode: p.pageCode,
          pageName: p.pageName,
          route: p.route,
          canView: p.canView,
          canCreate: p.canCreate,
          canEdit: p.canEdit,
          canDelete: p.canDelete,
        })),
      },
    };
  }

  /**
   * API 4: Return current authenticated user profile & active role information.
   */
  async getCurrentUser(userId: string, currentRoleId?: string) {
    if (!userId) {
      throw new UnauthorizedException('Authentication required.');
    }

    const user = await this.database.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        isBuyer: true,
        isSeller: true,
        isEmployee: true,
        status: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found.');
    }

    let selectedRole: { id: string; roleCode: string; roleName: string } | null = null;
    if (currentRoleId) {
      selectedRole = await this.authRepository.findUserRoleById(userId, currentRoleId);
    }

    if (!selectedRole) {
      const assignedRoles = await this.authRepository.findUserAssignedRoles(userId);
      selectedRole = assignedRoles[0] || null;
    }

    return {
      success: true,
      message: 'User profile retrieved successfully',
      data: {
        userId: user.id,
        name: user.name,
        email: user.email,
        mobile: user.mobile,
        userType: user.isEmployee ? 'EMPLOYEE' : (user.isSeller ? 'SELLER' : 'BUYER'),
        isBuyer: user.isBuyer,
        isSeller: user.isSeller,
        isEmployee: user.isEmployee,
        status: user.status,
        isActive: user.status === 'ACTIVE',
        selectedRole: selectedRole
          ? {
            roleId: selectedRole.id,
            roleCode: selectedRole.roleCode,
            roleName: selectedRole.roleName,
          }
          : null,
      },
    };
  }

  /**
   * API 5: Switch user role to another assigned role.
   */
  async switchRole(userId: string, dto: SwitchRoleDto) {
    const res = await this.selectRole(userId, dto);
    return {
      ...res,
      message: 'Role switched successfully',
    };
  }
}

