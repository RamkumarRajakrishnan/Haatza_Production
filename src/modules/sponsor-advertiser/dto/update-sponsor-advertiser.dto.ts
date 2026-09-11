import { PartialType } from '@nestjs/swagger';
import { CreateSponsorAdvertiserDto } from './create-sponsor-advertiser.dto';

export class UpdateSponsorAdvertiserDto extends PartialType(CreateSponsorAdvertiserDto) {}
