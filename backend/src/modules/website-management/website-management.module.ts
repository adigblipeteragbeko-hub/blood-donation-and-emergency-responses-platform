import { Module } from '@nestjs/common';
import { WebsiteManagementController } from './website-management.controller';
import { PublicWebsiteController } from './public-website.controller';
import { WebsiteManagementService } from './website-management.service';

@Module({
  controllers: [WebsiteManagementController, PublicWebsiteController],
  providers: [WebsiteManagementService],
  exports: [WebsiteManagementService],
})
export class WebsiteManagementModule {}
