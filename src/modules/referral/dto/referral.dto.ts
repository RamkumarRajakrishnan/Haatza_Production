import { IsString, IsNotEmpty, IsNumber, Min } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateReferralRewardDto {
  @ApiProperty({ example: 'sub_001' })
  @IsNotEmpty()
  @IsString()
  subscriptionId: string;

  @ApiProperty({ example: 200 })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  pointsToUse: number;
}
