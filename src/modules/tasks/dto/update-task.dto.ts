import { PartialType, OmitType } from '@nestjs/swagger';
import { CreateTaskDto } from './create-task.dto';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { TaskStatus } from '@prisma/client';

export class UpdateTaskDto extends PartialType(
  OmitType(CreateTaskDto, ['relatedEntityType', 'relatedEntityId'] as const),
) {
  @ApiPropertyOptional({ enum: TaskStatus })
  @IsEnum(TaskStatus)
  @IsOptional()
  status?: TaskStatus;

  @ApiPropertyOptional({ description: 'Completion notes' })
  @IsString()
  @IsOptional()
  completionNotes?: string;
}
