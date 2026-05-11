import { Controller, Get } from '@nestjs/common';
import { WebsiteAnnouncementsService } from './website-announcements.service';

@Controller('public/announcements')
export class PublicAnnouncementsController {
  constructor(private readonly announcementsService: WebsiteAnnouncementsService) {}

  @Get()
  listPublicAnnouncements() {
    return this.announcementsService.listPublicAnnouncements();
  }
}
