import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Registered mobile number or email address', example: '9876543210' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
