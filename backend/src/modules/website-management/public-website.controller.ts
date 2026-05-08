import { Controller, Get } from '@nestjs/common';
import { WebsiteManagementService } from './website-management.service';

@Controller('public/website')
export class PublicWebsiteController {
  constructor(private readonly websiteManagementService: WebsiteManagementService) {}

  @Get()
  getWebsiteContent() {
    return this.websiteManagementService.getPublicWebsiteContent();
  }
}
