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

  @ApiPropertyOptional({ type: String, nullable: true })
  entityType: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  entityId: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  description: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  changes: any;

  @ApiPropertyOptional({ type: String, nullable: true })
  ipAddress: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  userAgent: string | null;

  @ApiPropertyOptional({ type: String, nullable: true })
  requestId: string | null;

  @ApiProperty({ example: 'success' })
  status: string;

  @ApiPropertyOptional({ type: String, nullable: true })
  errorMessage: string | null;

  @ApiPropertyOptional({ type: Object, nullable: true })
  metadata: any;

  @ApiProperty()
  createdAt: Date;
}
