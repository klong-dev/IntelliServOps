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
import {
  CreatePaymentDto,
  PaymentListItemDto,
  PaymentDetailDto,
  PaymentCreatedDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
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
  @ApiResponse({ status: 200, description: 'List of payments', type: [PaymentListItemDto] })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get payment details' })
  @ApiResponse({ status: 200, description: 'Payment details', type: PaymentDetailDto })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.findOne(id, currentUser);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Create payment' })
  @ApiResponse({ status: 201, description: 'Payment created', type: PaymentCreatedDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async create(
    @Body() createDto: CreatePaymentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.create(createDto, currentUser);
  }

  @Post(':id/confirm')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Confirm payment' })
  @ApiResponse({ status: 200, description: 'Payment confirmed' })
  @ApiResponse({ status: 404, description: 'Payment not found' })
  async confirm(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { transactionId?: string },
  ) {
    return this.paymentsService.confirm(id, body.transactionId);
  }

  @Post('webhook/payos')
  @ApiOperation({ summary: 'PayOS webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePayOSWebhook(@Body() body: any) {
    return this.paymentsService.handlePayOSWebhook(body);
  }
}
