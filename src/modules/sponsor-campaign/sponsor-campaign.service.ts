import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSponsorCampaignDto } from './dto/create-sponsor-campaign.dto';
import { UpdateSponsorCampaignDto } from './dto/update-sponsor-campaign.dto';
import { QuerySponsorCampaignDto } from './dto/query-sponsor-campaign.dto';
import { SponsorCampaignStatus, SponsorCampaignObjective } from '@prisma/client';

/** Minimum daily budget (INR) required to launch a campaign */
const MIN_DAILY_BUDGET_FOR_LAUNCH = 100;

/**
 * Valid status transitions — JioHotstar-style campaign lifecycle.
 *
 * DRAFT → ACTIVE (via launch), PENDING_CREATIVE, PAUSED, DELETED
 * PENDING_CREATIVE → DRAFT, ACTIVE (via launch), DELETED
 * ACTIVE → PAUSED, COMPLETED
 * PAUSED → ACTIVE (via launch), DELETED
 * COMPLETED → (none)
 * REJECTED → DRAFT, DELETED
 * DELETED → (none)
 */
const VALID_STATUS_TRANSITIONS: Record<SponsorCampaignStatus, SponsorCampaignStatus[]> = {
  DRAFT: [
    SponsorCampaignStatus.ACTIVE,
    SponsorCampaignStatus.PENDING_CREATIVE,
    SponsorCampaignStatus.PAUSED,
    SponsorCampaignStatus.DELETED,
  ],
  PENDING_CREATIVE: [
    SponsorCampaignStatus.DRAFT,
    SponsorCampaignStatus.ACTIVE,
    SponsorCampaignStatus.DELETED,
  ],
  ACTIVE: [
    SponsorCampaignStatus.PAUSED,
    SponsorCampaignStatus.COMPLETED,
  ],
  PAUSED: [
    SponsorCampaignStatus.ACTIVE,
    SponsorCampaignStatus.DELETED,
  ],
  COMPLETED: [],
  REJECTED: [
    SponsorCampaignStatus.DRAFT,
    SponsorCampaignStatus.DELETED,
  ],
  DELETED: [],
};

/** Fields that can still be edited when campaign is ACTIVE */
const ACTIVE_EDITABLE_FIELDS = ['dailyBudget'];

@Injectable()
export class SponsorCampaignService {
  private readonly logger = new Logger(SponsorCampaignService.name);

  constructor(private readonly db: DatabaseService) {}

  // ──────────────────────────── helpers ────────────────────────────

  private normalizeObjective(value?: string): SponsorCampaignObjective {
    if (!value) throw new BadRequestException('Campaign objective is required.');
    const upper = value.toString().toUpperCase().trim().replace(/[\s-]+/g, '_');
    if (upper === 'DRIVE_SALES') return SponsorCampaignObjective.DRIVE_SALES;
    if (upper === 'BRAND_VISIBILITY') return SponsorCampaignObjective.BRAND_VISIBILITY;
    throw new BadRequestException(
      `Invalid campaign objective '${value}'. Must be DRIVE_SALES or BRAND_VISIBILITY.`,
    );
  }

  private normalizeStatus(value?: string): SponsorCampaignStatus {
    if (!value) return SponsorCampaignStatus.DRAFT;
    const upper = value.toString().toUpperCase().trim().replace(/[\s-]+/g, '_');
    const validStatuses = Object.values(SponsorCampaignStatus);
    if (validStatuses.includes(upper as SponsorCampaignStatus)) {
      return upper as SponsorCampaignStatus;
    }
    throw new BadRequestException(
      `Invalid status '${value}'. Valid values: ${validStatuses.join(', ')}`,
    );
  }

  private validateStatusTransition(
    currentStatus: SponsorCampaignStatus,
    targetStatus: SponsorCampaignStatus,
  ) {
    const allowed = VALID_STATUS_TRANSITIONS[currentStatus] || [];
    if (!allowed.includes(targetStatus)) {
      throw new ConflictException(
        `Cannot transition from ${currentStatus} to ${targetStatus}. ` +
          `Allowed transitions from ${currentStatus}: ${allowed.length ? allowed.join(', ') : 'none'}.`,
      );
    }
  }

  private formatResponse(record: any) {
    if (!record) return null;
    return {
      id: record.id,
      campaignUid: record.campaignUid,
      advertiserId: record.advertiserId,
      advertiserName: record.advertiser?.advertiserName || null,
      brandId: record.brandId,
      brandName: record.brand?.brandName || null,
      campaignName: record.campaignName,
      campaignObjective: record.campaignObjective,
      primaryCategory: record.primaryCategory || null,
      dailyBudget: record.dailyBudget ? Number(record.dailyBudget) : 0,
      currency: record.currency || 'INR',
      startDate: record.startDate,
      endDate: record.endDate || null,
      status: record.status,
      launchedAt: record.launchedAt || null,
      createdBy: record.createdBy || null,
      updatedBy: record.updatedBy || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt || null,
    };
  }

  /**
   * Resolve a campaign by either integer ID or UUID campaignUid.
   * Returns the Prisma `where` clause.
   */
  private resolveWhereClause(identifier: string): { id?: number; campaignUid?: string } {
    const asInt = parseInt(identifier, 10);
    if (!isNaN(asInt) && String(asInt) === identifier) {
      return { id: asInt };
    }
    return { campaignUid: identifier };
  }

  // ──────────────────────────── CRUD ────────────────────────────

  /**
   * POST createSponsorCampaign
   * Creates a new campaign in DRAFT status.
   */
  async create(dto: CreateSponsorCampaignDto) {
    this.logger.log(`Creating sponsor campaign: ${dto.campaignName}`);

    // ── Validate required fields ──
    if (!dto.campaignName?.trim()) {
      throw new BadRequestException('Campaign Name (campaignName) is required.');
    }
    if (!dto.advertiserId?.trim()) {
      throw new BadRequestException('Advertiser ID (advertiserId) is required.');
    }
    if (!dto.brandId?.trim()) {
      throw new BadRequestException('Brand ID (brandId) is required.');
    }
    if (dto.dailyBudget === undefined || dto.dailyBudget === null || dto.dailyBudget === '') {
      throw new BadRequestException('Daily Budget (dailyBudget) is required.');
    }
    if (!dto.startDate?.trim()) {
      throw new BadRequestException('Start Date (startDate) is required.');
    }

    const dailyBudget = Number(dto.dailyBudget);
    if (isNaN(dailyBudget) || dailyBudget <= 0) {
      throw new BadRequestException('Daily Budget must be a positive number.');
    }

    const objective = this.normalizeObjective(dto.campaignObjective);

    // ── Validate FK: advertiser exists ──
    const advertiser = await this.db.sponsorAdvertiser.findUnique({
      where: { id: dto.advertiserId.trim() },
    });
    if (!advertiser) {
      throw new NotFoundException(
        `Sponsor advertiser with ID '${dto.advertiserId.trim()}' not found.`,
      );
    }

    // ── Validate FK: brand exists ──
    const brand = await this.db.brand.findUnique({
      where: { id: dto.brandId.trim() },
    });
    if (!brand) {
      throw new NotFoundException(`Brand with ID '${dto.brandId.trim()}' not found.`);
    }

    // ── Validate brand belongs to advertiser ──
    if (brand.advertiserId !== advertiser.id) {
      throw new BadRequestException(
        `Brand '${brand.brandName}' does not belong to advertiser '${advertiser.advertiserName}'. ` +
          `The brand's advertiserId is '${brand.advertiserId || 'null'}' but you provided '${advertiser.id}'.`,
      );
    }

    // ── Parse dates ──
    const startDate = new Date(dto.startDate);
    if (isNaN(startDate.getTime())) {
      throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD.');
    }

    let endDate: Date | null = null;
    if (dto.endDate?.trim()) {
      endDate = new Date(dto.endDate);
      if (isNaN(endDate.getTime())) {
        throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD.');
      }
      if (endDate <= startDate) {
        throw new BadRequestException('End date must be after start date.');
      }
    }

    // ── Create the record ──
    const created = await this.db.sponsorCampaign.create({
      data: {
        advertiserId: advertiser.id,
        brandId: brand.id,
        campaignName: dto.campaignName.trim(),
        campaignObjective: objective,
        primaryCategory: dto.primaryCategory?.trim() || null,
        dailyBudget,
        currency: dto.currency?.trim() || 'INR',
        startDate,
        endDate,
        status: SponsorCampaignStatus.DRAFT,
        createdBy: dto.createdBy?.trim() || null,
      },
      include: {
        advertiser: true,
        brand: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor campaign created successfully',
      module: dto.module || 'sponsor',
      campaignItem: this.formatResponse(created),
    };
  }

  /**
   * GET getSponsorCampaign/:id
   * Fetch a single campaign by id (int) or campaignUid (UUID).
   */
  async findOne(identifier: string, module?: string) {
    const where = this.resolveWhereClause(identifier);

    const record = await this.db.sponsorCampaign.findFirst({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        advertiser: true,
        brand: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor campaign with identifier '${identifier}' not found.`);
    }

    return {
      success: true,
      message: 'Sponsor campaign details retrieved successfully',
      module: module || 'sponsor',
      campaignItem: this.formatResponse(record),
    };
  }

  /**
   * GET listSponsorCampaigns
   * Paginated list with filters.
   */
  async findAll(query: QuerySponsorCampaignDto) {
    const where: any = {
      deletedAt: null, // exclude soft-deleted
    };

    if (query.status?.trim()) {
      where.status = this.normalizeStatus(query.status);
    }

    if (query.advertiserId?.trim()) {
      where.advertiserId = query.advertiserId.trim();
    }

    if (query.brandId?.trim()) {
      where.brandId = query.brandId.trim();
    }

    // Date range filter on startDate
    if (query.startDate?.trim() || query.endDate?.trim()) {
      where.startDate = {};
      if (query.startDate?.trim()) {
        const from = new Date(query.startDate);
        if (!isNaN(from.getTime())) {
          where.startDate.gte = from;
        }
      }
      if (query.endDate?.trim()) {
        const to = new Date(query.endDate);
        if (!isNaN(to.getTime())) {
          where.startDate.lte = to;
        }
      }
    }

    if (query.search?.trim()) {
      const searchTerm = query.search.trim();
      where.OR = [
        { campaignName: { contains: searchTerm, mode: 'insensitive' } },
        { primaryCategory: { contains: searchTerm, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.db.sponsorCampaign.count({ where }),
      this.db.sponsorCampaign.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          advertiser: true,
          brand: true,
        },
      }),
    ]);

    return {
      success: true,
      message: 'Sponsor campaigns retrieved successfully',
      module: query.module || 'sponsor',
      total,
      page,
      limit,
      campaignItems: records.map((r) => this.formatResponse(r)),
    };
  }

  /**
   * PUT/PATCH updateSponsorCampaign/:id
   * Partial update with status-transition guards.
   * ACTIVE / COMPLETED campaigns only allow dailyBudget edits.
   */
  async update(identifier: string, dto: UpdateSponsorCampaignDto) {
    const where = this.resolveWhereClause(identifier);

    const record = await this.db.sponsorCampaign.findFirst({
      where: { ...where, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor campaign with identifier '${identifier}' not found.`);
    }

    // ── Status-transition guard for field edits ──
    const restrictedStatuses: SponsorCampaignStatus[] = [
      SponsorCampaignStatus.ACTIVE,
      SponsorCampaignStatus.COMPLETED,
    ];

    const isRestricted = restrictedStatuses.includes(record.status);

    const updateData: any = {};

    // campaignName
    if (dto.campaignName !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit campaignName when campaign status is ${record.status}.`,
        );
      }
      if (!dto.campaignName.trim()) {
        throw new BadRequestException('Campaign Name cannot be empty.');
      }
      updateData.campaignName = dto.campaignName.trim();
    }

    // campaignObjective
    if (dto.campaignObjective !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit campaignObjective when campaign status is ${record.status}.`,
        );
      }
      updateData.campaignObjective = this.normalizeObjective(dto.campaignObjective);
    }

    // primaryCategory
    if (dto.primaryCategory !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit primaryCategory when campaign status is ${record.status}.`,
        );
      }
      updateData.primaryCategory = dto.primaryCategory ? dto.primaryCategory.trim() : null;
    }

    // dailyBudget — always editable (business requirement)
    if (dto.dailyBudget !== undefined) {
      const budget = Number(dto.dailyBudget);
      if (isNaN(budget) || budget <= 0) {
        throw new BadRequestException('Daily Budget must be a positive number.');
      }
      updateData.dailyBudget = budget;
    }

    // currency
    if (dto.currency !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit currency when campaign status is ${record.status}.`,
        );
      }
      updateData.currency = dto.currency.trim() || 'INR';
    }

    // startDate
    if (dto.startDate !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit startDate when campaign status is ${record.status}.`,
        );
      }
      const d = new Date(dto.startDate);
      if (isNaN(d.getTime())) {
        throw new BadRequestException('Invalid startDate format. Use YYYY-MM-DD.');
      }
      updateData.startDate = d;
    }

    // endDate
    if (dto.endDate !== undefined) {
      if (isRestricted) {
        throw new ConflictException(
          `Cannot edit endDate when campaign status is ${record.status}.`,
        );
      }
      if (dto.endDate) {
        const d = new Date(dto.endDate);
        if (isNaN(d.getTime())) {
          throw new BadRequestException('Invalid endDate format. Use YYYY-MM-DD.');
        }
        updateData.endDate = d;
      } else {
        updateData.endDate = null;
      }
    }

    // status (direct transition via update — not the launch endpoint)
    if (dto.status !== undefined) {
      const targetStatus = this.normalizeStatus(dto.status);
      this.validateStatusTransition(record.status, targetStatus);
      updateData.status = targetStatus;
    }

    // updatedBy
    if (dto.updatedBy !== undefined) {
      updateData.updatedBy = dto.updatedBy.trim() || null;
    }

    const updated = await this.db.sponsorCampaign.update({
      where: { id: record.id },
      data: updateData,
      include: {
        advertiser: true,
        brand: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor campaign updated successfully',
      module: dto.module || 'sponsor',
      campaignItem: this.formatResponse(updated),
    };
  }

  /**
   * DELETE deleteSponsorCampaign/:id
   * Soft delete: sets deletedAt + status = DELETED.
   */
  async remove(identifier: string, module?: string) {
    const where = this.resolveWhereClause(identifier);

    const record = await this.db.sponsorCampaign.findFirst({
      where: { ...where, deletedAt: null },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor campaign with identifier '${identifier}' not found.`);
    }

    if (record.status === SponsorCampaignStatus.DELETED) {
      throw new ConflictException('Campaign is already deleted.');
    }

    // Validate transition to DELETED is allowed
    this.validateStatusTransition(record.status, SponsorCampaignStatus.DELETED);

    const updated = await this.db.sponsorCampaign.update({
      where: { id: record.id },
      data: {
        status: SponsorCampaignStatus.DELETED,
        deletedAt: new Date(),
      },
      include: {
        advertiser: true,
        brand: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor campaign deleted successfully',
      module: module || 'sponsor',
      campaignItem: this.formatResponse(updated),
    };
  }

  /**
   * POST launchSponsorCampaign/:id
   * Validates budget & prerequisites, then sets status = ACTIVE + launchedAt = now().
   */
  async launch(identifier: string, module?: string) {
    const where = this.resolveWhereClause(identifier);

    const record = await this.db.sponsorCampaign.findFirst({
      where: { ...where, deletedAt: null },
      include: {
        advertiser: true,
        brand: true,
      },
    });

    if (!record) {
      throw new NotFoundException(`Sponsor campaign with identifier '${identifier}' not found.`);
    }

    // ── Guard: cannot launch from invalid states ──
    const launchableStatuses: SponsorCampaignStatus[] = [
      SponsorCampaignStatus.DRAFT,
      SponsorCampaignStatus.PENDING_CREATIVE,
      SponsorCampaignStatus.PAUSED,
    ];

    if (!launchableStatuses.includes(record.status)) {
      throw new ConflictException(
        `Cannot launch a campaign with status '${record.status}'. ` +
          `Campaign must be in one of: ${launchableStatuses.join(', ')}.`,
      );
    }

    // ── Validate minimum daily budget ──
    const budget = Number(record.dailyBudget);
    if (budget < MIN_DAILY_BUDGET_FOR_LAUNCH) {
      throw new BadRequestException(
        `Daily budget must be at least ₹${MIN_DAILY_BUDGET_FOR_LAUNCH} to launch. Current: ₹${budget}.`,
      );
    }

    // ── Validate start date is not in the past ──
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const campaignStart = new Date(record.startDate);
    campaignStart.setHours(0, 0, 0, 0);

    if (campaignStart < today && record.status !== SponsorCampaignStatus.PAUSED) {
      throw new BadRequestException(
        `Campaign start date (${record.startDate.toISOString().split('T')[0]}) is in the past. Please update the start date before launching.`,
      );
    }

    // ── Validate advertiser is ACTIVE ──
    if (record.advertiser.status !== 'ACTIVE') {
      throw new BadRequestException(
        `Cannot launch campaign: advertiser '${record.advertiser.advertiserName}' status is '${record.advertiser.status}'. Advertiser must be ACTIVE.`,
      );
    }

    // ── Launch ──
    const updated = await this.db.sponsorCampaign.update({
      where: { id: record.id },
      data: {
        status: SponsorCampaignStatus.ACTIVE,
        launchedAt: new Date(),
      },
      include: {
        advertiser: true,
        brand: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor campaign launched successfully',
      module: module || 'sponsor',
      campaignItem: this.formatResponse(updated),
    };
  }
}
