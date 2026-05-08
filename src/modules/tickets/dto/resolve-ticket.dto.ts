import { ApiProperty } from '@nestjs/swagger';
import { Allow, IsIn, IsNotEmpty, IsString } from 'class-validator';
import { TicketAction } from '@prisma/client';

export class ResolveTicketDto {
  @ApiProperty({
    enum: [TicketAction.tenant_left, TicketAction.tenant_stays],
    description:
      'tenant_stays = khách còn ở; tenant_left = khách không ở nữa/hủy hợp đồng',
    example: TicketAction.tenant_stays,
  })
  @IsIn([TicketAction.tenant_left, TicketAction.tenant_stays])
  action: TicketAction;

  @ApiProperty({
    description: 'Ghi chú xác nhận của staff',
    example: 'Khách còn ở, gia hạn 3 ngày để thanh toán.',
  })
  @IsString()
  @IsNotEmpty()
  note: string;
}

export class ResolveTicketRequestDto extends ResolveTicketDto {
  @ApiProperty({
    type: 'array',
    items: { type: 'string', format: 'binary' },
    description: 'Ảnh bằng chứng bắt buộc, upload file JPEG/PNG/WebP',
  })
  @Allow()
  images: any[];
}
