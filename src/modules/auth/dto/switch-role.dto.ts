import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString } from 'class-validator';

export class SwitchRoleDto {
  @ApiProperty({ description: 'Target Role ID to switch to' })
  @IsNotEmpty({ message: 'roleId is required' })
  @IsString({ message: 'roleId must be a string' })
  roleId: string;
}
