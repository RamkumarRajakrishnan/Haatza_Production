import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenSessionDto {
  @ApiProperty({ example: '9f8a7b6c-5d4e-3f2a-1b0c-9d8e7f6a5b4c', description: 'Device hardware ID' })
  @IsNotEmpty({ message: 'deviceId is required.' })
  @IsString({ message: 'deviceId must be a string.' })
  deviceId: string;

  @ApiProperty({ example: 'a8f3b2c1d0e9f8a7b6c5d4e3f2a1b0c9', description: 'Opaque refresh token string' })
  @IsNotEmpty({ message: 'refreshToken is required.' })
  @IsString({ message: 'refreshToken must be a string.' })
  refreshToken: string;
}
