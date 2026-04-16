import { IsEnum } from 'class-validator';
import { RequestStatus } from '@prisma/client';

export class UpdateBloodRequestStatusDto {
  @IsEnum(RequestStatus)
  status!: RequestStatus;
}
