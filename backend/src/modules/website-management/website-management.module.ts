import { Module } from '@nestjs/common';
import { WebsiteManagementController } from './website-management.controller';
import { PublicWebsiteController } from './public-website.controller';
import { PublicAnnouncementsController } from './public-announcements.controller';
import { AnnouncementsController } from './announcements.controller';
import { WebsiteManagementService } from './website-management.service';
import { WebsiteAnnouncementsService } from './website-announcements.service';

@Module({
  controllers: [WebsiteManagementController, PublicWebsiteController, PublicAnnouncementsController, AnnouncementsController],
  providers: [WebsiteManagementService, WebsiteAnnouncementsService],
  exports: [WebsiteManagementService, WebsiteAnnouncementsService],
})
export class WebsiteManagementModule {}
