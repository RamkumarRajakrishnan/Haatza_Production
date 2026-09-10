import { ApiProperty } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsString, Matches } from 'class-validator';

export class ModuleQueryDto {
  @ApiProperty({
    name: 'module',
    enum: ['haatza', 'lite'],
    description: 'Target module (strictly case-sensitive: haatza or lite)',
    example: 'haatza',
    required: true,
  })
  @IsNotEmpty({ message: 'module is required' })
  @IsString({ message: 'module must be a string' })
  @IsIn(['haatza', 'lite'], {
    message: 'Invalid module. Allowed values are haatza or lite.',
  })
  @Matches(/^(haatza|lite)$/, {
    message: 'Invalid module. Allowed values are haatza or lite.',
  })
  module: 'haatza' | 'lite';
}
