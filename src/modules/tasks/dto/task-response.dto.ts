import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Task List Item DTO (findAll) ───────────────────────────────────

export class TaskListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Check HVAC unit in A101' })
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 'maintenance' })
  taskType: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  assignedToStaffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedByOperatorId: string | null;

  @ApiPropertyOptional({ nullable: true })
  apartmentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

// ─── Task Detail DTO (findOne) ──────────────────────────────────────

export class TaskDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Check HVAC unit in A101' })
  title: string;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiProperty({ example: 'maintenance' })
  taskType: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  assignedToStaffId: string | null;

  @ApiPropertyOptional({ nullable: true })
  assignedByOperatorId: string | null;

  @ApiPropertyOptional({ nullable: true })
  apartmentId: string | null;

  @ApiPropertyOptional({ nullable: true })
  relatedEntityType: string | null;

  @ApiPropertyOptional({ nullable: true })
  relatedEntityId: string | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledDate: Date | null;

  @ApiPropertyOptional({ nullable: true })
  scheduledTime: Date | null;

  @ApiPropertyOptional({ nullable: true })
  estimatedDurationMins: number | null;

  @ApiPropertyOptional({ nullable: true })
  actualStartTime: Date | null;

  @ApiPropertyOptional({ nullable: true })
  actualEndTime: Date | null;

  @ApiPropertyOptional({ nullable: true })
  completionNotes: string | null;

  @ApiPropertyOptional({ nullable: true })
  attachments: any;

  @ApiProperty()
  requiresFollowup: boolean;

  @ApiPropertyOptional({ nullable: true })
  followupDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
