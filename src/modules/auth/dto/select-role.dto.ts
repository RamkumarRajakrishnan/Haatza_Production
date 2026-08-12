import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SelectRoleDto {
  @ApiProperty({ description: 'Target Role ID to select' })
  @IsNotEmpty({ message: 'roleId is required' })
  @IsString({ message: 'roleId must be a string' })
  roleId: string;
}
