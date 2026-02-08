import {
  IsString,
  IsOptional,
  IsEnum,
  IsUUID,
  MaxLength,
  IsObject,
} from 'class-validator';
import { ActorType, ActivityStatus } from '@prisma/client';

export class CreateActivityLogDto {
  @IsEnum(ActorType)
  actorType: ActorType;

  @IsUUID()
  actorId: string;

  @IsString()
  @MaxLength(100)
  action: string;

  @IsString()
  @IsOptional()
  entityType?: string;

  @IsUUID()
  @IsOptional()
  entityId?: string;

  @IsString()
  @IsOptional()
  @MaxLength(2000)
  description?: string;

  @IsObject()
  @IsOptional()
  changes?: any;

  @IsString()
  @IsOptional()
  ipAddress?: string;

  @IsString()
  @IsOptional()
  userAgent?: string;

  @IsString()
  @IsOptional()
  requestId?: string;

  @IsEnum(ActivityStatus)
  @IsOptional()
  status?: ActivityStatus;

  @IsString()
  @IsOptional()
  errorMessage?: string;

  @IsObject()
  @IsOptional()
  metadata?: any;
}
