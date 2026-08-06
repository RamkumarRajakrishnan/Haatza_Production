import { ApiProperty } from '@nestjs/swagger';

export type IdentifierType = 'EMAIL' | 'PHONE';
export type NextStep = 'LOGIN' | 'REGISTER';

export class CheckUserDataDto {
  @ApiProperty({ description: 'Indicates whether the user exists in database for platform', example: true })
  exists: boolean;

  @ApiProperty({ description: 'User unique ID or empty string if not applicable', example: 'bbf960c1-3089-4e92-8393-fa8728aae9c5' })
  userId: string;

  @ApiProperty({ description: 'Detected type of identifier', enum: ['EMAIL', 'PHONE'], example: 'PHONE' })
  identifierType: IdentifierType | string;

  @ApiProperty({ description: 'Role or type of user or empty string', example: 'BUYER' })
  userType: string;

  @ApiProperty({ description: 'Whether user account status is ACTIVE', example: true })
  isActive: boolean;

  @ApiProperty({ description: 'Whether user email has been verified', example: false })
  emailVerified: boolean;

  @ApiProperty({ description: 'Whether user phone has been verified', example: false })
  phoneVerified: boolean;

  @ApiProperty({ description: 'Recommended next action for client', enum: ['LOGIN', 'REGISTER'], example: 'LOGIN' })
  nextStep: NextStep | string;
}

export class CheckUserResponseDto {
  @ApiProperty({ example: true })
  success: boolean;

  @ApiProperty({ example: 'User found.' })
  message: string;

  @ApiProperty({ type: CheckUserDataDto })
  data: CheckUserDataDto;
}
