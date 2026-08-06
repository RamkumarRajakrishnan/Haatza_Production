import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type IdentifierType = 'EMAIL' | 'PHONE';
export type NextStep = 'LOGIN' | 'REGISTER' | 'ONBOARD_SELLER' | 'ONBOARD_BUYER';

export class CheckUserDataDto {
  @ApiProperty({ description: 'Indicates whether the user exists in the database', example: true })
  exists: boolean;

  @ApiPropertyOptional({ description: 'User unique ID (only present if user exists)', example: 'usr_12345' })
  userId?: string;

  @ApiProperty({ description: 'Detected type of identifier', enum: ['EMAIL', 'PHONE'], example: 'EMAIL' })
  identifierType: IdentifierType;

  @ApiPropertyOptional({ description: 'Target platform requested (SELLER or BUYER)', example: 'SELLER' })
  platform?: string;

  @ApiPropertyOptional({ description: 'Whether user profile exists on the requested platform', example: false })
  existsOnRequestedPlatform?: boolean;

  @ApiPropertyOptional({ description: 'Primary user role in system', example: 'BUYER' })
  userType?: string;

  @ApiPropertyOptional({ description: 'Whether user has Buyer access', example: true })
  isBuyer?: boolean;

  @ApiPropertyOptional({ description: 'Whether user has Seller access', example: false })
  isSeller?: boolean;

  @ApiPropertyOptional({ description: 'Seller onboarding status if seller', example: 'PENDING' })
  sellerOnboardStatus?: string;

  @ApiPropertyOptional({ description: 'Whether user account status is ACTIVE', example: true })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether user email has been verified', example: true })
  emailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Whether user phone has been verified', example: true })
  phoneVerified?: boolean;

  @ApiProperty({ description: 'Recommended next action for client', enum: ['LOGIN', 'REGISTER', 'ONBOARD_SELLER', 'ONBOARD_BUYER'], example: 'ONBOARD_SELLER' })
  nextStep: NextStep;
}

export class CheckUserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User found.' })
  message: string;

  @ApiProperty({ type: CheckUserDataDto })
  data: CheckUserDataDto;
}
