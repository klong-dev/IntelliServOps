import { PartialType } from '@nestjs/swagger';
import { CreatePolicyDto } from './create-policy.dto';
import { IsBoolean, IsOptional } from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';

export class UpdatePolicyDto extends PartialType(CreatePolicyDto) {
  @ApiPropertyOptional({
    description: 'Kích hoạt hoặc vô hiệu hóa chính sách',
  })
  @IsBoolean()
  @IsOptional()
  isActive?: boolean;
}
