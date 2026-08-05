import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserLoginSummaryDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiProperty({ description: 'User full name' })
  name: string;

  @ApiPropertyOptional({ description: 'User email address', nullable: true })
  email?: string | null;

  @ApiProperty({ description: 'User phone number' })
  phoneNumber: string;

  @ApiProperty({ description: 'User role', example: 'BUYER' })
  role: string;

  @ApiProperty({ description: 'User status', example: 'ACTIVE' })
  status: string;
}

export class LoginSuccessResponseDto {
  @ApiProperty({ description: 'Operation status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Status message', example: 'Login successful.' })
  message: string;

  @ApiProperty({ description: 'JWT Access Token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT Refresh Token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration in seconds', example: 3600 })
  expiresIn: number;

  @ApiProperty({ description: 'User details', type: UserLoginSummaryDto })
  user: UserLoginSummaryDto;
}

export class LoginErrorResponseDto {
  @ApiProperty({ description: 'Operation status', example: false })
  success: boolean;

  @ApiProperty({
    description: 'Error message',
    example: 'Invalid email/phone number or password.',
  })
  message: string;
}
