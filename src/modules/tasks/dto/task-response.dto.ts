import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Task List Item DTO (findAll) ───────────────────────────────────

export class TaskListItemDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'Check HVAC unit in A101' })
  title: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ example: 'maintenance' })
  taskType: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedToStaffId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedByOperatorId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apartmentId: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
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

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiProperty({ example: 'maintenance' })
  taskType: string;

  @ApiProperty({ example: 'medium' })
  priority: string;

  @ApiProperty({ example: 'pending' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedToStaffId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  assignedByOperatorId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  apartmentId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  relatedEntityType: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  relatedEntityId: string | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  scheduledDate: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  scheduledTime: Date | null;

  @ApiPropertyOptional({ type: Number, nullable: true })
  estimatedDurationMins: number | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  actualStartTime: Date | null;

  @ApiPropertyOptional({ type: Date, nullable: true })
  actualEndTime: Date | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  completionNotes: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  attachments: any;

  @ApiProperty()
  requiresFollowup: boolean;

  @ApiPropertyOptional({ type: Date, nullable: true })
  followupDate: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}
