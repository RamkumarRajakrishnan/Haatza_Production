import { ApiProperty } from '@nestjs/swagger';

export type IdentifierType = 'EMAIL' | 'PHONE';
export type NextStep = 'LOGIN' | 'REGISTER';

export class CheckUserDataDto {
  @ApiProperty({ description: 'Indicates whether the user exists in database for platform' })
  exists: boolean;

  @ApiProperty({ description: 'User unique ID or empty string if not applicable' })
  userId: string;

  @ApiProperty({ description: 'Detected type of identifier', enum: ['EMAIL', 'PHONE'] })
  identifierType: IdentifierType | string;

  @ApiProperty({ description: 'Role or type of user or empty string' })
  userType: string;

  @ApiProperty({ description: 'Whether user account status is ACTIVE' })
  isActive: boolean;

  @ApiProperty({ description: 'Whether user email has been verified' })
  emailVerified: boolean;

  @ApiProperty({ description: 'Whether user phone has been verified' })
  phoneVerified: boolean;

  @ApiProperty({ description: 'Recommended next action for client', enum: ['LOGIN', 'REGISTER'] })
  nextStep: NextStep | string;
}

export class CheckUserResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ required: false })
  statusCode?: number;

  @ApiProperty()
  message: string;

  @ApiProperty({ type: CheckUserDataDto })
  data: CheckUserDataDto;

  @ApiProperty({ required: false, nullable: true })
  error?: any;
}
