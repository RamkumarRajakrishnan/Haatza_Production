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
import { SponsorCampaignService } from './sponsor-campaign.service';
import { CreateSponsorCampaignDto } from './dto/create-sponsor-campaign.dto';
import { UpdateSponsorCampaignDto } from './dto/update-sponsor-campaign.dto';
import { QuerySponsorCampaignDto } from './dto/query-sponsor-campaign.dto';

@ApiTags('Sponsor Campaigns')
@Controller([
  'sponsor-campaigns',
  'sponsor_campaigns',
  'sponsorCampaigns',
  'api/v1/sponsor-campaigns',
  'api/v1/sponsor_campaigns',
  'api/v1/sponsorCampaigns',
  'api/v1/sponsor/campaigns',
  'sponsor/campaigns',
])
export class SponsorCampaignController {
  constructor(private readonly sponsorCampaignService: SponsorCampaignService) {}

  // ─────────────────── 1. CREATE ───────────────────

  @Post(['', 'create', 'add', 'createSponsorCampaign', 'createSponsorCampaigns'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Create Sponsor Campaign (createSponsorCampaign)',
    description:
      'Creates a new sponsor campaign in DRAFT status. Validates advertiser & brand existence and ownership. ' +
      'Endpoint aliases: createSponsorCampaign, createSponsorCampaigns. ' +
      'Usage: POST /api/v1/sponsor-campaigns/createSponsorCampaign?module=sponsor',
  })
  @ApiResponse({ status: 200, description: 'Sponsor campaign created successfully' })
  async create(@Body() body: any, @Query() query: any) {
    const dto: CreateSponsorCampaignDto = {
      brandId:
        body?.brandId ||
        query?.brandId ||
        body?.brand_id ||
        query?.brand_id,
      advertiserId:
        body?.advertiserId ||
        query?.advertiserId ||
        body?.advertiser_id ||
        query?.advertiser_id ||
        body?.sponsorAdvertiserId ||
        query?.sponsorAdvertiserId,
      campaignName:
        body?.campaignName ||
        query?.campaignName ||
        body?.campaign_name ||
        query?.campaign_name ||
        body?.name ||
        query?.name,
      campaignObjective:
        body?.campaignObjective ||
        query?.campaignObjective ||
        body?.campaign_objective ||
        query?.campaign_objective ||
        body?.objective ||
        query?.objective,
      primaryCategory:
        body?.primaryCategory ||
        query?.primaryCategory ||
        body?.primary_category ||
        query?.primary_category ||
        body?.primaryCategoryId ||
        query?.primaryCategoryId ||
        body?.primary_category_id ||
        query?.primary_category_id,
      dailyBudget:
        body?.dailyBudget ??
        query?.dailyBudget ??
        body?.daily_budget ??
        query?.daily_budget,
      currency:
        body?.currency ||
        query?.currency ||
        'INR',
      startDate:
        body?.startDate ||
        query?.startDate ||
        body?.start_date ||
        query?.start_date,
      endDate:
        body?.endDate ||
        query?.endDate ||
        body?.end_date ||
        query?.end_date,
      createdBy:
        body?.createdBy ||
        query?.createdBy ||
        body?.created_by ||
        query?.created_by,
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.sponsorCampaignService.create(dto);
  }

  // ─────────────────── 2. LIST ───────────────────

  @Get(['', 'list', 'listSponsorCampaigns', 'listSponsorCampaign', 'getSponsorCampaigns'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Sponsor Campaigns (listSponsorCampaigns)',
    description:
      'Retrieves a paginated list of sponsor campaigns. Filterable by status, advertiserId, brandId, date range, search. ' +
      'Usage: GET /api/v1/sponsor-campaigns/listSponsorCampaigns?module=sponsor&status=DRAFT&page=1&limit=10',
  })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'DRAFT, ACTIVE, PAUSED, COMPLETED, etc.' })
  @ApiQuery({ name: 'advertiserId', required: false, type: String })
  @ApiQuery({ name: 'brandId', required: false, type: String })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: 'Filter from date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: 'Filter to date (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search campaign name' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Sponsor campaigns retrieved successfully' })
  async findAll(@Query() query: any) {
    const dto: QuerySponsorCampaignDto = {
      status: query?.status,
      advertiserId: query?.advertiserId || query?.advertiser_id,
      brandId: query?.brandId || query?.brand_id,
      startDate: query?.startDate || query?.start_date,
      endDate: query?.endDate || query?.end_date,
      search: query?.search,
      page: query?.page,
      limit: query?.limit,
      module: query?.module || 'sponsor',
    };

    return this.sponsorCampaignService.findAll(dto);
  }

  // ─────────────────── 3. GET ONE ───────────────────

  @Get([
    'getSponsorCampaign',
    'viewSponsorCampaign',
    'getSponsorCampaign/:id',
    'viewSponsorCampaign/:id',
    'view/:id',
    'details/:id',
    ':id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View Sponsor Campaign by ID (getSponsorCampaign)',
    description:
      'Retrieves a single sponsor campaign by numeric ID or UUID campaignUid. Includes advertiser & brand names. ' +
      'Usage: GET /api/v1/sponsor-campaigns/getSponsorCampaign?module=sponsor&id=<uuid>',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'Campaign ID or campaignUid' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor campaign details retrieved successfully' })
  async findOne(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Query('campaignId') campaignId?: string,
    @Query('campaignUid') campaignUid?: string,
    @Query('campaign_uid') campaignUidSnake?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || campaignId || campaignUid || campaignUidSnake;
    if (!id) {
      throw new BadRequestException('ID parameter is required to view campaign.');
    }
    return this.sponsorCampaignService.findOne(id, module);
  }

  // ─────────────────── 4. UPDATE ───────────────────

  @Put([
    'updateSponsorCampaign',
    'updateSponsorCampaigns',
    'updateSponsorCampaign/:id',
    'updateSponsorCampaigns/:id',
    'update/:id',
    ':id',
  ])
  @Patch([
    'updateSponsorCampaign',
    'updateSponsorCampaigns',
    'updateSponsorCampaign/:id',
    'updateSponsorCampaigns/:id',
    'update/:id',
    ':id',
  ])
  @Post([
    'updateSponsorCampaign',
    'updateSponsorCampaigns',
    'updateSponsorCampaign/:id',
    'updateSponsorCampaigns/:id',
    'update/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Update Sponsor Campaign by ID (updateSponsorCampaign)',
    description:
      'Partial update of a sponsor campaign. ACTIVE/COMPLETED campaigns only allow dailyBudget edits. ' +
      'Status transitions are validated. ' +
      'Usage: PUT /api/v1/sponsor-campaigns/updateSponsorCampaign?module=sponsor&id=<uuid>',
  })
  @ApiResponse({ status: 200, description: 'Sponsor campaign updated successfully' })
  async update(
    @Param('id') paramId: string,
    @Body() body: any,
    @Query() query: any,
  ) {
    const id =
      paramId ||
      query?.id ||
      body?.id ||
      query?.campaignId ||
      body?.campaignId ||
      query?.campaignUid ||
      body?.campaignUid ||
      query?.campaign_uid ||
      body?.campaign_uid;

    if (!id) {
      throw new BadRequestException('ID parameter is required to update campaign.');
    }

    const dto: UpdateSponsorCampaignDto = {
      campaignName:
        body?.campaignName ??
        query?.campaignName ??
        body?.campaign_name ??
        query?.campaign_name,
      campaignObjective:
        body?.campaignObjective ??
        query?.campaignObjective ??
        body?.campaign_objective ??
        query?.campaign_objective,
      primaryCategory:
        body?.primaryCategory ??
        query?.primaryCategory ??
        body?.primary_category ??
        query?.primary_category,
      dailyBudget:
        body?.dailyBudget ??
        query?.dailyBudget ??
        body?.daily_budget ??
        query?.daily_budget,
      currency:
        body?.currency ??
        query?.currency,
      startDate:
        body?.startDate ??
        query?.startDate ??
        body?.start_date ??
        query?.start_date,
      endDate:
        body?.endDate ??
        query?.endDate ??
        body?.end_date ??
        query?.end_date,
      status:
        body?.status ??
        query?.status,
      updatedBy:
        body?.updatedBy ??
        query?.updatedBy ??
        body?.updated_by ??
        query?.updated_by,
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.sponsorCampaignService.update(id, dto);
  }

  // ─────────────────── 5. DELETE (soft) ───────────────────

  @Delete([
    'deleteSponsorCampaign',
    'deleteSponsorCampaigns',
    'deleteSponsorCampaign/:id',
    'deleteSponsorCampaigns/:id',
    'delete/:id',
    ':id',
  ])
  @Post([
    'deleteSponsorCampaign',
    'deleteSponsorCampaigns',
    'deleteSponsorCampaign/:id',
    'deleteSponsorCampaigns/:id',
    'delete/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Sponsor Campaign by ID (deleteSponsorCampaign)',
    description:
      'Soft-deletes a sponsor campaign (sets deletedAt + status = DELETED). ' +
      'Usage: DELETE /api/v1/sponsor-campaigns/deleteSponsorCampaign?module=sponsor&id=<uuid>',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'Campaign ID or campaignUid' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor campaign deleted successfully' })
  async remove(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Body('id') bodyId?: string,
    @Query('campaignUid') campaignUid?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || bodyId || campaignUid;
    if (!id) {
      throw new BadRequestException('ID parameter is required to delete campaign.');
    }
    return this.sponsorCampaignService.remove(id, module);
  }

  // ─────────────────── 6. LAUNCH ───────────────────

  @Post([
    'launchSponsorCampaign',
    'launchSponsorCampaigns',
    'launchSponsorCampaign/:id',
    'launchSponsorCampaigns/:id',
    'launch/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Launch Sponsor Campaign (launchSponsorCampaign)',
    description:
      'Validates minimum daily budget (₹100), advertiser is ACTIVE, and campaign is in a launchable state. ' +
      'Sets status = ACTIVE and launchedAt = now(). ' +
      'Usage: POST /api/v1/sponsor-campaigns/launchSponsorCampaign?module=sponsor&id=<uuid>',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'Campaign ID or campaignUid' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor campaign launched successfully' })
  async launch(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Body('id') bodyId?: string,
    @Query('campaignUid') campaignUid?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || bodyId || campaignUid;
    if (!id) {
      throw new BadRequestException('ID parameter is required to launch campaign.');
    }
    return this.sponsorCampaignService.launch(id, module);
  }
}
