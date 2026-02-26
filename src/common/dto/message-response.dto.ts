import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { applyDecorators, Type } from '@nestjs/common';
import { ApiOkResponse, ApiCreatedResponse, getSchemaPath, ApiExtraModels } from '@nestjs/swagger';

// ─── Meta DTOs ──────────────────────────────────────────────────────

export class ResponseMetaDto {
  @ApiProperty({ example: '2026-02-26T10:21:00.000Z' })
  timestamp: string;

  @ApiPropertyOptional({ type: Number, example: 25 })
  total?: number;

  @ApiPropertyOptional({ type: Number, example: 1 })
  page?: number;

  @ApiPropertyOptional({ type: Number, example: 10 })
  limit?: number;

  @ApiPropertyOptional({ type: Number, example: 3 })
  totalPages?: number;
}

// ─── Swagger Helpers ────────────────────────────────────────────────

/**
 * Wraps a DTO in the JSON:API envelope for Swagger documentation.
 * Usage: @ApiJsonResponse(ApartmentDetailDto)
 *        @ApiJsonResponse(ApartmentListItemDto, { isArray: true })
 *        @ApiJsonResponse(ApartmentListItemDto, { isArray: true, isPaginated: true })
 */
export function ApiJsonResponse(
  dataDto: Type<any>,
  options?: { isArray?: boolean; isPaginated?: boolean; status?: number; description?: string },
) {
  const isArray = options?.isArray ?? false;
  const isPaginated = options?.isPaginated ?? false;
  const status = options?.status ?? 200;
  const description = options?.description ?? 'Successful response';

  const dataSchema = isArray
    ? { type: 'array', items: { $ref: getSchemaPath(dataDto) } }
    : { $ref: getSchemaPath(dataDto) };

  const metaProperties: Record<string, any> = {
    timestamp: { type: 'string', example: '2026-02-26T10:21:00.000Z' },
  };

  if (isPaginated) {
    metaProperties.total = { type: 'number', example: 25 };
    metaProperties.page = { type: 'number', example: 1 };
    metaProperties.limit = { type: 'number', example: 10 };
    metaProperties.totalPages = { type: 'number', example: 3 };
  }

  const schema = {
    properties: {
      statusCode: { type: 'number', example: status },
      message: { type: 'string', example: 'Success' },
      data: dataSchema,
      meta: {
        type: 'object',
        properties: metaProperties,
      },
    },
  };

  const responseDecorator =
    status === 201
      ? ApiCreatedResponse({ description, schema })
      : ApiOkResponse({ description, schema });

  return applyDecorators(ApiExtraModels(dataDto), responseDecorator);
}

// ─── Simple Message Response ────────────────────────────────────────

export class MessageResponseDto {
  @ApiProperty({ example: 'Operation completed successfully' })
  message: string;
}
