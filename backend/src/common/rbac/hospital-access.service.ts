import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { Hospital, Prisma, Role } from '@prisma/client';
import { PrismaService } from '../../prisma.service';

type HospitalWithMembership = Hospital & {
  user: { id: string; role: Role };
};

@Injectable()
export class HospitalAccessService {
  constructor(private readonly prisma: PrismaService) {}

  async getHospitalForUser(userId: string): Promise<HospitalWithMembership> {
    const directHospital = await this.prisma.hospital.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            role: true,
          },
        },
      },
    });

    if (directHospital) {
      return directHospital as HospitalWithMembership;
    }

    throw new NotFoundException('Hospital profile not found for this account');
  }

  async assertHospitalAccess(hospitalId: string, userId: string, role: Role) {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return;
    }

    const hospital = await this.getHospitalForUser(userId);
    if (hospital.id !== hospitalId) {
      throw new ForbiddenException('You do not have access to this hospital resource');
    }
  }

  buildHospitalScope(userId: string, role: Role): Prisma.BloodRequestWhereInput | undefined {
    if (role === Role.ADMIN || role === Role.SUPER_ADMIN) {
      return undefined;
    }

    return {
      hospital: {
        userId,
      },
    };
  }
}
