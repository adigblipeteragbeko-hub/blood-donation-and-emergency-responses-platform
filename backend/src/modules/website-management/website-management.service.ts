import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import {
  BloodGroup,
  DonorResponseStatus,
  PriorityLevel,
  RequestProgressStatus,
  RequestStatus,
  WebsiteStatisticKey,
} from '@prisma/client';
import { PrismaService } from '../../prisma.service';
import { AuditService } from '../../common/audit/audit.service';
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
import { WebsiteAnnouncementsService } from './website-announcements.service';

@Injectable()
export class WebsiteManagementService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
    private readonly announcements: WebsiteAnnouncementsService,
  ) {}

  private buildDescription(adminNameOrEmail: string, activity: string) {
    return `Admin ${adminNameOrEmail} ${activity}`;
  }

  private async resolveAdminLabel(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { email: true, donorProfile: { select: { fullName: true } } },
    });

    return user?.donorProfile?.fullName || user?.email || 'Admin';
  }

  private normalizeAlertPayload(dto: CreateWebsiteAlertDto | UpdateWebsiteAlertDto) {
    const data: Record<string, unknown> = {};

    if (dto.title !== undefined) data.title = dto.title;
    if (dto.message !== undefined) data.message = dto.message;
    if (dto.hospitalName !== undefined) data.hospitalName = dto.hospitalName;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;
    if (dto.isSticky !== undefined) data.isSticky = dto.isSticky;
    if (dto.isScrolling !== undefined) data.isScrolling = dto.isScrolling;
    if (dto.bloodType !== undefined) data.bloodType = dto.bloodType as BloodGroup;
    if (dto.urgencyLevel !== undefined) data.urgencyLevel = dto.urgencyLevel as PriorityLevel;
    if (dto.expiresAt !== undefined) data.expiresAt = dto.expiresAt ? new Date(dto.expiresAt) : null;

    return data;
  }

  private normalizeTestimonialPayload(dto: CreateTestimonialDto | UpdateTestimonialDto): Prisma.TestimonialUncheckedCreateInput | Prisma.TestimonialUncheckedUpdateInput {
    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.message !== undefined) data.message = dto.message;
    if (dto.location !== undefined) data.location = dto.location ?? '';
    if (dto.isApproved !== undefined) data.isApproved = dto.isApproved;
    if (dto.isPublished !== undefined) data.isPublished = dto.isPublished;

    return data;
  }

  private normalizePartnerHospitalPayload(
    dto: CreatePartnerHospitalDto | UpdatePartnerHospitalDto,
  ): Prisma.PartnerHospitalUncheckedCreateInput | Prisma.PartnerHospitalUncheckedUpdateInput {
    const data: Record<string, unknown> = {};

    if (dto.hospitalName !== undefined) data.hospitalName = dto.hospitalName;
    if (dto.location !== undefined) data.location = dto.location;
    if (dto.phone !== undefined) data.phone = dto.phone;
    if (dto.email !== undefined) data.email = dto.email;
    if (dto.description !== undefined) data.description = dto.description ?? '';
    if (dto.latitude !== undefined) data.latitude = dto.latitude;
    if (dto.longitude !== undefined) data.longitude = dto.longitude;

    return data;
  }

  private async getRealStatisticValue(key: WebsiteStatisticKey) {
    switch (key) {
      case WebsiteStatisticKey.REGISTERED_DONORS:
        return this.prisma.donor.count();
      case WebsiteStatisticKey.EMERGENCY_MATCHES:
        return this.prisma.donorResponse.count({
          where: {
            responseStatus: { in: [DonorResponseStatus.ACCEPTED, DonorResponseStatus.DONATED] },
          },
        });
      case WebsiteStatisticKey.PARTNER_HOSPITALS:
        return this.prisma.hospital.count();
      case WebsiteStatisticKey.REQUESTS_COMPLETED:
        return this.prisma.bloodRequest.count({
          where: {
            OR: [{ status: RequestStatus.FULFILLED }, { trackingStatus: RequestProgressStatus.COMPLETED }],
          },
        });
      default:
        return 0;
    }
  }

  async getAdminDashboardData() {
    const [alerts, statistics, faqs, testimonials, awarenessPosts, partnerHospitals, footerSettings] = await Promise.all([
      this.prisma.websiteAlert.findMany({ orderBy: [{ isActive: 'desc' }, { createdAt: 'desc' }] }),
      this.getStatistics(),
      this.prisma.faq.findMany({ orderBy: [{ isPublished: 'desc' }, { createdAt: 'asc' }] }),
      this.prisma.testimonial.findMany({ orderBy: [{ isApproved: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.awarenessPost.findMany({ orderBy: [{ isPublished: 'desc' }, { createdAt: 'desc' }] }),
      this.prisma.partnerHospital.findMany({ orderBy: [{ hospitalName: 'asc' }] }),
      this.getFooterSettings(),
    ]);

    return { alerts, statistics, faqs, testimonials, awarenessPosts, partnerHospitals, footerSettings };
  }

  async getStatistics() {
    const rows = await this.prisma.websiteStatistic.findMany({ orderBy: { key: 'asc' } });
    const stats = await Promise.all(
      rows.map(async (row) => {
        const liveValue = await this.getRealStatisticValue(row.key);
        const value = row.isOverrideEnabled && row.overrideValue !== null ? row.overrideValue : liveValue;

        return {
          ...row,
          liveValue,
          value,
        };
      }),
    );

    return stats;
  }

  async updateStatistic(key: WebsiteStatisticKey, dto: UpdateWebsiteStatisticDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const statistic = await this.prisma.websiteStatistic.upsert({
      where: { key },
      update: {
        label: dto.label,
        description: dto.description,
        overrideValue: dto.overrideValue === undefined ? undefined : dto.overrideValue,
        isOverrideEnabled: dto.isOverrideEnabled,
      },
      create: {
        key,
        label: dto.label ?? key.replace(/_/g, ' '),
        description: dto.description ?? '',
        overrideValue: dto.overrideValue ?? null,
        isOverrideEnabled: dto.isOverrideEnabled ?? false,
      },
    });

    await this.audit.log(
      'WEBSITE_STATISTIC_UPDATED',
      'WEBSITE_STATISTIC',
      actorUserId,
      statistic.id,
      { key, changes: dto },
      this.buildDescription(actor, `updated website statistic ${key}`),
    );

    return statistic;
  }

  async createAlert(dto: CreateWebsiteAlertDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const alert = await this.prisma.websiteAlert.create({
      data: this.normalizeAlertPayload(dto) as Prisma.WebsiteAlertCreateInput,
    });
    await this.announcements.syncAlertAnnouncement(alert);

    await this.audit.log(
      'WEBSITE_ALERT_CREATED',
      'WEBSITE_ALERT',
      actorUserId,
      alert.id,
      dto,
      this.buildDescription(actor, 'created homepage emergency alert'),
    );

    return alert;
  }

  async updateAlert(id: string, dto: UpdateWebsiteAlertDto, actorUserId: string) {
    const existing = await this.prisma.websiteAlert.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Website alert not found');
    }

    const actor = await this.resolveAdminLabel(actorUserId);
    const alert = await this.prisma.websiteAlert.update({
      where: { id },
      data: this.normalizeAlertPayload(dto) as Prisma.WebsiteAlertUpdateInput,
    });
    await this.announcements.syncAlertAnnouncement(alert);

    if (dto.isActive !== undefined && dto.isActive !== existing.isActive) {
      await this.audit.log(
        'WEBSITE_ALERT_VISIBILITY_CHANGED',
        'WEBSITE_ALERT',
        actorUserId,
        id,
        { previous: existing.isActive, current: dto.isActive },
        this.buildDescription(actor, `changed website alert visibility to ${dto.isActive ? 'active' : 'inactive'}`),
      );
    }

    await this.audit.log(
      'WEBSITE_ALERT_UPDATED',
      'WEBSITE_ALERT',
      actorUserId,
      id,
      dto,
      this.buildDescription(actor, 'updated homepage emergency alert'),
    );

    return alert;
  }

  async deleteAlert(id: string, actorUserId: string) {
    const existing = await this.prisma.websiteAlert.findUnique({ where: { id } });
    if (!existing) {
      throw new NotFoundException('Website alert not found');
    }

    const actor = await this.resolveAdminLabel(actorUserId);
    await this.prisma.websiteAlert.delete({ where: { id } });
    await this.announcements.removeAlertAnnouncement(id);
    await this.audit.log(
      'WEBSITE_ALERT_DELETED',
      'WEBSITE_ALERT',
      actorUserId,
      id,
      { title: existing.title },
      this.buildDescription(actor, 'deleted homepage emergency alert'),
    );

    return { message: 'Alert deleted successfully' };
  }

  async createFaq(dto: CreateFaqDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const faq = await this.prisma.faq.create({ data: dto });
    await this.audit.log('FAQ_CREATED', 'FAQ', actorUserId, faq.id, dto, this.buildDescription(actor, 'created FAQ content'));
    return faq;
  }

  async updateFaq(id: string, dto: UpdateFaqDto, actorUserId: string) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    const faq = await this.prisma.faq.update({ where: { id }, data: dto });

    if (dto.isPublished !== undefined && dto.isPublished !== existing.isPublished) {
      await this.audit.log(
        'FAQ_VISIBILITY_CHANGED',
        'FAQ',
        actorUserId,
        id,
        { previous: existing.isPublished, current: dto.isPublished },
        this.buildDescription(actor, `changed FAQ visibility to ${dto.isPublished ? 'published' : 'unpublished'}`),
      );
    }

    await this.audit.log('FAQ_UPDATED', 'FAQ', actorUserId, id, dto, this.buildDescription(actor, 'updated FAQ content'));
    return faq;
  }

  async deleteFaq(id: string, actorUserId: string) {
    const existing = await this.prisma.faq.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('FAQ not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    await this.prisma.faq.delete({ where: { id } });
    await this.audit.log('FAQ_DELETED', 'FAQ', actorUserId, id, { question: existing.question }, this.buildDescription(actor, 'deleted FAQ content'));
    return { message: 'FAQ deleted successfully' };
  }

  async createTestimonial(dto: CreateTestimonialDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const testimonialData = this.normalizeTestimonialPayload(dto) as Prisma.TestimonialCreateInput;
    const testimonial = await this.prisma.testimonial.create({ data: testimonialData });
    await this.audit.log(
      'TESTIMONIAL_CREATED',
      'TESTIMONIAL',
      actorUserId,
      testimonial.id,
      dto,
      this.buildDescription(actor, 'created testimonial content'),
    );
    return testimonial;
  }

  async updateTestimonial(id: string, dto: UpdateTestimonialDto, actorUserId: string) {
    const existing = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Testimonial not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    const testimonial = await this.prisma.testimonial.update({
      where: { id },
      data: this.normalizeTestimonialPayload(dto) as Prisma.TestimonialUpdateInput,
    });

    if (
      (dto.isPublished !== undefined && dto.isPublished !== existing.isPublished) ||
      (dto.isApproved !== undefined && dto.isApproved !== existing.isApproved)
    ) {
      await this.audit.log(
        'TESTIMONIAL_VISIBILITY_CHANGED',
        'TESTIMONIAL',
        actorUserId,
        id,
        {
          previousPublished: existing.isPublished,
          currentPublished: dto.isPublished,
          previousApproved: existing.isApproved,
          currentApproved: dto.isApproved,
        },
        this.buildDescription(actor, 'changed testimonial approval or publish state'),
      );
    }

    await this.audit.log(
      'TESTIMONIAL_UPDATED',
      'TESTIMONIAL',
      actorUserId,
      id,
      dto,
      this.buildDescription(actor, 'updated testimonial content'),
    );
    return testimonial;
  }

  async deleteTestimonial(id: string, actorUserId: string) {
    const existing = await this.prisma.testimonial.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Testimonial not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    await this.prisma.testimonial.delete({ where: { id } });
    await this.audit.log(
      'TESTIMONIAL_DELETED',
      'TESTIMONIAL',
      actorUserId,
      id,
      { name: existing.name },
      this.buildDescription(actor, 'deleted testimonial content'),
    );
    return { message: 'Testimonial deleted successfully' };
  }

  async createAwarenessPost(dto: CreateAwarenessPostDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const post = await this.prisma.awarenessPost.create({ data: dto });
    await this.announcements.syncAwarenessAnnouncement(post);
    await this.audit.log(
      'AWARENESS_POST_CREATED',
      'AWARENESS_POST',
      actorUserId,
      post.id,
      dto,
      this.buildDescription(actor, 'created awareness post'),
    );
    return post;
  }

  async updateAwarenessPost(id: string, dto: UpdateAwarenessPostDto, actorUserId: string) {
    const existing = await this.prisma.awarenessPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Awareness post not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    const post = await this.prisma.awarenessPost.update({ where: { id }, data: dto });
    await this.announcements.syncAwarenessAnnouncement(post);

    if (dto.isPublished !== undefined && dto.isPublished !== existing.isPublished) {
      await this.audit.log(
        'AWARENESS_POST_VISIBILITY_CHANGED',
        'AWARENESS_POST',
        actorUserId,
        id,
        { previous: existing.isPublished, current: dto.isPublished },
        this.buildDescription(actor, `changed awareness post visibility to ${dto.isPublished ? 'published' : 'unpublished'}`),
      );
    }

    await this.audit.log(
      'AWARENESS_POST_UPDATED',
      'AWARENESS_POST',
      actorUserId,
      id,
      dto,
      this.buildDescription(actor, 'updated awareness post'),
    );
    return post;
  }

  async deleteAwarenessPost(id: string, actorUserId: string) {
    const existing = await this.prisma.awarenessPost.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Awareness post not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    await this.prisma.awarenessPost.delete({ where: { id } });
    await this.announcements.removeAwarenessAnnouncement(id);
    await this.audit.log(
      'AWARENESS_POST_DELETED',
      'AWARENESS_POST',
      actorUserId,
      id,
      { title: existing.title },
      this.buildDescription(actor, 'deleted awareness post'),
    );
    return { message: 'Awareness post deleted successfully' };
  }

  async createPartnerHospital(dto: CreatePartnerHospitalDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const partnerHospital = await this.prisma.partnerHospital.create({
      data: this.normalizePartnerHospitalPayload(dto) as Prisma.PartnerHospitalCreateInput,
    });
    await this.audit.log(
      'PARTNER_HOSPITAL_CREATED',
      'PARTNER_HOSPITAL',
      actorUserId,
      partnerHospital.id,
      dto,
      this.buildDescription(actor, 'created partner hospital listing'),
    );
    return partnerHospital;
  }

  async updatePartnerHospital(id: string, dto: UpdatePartnerHospitalDto, actorUserId: string) {
    const existing = await this.prisma.partnerHospital.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner hospital not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    const partnerHospital = await this.prisma.partnerHospital.update({
      where: { id },
      data: this.normalizePartnerHospitalPayload(dto) as Prisma.PartnerHospitalUpdateInput,
    });
    await this.audit.log(
      'PARTNER_HOSPITAL_UPDATED',
      'PARTNER_HOSPITAL',
      actorUserId,
      id,
      dto,
      this.buildDescription(actor, 'updated partner hospital listing'),
    );
    return partnerHospital;
  }

  async deletePartnerHospital(id: string, actorUserId: string) {
    const existing = await this.prisma.partnerHospital.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Partner hospital not found');

    const actor = await this.resolveAdminLabel(actorUserId);
    await this.prisma.partnerHospital.delete({ where: { id } });
    await this.audit.log(
      'PARTNER_HOSPITAL_DELETED',
      'PARTNER_HOSPITAL',
      actorUserId,
      id,
      { hospitalName: existing.hospitalName },
      this.buildDescription(actor, 'deleted partner hospital listing'),
    );
    return { message: 'Partner hospital deleted successfully' };
  }

  async getFooterSettings() {
    return (
      (await this.prisma.websiteFooterSettings.findUnique({
        where: { singletonKey: 'default' },
      })) ??
      this.prisma.websiteFooterSettings.create({
        data: {
          singletonKey: 'default',
          emergencyPhonePrimary: '+233 544515775',
          emergencyPhoneSecondary: '+233 554287342',
          supportEmail: 'support@bloodresponse.local',
          facebookUrl: 'https://facebook.com',
          instagramUrl: 'https://instagram.com',
          linkedinUrl: 'https://linkedin.com',
          footerText: 'Built for trusted donor coordination, hospital response, and emergency visibility.',
        },
      })
    );
  }

  async updateFooterSettings(dto: UpdateFooterSettingsDto, actorUserId: string) {
    const actor = await this.resolveAdminLabel(actorUserId);
    const footerSettings = await this.prisma.websiteFooterSettings.upsert({
      where: { singletonKey: 'default' },
      update: dto,
      create: {
        singletonKey: 'default',
        emergencyPhonePrimary: dto.emergencyPhonePrimary ?? '+233 544515775',
        emergencyPhoneSecondary: dto.emergencyPhoneSecondary ?? '+233 554287342',
        supportEmail: dto.supportEmail ?? 'support@bloodresponse.local',
        facebookUrl: dto.facebookUrl,
        instagramUrl: dto.instagramUrl,
        linkedinUrl: dto.linkedinUrl,
        footerText: dto.footerText ?? 'Built for trusted donor coordination, hospital response, and emergency visibility.',
      },
    });

    await this.audit.log(
      'WEBSITE_FOOTER_UPDATED',
      'WEBSITE_FOOTER_SETTINGS',
      actorUserId,
      footerSettings.id,
      dto,
      this.buildDescription(actor, 'updated website footer settings'),
    );
    await this.announcements.upsertSystemAnnouncement();
    return footerSettings;
  }

  async getPublicWebsiteContent() {
    const [alert, statistics, faqs, testimonials, awarenessPosts, partnerHospitals, footerSettings] = await Promise.all([
      this.prisma.websiteAlert.findFirst({
        where: {
          isActive: true,
          OR: [{ expiresAt: null }, { expiresAt: { gt: new Date() } }],
        },
        orderBy: [{ urgencyLevel: 'desc' }, { createdAt: 'desc' }],
      }),
      this.getStatistics(),
      this.prisma.faq.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'asc' } }),
      this.prisma.testimonial.findMany({
        where: { isApproved: true, isPublished: true },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.awarenessPost.findMany({ where: { isPublished: true }, orderBy: { createdAt: 'desc' }, take: 12 }),
      this.prisma.partnerHospital.findMany({ orderBy: { hospitalName: 'asc' } }),
      this.getFooterSettings(),
    ]);

    return {
      alert,
      statistics,
      faqs,
      testimonials,
      awarenessPosts,
      partnerHospitals,
      footerSettings,
    };
  }
}
