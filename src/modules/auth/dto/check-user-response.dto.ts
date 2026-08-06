import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export type IdentifierType = 'EMAIL' | 'PHONE';
export type NextStep = 'LOGIN' | 'REGISTER';

export class CheckUserDataDto {
  @ApiProperty({ description: 'Indicates whether the user exists in the database', example: true })
  exists: boolean;

  @ApiPropertyOptional({ description: 'User unique ID (only present if user exists)', example: 'usr_12345' })
  userId?: string;

  @ApiProperty({ description: 'Detected type of identifier', enum: ['EMAIL', 'PHONE'], example: 'EMAIL' })
  identifierType: IdentifierType;

  @ApiPropertyOptional({ description: 'Role or type of user', example: 'SELLER' })
  userType?: string;

  @ApiPropertyOptional({ description: 'Whether user account status is ACTIVE', example: true })
  isActive?: boolean;

  @ApiPropertyOptional({ description: 'Whether user email has been verified', example: true })
  emailVerified?: boolean;

  @ApiPropertyOptional({ description: 'Whether user phone has been verified', example: true })
  phoneVerified?: boolean;

  @ApiProperty({ description: 'Recommended next action for the client', enum: ['LOGIN', 'REGISTER'], example: 'LOGIN' })
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
