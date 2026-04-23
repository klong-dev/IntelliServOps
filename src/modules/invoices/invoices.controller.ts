import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Query,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { InvoiceStatus } from '@prisma/client';
import { InvoicesService } from './invoices.service';
import {
  ConfirmInvoicePartnerPayoutDto,
  ConfirmInvoicePartnerPayoutResultDto,
  InvoiceDetailDto,
  InvoiceListPaginatedDto,
  InvoiceListQueryDto,
  InvoiceMeListDto,
  InvoiceMeQueryDto,
  InvoiceMyRevenueOverviewDto,
  InvoiceOverdueListQueryDto,
  InvoicePartnerPayoutQueryDto,
  InvoicePartnerPayoutSummaryListDto,
  InvoicePartnerRevenueSummaryItemDto,
  InvoiceRevenueDashboardDto,
  InvoiceRevenueDashboardQueryDto,
  InvoiceRevenueFilterQueryDto,
  InvoiceRevenueOverviewDto,
  InvoiceRevenueTimeseriesDto,
  InvoiceRevenueTimeseriesQueryDto,
  InvoiceRevenueTransactionListDto,
  MonthlyUtilityInvoiceListDto,
  MonthlyUtilityQueryDto,
  OverdueApartmentTenantListDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoicesController {
  private readonly validTransferImageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  constructor(
    private readonly invoicesService: InvoicesService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  private getMimeType(file: unknown): string {
    if (
      typeof file !== 'object' ||
      file === null ||
      !('mimetype' in file) ||
      typeof (file as { mimetype?: unknown }).mimetype !== 'string'
    ) {
      throw new BadRequestException('transferProof image is invalid');
    }

    return (file as { mimetype: string }).mimetype;
  }

  @Get('overview')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'System revenue overview',
    description:
      'Revenue from paid invoices. For partner apartments, system revenue is calculated by cooperation commission percentage, except forfeited deposits which belong fully to the system.',
  })
  @ApiJsonResponse(InvoiceRevenueOverviewDto, {
    description: 'Revenue overview for system and partner payout context',
  })
  getOverview(
    @Query() query: InvoiceRevenueFilterQueryDto,
  ): Promise<InvoiceRevenueOverviewDto> {
    return this.invoicesService.getSystemRevenueOverview(query);
  }

  @Get('partners')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Partner revenue summaries',
    description:
      'Grouped revenue summaries by partner with gross revenue, system commission, and net payout.',
  })
  @ApiJsonResponse(InvoicePartnerRevenueSummaryItemDto, {
    isArray: true,
    description: 'Partner revenue summaries',
  })
  getPartnerSummaries(
    @Query() query: InvoiceRevenueFilterQueryDto,
  ): Promise<InvoicePartnerRevenueSummaryItemDto[]> {
    return this.invoicesService.getPartnerRevenueSummaries(query);
  }

  @Get('transactions')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Revenue transaction reconciliation list',
    description:
      'Detailed reconciled revenue rows with invoice, apartment, rental contract and cooperation contract information.',
  })
  @ApiJsonResponse(InvoiceRevenueTransactionListDto, {
    description: 'Paginated revenue transaction list',
  })
  getTransactions(
    @Query() query: InvoiceRevenueFilterQueryDto,
  ): Promise<InvoiceRevenueTransactionListDto> {
    return this.invoicesService.getRevenueTransactions(query);
  }

  @Get('me/overview')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Partner view own apartment revenue overview',
    description:
      'Partner-only endpoint. Revenue is calculated as paid receivable invoices minus system commission.',
  })
  @ApiJsonResponse(InvoiceMyRevenueOverviewDto, {
    description: 'Partner own revenue overview',
  })
  getMyOverview(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: InvoiceRevenueFilterQueryDto,
  ): Promise<InvoiceMyRevenueOverviewDto> {
    return this.invoicesService.getMyRevenueOverview(currentUser, query);
  }

  @Get('me/transactions')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Partner view own apartment revenue transactions',
    description:
      'Partner-only endpoint. Returns reconciled transaction rows for apartments owned by current partner user.',
  })
  @ApiJsonResponse(InvoiceRevenueTransactionListDto, {
    description: 'Paginated partner own revenue transactions',
  })
  getMyTransactions(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: InvoiceRevenueFilterQueryDto,
  ): Promise<InvoiceRevenueTransactionListDto> {
    return this.invoicesService.getMyRevenueTransactions(currentUser, query);
  }

  @Get('dashboard')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Dashboard statistics for operators and admins',
    description:
      'Aggregated user and partner ratios, apartment occupancy, apartment revenue ranking, and system revenue summary.',
  })
  @ApiJsonResponse(InvoiceRevenueDashboardDto, {
    description: 'Dashboard summary for operator/admin back office',
  })
  getDashboard(
    @Query() query: InvoiceRevenueDashboardQueryDto,
  ): Promise<InvoiceRevenueDashboardDto> {
    return this.invoicesService.getDashboardStatistics(query);
  }

  @Get('timeseries')
  @Roles(Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'System revenue timeseries',
    description:
      'System-wide paid revenue grouped by month or year for a selected time window.',
  })
  @ApiJsonResponse(InvoiceRevenueTimeseriesDto, {
    description: 'Revenue timeseries grouped by month or year',
  })
  getRevenueTimeseries(
    @Query() query: InvoiceRevenueTimeseriesQueryDto,
  ): Promise<InvoiceRevenueTimeseriesDto> {
    return this.invoicesService.getRevenueTimeseries(query);
  }

  @Get('staff/partner-payouts')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Staff view monthly partner payout summaries',
    description:
      'Show monthly amount that should be transferred to each partner (rent revenue minus system commission).',
  })
  @ApiJsonResponse(InvoicePartnerPayoutSummaryListDto, {
    description: 'Paginated partner payout summaries for selected month',
  })
  getStaffPartnerPayoutSummaries(
    @Query() query: InvoicePartnerPayoutQueryDto,
  ): Promise<InvoicePartnerPayoutSummaryListDto> {
    return this.invoicesService.getStaffPartnerPayoutSummaries(query);
  }

  @Post('staff/partner-payouts/confirm')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('transferProof'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ConfirmInvoicePartnerPayoutDto })
  @ApiOperation({
    summary: 'Staff confirm monthly payout transfer to partner',
    description:
      'Confirm transfer by uploading transfer proof image and saving confirmation for the partner/month.',
  })
  @ApiJsonResponse(ConfirmInvoicePartnerPayoutResultDto, {
    description: 'Partner payout confirmation saved successfully',
  })
  async confirmStaffPartnerPayout(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: ConfirmInvoicePartnerPayoutDto,
    @UploadedFile() transferProof: unknown,
  ): Promise<ConfirmInvoicePartnerPayoutResultDto> {
    if (!transferProof) {
      throw new BadRequestException('transferProof image is required');
    }

    const mimeType = this.getMimeType(transferProof);

    if (!this.validTransferImageMimeTypes.includes(mimeType)) {
      throw new BadRequestException(
        `Invalid image format. Allowed: ${this.validTransferImageMimeTypes.join(', ')}`,
      );
    }

    const timestamp = Date.now();
    const ext =
      mimeType === 'image/jpeg'
        ? 'jpg'
        : mimeType === 'image/webp'
          ? 'webp'
          : 'png';
    const storagePath = `partner-payouts/${body.partnerId}/${body.month}-${timestamp}.${ext}`;
    const transferProofImageUrl = await this.storageService.uploadFile(
      'apartment-cooperation',
      storagePath,
      transferProof,
    );

    const payout = await this.invoicesService.confirmPartnerMonthlyPayout({
      currentUser,
      partnerId: body.partnerId,
      month: body.month,
      transferProofImageUrl,
      note: body.note,
    });

    return { payout };
  }

  @Get('me')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Unified invoice feed for staff, user and partner',
    description:
      'Role-aware endpoint. Staff gets payout worklist, user gets payable invoices, partner gets receivable invoices with payout breakdown.',
  })
  @ApiJsonResponse(InvoiceMeListDto, {
    description: 'Role-aware invoice feed',
  })
  async findMe(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: InvoiceMeQueryDto,
  ): Promise<InvoiceMeListDto> {
    return this.invoicesService.findMe(currentUser, query);
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(InvoiceListPaginatedDto, {
    description: 'Paginated list of invoices',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: InvoiceListQueryDto,
  ) {
    return this.invoicesService.findAll(currentUser, query);
  }

  @Get('utility/monthly')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List monthly utility invoices' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(MonthlyUtilityInvoiceListDto, {
    description:
      'Paginated list of monthly utility invoices with electricity and water usage details',
  })
  async findMonthlyUtilityUsage(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: MonthlyUtilityQueryDto,
  ) {
    return this.invoicesService.findMonthlyUtilityUsage(currentUser, query);
  }

  @Get('overdue/apartments-tenants')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'List apartments and tenants with overdue rent/utility invoices',
  })
  @ApiQuery({ name: 'minOverdueDays', required: false, type: Number })
  @ApiJsonResponse(OverdueApartmentTenantListDto, {
    description:
      'Apartments and tenants that currently have overdue rent or utility invoices',
  })
  async listOverdueApartmentsAndTenants(
    @Query() query: InvoiceOverdueListQueryDto,
  ) {
    return this.invoicesService.listOverdueApartmentsAndTenants(query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiJsonResponse(InvoiceDetailDto, { description: 'Invoice details' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.invoicesService.findOne(id, currentUser);
  }
}
