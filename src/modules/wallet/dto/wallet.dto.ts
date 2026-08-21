import { IsString, IsNotEmpty, IsOptional } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class PayWithWalletDto {
  @ApiProperty({ example: 'plan_growth_123' })
  @IsNotEmpty()
  @IsString()
  planId: string;

  @ApiPropertyOptional({ example: 'GROW50' })
  @IsOptional()
  @IsString()
  couponCode?: string;
}
