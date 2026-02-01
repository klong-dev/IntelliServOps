import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { PaymentsService } from './payments.service';
import { CreatePaymentDto } from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PaymentStatus } from '@prisma/client';

@ApiTags('Payments')
@ApiBearerAuth()
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get payment details' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.findOne(id, currentUser);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Create payment' })
  @ApiResponse({ status: 201, description: 'Payment created' })
  async create(
    @Body() createDto: CreatePaymentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.create(createDto, currentUser);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Confirm payment' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { transactionId?: string },
  ) {
    return this.paymentsService.confirm(id, body.transactionId);
  }

  @Post('webhook/payos')
  @Public()
  @ApiOperation({ summary: 'PayOS webhook endpoint' })
  async payosWebhook(@Body() webhookData: any) {
    return this.paymentsService.handlePayOSWebhook(webhookData);
  }
}
