import { BloodGroup, HospitalRequestResponseStatus, HospitalRequestResponseType } from '@prisma/client';
import { IsEnum, IsInt, IsOptional, IsString, Min } from 'class-validator';

export class RespondToHospitalRequestDto {
  @IsEnum(HospitalRequestResponseType)
  responseType!: HospitalRequestResponseType;

  @IsOptional()
  @IsInt()
  @Min(1)
  unitsOffered?: number;

  @IsOptional()
  @IsEnum(BloodGroup)
  bloodGroupOffered?: BloodGroup;

  @IsOptional()
  @IsString()
  note?: string;
}

export class UpdateHospitalRequestResponseStatusDto {
  @IsEnum(HospitalRequestResponseStatus)
  status!: HospitalRequestResponseStatus;
}

export class DispatchHospitalBloodTransferDto {
  @IsInt()
  @Min(1)
  units!: number;

  @IsOptional()
  @IsString()
  dispatchNote?: string;

  @IsOptional()
  @IsString()
  dispatchReference?: string;
}

export class ReceiveHospitalBloodTransferDto {
  @IsInt()
  @Min(1)
  units!: number;

  @IsOptional()
  @IsString()
  receivedNote?: string;

  @IsOptional()
  @IsString()
  receivedCondition?: string;
}
