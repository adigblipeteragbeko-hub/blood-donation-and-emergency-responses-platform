import { BloodGroup } from '@prisma/client';
import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const EmptyStringToNull = () => Transform(({ value }) => (value === '' ? null : value));

export class HealthAnswerDto {
  @IsString()
  questionKey!: string;

  @IsString()
  questionText!: string;

  @IsBoolean()
  answer!: boolean;

  @IsOptional()
  @IsString()
  details?: string;
}

export class UpsertDonorClinicalDraftDto {
  @IsOptional()
  @IsString()
  selectedHospitalId?: string;

  @IsOptional()
  @EmptyStringToNull()
  @IsDateString()
  formDate?: string | null;

  @IsOptional()
  @IsString()
  venue?: string;

  @IsOptional()
  @IsIn(['Mr', 'Mrs', 'Ms', 'Dr', 'Prof', 'Other', ''])
  title?: string;

  @IsOptional()
  @IsString()
  firstName?: string;

  @IsOptional()
  @IsString()
  otherNames?: string;

  @IsOptional()
  @IsString()
  lastName?: string;

  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @IsOptional()
  @IsIn(['Male', 'Female', ''])
  sex?: string;

  @IsOptional()
  @IsString()
  areaOfResidence?: string;

  @IsOptional()
  @IsString()
  addressOrWorkplace?: string;

  @IsOptional()
  @IsString()
  occupation?: string;

  @IsOptional()
  @IsString()
  idType?: string;

  @IsOptional()
  @IsString()
  idNumber?: string;

  @IsOptional()
  @IsString()
  phoneNumber?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @IsString()
  preferredContactMethod?: string;

  @IsOptional()
  @IsBoolean()
  doNotContactForDonation?: boolean;

  @IsOptional()
  @IsIn(['VOLUNTARY', 'REPLACEMENT_FAMILY'])
  donorType?: string;

  @IsOptional()
  @IsBoolean()
  hasDonatedBefore?: boolean;

  @IsOptional()
  @EmptyStringToNull()
  @IsDateString()
  lastDonationDate?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  numberOfVoluntaryDonations?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  numberOfReplacementDonations?: number;

  @IsOptional()
  @IsString()
  donorCardNumber?: string;

  @IsOptional()
  @IsString()
  patientName?: string;

  @IsOptional()
  @IsString()
  patientHospital?: string;

  @IsOptional()
  @IsString()
  requestReference?: string;

  @IsOptional()
  @IsString()
  ward?: string;

  @IsOptional()
  @IsString()
  relationshipToPatient?: string;

  @IsOptional()
  @IsString()
  clerkingOfficerName?: string;

  @IsOptional()
  @IsString()
  clerkingOfficerSignature?: string;

  @IsOptional()
  @ValidateNested({ each: true })
  @Type(() => HealthAnswerDto)
  healthAnswers?: HealthAnswerDto[];

  @IsOptional()
  @IsBoolean()
  declarationConfirmed?: boolean;

  @IsOptional()
  @IsBoolean()
  testingConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  contactConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  staffEligibilityConsent?: boolean;

  @IsOptional()
  @IsBoolean()
  dataUseConsent?: boolean;

  @IsOptional()
  @EmptyStringToNull()
  @IsDateString()
  declarationDate?: string | null;

}

export class ReviewQueueQueryDto {
  @IsOptional()
  @IsString()
  status?: string;

  @IsOptional()
  @IsString()
  search?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  skip?: number = 0;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  take?: number = 30;
}

export class UpdateClinicalReviewDto {
  @IsOptional()
  @IsString()
  reviewNotes?: string;

  @IsOptional()
  @IsString()
  status?: string;
}

export class OfficeUseDto {
  @IsOptional()
  @IsEnum(BloodGroup)
  confirmedBloodGroup?: BloodGroup;

  @IsOptional()
  @IsIn(['PASSED', 'FAILED'])
  appearancePassed?: 'PASSED' | 'FAILED';

  @IsOptional()
  @IsIn(['PASSED', 'FAILED'])
  medicalHistoryPassed?: 'PASSED' | 'FAILED';

  @IsOptional()
  @IsNumber()
  @Min(30)
  @Max(250)
  weightKg?: number;

  @IsOptional()
  @IsString()
  bloodPressure?: string;

  @IsOptional()
  @IsInt()
  @Min(30)
  @Max(220)
  pulseBpm?: number;

  @IsOptional()
  @IsNumber()
  @Min(3)
  @Max(25)
  haemoglobinLevel?: number;

  @IsOptional()
  @IsIn(['PASSED', 'FAILED'])
  hbByCuSO4Passed?: 'PASSED' | 'FAILED';

  @IsOptional()
  @IsIn(['YES', 'NO'])
  hbSagChecked?: 'YES' | 'NO';

  @IsOptional()
  @IsString()
  hbSagResult?: string;

  @IsOptional()
  @IsIn(['YES', 'NO'])
  qualifiesToDonate?: 'YES' | 'NO';

  @IsOptional()
  @IsIn(['QUALIFIED', 'TEMPORARILY_DEFERRED', 'PERMANENTLY_DEFERRED', 'REJECTED'])
  outcomeOfScreening?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  permanentDeferralReasons?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  temporaryDeferralReasons?: string[];

  @IsOptional()
  @IsString()
  temporaryDeferralDuration?: string;

  @IsOptional()
  @IsString()
  comments?: string;

  @IsOptional()
  @IsString()
  nurseName?: string;
}

