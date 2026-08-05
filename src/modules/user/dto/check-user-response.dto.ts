import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class UserSummaryDto {
  @ApiProperty({ description: 'User ID' })
  id: string;

  @ApiPropertyOptional({ description: 'User email address' })
  email?: string | null;

  @ApiProperty({ description: 'User phone number' })
  phoneNumber: string;

  @ApiProperty({ description: 'User status', example: 'ACTIVE' })
  status: string;
}

export class CheckUserResponseDto {
  @ApiProperty({ description: 'Operation status', example: true })
  success: boolean;

  @ApiProperty({ description: 'Indicates if user exists', example: true })
  exists: boolean;

  @ApiPropertyOptional({
    description: 'User details if found',
    type: UserSummaryDto,
    nullable: true,
  })
  user: UserSummaryDto | null;

  @ApiProperty({ description: 'Status message', example: 'User found.' })
  message: string;
}

export class CheckUserErrorResponseDto {
  @ApiProperty({ description: 'Operation status', example: false })
  success: boolean;

  @ApiProperty({
    description: 'Error message',
    example: 'Either email or phoneNumber is required.',
  })
  message: string;
}
