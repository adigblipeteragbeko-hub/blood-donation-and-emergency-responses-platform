import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import { PermissionCode, Role, WebsiteStatisticKey } from '@prisma/client';
import { WebsiteManagementService } from './website-management.service';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Permissions } from '../../common/rbac/permissions.decorator';
import { PermissionsGuard } from '../../common/rbac/permissions.guard';
import { CreateWebsiteAlertDto } from './dto/create-website-alert.dto';
import { UpdateWebsiteAlertDto } from './dto/update-website-alert.dto';
import { CreateFaqDto } from './dto/create-faq.dto';
import { UpdateFaqDto } from './dto/update-faq.dto';
import { UpdateWebsiteStatisticDto } from './dto/update-website-statistic.dto';
import { CreateTestimonialDto } from './dto/create-testimonial.dto';
import { UpdateTestimonialDto } from './dto/update-testimonial.dto';
import { CreateAwarenessPostDto } from './dto/create-awareness-post.dto';
import { UpdateAwarenessPostDto } from './dto/update-awareness-post.dto';
import { CreatePartnerHospitalDto } from './dto/create-partner-hospital.dto';
import { UpdatePartnerHospitalDto } from './dto/update-partner-hospital.dto';
import { UpdateFooterSettingsDto } from './dto/update-footer-settings.dto';

@Controller('admin/website-management')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard, PermissionsGuard)
@Roles(Role.ADMIN)
@Permissions([PermissionCode.WEBSITE_CONTENT_MANAGE])
export class WebsiteManagementController {
  constructor(private readonly websiteManagementService: WebsiteManagementService) {}

  @Get()
  dashboard() {
    return this.websiteManagementService.getAdminDashboardData();
  }

  @Get('statistics')
  statistics() {
    return this.websiteManagementService.getStatistics();
  }

  @Patch('statistics/:key')
  updateStatistic(
    @Param('key') key: WebsiteStatisticKey,
    @Body() dto: UpdateWebsiteStatisticDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.websiteManagementService.updateStatistic(key, dto, user.id);
  }

  @Post('alerts')
  createAlert(@Body() dto: CreateWebsiteAlertDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.createAlert(dto, user.id);
  }

  @Patch('alerts/:id')
  updateAlert(@Param('id') id: string, @Body() dto: UpdateWebsiteAlertDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.updateAlert(id, dto, user.id);
  }

  @Delete('alerts/:id')
  deleteAlert(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.deleteAlert(id, user.id);
  }

  @Post('faqs')
  createFaq(@Body() dto: CreateFaqDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.createFaq(dto, user.id);
  }

  @Patch('faqs/:id')
  updateFaq(@Param('id') id: string, @Body() dto: UpdateFaqDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.updateFaq(id, dto, user.id);
  }

  @Delete('faqs/:id')
  deleteFaq(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.deleteFaq(id, user.id);
  }

  @Post('testimonials')
  createTestimonial(@Body() dto: CreateTestimonialDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.createTestimonial(dto, user.id);
  }

  @Patch('testimonials/:id')
  updateTestimonial(
    @Param('id') id: string,
    @Body() dto: UpdateTestimonialDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.websiteManagementService.updateTestimonial(id, dto, user.id);
  }

  @Delete('testimonials/:id')
  deleteTestimonial(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.deleteTestimonial(id, user.id);
  }

  @Post('awareness-posts')
  createAwarenessPost(@Body() dto: CreateAwarenessPostDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.createAwarenessPost(dto, user.id);
  }

  @Patch('awareness-posts/:id')
  updateAwarenessPost(
    @Param('id') id: string,
    @Body() dto: UpdateAwarenessPostDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.websiteManagementService.updateAwarenessPost(id, dto, user.id);
  }

  @Delete('awareness-posts/:id')
  deleteAwarenessPost(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.deleteAwarenessPost(id, user.id);
  }

  @Post('partner-hospitals')
  createPartnerHospital(@Body() dto: CreatePartnerHospitalDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.createPartnerHospital(dto, user.id);
  }

  @Patch('partner-hospitals/:id')
  updatePartnerHospital(
    @Param('id') id: string,
    @Body() dto: UpdatePartnerHospitalDto,
    @CurrentUser() user: { id: string },
  ) {
    return this.websiteManagementService.updatePartnerHospital(id, dto, user.id);
  }

  @Delete('partner-hospitals/:id')
  deletePartnerHospital(@Param('id') id: string, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.deletePartnerHospital(id, user.id);
  }

  @Get('footer')
  getFooter() {
    return this.websiteManagementService.getFooterSettings();
  }

  @Patch('footer')
  updateFooter(@Body() dto: UpdateFooterSettingsDto, @CurrentUser() user: { id: string }) {
    return this.websiteManagementService.updateFooterSettings(dto, user.id);
  }
}

