import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class RefreshTokenSessionDto {
  @ApiProperty({ description: 'Device hardware ID' })
  @IsNotEmpty({ message: 'deviceId is required.' })
  @IsString({ message: 'deviceId must be a string.' })
  deviceId: string;

  @ApiProperty({ description: 'Opaque refresh token string' })
  @IsNotEmpty({ message: 'refreshToken is required.' })
  @IsString({ message: 'refreshToken must be a string.' })
  refreshToken: string;
}
