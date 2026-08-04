import { Injectable, NotFoundException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';

interface AddressData {
  addressLine: string;
  pincode: string;
  city: string;
  state: string;
  country?: string;
  isDefault?: boolean;
}

@Injectable()
export class AddressService {
  constructor(private readonly db: DatabaseService) {}

  async getUserAddresses(userId: string) {
    const user = await this.db.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        address: true,
        pincode: true,
        city: true,
        state: true,
        country: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return [
      {
        id: 'default-address',
        userId: user.id,
        addressLine: user.address || '',
        pincode: user.pincode || '',
        city: user.city || '',
        state: user.state || '',
        country: user.country || 'India',
        isDefault: true,
      },
    ];
  }

  async saveAddress(userId: string, data: AddressData) {
    const user = await this.db.user.update({
      where: { id: userId },
      data: {
        address: data.addressLine,
        pincode: data.pincode,
        city: data.city,
        state: data.state,
        country: data.country || 'India',
      },
    });

    return {
      id: 'default-address',
      userId: user.id,
      addressLine: user.address,
      pincode: user.pincode,
      city: user.city,
      state: user.state,
      country: user.country,
      isDefault: true,
    };
  }
}
