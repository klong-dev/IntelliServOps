import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  ParseUUIDPipe,
  UploadedFile,
  UseInterceptors,
  UsePipes,
  BadRequestException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { PaymentsService } from './payments.service';
import {
  CreatePayOSPaymentLinkDto,
  PaymentListItemDto,
  PaymentDetailDto,
  PayOSPaymentLinkCreatedDto,
  ListDuePartnerMonthlyPayoutsQueryDto,
  PartnerMonthlyPayoutItemDto,
  ConfirmPartnerMonthlyPayoutDto,
  ConfirmPartnerMonthlyPayoutResultDto,
} from './dto';
import { PaymentListQueryDto } from './dto/payment-list-query.dto';
import { SimulatePaymentSuccessDto } from './dto/simulate-payment-success.dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Public } from '../../common/decorators/public.decorator';
import { ApiJsonResponse } from '../../common/dto';
import { FileUploadPipe } from '../../common/pipes';
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
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(PaymentListItemDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated list of payments',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: PaymentListQueryDto,
  ) {
    return this.paymentsService.findAll(currentUser, query);
  }

  @Get('invoice/:invoiceId')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get payments by invoice ID' })
  @ApiQuery({ name: 'status', required: false, enum: PaymentStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(PaymentListItemDto, {
    isArray: true,
    isPaginated: true,
    description:
      'Paginated payments of a specific invoice (includes pending synthetic entry if unpaid)',
  })
  async findByInvoiceId(
    @Param('invoiceId', ParseUUIDPipe) invoiceId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: PaymentListQueryDto,
  ) {
    return this.paymentsService.findByInvoiceId(invoiceId, currentUser, query);
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

  @Post('payos/webhook')
  @Public()
  @ApiOperation({
    summary: 'Receive PayOS payment webhook',
    description: 'Public callback endpoint used by PayOS to confirm payment results.',
  })
  @ApiResponse({
    status: 201,
    description: 'Webhook received and processed',
  })
  async handlePayOSWebhook(@Body() webhookData: Webhook) {
    return this.paymentsService.handlePayOSWebhook(webhookData);
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

  @Get('partner-monthly-payouts/due')
  @Roles(Role.STAFF)
  @ApiOperation({
    summary: 'List due monthly partner payouts',
    description:
      'Return only partners whose payout for billing month is already due and not yet paid.',
  })
  @ApiJsonResponse(PartnerMonthlyPayoutItemDto, {
    isArray: true,
    description: 'Due monthly partner payouts',
  })
  listDuePartnerMonthlyPayouts(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ListDuePartnerMonthlyPayoutsQueryDto,
  ) {
    return this.paymentsService.listDuePartnerMonthlyPayouts(
      currentUser,
      query,
    );
  }

  @Post('partner-monthly-payouts/confirm')
  @Roles(Role.STAFF)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(FileInterceptor('transferProof'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description:
      'Confirm monthly partner payout and upload transfer proof image (required).',
    type: ConfirmPartnerMonthlyPayoutDto,
  })
  @ApiOperation({
    summary: 'Confirm monthly partner payout with transfer proof',
  })
  @ApiJsonResponse(ConfirmPartnerMonthlyPayoutResultDto, {
    status: 201,
    description: 'Partner monthly payout confirmed',
  })
  async confirmPartnerMonthlyPayout(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: ConfirmPartnerMonthlyPayoutDto,
    @UploadedFile() transferProof: any,
  ) {
    if (!transferProof) {
      throw new BadRequestException('Transfer proof image is required');
    }

    return this.paymentsService.confirmPartnerMonthlyPayout(
      currentUser,
      body,
      transferProof,
    );
  }
}
