import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── Activity Log Response DTO ──────────────────────────────────────

export class ActivityLogResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty({ example: 'user' })
  actorType: string;

  @ApiProperty()
  actorId: string;

  @ApiProperty({ example: 'login' })
  action: string;

  @ApiPropertyOptional({ nullable: true })
  entityType: string | null;

  @ApiPropertyOptional({ nullable: true })
  entityId: string | null;

  @ApiPropertyOptional({ nullable: true })
  description: string | null;

  @ApiPropertyOptional({ nullable: true })
  changes: any;

  @ApiPropertyOptional({ nullable: true })
  ipAddress: string | null;

  @ApiPropertyOptional({ nullable: true })
  userAgent: string | null;

  @ApiPropertyOptional({ nullable: true })
  requestId: string | null;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiPropertyOptional({ nullable: true })
  errorMessage: string | null;

  @ApiPropertyOptional({ nullable: true })
  metadata: any;

  @ApiProperty()
  createdAt: Date;
}
