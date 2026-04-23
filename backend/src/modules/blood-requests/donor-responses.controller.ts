import { Body, Controller, Param, Patch, UseGuards } from '@nestjs/common';
import { Role } from '@prisma/client';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Roles } from '../../common/decorators/roles.decorator';
import { ActiveUserGuard } from '../../common/guards/active-user.guard';
import { JwtAccessGuard } from '../auth/guards/jwt-access.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { BloodRequestsService } from './blood-requests.service';
import { UpdateDonorResponseDto } from './dto/update-donor-response.dto';

@UseGuards(JwtAccessGuard, ActiveUserGuard, RolesGuard)
@Controller('donor-responses')
export class DonorResponsesController {
  constructor(private readonly bloodRequestsService: BloodRequestsService) {}

  @Roles(Role.ADMIN, Role.HOSPITAL_STAFF)
  @Patch(':id')
  update(
    @Param('id') id: string,
    @CurrentUser() user: { id: string; role: Role },
    @Body() dto: UpdateDonorResponseDto,
  ) {
    return this.bloodRequestsService.updateDonorResponse(id, user.id, user.role, dto);
  }
}

