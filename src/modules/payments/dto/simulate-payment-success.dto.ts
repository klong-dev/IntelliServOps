import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

export class SimulatePaymentSuccessDto {
  @ApiPropertyOptional({
    description: 'Optional mock transaction id for simulated payment success',
    example: 'MOCK-TX-20260330-001',
  })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  transactionId?: string;
}
