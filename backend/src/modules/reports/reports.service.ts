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

    const [bloodStock, donations, requests, emergencies] = await Promise.all([
      this.prisma.inventoryItem.groupBy({ by: ['bloodGroup'], _sum: { availableUnits: true } }),
      this.prisma.donation.count({ where }),
      this.prisma.bloodRequest.count({ where }),
      this.prisma.bloodRequest.count({ where: { ...where, type: 'EMERGENCY' } }),
    ]);

    return {
      bloodStock,
      donationActivity: { totalDonations: donations },
      requestFulfillment: { totalRequests: requests },
      emergencyResponse: { totalEmergencyRequests: emergencies },
    };
  }
}
