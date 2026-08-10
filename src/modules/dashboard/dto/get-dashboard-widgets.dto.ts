import { IsNotEmpty, IsString, IsOptional, IsEnum } from 'class-validator';
import { DashboardModule } from '@prisma/client';

export class GetDashboardWidgetsDto {
  @IsNotEmpty({ message: 'categoryId is required' })
  @IsString()
  categoryId: string;

  @IsNotEmpty({ message: 'warehouseId is required' })
  @IsString()
  warehouseId: string;

  @IsOptional()
  @IsEnum(DashboardModule)
  module?: DashboardModule = DashboardModule.LITE;
}
