import { Injectable } from '@nestjs/common';
import { AppointmentStatus, BloodGroup, RequestStatus, RequestType, Role } from '@prisma/client';
import { HospitalAccessService } from '../../common/rbac/hospital-access.service';
import { PrismaService } from '../../prisma.service';
import { AssistantIntent } from './assistant-intent.service';

type AssistantUser = { id: string; role: Role };

const startOfToday = () => {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
};

const endOfToday = () => {
  const date = new Date();
  date.setHours(23, 59, 59, 999);
  return date;
};

const formatBloodGroup = (value: BloodGroup | string) => String(value).replace('_POS', '+').replace('_NEG', '-');
const formatHospitalDisplayName = (value?: string | null) => {
  const trimmed = String(value ?? '').trim();
  if (!trimmed) return 'Hospital';
  const known: Record<string, string> = {
    'HO TEACHING': 'Ho Teaching Hospital',
    'HO TEACHING HOSPITAL': 'Ho Teaching Hospital',
  };
  const mapped = known[trimmed.toUpperCase()];
  if (mapped) return mapped;
  if (trimmed === trimmed.toUpperCase() && /[A-Z]/.test(trimmed)) {
    return trimmed.toLowerCase().replace(/\b\w/g, (letter) => letter.toUpperCase());
  }
  return trimmed;
};

@Injectable()
export class AssistantQueryService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly hospitalAccess: HospitalAccessService,
  ) {}

  async answerOperational(intent: AssistantIntent, user: AssistantUser, bloodGroup?: BloodGroup) {
    if (user.role === Role.DONOR) return this.answerDonor(intent, user.id);
    if (user.role === Role.HOSPITAL_ADMIN) return this.answerHospital(intent, user.id, bloodGroup);
    if (user.role === Role.ADMIN) return this.answerAdmin(intent);
    return null;
  }

  private async getDonor(userId: string) {
    return this.prisma.donor.findUnique({ where: { userId } });
  }

  private async answerDonor(intent: AssistantIntent, userId: string) {
    const donor = await this.getDonor(userId);
    if (!donor) {
      return { type: 'EMPTY_STATE' as const, message: 'No donor profile is linked to your account yet.', data: {}, route: '/donor/profile' };
    }

    if (intent === 'DONOR_ELIGIBILITY_STATUS') {
      const status = donor.eligibilityStatus ? 'Approved' : 'Pending review or not currently eligible';
      return {
        type: 'ANSWER' as const,
        message: `Your current system status is ${status}. Final eligibility is still confirmed by authorised hospital staff at the time of donation.`,
        data: {
          donorId: donor.id,
          eligibilityStatus: donor.eligibilityStatus,
          availabilityStatus: donor.availabilityStatus,
          nextEligibilityDate: donor.nextEligibilityDate,
        },
        route: '/donor/eligibility',
      };
    }

    if (intent === 'DONOR_NEXT_APPOINTMENT') {
      const appointment = await this.prisma.appointment.findFirst({
        where: {
          donorId: donor.id,
          scheduledAt: { gte: new Date() },
          status: { notIn: [AppointmentStatus.CANCELLED, AppointmentStatus.DECLINED, AppointmentStatus.COMPLETED, AppointmentStatus.NO_SHOW, AppointmentStatus.MISSED] },
        },
        orderBy: { scheduledAt: 'asc' },
        include: { hospital: { select: { hospitalName: true, location: true } } },
      });
      if (!appointment) {
        return { type: 'EMPTY_STATE' as const, message: 'You do not currently have an upcoming appointment.', data: {}, route: '/donor/appointments' };
      }
      return {
        type: 'ANSWER' as const,
        message: `Your next appointment is ${appointment.appointmentReference} at ${formatHospitalDisplayName(appointment.hospital.hospitalName)} on ${appointment.scheduledAt.toLocaleString()}.`,
        data: {
          appointmentId: appointment.id,
          appointmentReference: appointment.appointmentReference,
          hospitalName: formatHospitalDisplayName(appointment.hospital.hospitalName),
          scheduledAt: appointment.scheduledAt,
          status: appointment.status,
        },
        route: '/donor/appointments',
      };
    }

    if (intent === 'DONOR_DONATION_HISTORY') {
      const count = await this.prisma.donation.count({ where: { donorId: donor.id } });
      return {
        type: count ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: count ? `${count} completed donation record${count === 1 ? '' : 's'} are linked to your donor profile.` : 'No completed donations are recorded yet.',
        data: { donationCount: count },
        route: '/donor/history',
      };
    }

    if (intent === 'DONOR_NOTIFICATION_COUNT') {
      const unread = await this.prisma.notification.count({ where: { userId, isRead: false } });
      return {
        type: 'ANSWER' as const,
        message: unread ? `You have ${unread} unread notification${unread === 1 ? '' : 's'}.` : 'You have no unread notifications right now.',
        data: { unreadNotifications: unread },
        route: '/donor/notifications',
      };
    }

    return null;
  }

  private async answerHospital(intent: AssistantIntent, userId: string, bloodGroup?: BloodGroup) {
    const hospital = await this.hospitalAccess.getHospitalForUser(userId);
    const warningWhere = { hospitalId: hospital.id, ...(bloodGroup ? { bloodGroup } : {}) };

    if (intent === 'HOSPITAL_CRITICAL_GROUPS') {
      const critical = await this.prisma.bloodStockWarning.findMany({
        where: { ...warningWhere, level: 'CRITICAL' },
        select: { bloodGroup: true, currentUnits: true, explanation: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 8,
      });
      return {
        type: critical.length ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: critical.length
          ? `Critical blood groups: ${critical.map((item) => formatBloodGroup(item.bloodGroup)).join(', ')}.`
          : 'No blood groups are currently classified as critical.',
        data: { hospitalName: formatHospitalDisplayName(hospital.hospitalName), critical },
        route: '/hospital/stock-intelligence',
      };
    }

    if (intent === 'HOSPITAL_STOCK_STATUS') {
      const inventory = await this.prisma.inventoryItem.findMany({
        where: { hospitalId: hospital.id, ...(bloodGroup ? { bloodGroup } : {}) },
        select: { bloodGroup: true, availableUnits: true, expiringUnits: true, lowThreshold: true, criticalThreshold: true, lastUpdated: true },
        orderBy: { bloodGroup: 'asc' },
      });
      const totalUnits = inventory.reduce((sum, item) => sum + item.availableUnits, 0);
      return {
        type: inventory.length ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: inventory.length ? `${formatHospitalDisplayName(hospital.hospitalName)} currently has ${totalUnits} total blood unit(s) recorded.` : 'No inventory records are available for your hospital yet.',
        data: { hospitalName: formatHospitalDisplayName(hospital.hospitalName), totalUnits, inventory },
        route: '/hospital/inventory',
      };
    }

    if (intent === 'HOSPITAL_TODAY_APPOINTMENTS') {
      const count = await this.prisma.appointment.count({
        where: { hospitalId: hospital.id, scheduledAt: { gte: startOfToday(), lte: endOfToday() } },
      });
      return {
        type: count ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: count ? `${count} appointment${count === 1 ? '' : 's'} are scheduled for today.` : 'No appointments are scheduled for today.',
        data: { todayAppointments: count, hospitalName: formatHospitalDisplayName(hospital.hospitalName) },
        route: '/hospital/appointments',
      };
    }

    if (intent === 'HOSPITAL_OPEN_REQUESTS') {
      const count = await this.prisma.bloodRequest.count({
        where: { hospitalId: hospital.id, type: RequestType.EMERGENCY, status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] } },
      });
      return {
        type: count ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: count ? `${count} open emergency request${count === 1 ? '' : 's'} are linked to your hospital.` : 'There are no open emergency requests.',
        data: { openEmergencyRequests: count, hospitalName: formatHospitalDisplayName(hospital.hospitalName) },
        route: '/hospital/active-requests',
      };
    }

    if (intent === 'HOSPITAL_EXPIRING_UNITS') {
      const rows = await this.prisma.inventoryItem.findMany({ where: { hospitalId: hospital.id }, select: { bloodGroup: true, expiringUnits: true } });
      const expiringUnits = rows.reduce((sum, item) => sum + item.expiringUnits, 0);
      return {
        type: expiringUnits ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: expiringUnits ? `${expiringUnits} blood unit(s) are marked as expiring soon.` : 'No expiring blood units are currently recorded.',
        data: { expiringUnits, byBloodGroup: rows },
        route: '/hospital/stock-intelligence',
      };
    }

    if (intent === 'HOSPITAL_AVAILABLE_DONORS') {
      const count = await this.prisma.donor.count({ where: { eligibilityStatus: true, availabilityStatus: true } });
      return {
        type: 'ANSWER' as const,
        message: `${count} approved available donor${count === 1 ? '' : 's'} are visible for compatible matching workflows.`,
        data: { availableApprovedDonors: count },
        route: '/hospital/donor-search',
      };
    }

    if (intent === 'HOSPITAL_AI_EXPLANATION') {
      const recommendation = await this.prisma.aiRecommendation.findFirst({
        where: { hospitalId: hospital.id },
        orderBy: { createdAt: 'desc' },
        select: { bloodGroup: true, riskLevel: true, confidenceLevel: true, suggestedAction: true, reasonsJson: true, createdAt: true },
      });
      if (!recommendation) {
        return { type: 'EMPTY_STATE' as const, message: 'No active AI recommendation is available for your hospital.', data: {}, route: '/hospital/ai-intelligence' };
      }
      return {
        type: 'ANSWER' as const,
        message: `Latest AI recommendation: ${recommendation.suggestedAction ?? 'Review stock risk details.'}`,
        data: recommendation,
        route: '/hospital/ai-intelligence',
      };
    }

    if (intent === 'HOSPITAL_RECENT_ALERTS') {
      const alerts = await this.prisma.notification.findMany({
        where: { userId },
        select: { id: true, title: true, createdAt: true, isRead: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      return {
        type: alerts.length ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: alerts.length ? `Here are the latest ${alerts.length} alert or notification item(s).` : 'No recent alerts are available.',
        data: { alerts },
        route: '/hospital/notifications',
      };
    }

    return null;
  }

  private async answerAdmin(intent: AssistantIntent) {
    if (intent === 'ADMIN_HOSPITALS_REQUIRING_ATTENTION' || intent === 'ADMIN_SYSTEM_CRITICAL_GROUPS') {
      const critical = await this.prisma.bloodStockWarning.findMany({
        where: { level: 'CRITICAL' },
        select: { hospitalId: true, bloodGroup: true, currentUnits: true, createdAt: true, hospital: { select: { hospitalName: true } } },
        orderBy: { createdAt: 'desc' },
        take: 10,
      });
      const hospitalCount = new Set(critical.map((item) => item.hospitalId)).size;
      return {
        type: critical.length ? 'ANSWER' as const : 'EMPTY_STATE' as const,
        message: critical.length ? `${hospitalCount} hospital${hospitalCount === 1 ? '' : 's'} currently have critical blood-group warnings.` : 'No system-wide critical blood-group warnings are currently recorded.',
        data: { hospitalCount, critical },
        route: '/admin/management?section=ai-intelligence',
      };
    }

    if (intent === 'ADMIN_OPEN_REQUESTS') {
      const count = await this.prisma.bloodRequest.count({ where: { status: { in: [RequestStatus.OPEN, RequestStatus.MATCHING] } } });
      return { type: 'ANSWER' as const, message: `${count} open request${count === 1 ? '' : 's'} are currently in the system.`, data: { openRequests: count }, route: '/admin/management?section=request-tracking' };
    }

    if (intent === 'ADMIN_DONOR_TOTALS') {
      const [total, approved] = await Promise.all([
        this.prisma.donor.count(),
        this.prisma.donor.count({ where: { eligibilityStatus: true } }),
      ]);
      return { type: 'ANSWER' as const, message: `${total} donor profile${total === 1 ? '' : 's'} are registered; ${approved} are currently marked approved in the system.`, data: { total, approved }, route: '/admin/management?section=donors' };
    }

    if (intent === 'ADMIN_HOSPITAL_TOTALS') {
      const [total, approved] = await Promise.all([
        this.prisma.hospital.count(),
        this.prisma.hospital.count({ where: { isApproved: true } }),
      ]);
      return { type: 'ANSWER' as const, message: `${approved} of ${total} hospital profile${total === 1 ? '' : 's'} are approved.`, data: { total, approved }, route: '/admin/management?section=hospitals' };
    }

    if (intent === 'ADMIN_AI_HISTORY') {
      const count = await this.prisma.aiRecommendation.count();
      return { type: count ? 'ANSWER' as const : 'EMPTY_STATE' as const, message: count ? `${count} AI recommendation record${count === 1 ? '' : 's'} are available in history.` : 'No AI recommendation history is available yet.', data: { count }, route: '/admin/management?section=ai-intelligence' };
    }

    if (intent === 'ADMIN_RECENT_AUDIT_ACTIVITY') {
      const rows = await this.prisma.auditLog.findMany({
        select: { id: true, action: true, module: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
        take: 5,
      });
      return { type: rows.length ? 'ANSWER' as const : 'EMPTY_STATE' as const, message: rows.length ? `Here are the latest ${rows.length} audit event summaries.` : 'No audit activity is available yet.', data: { audit: rows }, route: '/admin/management?section=audit' };
    }

    return null;
  }
}
