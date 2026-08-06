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

  @ApiProperty({ description: 'User role' })
  role: string;

  @ApiProperty({ description: 'User status' })
  status: string;
}

export class LoginSuccessResponseDto {
  @ApiProperty({ description: 'Operation status' })
  success: boolean;

  @ApiProperty({ description: 'Status message' })
  message: string;

  @ApiProperty({ description: 'JWT Access Token' })
  accessToken: string;

  @ApiProperty({ description: 'JWT Refresh Token' })
  refreshToken: string;

  @ApiProperty({ description: 'Access token expiration in seconds' })
  expiresIn: number;

  @ApiProperty({ description: 'User details', type: UserLoginSummaryDto })
  user: UserLoginSummaryDto;
}

export class LoginErrorResponseDto {
  @ApiProperty({ description: 'Operation status' })
  success: boolean;

  @ApiProperty({
    description: 'Error message',
  })
  message: string;
}
