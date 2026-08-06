import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString } from 'class-validator';

export class DeviceInfoDto {
  @ApiProperty({ example: '9f8a7b6c-5d4e-3f2a-1b0c-9d8e7f6a5b4c', description: 'Unique device hardware identifier' })
  @IsNotEmpty({ message: 'deviceId is required.' })
  @IsString({ message: 'deviceId must be a string.' })
  deviceId: string;

  @ApiPropertyOptional({ example: 'iPhone 15 Pro', description: 'User human-readable device name' })
  @IsOptional()
  @IsString()
  deviceName?: string;

  @ApiPropertyOptional({ example: 'IOS', description: 'Platform OS (IOS, ANDROID, WEB)' })
  @IsOptional()
  @IsString()
  platform?: string;

  @ApiPropertyOptional({ example: '17.4.1', description: 'Device OS version' })
  @IsOptional()
  @IsString()
  osVersion?: string;

  @ApiPropertyOptional({ example: '2.4.0', description: 'Client app version' })
  @IsOptional()
  @IsString()
  appVersion?: string;

  @ApiPropertyOptional({ example: 'fcm_token_xyz_123456', description: 'FCM Push Token (Stored securely in DB)' })
  @IsOptional()
  @IsString()
  pushToken?: string;
}
