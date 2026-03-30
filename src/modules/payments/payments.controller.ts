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
  CreatePayOSPaymentLinkDto,
  PaymentListItemDto,
  PaymentDetailDto,
  PaymentCreatedDto,
  PayOSPaymentLinkCreatedDto,
} from './dto';
import { SimulatePaymentSuccessDto } from './dto/simulate-payment-success.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { PaymentStatus } from '@prisma/client';
import type { Webhook } from '@payos/node/lib/resources';

@ApiTags('Payments')
@ApiBearerAuth('JWT-auth')
@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List payments' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'invoiceId', required: false, type: String })
  @ApiJsonResponse(PaymentListItemDto, {
    isArray: true,
    description: 'List of payments',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: PaymentStatus,
    @Query('invoiceId') invoiceId?: string,
  ) {
    return this.paymentsService.findAll(currentUser, status, invoiceId);
  }

  @Get('invoice/:invoiceId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get payments by invoice ID' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiJsonResponse(PaymentListItemDto, {
    isArray: true,
    description:
      'Payments of a specific invoice (includes pending synthetic entry if unpaid)',
  })
  async findByInvoiceId(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: PaymentStatus,
  ) {
    return this.paymentsService.findByInvoiceId(invoiceId, currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get payment details' })
  @ApiJsonResponse(PaymentDetailDto, { description: 'Payment details' })
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
  @ApiJsonResponse(PaymentCreatedDto, {
    status: 201,
    description: 'Payment created',
  })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async create(
    @Body() createDto: CreatePaymentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.create(createDto, currentUser);
  }

  @Post('payos/create-link')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Create PayOS hosted checkout link from invoice' })
  @ApiJsonResponse(PayOSPaymentLinkCreatedDto, {
    status: 201,
    description: 'PayOS payment link created',
  })
  async createPayOSPaymentLink(
    @Body() createDto: CreatePayOSPaymentLinkDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.createPayOSPayment(createDto, currentUser);
  }

  @Post('invoice/:invoiceId/mock-success')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Simulate successful payment by invoice ID',
    description:
      'Bypass PayOS and mark the invoice payment as successful for testing/development flows.',
  })
  @ApiJsonResponse(PaymentDetailDto, {
    description: 'Payment marked successful and invoice updated to paid',
  })
  simulateSuccessByInvoice(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @Body() body: SimulatePaymentSuccessDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.paymentsService.simulateSuccessByInvoice(
      invoiceId,
      currentUser,
      body.transactionId,
    );
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
  @Public()
  @ApiOperation({ summary: 'PayOS webhook' })
  @ApiResponse({ status: 200, description: 'Webhook processed' })
  async handlePayOSWebhook(@Body() body: Webhook) {
    return this.paymentsService.handlePayOSWebhook(body);
  }
}
