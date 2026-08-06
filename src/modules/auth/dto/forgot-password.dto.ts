import { IsNotEmpty, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForgotPasswordDto {
  @ApiProperty({ description: 'Registered mobile number or email address' })
  @IsString()
  @IsNotEmpty()
  identifier: string;
}
