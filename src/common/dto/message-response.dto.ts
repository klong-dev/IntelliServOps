import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ─── JSON:API Meta DTO ──────────────────────────────────────────────

export class PaginationMetaDto {
  @ApiProperty({ example: 25 })
  total: number;

  @ApiProperty({ example: 1 })
  page: number;

  @ApiProperty({ example: 10 })
  limit: number;

  @ApiProperty({ example: 3 })
  totalPages: number;
}

export class ResponseMetaDto {
  @ApiProperty({ example: '2026-02-26T10:21:00.000Z' })
  timestamp: string;

  @ApiPropertyOptional({ type: PaginationMetaDto })
  pagination?: PaginationMetaDto;
}

// ─── JSON:API Wrapper DTO (for Swagger docs) ────────────────────────

/**
 * Base JSON:API response wrapper.
 * All successful responses are wrapped: { statusCode, message, data, meta }
 */
export class JsonApiResponseDto<T = any> {
  @ApiProperty({ example: 200 })
  statusCode: number;

  @ApiProperty({ example: 'Success' })
  message: string;

  @ApiProperty()
  data: T;

  @ApiProperty({ type: ResponseMetaDto })
  meta: ResponseMetaDto;
}

// ─── Simple Message Response ────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
