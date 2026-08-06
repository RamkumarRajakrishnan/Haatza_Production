import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsNotEmpty, IsString, ValidateNested } from 'class-validator';
import { DeviceInfoDto } from './device-info.dto';

export class VerifyOtpSessionDto {
  @ApiProperty({ example: '+1234567890', description: 'User mobile phone number' })
  @IsNotEmpty({ message: 'phoneNumber is required.' })
  @IsString({ message: 'phoneNumber must be a string.' })
  phoneNumber: string;

  @ApiProperty({ example: '554433', description: '6-digit OTP code' })
  @IsNotEmpty({ message: 'otpCode is required.' })
  @IsString({ message: 'otpCode must be a string.' })
  otpCode: string;

  @ApiProperty({ type: DeviceInfoDto, description: 'Device metadata and FCM push token' })
  @IsNotEmpty({ message: 'deviceInfo is required.' })
  @ValidateNested()
  @Type(() => DeviceInfoDto)
  deviceInfo: DeviceInfoDto;
}
