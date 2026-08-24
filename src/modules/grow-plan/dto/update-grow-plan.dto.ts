import { PartialType } from '@nestjs/swagger';
import { CreateGrowPlanDto } from './create-grow-plan.dto';

export class UpdateGrowPlanDto extends PartialType(CreateGrowPlanDto) {}
