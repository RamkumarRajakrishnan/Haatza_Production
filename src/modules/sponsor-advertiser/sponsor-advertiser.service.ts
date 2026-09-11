import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSponsorAdvertiserDto } from './dto/create-sponsor-advertiser.dto';
import { UpdateSponsorAdvertiserDto } from './dto/update-sponsor-advertiser.dto';
import { QuerySponsorAdvertiserDto } from './dto/query-sponsor-advertiser.dto';
import { SponsorAdvertiserStatus } from '@prisma/client';

@Injectable()
export class SponsorAdvertiserService {
  private readonly logger = new Logger(SponsorAdvertiserService.name);

  constructor(private readonly db: DatabaseService) {}

  private normalizeStatus(status?: string): SponsorAdvertiserStatus {
    if (!status) return SponsorAdvertiserStatus.PENDING;
    const upper = status.toString().toUpperCase().trim();
    if (upper === 'ACTIVE') return SponsorAdvertiserStatus.ACTIVE;
    if (upper === 'INACTIVE') return SponsorAdvertiserStatus.INACTIVE;
    if (upper === 'PENDING') return SponsorAdvertiserStatus.PENDING;
    return SponsorAdvertiserStatus.PENDING;
  }

  private formatCamelCaseResponse(record: any) {
    if (!record) return null;
    return {
      id: record.id,
      advertiserName: record.advertiserName,
      advertiserLogo: record.advertiserLogo || null,
      gstNumber: record.gstNumber,
      gstCertificate: record.gstCertificate || null,
      pan: record.pan,
      panCard: record.panCard || null,
      status: record.status,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
    };
  }

  async create(dto: CreateSponsorAdvertiserDto) {
    this.logger.log(`Creating sponsor advertiser: ${dto.advertiserName}`);

    if (!dto.advertiserName?.trim()) {
      throw new BadRequestException('Advertiser Name (advertiserName) is required.');
    }
    if (!dto.gstNumber?.trim()) {
      throw new BadRequestException('GST Number (gstNumber) is required.');
    }
    if (!dto.pan?.trim()) {
      throw new BadRequestException('PAN Number (pan) is required.');
    }

    const cleanGst = dto.gstNumber.trim();
    const cleanPan = dto.pan.trim();

    // Prevent duplicate GST Number
    const existingGst = await this.db.sponsorAdvertiser.findFirst({
      where: { gstNumber: { equals: cleanGst, mode: 'insensitive' } },
    });
    if (existingGst) {
      throw new ConflictException(`An advertiser with GST number '${cleanGst}' already exists.`);
    }

    // Prevent duplicate PAN
    const existingPan = await this.db.sponsorAdvertiser.findFirst({
      where: { pan: { equals: cleanPan, mode: 'insensitive' } },
    });
    if (existingPan) {
      throw new ConflictException(`An advertiser with PAN '${cleanPan}' already exists.`);
    }

    const status = this.normalizeStatus(dto.status);

    const created = await this.db.sponsorAdvertiser.create({
      data: {
        advertiserName: dto.advertiserName.trim(),
        advertiserLogo: dto.advertiserLogo?.trim() || null,
        gstNumber: cleanGst,
        gstCertificate: dto.gstCertificate?.trim() || null,
        pan: cleanPan,
        panCard: dto.panCard?.trim() || null,
        status,
      },
    });

    return {
      success: true,
      message: 'Sponsor advertiser created successfully',
      module: dto.module || 'sponsor',
      data: this.formatCamelCaseResponse(created),
    };
  }

  async findAll(query: QuerySponsorAdvertiserDto) {
    const where: any = {};

    if (query.status?.trim()) {
      where.status = this.normalizeStatus(query.status);
    }

    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { advertiserName: { contains: searchTerm, mode: 'insensitive' } },
        { gstNumber: { contains: searchTerm, mode: 'insensitive' } },
        { pan: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.db.sponsorAdvertiser.count({ where }),
      this.db.sponsorAdvertiser.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
    ]);

    return {
      success: true,
      message: 'Sponsor advertisers retrieved successfully',
      module: query.module || 'sponsor',
      total,
      page,
      limit,
      data: records.map((record) => this.formatCamelCaseResponse(record)),
    };
  }

  async findOne(id: string, module?: string) {
    const record = await this.db.sponsorAdvertiser.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor advertiser with ID '${id}' not found.`);
    }

    return {
      success: true,
      message: 'Sponsor advertiser details retrieved successfully',
      module: module || 'sponsor',
      data: this.formatCamelCaseResponse(record),
    };
  }

  async update(id: string, dto: UpdateSponsorAdvertiserDto) {
    const record = await this.db.sponsorAdvertiser.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor advertiser with ID '${id}' not found.`);
    }

    const updateData: any = {};

    if (dto.advertiserName !== undefined) {
      if (!dto.advertiserName.trim()) {
        throw new BadRequestException('Advertiser Name cannot be empty.');
      }
      updateData.advertiserName = dto.advertiserName.trim();
    }

    if (dto.advertiserLogo !== undefined) {
      updateData.advertiserLogo = dto.advertiserLogo ? dto.advertiserLogo.trim() : null;
    }

    if (dto.gstNumber !== undefined) {
      const cleanGst = dto.gstNumber.trim();
      if (!cleanGst) {
        throw new BadRequestException('GST Number cannot be empty.');
      }
      const existingGst = await this.db.sponsorAdvertiser.findFirst({
        where: {
          gstNumber: { equals: cleanGst, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existingGst) {
        throw new ConflictException(`An advertiser with GST number '${cleanGst}' already exists.`);
      }
      updateData.gstNumber = cleanGst;
    }

    if (dto.gstCertificate !== undefined) {
      updateData.gstCertificate = dto.gstCertificate ? dto.gstCertificate.trim() : null;
    }

    if (dto.pan !== undefined) {
      const cleanPan = dto.pan.trim();
      if (!cleanPan) {
        throw new BadRequestException('PAN Number cannot be empty.');
      }
      const existingPan = await this.db.sponsorAdvertiser.findFirst({
        where: {
          pan: { equals: cleanPan, mode: 'insensitive' },
          id: { not: id },
        },
      });
      if (existingPan) {
        throw new ConflictException(`An advertiser with PAN '${cleanPan}' already exists.`);
      }
      updateData.pan = cleanPan;
    }

    if (dto.panCard !== undefined) {
      updateData.panCard = dto.panCard ? dto.panCard.trim() : null;
    }

    if (dto.status !== undefined) {
      updateData.status = this.normalizeStatus(dto.status);
    }

    const updated = await this.db.sponsorAdvertiser.update({
      where: { id },
      data: updateData,
    });

    return {
      success: true,
      message: 'Sponsor advertiser updated successfully',
      module: dto.module || 'sponsor',
      data: this.formatCamelCaseResponse(updated),
    };
  }

  async remove(id: string, module?: string) {
    const record = await this.db.sponsorAdvertiser.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor advertiser with ID '${id}' not found.`);
    }

    await this.db.sponsorAdvertiser.delete({
      where: { id },
    });

    return {
      success: true,
      message: 'Sponsor advertiser deleted successfully',
      module: module || 'sponsor',
      data: { id },
    };
  }
}
