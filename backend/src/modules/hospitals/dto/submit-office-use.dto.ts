import { IsObject } from 'class-validator';

export class SubmitOfficeUseDto {
  @IsObject()
  officeUseOnly!: Record<string, unknown>;
}

