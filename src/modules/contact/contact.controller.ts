import { Body, Controller, Get, Post } from '@nestjs/common';
import { ContactService } from './contact.service';
import { CreateContactEnquiryDto } from './dto/create-contact-enquiry.dto';

@Controller()
export class ContactController {
  constructor(private readonly contactService: ContactService) {}

  @Post([
    'contact-enquiries',
    'contactEnquiries',
    '/_functions/contactEnquiries',
    '/_functions/contact-enquiries',
  ])
  create(@Body() dto: CreateContactEnquiryDto) {
    return this.contactService.createEnquiry(dto);
  }

  @Get([
    'contact-enquiries',
    'contactEnquiries',
    '/_functions/contactEnquiries',
    '/_functions/contact-enquiries',
  ])
  findAll() {
    return this.contactService.getAllEnquiries();
  }
}
