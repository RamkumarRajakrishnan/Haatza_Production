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
import { BrandService } from './brand.service';
import { MediaStorageService } from '../media-storage/media-storage.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';

@ApiTags('Brands')
@Controller([
  'brands',
  'brand',
  'api/v1/brands',
  'api/v1/brand',
  'api/v1/sponsor/brands',
  'sponsor/brands',
])
export class BrandController {
  constructor(
    private readonly brandService: BrandService,
    private readonly mediaStorageService: MediaStorageService,
  ) {}

  private async processUploadedFiles(
    files: { brandLogo?: any[]; selfDeclaration?: any[]; letterOfAuthorization?: any[] },
    req: Request,
  ): Promise<{ brandLogo?: string; selfDeclaration?: string; letterOfAuthorization?: string }> {
    const urls: { brandLogo?: string; selfDeclaration?: string; letterOfAuthorization?: string } = {};

    if (!files) return urls;

    const host = req.get('host');
    const rawProto = req.headers['x-forwarded-proto'] || req.protocol || 'https';
    const protocol = Array.isArray(rawProto) ? rawProto[0] : rawProto.split(',')[0].trim();
    const requestBaseUrl = `${protocol}://${host}/uploads`;

    const fieldMap: Array<'brandLogo' | 'selfDeclaration' | 'letterOfAuthorization'> = [
      'brandLogo',
      'selfDeclaration',
      'letterOfAuthorization',
    ];

    for (const fieldName of fieldMap) {
      const fileList = files[fieldName];
      if (fileList && fileList.length > 0) {
        const file = fileList[0];
        try {
          const uploaded = await this.mediaStorageService.upload({
            file,
            folder: 'brands',
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
          urls[fieldName] = `${requestBaseUrl}/brands/${filename}`;
        }
      }
    }

    return urls;
  }

  @Post(['', 'create', 'add', 'createBrand', 'createBrands'])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'brandLogo', maxCount: 1 },
        { name: 'selfDeclaration', maxCount: 1 },
        { name: 'letterOfAuthorization', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: os.tmpdir(),
          filename: (_req, file, cb) => {
            const uniqueId = crypto.randomUUID();
            cb(null, `brand-${uniqueId}${path.extname(file.originalname) || '.bin'}`);
          },
        }),
      },
    ),
  )
  @ApiConsumes('multipart/form-data', 'application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Create Brand (createBrand / createBrands)',
    description:
      'Creates a new brand record. Endpoint alias: createBrand, createBrands. Supports photo/pdf file uploads, query parameters (e.g. ?module=sponsor), or JSON body. Output response is in camelCase.',
  })
  @ApiResponse({ status: 200, description: 'Brand created successfully' })
  async create(
    @Body() body: any,
    @Query() query: any,
    @UploadedFiles()
    files: { brandLogo?: any[]; selfDeclaration?: any[]; letterOfAuthorization?: any[] },
    @Req() req: Request,
  ) {
    const uploadedUrls = await this.processUploadedFiles(files, req);

    const dto: CreateBrandDto = {
      brandName:
        body?.brandName ||
        query?.brandName ||
        body?.brand_name ||
        query?.brand_name ||
        body?.name ||
        query?.name,
      brandLogo:
        uploadedUrls.brandLogo ||
        body?.brandLogo ||
        query?.brandLogo ||
        body?.brand_logo ||
        query?.brand_logo ||
        body?.logo ||
        query?.logo,
      brandWebsite:
        body?.brandWebsite ||
        query?.brandWebsite ||
        body?.brand_website ||
        query?.brand_website ||
        body?.website ||
        query?.website,
      industry:
        body?.industry ||
        query?.industry,
      shortDescription:
        body?.shortDescription ||
        query?.shortDescription ||
        body?.short_description ||
        query?.short_description ||
        body?.description ||
        query?.description,
      selfDeclaration:
        uploadedUrls.selfDeclaration ||
        body?.selfDeclaration ||
        query?.selfDeclaration ||
        body?.self_declaration ||
        query?.self_declaration,
      letterOfAuthorization:
        uploadedUrls.letterOfAuthorization ||
        body?.letterOfAuthorization ||
        query?.letterOfAuthorization ||
        body?.letter_of_authorization ||
        query?.letter_of_authorization ||
        body?.authorization_letter ||
        query?.authorization_letter,
      advertiserId:
        body?.advertiserId ||
        query?.advertiserId ||
        body?.advertiser_id ||
        query?.advertiser_id ||
        body?.sponsorAdvertiserId ||
        query?.sponsorAdvertiserId,
      status:
        body?.status ||
        query?.status ||
        'ACTIVE',
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.brandService.create(dto);
  }

  @Get(['', 'list', 'listBrands', 'listBrand', 'getBrands', 'getBrand'])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'List Brands (listBrands / getBrands)',
    description:
      'Retrieves a list of brands. Endpoint alias: listBrands, getBrands. Filtered by industry, advertiserId, status, search, and module (module=sponsor). Response is formatted in camelCase.',
  })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiQuery({ name: 'industry', required: false, type: String, description: 'Filter by industry' })
  @ApiQuery({ name: 'advertiserId', required: false, type: String, description: 'Filter by sponsor advertiser reference ID' })
  @ApiQuery({ name: 'status', required: false, type: String, description: 'ACTIVE, INACTIVE, PENDING' })
  @ApiQuery({ name: 'search', required: false, type: String, description: 'Search brand name or industry' })
  @ApiQuery({ name: 'page', required: false, type: Number, example: 1 })
  @ApiQuery({ name: 'limit', required: false, type: Number, example: 10 })
  @ApiResponse({ status: 200, description: 'Brands retrieved successfully' })
  async findAll(@Query() query: QueryBrandDto) {
    return this.brandService.findAll(query);
  }

  @Get([
    'viewBrands',
    'viewBrand',
    'viewBrands/:id',
    'viewBrand/:id',
    'view/:id',
    'details/:id',
    ':id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'View Brand by ID (viewBrands / viewBrand)',
    description: 'Retrieves a single brand detail by ID. Endpoint alias: viewBrands, viewBrand. Response is formatted in camelCase.',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'ID if not passed in route parameter' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Brand details retrieved successfully' })
  async findOne(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Query('brandId') brandId?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || brandId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to view brand.');
    }
    return this.brandService.findOne(id, module);
  }

  @Put([
    'updateBrands',
    'updateBrand',
    'updateBrands/:id',
    'updateBrand/:id',
    'update/:id',
    ':id',
  ])
  @Patch([
    'updateBrands',
    'updateBrand',
    'updateBrands/:id',
    'updateBrand/:id',
    'update/:id',
    ':id',
  ])
  @Post([
    'updateBrands',
    'updateBrand',
    'updateBrands/:id',
    'updateBrand/:id',
    'update/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @UseInterceptors(
    FileFieldsInterceptor(
      [
        { name: 'brandLogo', maxCount: 1 },
        { name: 'selfDeclaration', maxCount: 1 },
        { name: 'letterOfAuthorization', maxCount: 1 },
      ],
      {
        storage: diskStorage({
          destination: os.tmpdir(),
          filename: (_req, file, cb) => {
            const uniqueId = crypto.randomUUID();
            cb(null, `brand-${uniqueId}${path.extname(file.originalname) || '.bin'}`);
          },
        }),
      },
    ),
  )
  @ApiConsumes('multipart/form-data', 'application/json', 'application/x-www-form-urlencoded')
  @ApiOperation({
    summary: 'Update Brand by ID (updateBrands / updateBrand)',
    description:
      'Updates brand details by ID. Endpoint alias: updateBrands, updateBrand. Supports file uploads, query parameters, or JSON body. Output response is in camelCase.',
  })
  @ApiResponse({ status: 200, description: 'Brand updated successfully' })
  async update(
    @Param('id') paramId: string,
    @Body() body: any,
    @Query() query: any,
    @UploadedFiles()
    files: { brandLogo?: any[]; selfDeclaration?: any[]; letterOfAuthorization?: any[] },
    @Req() req: Request,
  ) {
    const id = paramId || query?.id || body?.id || query?.brandId || body?.brandId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to update brand.');
    }

    const uploadedUrls = await this.processUploadedFiles(files, req);

    const dto: UpdateBrandDto = {
      brandName:
        body?.brandName ??
        query?.brandName ??
        body?.brand_name ??
        query?.brand_name ??
        body?.name ??
        query?.name,
      brandLogo:
        uploadedUrls.brandLogo ||
        body?.brandLogo ||
        query?.brandLogo ||
        body?.brand_logo ||
        query?.brand_logo ||
        body?.logo ||
        query?.logo,
      brandWebsite:
        body?.brandWebsite ??
        query?.brandWebsite ??
        body?.brand_website ??
        query?.brand_website ??
        body?.website ??
        query?.website,
      industry:
        body?.industry ??
        query?.industry,
      shortDescription:
        body?.shortDescription ??
        query?.shortDescription ??
        body?.short_description ??
        query?.short_description ??
        body?.description ??
        query?.description,
      selfDeclaration:
        uploadedUrls.selfDeclaration ||
        body?.selfDeclaration ||
        query?.selfDeclaration ||
        body?.self_declaration ||
        query?.self_declaration,
      letterOfAuthorization:
        uploadedUrls.letterOfAuthorization ||
        body?.letterOfAuthorization ||
        query?.letterOfAuthorization ||
        body?.letter_of_authorization ||
        query?.letter_of_authorization ||
        body?.authorization_letter ||
        query?.authorization_letter,
      advertiserId:
        body?.advertiserId ??
        query?.advertiserId ??
        body?.advertiser_id ??
        query?.advertiser_id ??
        body?.sponsorAdvertiserId ??
        query?.sponsorAdvertiserId,
      status:
        body?.status ??
        query?.status,
      module:
        body?.module ||
        query?.module ||
        'sponsor',
    };

    return this.brandService.update(id, dto);
  }

  @Delete([
    'deleteBrands',
    'deleteBrand',
    'deleteBrands/:id',
    'deleteBrand/:id',
    'delete/:id',
    ':id',
  ])
  @Post([
    'deleteBrands',
    'deleteBrand',
    'deleteBrands/:id',
    'deleteBrand/:id',
    'delete/:id',
  ])
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Delete Brand by ID (deleteBrands / deleteBrand)',
    description: 'Deletes a brand record permanently by ID. Endpoint alias: deleteBrands, deleteBrand.',
  })
  @ApiQuery({ name: 'id', required: false, type: String, description: 'ID if not passed in route parameter' })
  @ApiQuery({ name: 'module', required: false, type: String, example: 'sponsor' })
  @ApiResponse({ status: 200, description: 'Brand deleted successfully' })
  async remove(
    @Param('id') paramId: string,
    @Query('id') queryId?: string,
    @Body('id') bodyId?: string,
    @Query('module') module?: string,
  ) {
    const id = paramId || queryId || bodyId;
    if (!id) {
      throw new BadRequestException('ID parameter is required to delete brand.');
    }
    return this.brandService.remove(id, module);
  }
}
