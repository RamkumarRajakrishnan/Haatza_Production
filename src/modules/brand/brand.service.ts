import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateBrandDto } from './dto/create-brand.dto';
import { UpdateBrandDto } from './dto/update-brand.dto';
import { QueryBrandDto } from './dto/query-brand.dto';

@Injectable()
export class BrandService {
  private readonly logger = new Logger(BrandService.name);

  constructor(private readonly db: DatabaseService) {}

  private normalizeStatus(status?: string): string {
    if (!status) return 'ACTIVE';
    const upper = status.toString().toUpperCase().trim();
    if (upper === 'ACTIVE') return 'ACTIVE';
    if (upper === 'INACTIVE') return 'INACTIVE';
    if (upper === 'PENDING') return 'PENDING';
    return 'ACTIVE';
  }

  private formatCamelCaseResponse(record: any) {
    if (!record) return null;
    return {
      id: record.id,
      advertiserId: record.advertiserId || null,
      brandName: record.brandName,
      brandLogo: record.brandLogo || null,
      brandWebsite: record.brandWebsite || null,
      industry: record.industry,
      shortDescription: record.shortDescription || null,
      selfDeclaration: record.selfDeclaration || null,
      letterOfAuthorization: record.letterOfAuthorization || null,
      status: record.status || 'ACTIVE',
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      advertiser: record.advertiser
        ? {
            id: record.advertiser.id,
            advertiserName: record.advertiser.advertiserName,
            advertiserLogo: record.advertiser.advertiserLogo || null,
            gstNumber: record.advertiser.gstNumber,
            pan: record.advertiser.pan,
            status: record.advertiser.status,
          }
        : null,
    };
  }

  async create(dto: CreateBrandDto) {
    this.logger.log(`Creating brand: ${dto.brandName}`);

    if (!dto.brandName?.trim()) {
      throw new BadRequestException('Brand Name (brandName) is required.');
    }
    if (!dto.industry?.trim()) {
      throw new BadRequestException('Industry (industry) is required.');
    }

    const status = this.normalizeStatus(dto.status);

    if (!dto.advertiserId?.trim()) {
      throw new BadRequestException('Advertiser ID (advertiserId) is required to create a brand.');
    }

    const cleanAdvId = dto.advertiserId.trim();
    const adv = await this.db.sponsorAdvertiser.findUnique({
      where: { id: cleanAdvId },
    });
    if (!adv) {
      throw new NotFoundException(`Sponsor advertiser with ID '${cleanAdvId}' not found.`);
    }
    const advertiserId = adv.id;

    const cleanBrandName = dto.brandName.trim();
    const existingBrand = await this.db.brand.findFirst({
      where: {
        brandName: { equals: cleanBrandName, mode: 'insensitive' },
        advertiserId: advertiserId,
      },
    });
    if (existingBrand) {
      throw new ConflictException(`A brand with name '${cleanBrandName}' already exists under this advertiser.`);
    }

    const created = await this.db.brand.create({
      data: {
        brandName: dto.brandName.trim(),
        brandLogo: dto.brandLogo?.trim() || null,
        brandWebsite: dto.brandWebsite?.trim() || null,
        industry: dto.industry.trim(),
        shortDescription: dto.shortDescription?.trim() || null,
        selfDeclaration: dto.selfDeclaration?.trim() || null,
        letterOfAuthorization: dto.letterOfAuthorization?.trim() || null,
        advertiserId,
        status,
      },
      include: {
        advertiser: true,
      },
    });

    return {
      success: true,
      message: 'Brand created successfully',
      module: dto.module || 'sponsor',
      data: this.formatCamelCaseResponse(created),
    };
  }

  async findAll(query: QueryBrandDto) {
    const where: any = {};

    if (query.status?.trim()) {
      where.status = this.normalizeStatus(query.status);
    }

    if (query.industry?.trim()) {
      where.industry = { equals: query.industry.trim(), mode: 'insensitive' };
    }

    if (query.advertiserId?.trim()) {
      where.advertiserId = query.advertiserId.trim();
    }

    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { brandName: { contains: searchTerm, mode: 'insensitive' } },
        { industry: { contains: searchTerm, mode: 'insensitive' } },
        { shortDescription: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.db.brand.count({ where }),
      this.db.brand.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          advertiser: true,
        },
      }),
    ]);

    return {
      success: true,
      message: 'Brands retrieved successfully',
      module: query.module || 'sponsor',
      total,
      page,
      limit,
      data: records.map((record) => this.formatCamelCaseResponse(record)),
    };
  }

  async findOne(id: string, module?: string) {
    const record = await this.db.brand.findUnique({
      where: { id },
      include: {
        advertiser: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Brand with ID '${id}' not found.`);
    }

    return {
      success: true,
      message: 'Brand details retrieved successfully',
      module: module || 'sponsor',
      data: this.formatCamelCaseResponse(record),
    };
  }

  async update(id: string, dto: UpdateBrandDto) {
    const record = await this.db.brand.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Brand with ID '${id}' not found.`);
    }

    const updateData: any = {};

    if (dto.brandName !== undefined) {
      const cleanBrandName = dto.brandName.trim();
      if (!cleanBrandName) {
        throw new BadRequestException('Brand Name cannot be empty.');
      }
      const targetAdvId = dto.advertiserId !== undefined ? (dto.advertiserId?.trim() || null) : record.advertiserId;
      const existingBrand = await this.db.brand.findFirst({
        where: {
          brandName: { equals: cleanBrandName, mode: 'insensitive' },
          advertiserId: targetAdvId,
          id: { not: id },
        },
      });
      if (existingBrand) {
        throw new ConflictException(`A brand with name '${cleanBrandName}' already exists under this advertiser.`);
      }
      updateData.brandName = cleanBrandName;
    }

    if (dto.brandLogo !== undefined) {
      updateData.brandLogo = dto.brandLogo ? dto.brandLogo.trim() : null;
    }

    if (dto.brandWebsite !== undefined) {
      updateData.brandWebsite = dto.brandWebsite ? dto.brandWebsite.trim() : null;
    }

    if (dto.industry !== undefined) {
      if (!dto.industry.trim()) {
        throw new BadRequestException('Industry cannot be empty.');
      }
      updateData.industry = dto.industry.trim();
    }

    if (dto.shortDescription !== undefined) {
      updateData.shortDescription = dto.shortDescription ? dto.shortDescription.trim() : null;
    }

    if (dto.selfDeclaration !== undefined) {
      updateData.selfDeclaration = dto.selfDeclaration ? dto.selfDeclaration.trim() : null;
    }

    if (dto.letterOfAuthorization !== undefined) {
      updateData.letterOfAuthorization = dto.letterOfAuthorization ? dto.letterOfAuthorization.trim() : null;
    }

    if (dto.advertiserId !== undefined) {
      if (dto.advertiserId?.trim()) {
        const cleanAdvId = dto.advertiserId.trim();
        const adv = await this.db.sponsorAdvertiser.findUnique({
          where: { id: cleanAdvId },
        });
        if (!adv) {
          throw new NotFoundException(`Sponsor advertiser with ID '${cleanAdvId}' not found.`);
        }
        updateData.advertiserId = adv.id;
      } else {
        updateData.advertiserId = null;
      }
    }

    if (dto.status !== undefined) {
      updateData.status = this.normalizeStatus(dto.status);
    }

    const updated = await this.db.brand.update({
      where: { id },
      data: updateData,
      include: {
        advertiser: true,
      },
    });

    return {
      success: true,
      message: 'Brand updated successfully',
      module: dto.module || 'sponsor',
      data: this.formatCamelCaseResponse(updated),
    };
  }

  async remove(id: string, module?: string) {
    const record = await this.db.brand.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Brand with ID '${id}' not found.`);
    }

    await this.db.brand.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Brand deleted successfully',
      module: module || 'sponsor',
      data: { id },
    };
  }
}
