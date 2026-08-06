import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @ApiProperty({ description: 'Unique device hardware identifier' })
  @IsNotEmpty({ message: 'deviceId is required.' })
  @IsString({ message: 'deviceId must be a string.' })
  deviceId: string;

  @ApiPropertyOptional({ description: 'User human-readable device name' })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ description: 'Platform OS (IOS, ANDROID, WEB)' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ description: 'Device OS version' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({ description: 'Client app version' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ description: 'FCM Push Token (Stored securely in DB)' })
  @IsOptional()
  @IsString()
  pushToken?: string;
}
