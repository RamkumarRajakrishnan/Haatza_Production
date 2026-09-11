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
  UseInterceptors,
  UploadedFiles,
  Req,
  BadRequestException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery, ApiConsumes } from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as os from 'os';
import * as path from 'path';
import * as crypto from 'crypto';
import { Request } from 'express';
import { SponsorAdvertiserService } from './sponsor-advertiser.service';
import { MediaStorageService } from '../media-storage/media-storage.service';
import { CreateSponsorAdvertiserDto } from './dto/create-sponsor-advertiser.dto';
import { UpdateSponsorAdvertiserDto } from './dto/update-sponsor-advertiser.dto';
import { QuerySponsorAdvertiserDto } from './dto/query-sponsor-advertiser.dto';
import { SponsorAdvertiserStatus } from '@prisma/client';

@ApiTags('Sponsor Advertisers')
@Controller([
  'sponsor-advertisers',
  'sponsor_advertisers',
  'sponsorAdvertisers',
  'api/v1/sponsor-advertisers',
  'api/v1/sponsor_advertisers',
  'api/v1/sponsorAdvertisers',
  'api/v1/sponsor/advertisers',
  'sponsor/advertisers',
])
export class SponsorAdvertiserController {
  constructor(
    private readonly sponsorAdvertiserService: SponsorAdvertiserService,
    private readonly mediaStorageService: MediaStorageService,
  ) {}

  private async processUploadedFiles(
    files: { advertiserLogo?: any[]; gstCertificate?: any[]; panCard?: any[] },
    req: Request,
  ): Promise<{ advertiserLogo?: string; gstCertificate?: string; panCard?: string }> {
    const urls: { advertiserLogo?: string; gstCertificate?: string; panCard?: string } = {};

    if (!files) return urls;

    const host = req.get('host');
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = Array.isArray(rawProto) ? rawProto[0] : rawProto.split(',')[0].trim();
    const requestBaseUrl = `${protocol}://${host}/uploads`;

    const fieldMap: Array<'advertiserLogo' | 'gstCertificate' | 'panCard'> = [
      'advertiserLogo',
      'gstCertificate',
      'panCard',
    ];

    for (const fieldName of fieldMap) {
      const fileList = files[fieldName];
      if (fileList && fileList.length > 0) {
        const file = fileList[0];
        try {
          const uploaded = await this.mediaStorageService.upload({
            file,
            folder: 'sponsors',
          });
          const cleanKey = uploaded.key.replace(/^\/+/, '');
          const customMediaBase = process.env.MEDIA_BASE_URL;
          let finalUrl: string;
          if (customMediaBase && !customMediaBase.includes('haatza.com/uploads')) {
            finalUrl = `${customMediaBase.replace(/\/+$/, '')}/${cleanKey}`;
          } else {
            finalUrl = `${requestBaseUrl}/${cleanKey}`;
          }
          urls[fieldName] = finalUrl;
        } catch (err) {
          const filename = path.basename(file.path || file.filename || 'file.bin');
          urls[fieldName] = `${requestBaseUrl}/sponsors/${filename}`;
        }
      }
    }

    return urls;
  }

  @Post(['', 'create', 'add', 'createSponsorAdvertisers', 'createSponsorAdvertiser'])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'advertiserLogo', maxCount: 1 },
        { name: 'gstCertificate', maxCount: 1 },
        { name: 'panCard', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: os.tmpdir(),
          filename: (_req, file, cb) => {
            const uniqueId = crypto.randomUUID();
            cb(null, `sponsor-${uniqueId}${path.extname(file.originalname) || '.bin'}`);
          },
        }),
      },
    ),
  )
  @ApiConsumes('multipart/form-data', 'application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Create Sponsor Advertiser (createSponsorAdvertisers)',
    description:
      'Creates a new sponsor advertiser record. Endpoint alias: createSponsorAdvertisers. Supports photo/pdf file uploads, query parameters, or JSON body. Output response is in camelCase.',
  })
  @ApiResponse({ status: 200, description: 'Sponsor advertiser created successfully' })
  async create(
    @Body() body: any,
    @Query() query: any,
    @UploadedFiles() files: { advertiserLogo?: any[]; gstCertificate?: any[]; panCard?: any[] },
    @Req() req: Request,
  ) {
    const uploadedUrls = await this.processUploadedFiles(files, req);

    const dto: CreateSponsorAdvertiserDto = {
      advertiserName:
        body?.advertiserName ||
        query?.advertiserName ||
        body?.advertiser_name ||
        query?.advertiser_name ||
        body?.name ||
        query?.name,
      advertiserLogo:
        uploadedUrls.advertiserLogo ||
        body?.advertiserLogo ||
        query?.advertiserLogo ||
        body?.advertiser_logo ||
        query?.advertiser_logo ||
        body?.logo ||
        query?.logo,
      gstNumber:
        body?.gstNumber ||
        query?.gstNumber ||
        body?.gst_number ||
        query?.gst_number ||
        body?.gst ||
        query?.gst,
      gstCertificate:
        uploadedUrls.gstCertificate ||
        body?.gstCertificate ||
        query?.gstCertificate ||
        body?.gst_certificate ||
        query?.gst_certificate,
      pan:
        body?.pan ||
        query?.pan ||
        body?.pan_number ||
        query?.pan_number,
      panCard:
        uploadedUrls.panCard ||
        body?.panCard ||
        query?.panCard ||
        body?.pan_card ||
        query?.pan_card,
      status:
        body?.status ||
        query?.status ||
        SponsorAdvertiserStatus.PENDING,
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.sponsorAdvertiserService.create(dto);
  }

  @Get(['', 'list', 'listSponsorAdvertisers', 'listSponsorAdvertiser', 'getSponsorAdvertisers', 'getSponsorAdvertiser'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Sponsor Advertisers (listSponsorAdvertisers)',
    description:
      'Retrieves a list of sponsor advertisers. Endpoint alias: listSponsorAdvertisers. Filtered by status, search, and module (module=sponsor). Response is formatted in camelCase.',
  })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiQuery({ name: 'status', required: false, enum: SponsorAdvertiserStatus, description: 'PENDING, ACTIVE, INACTIVE' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search advertiser name, GST or PAN' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Sponsor advertisers retrieved successfully' })
  async findAll(@Query() query: QuerySponsorAdvertiserDto) {
    return this.sponsorAdvertiserService.findAll(query);
  }

  @Get([
    'viewSponsorAdvertisers',
    'viewSponsorAdvertiser',
    'viewSponsorAdvertisers/:id',
    'viewSponsorAdvertiser/:id',
    'view/:id',
    'details/:id',
    ':id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View Sponsor Advertiser by ID (viewSponsorAdvertisers)',
    description: 'Retrieves a single sponsor advertiser detail by ID. Endpoint alias: viewSponsorAdvertisers. Response is formatted in camelCase.',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'ID if not passed in route parameter' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor advertiser details retrieved successfully' })
  async findOne(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Query('advertiserId') advertiserId?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || advertiserId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to view advertiser.');
    }
    return this.sponsorAdvertiserService.findOne(id, module);
  }

  @Put([
    'updateSponsorAdvertisers',
    'updateSponsorAdvertiser',
    'updateSponsorAdvertisers/:id',
    'updateSponsorAdvertiser/:id',
    'update/:id',
    ':id',
  ])
  @Patch([
    'updateSponsorAdvertisers',
    'updateSponsorAdvertiser',
    'updateSponsorAdvertisers/:id',
    'updateSponsorAdvertiser/:id',
    'update/:id',
    ':id',
  ])
  @Post([
    'updateSponsorAdvertisers',
    'updateSponsorAdvertiser',
    'updateSponsorAdvertisers/:id',
    'updateSponsorAdvertiser/:id',
    'update/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'advertiserLogo', maxCount: 1 },
        { name: 'gstCertificate', maxCount: 1 },
        { name: 'panCard', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: os.tmpdir(),
          filename: (_req, file, cb) => {
            const uniqueId = crypto.randomUUID();
            cb(null, `sponsor-${uniqueId}${path.extname(file.originalname) || '.bin'}`);
          },
        }),
      },
    ),
  )
  @ApiConsumes('multipart/form-data', 'application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Update Sponsor Advertiser by ID (updateSponsorAdvertisers)',
    description:
      'Updates sponsor advertiser details by ID. Endpoint alias: updateSponsorAdvertisers. Supports file uploads, query parameters, or JSON body. Output response is in camelCase.',
  })
  @ApiResponse({ status: 200, description: 'Sponsor advertiser updated successfully' })
  async update(
    @Param('id') paramId: string,
    @Body() body: any,
    @Query() query: any,
    @UploadedFiles() files: { advertiserLogo?: any[]; gstCertificate?: any[]; panCard?: any[] },
    @Req() req: Request,
  ) {
    const id = paramId || query?.id || body?.id || query?.advertiserId || body?.advertiserId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to update advertiser.');
    }

    const uploadedUrls = await this.processUploadedFiles(files, req);

    const dto: UpdateSponsorAdvertiserDto = {
      advertiserName:
        body?.advertiserName ??
        query?.advertiserName ??
        body?.advertiser_name ??
        query?.advertiser_name ??
        body?.name ??
        query?.name,
      advertiserLogo:
        uploadedUrls.advertiserLogo ||
        body?.advertiserLogo ||
        query?.advertiserLogo ||
        body?.advertiser_logo ||
        query?.advertiser_logo ||
        body?.logo ||
        query?.logo,
      gstNumber:
        body?.gstNumber ??
        query?.gstNumber ??
        body?.gst_number ??
        query?.gst_number ??
        body?.gst ??
        query?.gst,
      gstCertificate:
        uploadedUrls.gstCertificate ||
        body?.gstCertificate ||
        query?.gstCertificate ||
        body?.gst_certificate ||
        query?.gst_certificate,
      pan:
        body?.pan ??
        query?.pan ??
        body?.pan_number ??
        query?.pan_number,
      panCard:
        uploadedUrls.panCard ||
        body?.panCard ||
        query?.panCard ||
        body?.pan_card ||
        query?.pan_card,
      status:
        body?.status ??
        query?.status,
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.sponsorAdvertiserService.update(id, dto);
  }

  @Delete([
    'deleteSponsorAdvertisers',
    'deleteSponsorAdvertiser',
    'deleteSponsorAdvertisers/:id',
    'deleteSponsorAdvertiser/:id',
    'delete/:id',
    ':id',
  ])
  @Post([
    'deleteSponsorAdvertisers',
    'deleteSponsorAdvertiser',
    'deleteSponsorAdvertisers/:id',
    'deleteSponsorAdvertiser/:id',
    'delete/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Sponsor Advertiser by ID (deleteSponsorAdvertisers)',
    description: 'Deletes a sponsor advertiser record permanently by ID. Endpoint alias: deleteSponsorAdvertisers.',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'ID if not passed in route parameter' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Sponsor advertiser deleted successfully' })
  async remove(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Body('id') bodyId?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || bodyId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to delete advertiser.');
    }
    return this.sponsorAdvertiserService.remove(id, module);
  }
}
