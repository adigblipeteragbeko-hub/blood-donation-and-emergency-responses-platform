import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { Throttle, ThrottlerGuard } from '@nestjs/throttler';
import { Role, SmsPurpose, SmsStatus } from '@prisma/client';
import { AuditService } from '../../common/audit/audit.service';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { SendTestSmsDto } from './dto/send-sms.dto';
import { SMS_TEST_MESSAGE } from './sms.constants';
import { SmsService } from './sms.service';

@Controller('sms')
@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
export class SmsController {
  constructor(
    private readonly smsService: SmsService,
    private readonly audit: AuditService,
  ) {}

  @Post('test')
  @UseGuards(ThrottlerGuard)
  @Throttle({ default: { limit: 3, ttl: 60_000 } })
  @Roles(Role.ADMIN)
  async sendTestSms(@CurrentUser() user: { id: string }, @Body() dto: SendTestSmsDto) {
    const result = await this.smsService.sendSms({
      recipient: dto.phoneNumber,
      message: SMS_TEST_MESSAGE,
      purpose: SmsPurpose.TEST,
      triggeredByUserId: user.id,
      relatedEntityType: 'SMS_TEST',
      relatedEntityId: user.id,
      idempotencyKey: null,
    });
    await this.audit.log(result.success ? 'SMS_TEST_SENT' : 'SMS_TEST_FAILED', 'SMS', user.id, result.smsLogId ?? undefined, {
      status: result.status,
      provider: result.provider,
      providerCampaignId: result.providerCampaignId ?? null,
      sentCount: result.sentCount,
      rejectedCount: result.rejectedCount,
      errorCode: result.errorCode ?? null,
    });
    return result;
  }

  @Get('history')
  @Roles(Role.ADMIN)
  getHistory(@Query() query: { skip?: number; take?: number; purpose?: SmsPurpose; status?: SmsStatus }) {
    return this.smsService.getHistory(query);
  }
}
