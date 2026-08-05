import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

@Injectable()
export class UserService {
  constructor(private readonly db: DatabaseService) { }

  async getUserProfile(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        companyName: true,
        role: true,
        status: true,
        address: true,
        pincode: true,
        city: true,
        state: true,
        country: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User profile not found');
    }
    return user;
  }

  async updateUserProfile(userId: string, data: any) {
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        ...(data.name && { name: data.name }),
        ...(data.email && { email: data.email }),
        ...(data.address && { address: data.address }),
        ...(data.pincode && { pincode: data.pincode }),
        ...(data.city && { city: data.city }),
        ...(data.state && { state: data.state }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        mobile: true,
        role: true,
        status: true,
        address: true,
        pincode: true,
        city: true,
        state: true,
        updatedAt: true,
      },
    });
    return user;
  }

  async getAllUsers(page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [users, total] = await Promise.all([
      this.db.user.findMany({
        skip,
        take: limit,
        select: {
          id: true,
          name: true,
          email: true,
          mobile: true,
          role: true,
          status: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.db.user.count(),
    ]);

    return {
      users,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    };
  }
}
