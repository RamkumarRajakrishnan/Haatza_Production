import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class VerifyOtpSessionDto {
  @ApiProperty({ description: 'User mobile phone number' })
  @IsNotEmpty({ message: 'phoneNumber is required.' })
  @IsString({ message: 'phoneNumber must be a string.' })
  phoneNumber: string;

  @ApiProperty({ description: '6-digit OTP code' })
  @IsNotEmpty({ message: 'otpCode is required.' })
  @IsString({ message: 'otpCode must be a string.' })
  otpCode: string;

  @ApiPropertyOptional({ type: DeviceInfoDto, description: 'Device metadata and FCM push token' })
  @IsOptional()
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo?: DeviceInfoDto;
}
