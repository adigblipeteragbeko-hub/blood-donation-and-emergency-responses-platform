import { IsEmail, IsOptional, IsPhoneNumber, IsString, IsUrl, MaxLength } from 'class-validator';

export class UpdateFooterSettingsDto {
  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'emergencyPhonePrimary must be a valid international phone number' })
  emergencyPhonePrimary?: string;

  @IsOptional()
  @IsPhoneNumber(undefined, { message: 'emergencyPhoneSecondary must be a valid international phone number' })
  emergencyPhoneSecondary?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(120)
  supportEmail?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  facebookUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  instagramUrl?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkedinUrl?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  footerText?: string;
}
