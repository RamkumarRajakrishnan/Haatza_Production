import {
  Controller,
  Get,
  Post,
  Put,
  Patch,
  Delete,
  Param,
  Body,
  Query,
  HttpCode,
  HttpStatus,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { SponsorAdCreativeService } from './sponsor-ad-creative.service';
import { CreateSponsorAdCreativeDto } from './dto/create-sponsor-ad-creative.dto';
import { UpdateSponsorAdCreativeDto } from './dto/update-sponsor-ad-creative.dto';
import { QuerySponsorAdCreativeDto } from './dto/query-sponsor-ad-creative.dto';

@ApiTags('Sponsor Ad Creatives')
@Controller([
  'sponsor-ad-creatives',
  'sponsor_ad_creatives',
  'sponsorAdCreatives',
  'sponsor/creatives',
  '',
])
export class SponsorAdCreativeController {
  constructor(private readonly creativeService: SponsorAdCreativeService) {}

  // ─────────────────── 1. CREATE ───────────────────

  @Post([
    'createSponsorAdCreatives',
    'createSponsorAdCreative',
    'create',
    'add',
    '',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create Sponsor Ad Creative (createSponsorAdCreatives)',
    description:
      'Creates a new ad creative in DRAFT status linked to an existing sponsor campaign. ' +
      'Requires ?module=sponsor. ' +
      'Usage: POST /api/v1/createSponsorAdCreatives?module=sponsor or /api/v1/sponsor-ad-creatives/createSponsorAdCreatives?module=sponsor',
  })
  @ApiQuery({ name: 'module', required: true, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor ad creative created successfully' })
  async create(@Body() body: any, @Query() query: any) {
    const dto: CreateSponsorAdCreativeDto = {
      campaignId:
        body?.campaignId ||
        query?.campaignId ||
        body?.campaign_id ||
        query?.campaign_id ||
        body?.campaignUid ||
        query?.campaignUid ||
        body?.campaign_uid ||
        query?.campaign_uid,
      creativeName:
        body?.creativeName ||
        query?.creativeName ||
        body?.creative_name ||
        query?.creative_name ||
        body?.name ||
        query?.name,
      primaryText:
        body?.primaryText ||
        query?.primaryText ||
        body?.primary_text ||
        query?.primary_text ||
        body?.text ||
        query?.text,
      headline:
        body?.headline ||
        query?.headline ||
        body?.title ||
        query?.title,
      creativeImageUrl:
        body?.creativeImageUrl ||
        query?.creativeImageUrl ||
        body?.creative_image_url ||
        query?.creative_image_url ||
        body?.imageUrl ||
        query?.imageUrl ||
        body?.image_url ||
        query?.image_url,
      imageAspectRatio:
        body?.imageAspectRatio ||
        query?.imageAspectRatio ||
        body?.image_aspect_ratio ||
        query?.image_aspect_ratio ||
        body?.aspectRatio ||
        query?.aspectRatio ||
        body?.aspect_ratio ||
        query?.aspect_ratio ||
        '1:1',
      destinationType:
        body?.destinationType ||
        query?.destinationType ||
        body?.destination_type ||
        query?.destination_type ||
        'CUSTOM_URL',
      destinationLink:
        body?.destinationLink ||
        query?.destinationLink ||
        body?.destination_link ||
        query?.destination_link ||
        body?.landingUrl ||
        query?.landingUrl ||
        body?.landing_url ||
        query?.landing_url,
      ctaButtonText:
        body?.ctaButtonText ||
        query?.ctaButtonText ||
        body?.cta_button_text ||
        query?.cta_button_text ||
        body?.ctaText ||
        query?.ctaText ||
        body?.cta ||
        query?.cta ||
        'SHOP_NOW',
      createdBy:
        body?.createdBy ||
        query?.createdBy ||
        body?.created_by ||
        query?.created_by,
      module:
        query?.module ||
        body?.module ||
        'sponsor',
    };

    return this.creativeService.create(dto);
  }

  // ─────────────────── 2. GET LIST ───────────────────

  @Get([
    'getSponsorAdCreatives',
    'getSponsorAdCreative',
    'listSponsorAdCreatives',
    'listSponsorAdCreative',
    'list',
    '',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Sponsor Ad Creatives (getSponsorAdCreatives)',
    description:
      'Retrieves a paginated list of sponsor ad creatives. Filterable by campaignId, status, and search. ' +
      'Requires ?module=sponsor. ' +
      'Usage: GET /api/v1/getSponsorAdCreatives?module=sponsor&campaignId=<id>&page=1&limit=10',
  })
  @ApiQuery({ name: 'module', required: true, type: String, example: 'sponsor' })
  @ApiQuery({ name: 'campaignId', required: false, type: String })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'DRAFT, ACTIVE, PAUSED, REJECTED, DELETED' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search creative name or headline' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Sponsor ad creatives retrieved successfully' })
  async findAll(@Query() query: any) {
    // If an ID was provided via query param without a route parameter, delegate to findOne
    if (query?.id || query?.creativeId || query?.creativeUid || query?.creative_uid) {
      const singleId = query?.id || query?.creativeId || query?.creativeUid || query?.creative_uid;
      return this.creativeService.findOne(singleId, query?.module);
    }

    const dto: QuerySponsorAdCreativeDto = {
      campaignId: query?.campaignId || query?.campaign_id,
      status: query?.status,
      search: query?.search,
      page: query?.page,
      limit: query?.limit,
      module: query?.module || 'sponsor',
    };

    return this.creativeService.findAll(dto);
  }

  // ─────────────────── 3. GET ONE BY ID ───────────────────

  @Get([
    'getSponsorAdCreatives/:id',
    'getSponsorAdCreative/:id',
    'details/:id',
    'view/:id',
    ':id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View Sponsor Ad Creative by ID (getSponsorAdCreatives/:id)',
    description:
      'Retrieves a single sponsor ad creative by numeric ID or UUID creativeUid with joined campaign name. ' +
      'Requires ?module=sponsor. ' +
      'Usage: GET /api/v1/getSponsorAdCreatives/<uuid>?module=sponsor',
  })
  @ApiQuery({ name: 'module', required: true, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor ad creative details retrieved successfully' })
  async findOne(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Query('creativeUid') creativeUid?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || creativeUid;
    if (!id) {
      throw new BadRequestException('ID parameter is required to view creative.');
    }
    return this.creativeService.findOne(id, module);
  }

  // ─────────────────── 4. UPDATE ───────────────────

  @Put([
    'updateSponsorAdCreatives/:id',
    'updateSponsorAdCreative/:id',
    'updateSponsorAdCreatives',
    'updateSponsorAdCreative',
    'update/:id',
    ':id',
  ])
  @Patch([
    'updateSponsorAdCreatives/:id',
    'updateSponsorAdCreative/:id',
    'updateSponsorAdCreatives',
    'updateSponsorAdCreative',
    'update/:id',
    ':id',
  ])
  @Post([
    'updateSponsorAdCreatives/:id',
    'updateSponsorAdCreative/:id',
    'updateSponsorAdCreatives',
    'updateSponsorAdCreative',
    'update/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Sponsor Ad Creative (updateSponsorAdCreatives/:id)',
    description:
      'Partial update of an ad creative. Revalidates character lengths, URL syntax, and REJECTED guard. ' +
      'Requires ?module=sponsor. ' +
      'Usage: PUT /api/v1/updateSponsorAdCreatives/<uuid>?module=sponsor',
  })
  @ApiQuery({ name: 'module', required: true, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor ad creative updated successfully' })
  async update(
    @Param('id') paramId: string,
    @Body() body: any,
    @Query() query: any,
  ) {
    const id =
      paramId ||
      query?.id ||
      body?.id ||
      query?.creativeId ||
      body?.creativeId ||
      query?.creativeUid ||
      body?.creativeUid ||
      query?.creative_uid ||
      body?.creative_uid;

    if (!id) {
      throw new BadRequestException('ID parameter is required to update creative.');
    }

    const dto: UpdateSponsorAdCreativeDto = {
      creativeName:
        body?.creativeName ??
        query?.creativeName ??
        body?.creative_name ??
        query?.creative_name ??
        body?.name ??
        query?.name,
      primaryText:
        body?.primaryText ??
        query?.primaryText ??
        body?.primary_text ??
        query?.primary_text ??
        body?.text ??
        query?.text,
      headline:
        body?.headline ??
        query?.headline ??
        body?.title ??
        query?.title,
      creativeImageUrl:
        body?.creativeImageUrl ??
        query?.creativeImageUrl ??
        body?.creative_image_url ??
        query?.creative_image_url ??
        body?.imageUrl ??
        query?.imageUrl ??
        body?.image_url ??
        query?.image_url,
      imageAspectRatio:
        body?.imageAspectRatio ??
        query?.imageAspectRatio ??
        body?.image_aspect_ratio ??
        query?.image_aspect_ratio ??
        body?.aspectRatio ??
        query?.aspectRatio,
      destinationType:
        body?.destinationType ??
        query?.destinationType ??
        body?.destination_type ??
        query?.destination_type,
      destinationLink:
        body?.destinationLink ??
        query?.destinationLink ??
        body?.destination_link ??
        query?.destination_link ??
        body?.landingUrl ??
        query?.landingUrl ??
        body?.landing_url ??
        query?.landing_url,
      ctaButtonText:
        body?.ctaButtonText ??
        query?.ctaButtonText ??
        body?.cta_button_text ??
        query?.cta_button_text ??
        body?.ctaText ??
        query?.ctaText ??
        body?.cta ??
        query?.cta,
      status:
        body?.status ??
        query?.status,
      updatedBy:
        body?.updatedBy ??
        query?.updatedBy ??
        body?.updated_by ??
        query?.updated_by,
      module:
        query?.module ||
        body?.module ||
        'sponsor',
    };

    return this.creativeService.update(id, dto);
  }

  // ─────────────────── 5. DELETE (soft) ───────────────────

  @Delete([
    'deleteSponsorAdCreatives/:id',
    'deleteSponsorAdCreative/:id',
    'deleteSponsorAdCreatives',
    'deleteSponsorAdCreative',
    'delete/:id',
    ':id',
  ])
  @Post([
    'deleteSponsorAdCreatives/:id',
    'deleteSponsorAdCreative/:id',
    'deleteSponsorAdCreatives',
    'deleteSponsorAdCreative',
    'delete/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Sponsor Ad Creative (deleteSponsorAdCreatives/:id)',
    description:
      'Soft-deletes an ad creative (sets deletedAt + status = DELETED). ' +
      'Blocks deletion if linked campaign is ACTIVE (returns 409 Conflict). ' +
      'Requires ?module=sponsor. ' +
      'Usage: DELETE /api/v1/deleteSponsorAdCreatives/<uuid>?module=sponsor',
  })
  @ApiQuery({ name: 'module', required: true, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor ad creative deleted successfully' })
  async remove(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Body('id') bodyId?: string,
    @Query('creativeUid') creativeUid?: string,
    @Query('module') module?: string,
    @Body('module') bodyModule?: string,
  ) {
    const id = paramId || queryId || bodyId || creativeUid;
    if (!id) {
      throw new BadRequestException('ID parameter is required to delete creative.');
    }
    const targetModule = queryId ? module : (module || bodyModule || 'sponsor');
    return this.creativeService.remove(id, targetModule);
  }
}
