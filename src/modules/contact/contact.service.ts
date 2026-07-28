import { Injectable, BadRequestException } from '@nestjs/common';
import { DatabaseService } from '../../database/database.service';
import { CreateContactEnquiryDto } from './dto/create-contact-enquiry.dto';

@Injectable()
export class ContactService {
  constructor(private database: DatabaseService) {}

  async createEnquiry(dto: CreateContactEnquiryDto) {
    const firstName = dto.firstName || dto.name;
    if (!firstName || !firstName.trim()) {
      throw new BadRequestException('firstName or name field is required');
    }

    const enquiry = await this.database.contactEnquiry.create({
      data: {
        firstName: firstName.trim(),
        phone: dto.phone.trim(),
        email: dto.email ? dto.email.trim() : null,
        city: dto.city ? dto.city.trim() : 'Bangalore',
        message: dto.message ? dto.message.trim() : null,
      },
    });

    return {
      message: 'Contact enquiry submitted successfully',
      data: enquiry,
    };
  }

  async getAllEnquiries() {
    return this.database.contactEnquiry.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }
}
