import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ReportFilterDto } from './dto/report-filter.dto';

@Injectable()
export class ReportsService {
  constructor(private readonly prisma: PrismaService) {}

  private getDateFilter(filter: ReportFilterDto) {
    const createdAt: { gte?: Date; lte?: Date } = {};

    if (filter.from) {
      createdAt.gte = new Date(filter.from);
    }
    if (filter.to) {
      createdAt.lte = new Date(filter.to);
    }

    return Object.keys(createdAt).length ? { createdAt } : {};
  }

  async summary(filter: ReportFilterDto) {
    const where = this.getDateFilter(filter);
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const [bloodStock, donations, requests, emergencies, demandByGroup, acceptedResponses, emergencyCompleted] = await Promise.all([
      this.prisma.inventoryItem.groupBy({ by: ['bloodGroup'], _sum: { availableUnits: true } }),
      this.prisma.donation.count({ where }),
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.count({ where: { ...where, type: 'EMERGENCY' } }),
      this.prisma.bloodRequest.groupBy({
        by: ['bloodGroup'],
        where: { createdAt: { gte: thirtyDaysAgo } },
        _count: { _all: true },
      }),
      this.prisma.donorResponse.count({
        where: { responseStatus: 'ACCEPTED', ...(where as object) },
      }),
      this.prisma.bloodRequest.count({
        where: { type: 'EMERGENCY', trackingStatus: 'COMPLETED', ...(where as object) },
      }),
    ]);

    const stockByGroup = new Map(bloodStock.map((item) => [item.bloodGroup, item._sum.availableUnits ?? 0]));
    const totalRecentDemand = demandByGroup.reduce((sum, item) => sum + item._count._all, 0);
    const projected7DayDemand = Math.ceil((totalRecentDemand / 30) * 7);
    const shortageRisk = demandByGroup.map((item) => {
      const currentStock = stockByGroup.get(item.bloodGroup) ?? 0;
      const ratio = currentStock === 0 ? item._count._all : item._count._all / currentStock;
      const riskLevel = currentStock === 0 || ratio >= 2 ? 'CRITICAL' : ratio >= 1 ? 'HIGH' : ratio >= 0.5 ? 'MEDIUM' : 'LOW';
      return {
        bloodGroup: item.bloodGroup,
        recentRequests: item._count._all,
        currentStock,
        riskLevel,
      };
    });

    return {
      bloodStock,
      donationActivity: { totalDonations: donations },
      requestFulfillment: { totalRequests: requests },
      emergencyResponse: { totalEmergencyRequests: emergencies },
      predictiveAnalytics: {
        windowDays: 30,
        projected7DayDemand,
        shortageRisk,
      },
      operationalKpis: {
        acceptedDonorResponses: acceptedResponses,
        emergencyFulfillmentRate: emergencies === 0 ? 0 : Number(((emergencyCompleted / emergencies) * 100).toFixed(2)),
      },
    };
  }
}
