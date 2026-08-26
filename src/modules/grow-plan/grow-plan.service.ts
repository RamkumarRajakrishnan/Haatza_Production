import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateGrowPlanDto } from './dto/create-grow-plan.dto';
import { UpdateGrowPlanDto } from './dto/update-grow-plan.dto';

@Injectable()
export class GrowPlanService {
  private readonly logger = new Logger(GrowPlanService.name);

  constructor(private readonly db: DatabaseService) {}

  async create(dto: CreateGrowPlanDto) {
    this.logger.log(`Creating GrowPlan entry for email: ${dto.email}, plan: ${dto.planName}`);
    const data: any = {
      memberId: dto.memberId || null,
      orderId: dto.orderId || null,
      planName: dto.planName || null,
      nickname: dto.nickname || null,
      planId: dto.planId || null,
      status: dto.status || 'ACTIVE',
      email: dto.email || null,
      endedDate: dto.endedDate ? new Date(dto.endedDate) : null,
      startedDate: dto.startedDate ? new Date(dto.startedDate) : null,
      paymentId: dto.paymentId || null,
      razorpayOrderId: dto.razorpayOrderId || null,
      manageGrowPlanPageLink: dto.manageGrowPlanPageLink || null,
      phone: dto.phone || null,
      sellerId: dto.sellerId || null,
      owner: dto.owner || null,
    };

    return await this.db.growPlan.create({ data });
  }

  async findAll(filters: { sellerId?: string; email?: string; status?: string }) {
    const where: any = {};
    if (filters.sellerId?.trim()) {
      where.sellerId = filters.sellerId.trim();
    }
    if (filters.email?.trim()) {
      where.email = { equals: filters.email.trim(), mode: 'insensitive' };
    }
    if (filters.status?.trim()) {
      where.status = { equals: filters.status.trim(), mode: 'insensitive' };
    }

    return await this.db.growPlan.findMany({
      where,
      orderBy: { createdDate: 'desc' },
    });
  }

  async findOne(id: string) {
    const record = await this.db.growPlan.findUnique({
      where: { id },
    });

    if (!record) {
      throw new NotFoundException(`GrowPlan record with ID '${id}' not found.`);
    }

    return record;
  }

  async update(id: string, dto: UpdateGrowPlanDto) {
    const record = await this.findOne(id);

    const updateData: any = {};
    if (dto.memberId !== undefined) updateData.memberId = dto.memberId;
    if (dto.orderId !== undefined) updateData.orderId = dto.orderId;
    if (dto.planName !== undefined) updateData.planName = dto.planName;
    if (dto.nickname !== undefined) updateData.nickname = dto.nickname;
    if (dto.planId !== undefined) updateData.planId = dto.planId;
    if (dto.status !== undefined) updateData.status = dto.status;
    if (dto.email !== undefined) updateData.email = dto.email;
    if (dto.endedDate !== undefined) updateData.endedDate = dto.endedDate ? new Date(dto.endedDate) : null;
    if (dto.startedDate !== undefined) updateData.startedDate = dto.startedDate ? new Date(dto.startedDate) : null;
    if (dto.paymentId !== undefined) updateData.paymentId = dto.paymentId;
    if (dto.razorpayOrderId !== undefined) updateData.razorpayOrderId = dto.razorpayOrderId;
    if (dto.manageGrowPlanPageLink !== undefined) updateData.manageGrowPlanPageLink = dto.manageGrowPlanPageLink;
    if (dto.phone !== undefined) updateData.phone = dto.phone;
    if (dto.sellerId !== undefined) updateData.sellerId = dto.sellerId;
    if (dto.owner !== undefined) updateData.owner = dto.owner;

    return await this.db.growPlan.update({
      where: { id: record.id },
      data: updateData,
    });
  }

  async remove(id: string) {
    const record = await this.findOne(id);
    await this.db.growPlan.delete({
      where: { id: record.id },
    });
    return { success: true, message: `GrowPlan record '${id}' deleted successfully.` };
  }
}
