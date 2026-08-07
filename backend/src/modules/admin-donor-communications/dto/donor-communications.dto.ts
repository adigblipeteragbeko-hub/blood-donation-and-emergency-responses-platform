import { IsArray, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export type DonorCommunicationFilters = {
  search?: string;
  bloodGroup?: string;
  region?: string;
  city?: string;
  hospitalId?: string;
  eligibilityStatus?: string;
  accountStatus?: string;
  smsEnabled?: string | boolean;
  lastDonationFrom?: string;
  lastDonationTo?: string;
  neverDonated?: string | boolean;
  reminderDue?: string | boolean;
};

export class DonorContactsQueryDto {
  @IsOptional() @IsString() search?: string;
  @IsOptional() @IsString() bloodGroup?: string;
  @IsOptional() @IsString() region?: string;
  @IsOptional() @IsString() city?: string;
  @IsOptional() @IsString() hospitalId?: string;
  @IsOptional() @IsString() eligibilityStatus?: string;
  @IsOptional() @IsString() accountStatus?: string;
  @IsOptional() smsEnabled?: string;
  @IsOptional() @IsString() lastDonationFrom?: string;
  @IsOptional() @IsString() lastDonationTo?: string;
  @IsOptional() neverDonated?: string;
  @IsOptional() reminderDue?: string;
  @IsOptional() skip?: string;
  @IsOptional() take?: string;
}

export class ExportDonorContactsDto {
  @IsOptional()
  @IsArray()
  donorIds?: string[];

  @IsOptional()
  filters?: DonorCommunicationFilters;

  @IsOptional()
  @IsIn(['csv'])
  format?: 'csv';

  @IsArray()
  fields!: string[];
}

export class PreviewBulkSmsDto {
  @IsOptional()
  @IsArray()
  donorIds?: string[];

  @IsOptional()
  filters?: DonorCommunicationFilters;

  @IsString()
  @IsIn(['EXPLICIT', 'FILTERED'])
  selectionMode!: 'EXPLICIT' | 'FILTERED';

  @IsString()
  @MaxLength(480)
  message!: string;
}

export class LaunchSmsCampaignDto extends PreviewBulkSmsDto {
  @IsString()
  @MaxLength(120)
  name!: string;

  @IsString()
  confirmationText!: string;
}
