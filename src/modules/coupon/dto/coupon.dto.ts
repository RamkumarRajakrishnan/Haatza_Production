import { IsString, IsNotEmpty } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ValidateCouponDto {
  @ApiProperty({ example: 'plan_growth_123' })
  @IsNotEmpty()
  @IsString()
  planId: string;

  @ApiProperty({ example: 'GROW50' })
  @IsNotEmpty()
  @IsString()
  couponCode: string;
}
