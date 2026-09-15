import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateSponsorAdCreativeDto } from './dto/create-sponsor-ad-creative.dto';
import { UpdateSponsorAdCreativeDto } from './dto/update-sponsor-ad-creative.dto';
import { QuerySponsorAdCreativeDto } from './dto/query-sponsor-ad-creative.dto';
import {
  CreativeAspectRatio,
  CreativeDestinationType,
  CreativeCtaButtonText,
  CreativeStatus,
  SponsorCampaignStatus,
} from '@prisma/client';

@Injectable()
export class SponsorAdCreativeService {
  private readonly logger = new Logger(SponsorAdCreativeService.name);

  constructor(private readonly db: DatabaseService) {}

  // ─────────────────── Helpers & Normalizers ───────────────────

  /**
   * Validates mandatory ?module=sponsor query param.
   */
  private validateModule(module?: string): void {
    if (!module || module.toString().toLowerCase().trim() !== 'sponsor') {
      throw new BadRequestException(
        "Invalid or missing 'module' parameter. 'module=sponsor' is required for all sponsor operations.",
      );
    }
  }

  /**
   * Normalizes Aspect Ratio: 1:1 -> RATIO_1_1, 4:5 -> RATIO_4_5
   */
  private normalizeAspectRatio(ratio?: string): CreativeAspectRatio {
    if (!ratio) return CreativeAspectRatio.RATIO_1_1;
    const clean = ratio.toString().toUpperCase().trim().replace(/[:\s]/g, '_');
    if (clean === '1_1' || clean === 'RATIO_1_1' || clean === '1:1' || clean === 'SQUARE') {
      return CreativeAspectRatio.RATIO_1_1;
    }
    if (clean === '4_5' || clean === 'RATIO_4_5' || clean === '4:5' || clean === 'PORTRAIT') {
      return CreativeAspectRatio.RATIO_4_5;
    }
    throw new BadRequestException(
      `Invalid imageAspectRatio '${ratio}'. Allowed values: 1:1, 4:5`,
    );
  }

  /**
   * Normalizes Destination Type
   */
  private normalizeDestinationType(type?: string): CreativeDestinationType {
    if (!type) return CreativeDestinationType.CUSTOM_URL;
    const clean = type.toString().toUpperCase().trim().replace(/[-\s]/g, '_');
    switch (clean) {
      case 'PRODUCT_PAGE':
      case 'PRODUCT':
        return CreativeDestinationType.PRODUCT_PAGE;
      case 'BRAND_STORE':
      case 'STORE':
      case 'BRAND':
        return CreativeDestinationType.BRAND_STORE;
      case 'CATEGORY_PAGE':
      case 'CATEGORY':
        return CreativeDestinationType.CATEGORY_PAGE;
      case 'CUSTOM_URL':
      case 'CUSTOM':
      case 'URL':
        return CreativeDestinationType.CUSTOM_URL;
      default:
        throw new BadRequestException(
          `Invalid destinationType '${type}'. Allowed values: PRODUCT_PAGE, BRAND_STORE, CATEGORY_PAGE, CUSTOM_URL`,
        );
    }
  }

  /**
   * Normalizes CTA Button Text
   */
  private normalizeCtaButtonText(cta?: string): CreativeCtaButtonText {
    if (!cta) return CreativeCtaButtonText.SHOP_NOW;
    const clean = cta.toString().toUpperCase().trim().replace(/[-\s]/g, '_');
    switch (clean) {
      case 'SHOP_NOW':
        return CreativeCtaButtonText.SHOP_NOW;
      case 'LEARN_MORE':
        return CreativeCtaButtonText.LEARN_MORE;
      case 'BOOK_NOW':
        return CreativeCtaButtonText.BOOK_NOW;
      case 'SIGN_UP':
      case 'SIGNUP':
        return CreativeCtaButtonText.SIGN_UP;
      case 'ORDER_NOW':
        return CreativeCtaButtonText.ORDER_NOW;
      default:
        throw new BadRequestException(
          `Invalid ctaButtonText '${cta}'. Allowed values: SHOP_NOW, LEARN_MORE, BOOK_NOW, SIGN_UP, ORDER_NOW`,
        );
    }
  }

  /**
   * Normalizes Creative Status
   */
  private normalizeStatus(status?: string): CreativeStatus {
    if (!status) return CreativeStatus.DRAFT;
    const clean = status.toString().toUpperCase().trim();
    switch (clean) {
      case 'DRAFT':
        return CreativeStatus.DRAFT;
      case 'ACTIVE':
        return CreativeStatus.ACTIVE;
      case 'PAUSED':
        return CreativeStatus.PAUSED;
      case 'REJECTED':
        return CreativeStatus.REJECTED;
      case 'DELETED':
        return CreativeStatus.DELETED;
      default:
        throw new BadRequestException(
          `Invalid status '${status}'. Allowed values: DRAFT, ACTIVE, PAUSED, REJECTED, DELETED`,
        );
    }
  }

  /**
   * Validates URL format
   */
  private validateUrl(urlStr: string, fieldName = 'destinationLink'): void {
    if (!urlStr || !urlStr.trim()) {
      throw new BadRequestException(`${fieldName} cannot be empty.`);
    }
    const trimmed = urlStr.trim();
    try {
      const parsed = new URL(trimmed);
      if (!['http:', 'https:'].includes(parsed.protocol)) {
        throw new Error();
      }
    } catch {
      throw new BadRequestException(
        `${fieldName} must be a valid HTTP or HTTPS URL (e.g. https://haatza.com/products/example).`,
      );
    }
  }

  /**
   * Resolves campaign by numeric ID, CP001 code, or UUID campaignUid.
   * Throws 404 if not found, 400 if deleted.
   */
  private async resolveCampaign(campaignIdOrUid: string | number) {
    const raw = campaignIdOrUid?.toString().trim();
    if (!raw) {
      throw new BadRequestException('campaignId is required.');
    }

    let isNumeric = /^\d+$/.test(raw);
    let parsedId = isNumeric ? parseInt(raw, 10) : null;

    if (raw.toUpperCase().startsWith('CP')) {
      const codeNum = parseInt(raw.slice(2), 10);
      if (!isNaN(codeNum)) {
        isNumeric = true;
        parsedId = codeNum;
      }
    }

    const campaign = await this.db.sponsorCampaign.findFirst({
      where: isNumeric && parsedId !== null
        ? { id: parsedId, deletedAt: null }
        : { campaignUid: raw, deletedAt: null },
      select: {
        id: true,
        campaignUid: true,
        campaignName: true,
        status: true,
        deletedAt: true,
      },
    });

    if (!campaign) {
      throw new NotFoundException(
        `Sponsor campaign with ID '${raw}' was not found or is inactive.`,
      );
    }

    if (campaign.status === SponsorCampaignStatus.DELETED) {
      throw new BadRequestException(
        `Cannot link creative to campaign '${campaign.campaignName}' because the campaign is DELETED.`,
      );
    }

    return campaign;
  }

  /**
   * Resolves where clause for creative by numeric ID, CR001 code, or UUID creativeUid.
   */
  private resolveCreativeWhere(identifier: string | number) {
    const raw = identifier?.toString().trim();
    if (!raw) {
      throw new BadRequestException('Creative ID is required.');
    }
    if (raw.toUpperCase().startsWith('CR')) {
      const codeNum = parseInt(raw.slice(2), 10);
      if (!isNaN(codeNum)) {
        return { id: codeNum };
      }
    }
    const isNumeric = /^\d+$/.test(raw);
    return isNumeric ? { id: parseInt(raw, 10) } : { creativeUid: raw };
  }

  /**
   * Formats DB creative record to camelCase JSON response with joined campaign info.
   */
  private formatCamelCaseResponse(record: any) {
    if (!record) return null;
    const creativeCode = record.id ? `CR${String(record.id).padStart(3, '0')}` : null;
    const campaignCode = record.campaignId ? `CP${String(record.campaignId).padStart(3, '0')}` : null;
    return {
      id: record.id,
      creativeCode,
      creativeUid: record.creativeUid,
      campaignId: record.campaignId,
      campaignCode,
      campaignUid: record.campaign?.campaignUid || null,
      campaignName: record.campaign?.campaignName || null,
      campaignStatus: record.campaign?.status || null,
      creativeName: record.creativeName,
      primaryText: record.primaryText,
      headline: record.headline,
      creativeImageUrl: record.creativeImageUrl,
      imageAspectRatio:
        record.imageAspectRatio === CreativeAspectRatio.RATIO_1_1
          ? '1:1'
          : record.imageAspectRatio === CreativeAspectRatio.RATIO_4_5
            ? '4:5'
            : record.imageAspectRatio,
      destinationType: record.destinationType,
      destinationLink: record.destinationLink,
      ctaButtonText: record.ctaButtonText,
      status: record.status,
      createdBy: record.createdBy || null,
      updatedBy: record.updatedBy || null,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      deletedAt: record.deletedAt || null,
    };
  }

  // ─────────────────── 1. CREATE ───────────────────

  /**
   * POST /api/v1/createSponsorAdCreatives?module=sponsor
   * Creates a new creative in DRAFT status linked to a valid sponsor campaign.
   */
  async create(dto: CreateSponsorAdCreativeDto) {
    this.validateModule(dto.module);

    if (!dto.creativeName?.trim()) {
      throw new BadRequestException('Creative Name (creativeName) is required.');
    }
    if (!dto.primaryText?.trim()) {
      throw new BadRequestException('Primary Text (primaryText) is required.');
    }
    if (dto.primaryText.trim().length > 150) {
      throw new BadRequestException(
        `Primary Text cannot exceed 150 characters. Current length: ${dto.primaryText.trim().length}`,
      );
    }
    if (!dto.headline?.trim()) {
      throw new BadRequestException('Headline (headline) is required.');
    }
    if (dto.headline.trim().length > 60) {
      throw new BadRequestException(
        `Headline cannot exceed 60 characters. Current length: ${dto.headline.trim().length}`,
      );
    }
    if (!dto.creativeImageUrl?.trim()) {
      throw new BadRequestException('Creative Image URL (creativeImageUrl) is required.');
    }
    if (!dto.destinationLink?.trim()) {
      throw new BadRequestException('Destination Link (destinationLink) is required.');
    }
    this.validateUrl(dto.destinationLink, 'destinationLink');

    // ── Resolve and validate campaign ──
    const campaign = await this.resolveCampaign(dto.campaignId);

    const aspectRatio = this.normalizeAspectRatio(dto.imageAspectRatio);
    const destinationType = this.normalizeDestinationType(dto.destinationType);
    const ctaButtonText = this.normalizeCtaButtonText(dto.ctaButtonText);

    const created = await this.db.sponsorAdCreative.create({
      data: {
        campaignId: campaign.id,
        creativeName: dto.creativeName.trim(),
        primaryText: dto.primaryText.trim(),
        headline: dto.headline.trim(),
        creativeImageUrl: dto.creativeImageUrl.trim(),
        imageAspectRatio: aspectRatio,
        destinationType,
        destinationLink: dto.destinationLink.trim(),
        ctaButtonText,
        status: CreativeStatus.DRAFT,
        createdBy: dto.createdBy?.trim() || null,
      },
      include: {
        campaign: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor ad creative created successfully',
      module: 'sponsor',
      creativeItem: this.formatCamelCaseResponse(created),
    };
  }

  // ─────────────────── 2. GET ONE ───────────────────

  /**
   * GET /api/v1/getSponsorAdCreatives/:id?module=sponsor
   * Fetch single creative by id or creativeUid with joined campaign info.
   */
  async findOne(identifier: string | number, module?: string) {
    this.validateModule(module);

    const where = this.resolveCreativeWhere(identifier);
    const record = await this.db.sponsorAdCreative.findFirst({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        campaign: true,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Sponsor ad creative with identifier '${identifier}' was not found.`,
      );
    }

    return {
      success: true,
      message: 'Sponsor ad creative details retrieved successfully',
      module: 'sponsor',
      creativeItem: this.formatCamelCaseResponse(record),
    };
  }

  // ─────────────────── 3. GET LIST ───────────────────

  /**
   * GET /api/v1/getSponsorAdCreatives?module=sponsor
   * Paginated list with campaign & status filters.
   */
  async findAll(query: QuerySponsorAdCreativeDto) {
    this.validateModule(query.module);

    const where: any = {
      deletedAt: null, // exclude soft-deleted
    };

    if (query.campaignId?.trim()) {
      const rawCamp = query.campaignId.trim();
      const isNumeric = /^\d+$/.test(rawCamp);
      if (isNumeric) {
        where.campaignId = parseInt(rawCamp, 10);
      } else {
        // Resolve UUID campaignUid
        const campaign = await this.db.sponsorCampaign.findFirst({
          where: { campaignUid: rawCamp },
          select: { id: true },
        });
        if (campaign) {
          where.campaignId = campaign.id;
        } else {
          where.campaignId = -1; // non-matching
        }
      }
    }

    if (query.status?.trim()) {
      where.status = this.normalizeStatus(query.status);
    }

    if (query.search?.trim()) {
      const term = query.search.trim();
      where.OR = [
        { creativeName: { contains: term, mode: 'insensitive' } },
        { headline: { contains: term, mode: 'insensitive' } },
        { primaryText: { contains: term, mode: 'insensitive' } },
      ];
    }

    const page = Number(query.page) > 0 ? Number(query.page) : 1;
    const limit = Number(query.limit) > 0 ? Number(query.limit) : 50;
    const skip = (page - 1) * limit;

    const [total, records] = await Promise.all([
      this.db.sponsorAdCreative.count({ where }),
      this.db.sponsorAdCreative.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        include: {
          campaign: true,
        },
      }),
    ]);

    const totalPages = Math.ceil(total / limit) || 1;

    return {
      success: true,
      message: 'Sponsor ad creatives retrieved successfully',
      module: 'sponsor',
      total,
      page,
      limit,
      totalPages,
      creativeItems: records.map((r) => this.formatCamelCaseResponse(r)),
    };
  }

  // ─────────────────── 4. UPDATE ───────────────────

  /**
   * PUT /api/v1/updateSponsorAdCreatives/:id?module=sponsor
   * Partial update: revalidates character limits, URL syntax, and REJECTED guard.
   */
  async update(identifier: string | number, dto: UpdateSponsorAdCreativeDto) {
    this.validateModule(dto.module);

    const where = this.resolveCreativeWhere(identifier);
    const record = await this.db.sponsorAdCreative.findFirst({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        campaign: true,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Sponsor ad creative with identifier '${identifier}' was not found.`,
      );
    }

    // Business rule: Disallow edits if status = REJECTED unless resubmitting / changing status
    if (record.status === CreativeStatus.REJECTED && !dto.status) {
      throw new ConflictException(
        `Cannot edit creative in REJECTED status without updating/resubmitting its status (e.g. set status: 'DRAFT').`,
      );
    }

    const updateData: any = {};

    if (dto.creativeName !== undefined) {
      if (!dto.creativeName.trim()) {
        throw new BadRequestException('Creative Name cannot be empty.');
      }
      updateData.creativeName = dto.creativeName.trim();
    }

    if (dto.primaryText !== undefined) {
      if (!dto.primaryText.trim()) {
        throw new BadRequestException('Primary Text cannot be empty.');
      }
      if (dto.primaryText.trim().length > 150) {
        throw new BadRequestException(
          `Primary Text cannot exceed 150 characters. Current length: ${dto.primaryText.trim().length}`,
        );
      }
      updateData.primaryText = dto.primaryText.trim();
    }

    if (dto.headline !== undefined) {
      if (!dto.headline.trim()) {
        throw new BadRequestException('Headline cannot be empty.');
      }
      if (dto.headline.trim().length > 60) {
        throw new BadRequestException(
          `Headline cannot exceed 60 characters. Current length: ${dto.headline.trim().length}`,
        );
      }
      updateData.headline = dto.headline.trim();
    }

    if (dto.creativeImageUrl !== undefined) {
      if (!dto.creativeImageUrl.trim()) {
        throw new BadRequestException('Creative Image URL cannot be empty.');
      }
      updateData.creativeImageUrl = dto.creativeImageUrl.trim();
    }

    if (dto.imageAspectRatio !== undefined) {
      updateData.imageAspectRatio = this.normalizeAspectRatio(dto.imageAspectRatio);
    }

    if (dto.destinationType !== undefined) {
      updateData.destinationType = this.normalizeDestinationType(dto.destinationType);
    }

    if (dto.destinationLink !== undefined) {
      if (!dto.destinationLink.trim()) {
        throw new BadRequestException('Destination Link cannot be empty.');
      }
      this.validateUrl(dto.destinationLink, 'destinationLink');
      updateData.destinationLink = dto.destinationLink.trim();
    }

    if (dto.ctaButtonText !== undefined) {
      updateData.ctaButtonText = this.normalizeCtaButtonText(dto.ctaButtonText);
    }

    if (dto.status !== undefined) {
      updateData.status = this.normalizeStatus(dto.status);
    }

    if (dto.updatedBy !== undefined) {
      updateData.updatedBy = dto.updatedBy.trim() || null;
    }

    const updated = await this.db.sponsorAdCreative.update({
      where: { id: record.id },
      data: updateData,
      include: {
        campaign: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor ad creative updated successfully',
      module: 'sponsor',
      creativeItem: this.formatCamelCaseResponse(updated),
    };
  }

  // ─────────────────── 5. DELETE (soft) ───────────────────

  /**
   * DELETE /api/v1/deleteSponsorAdCreatives/:id?module=sponsor
   * Soft-delete. Blocks deletion if linked campaign is ACTIVE (409 Conflict).
   */
  async remove(identifier: string | number, module?: string) {
    this.validateModule(module);

    const where = this.resolveCreativeWhere(identifier);
    const record = await this.db.sponsorAdCreative.findFirst({
      where: {
        ...where,
        deletedAt: null,
      },
      include: {
        campaign: true,
      },
    });

    if (!record) {
      throw new NotFoundException(
        `Sponsor ad creative with identifier '${identifier}' was not found.`,
      );
    }

    if (record.status === CreativeStatus.DELETED) {
      throw new ConflictException('Creative is already deleted.');
    }

    // Business rule: Block delete if creative is linked to an ACTIVE campaign
    if (record.campaign?.status === SponsorCampaignStatus.ACTIVE) {
      throw new ConflictException(
        `Cannot delete creative '${record.creativeName}' because its linked campaign '${record.campaign.campaignName}' is currently ACTIVE. Please pause the campaign or switch the active creative before deleting.`,
      );
    }

    const updated = await this.db.sponsorAdCreative.update({
      where: { id: record.id },
      data: {
        status: CreativeStatus.DELETED,
        deletedAt: new Date(),
      },
      include: {
        campaign: true,
      },
    });

    return {
      success: true,
      message: 'Sponsor ad creative deleted successfully',
      module: 'sponsor',
      creativeItem: this.formatCamelCaseResponse(updated),
    };
  }
}
