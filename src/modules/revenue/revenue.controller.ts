import {
  BadRequestException,
  Body,
  Controller,
  Get,
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
  ApiTags,
} from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiJsonResponse } from '../../common/dto';
import { CurrentUser, Roles } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { RevenueService } from './revenue.service';
import {
  PartnerMyRevenueOverviewDto,
  PartnerRevenueSummaryItemDto,
  RevenueFilterQueryDto,
  RevenueOverviewDto,
  RevenueTransactionListDto,
} from './dto';
import {
  ConfirmPartnerPayoutDto,
  ConfirmPartnerPayoutResultDto,
  PartnerPayoutQueryDto,
  PartnerPayoutSummaryListDto,
} from './dto/partner-payout.dto';

@ApiTags('Revenue')
@ApiBearerAuth('JWT-auth')
@Controller('revenues')
@Roles(Role.OPERATOR, Role.ADMIN)
export class RevenueController {
  private readonly validTransferImageMimeTypes = [
    'image/jpeg',
    'image/png',
    'image/webp',
  ];

  constructor(
    private readonly revenueService: RevenueService,
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
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'System revenue overview',
    description:
      'Revenue from paid invoices excluding deposit fees. For partner apartments, system revenue is calculated by cooperation commission percentage.',
  })
  @ApiJsonResponse(RevenueOverviewDto, {
    description: 'Revenue overview for system and partner payout context',
  })
  getOverview(
    @Query() query: RevenueFilterQueryDto,
  ): Promise<RevenueOverviewDto> {
    return this.revenueService.getSystemRevenueOverview(query);
  }

  @Get('partners')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Partner revenue summaries',
    description:
      'Grouped revenue summaries by partner with gross revenue, system commission, and net payout.',
  })
  @ApiJsonResponse(PartnerRevenueSummaryItemDto, {
    isArray: true,
    description: 'Partner revenue summaries',
  })
  getPartnerSummaries(
    @Query() query: RevenueFilterQueryDto,
  ): Promise<PartnerRevenueSummaryItemDto[]> {
    return this.revenueService.getPartnerRevenueSummaries(query);
  }

  @Get('transactions')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Revenue transaction reconciliation list',
    description:
      'Detailed reconciled revenue rows with invoice, apartment, rental contract and cooperation contract information.',
  })
  @ApiJsonResponse(RevenueTransactionListDto, {
    description: 'Paginated revenue transaction list',
  })
  getTransactions(
    @Query() query: RevenueFilterQueryDto,
  ): Promise<RevenueTransactionListDto> {
    return this.revenueService.getRevenueTransactions(query);
  }

  @Get('partner/me/overview')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Partner view own apartment revenue overview',
    description:
      'Partner-only endpoint. Revenue is calculated as paid rent invoices minus system commission.',
  })
  @ApiJsonResponse(PartnerMyRevenueOverviewDto, {
    description: 'Partner own revenue overview',
  })
  getMyPartnerOverview(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: RevenueFilterQueryDto,
  ): Promise<PartnerMyRevenueOverviewDto> {
    return this.revenueService.getMyPartnerRevenueOverview(currentUser, query);
  }

  @Get('partner/me/transactions')
  @Roles(Role.USER, Role.ADMIN)
  @ApiOperation({
    summary: 'Partner view own apartment revenue transactions',
    description:
      'Partner-only endpoint. Returns reconciled transaction rows for apartments owned by current partner user.',
  })
  @ApiJsonResponse(RevenueTransactionListDto, {
    description: 'Paginated partner own revenue transactions',
  })
  getMyPartnerTransactions(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: RevenueFilterQueryDto,
  ): Promise<RevenueTransactionListDto> {
    return this.revenueService.getMyPartnerRevenueTransactions(
      currentUser,
      query,
    );
  }

  @Get('staff/partner-payouts')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @ApiOperation({
    summary: 'Staff view monthly partner payout summaries',
    description:
      'Show monthly amount that should be transferred to each partner (rent revenue minus system commission).',
  })
  @ApiJsonResponse(PartnerPayoutSummaryListDto, {
    description: 'Paginated partner payout summaries for selected month',
  })
  getStaffPartnerPayoutSummaries(
    @Query() query: PartnerPayoutQueryDto,
  ): Promise<PartnerPayoutSummaryListDto> {
    return this.revenueService.getStaffPartnerPayoutSummaries(query);
  }

  @Post('staff/partner-payouts/confirm')
  @Roles(Role.STAFF, Role.OPERATOR, Role.ADMIN)
  @UseInterceptors(FileInterceptor('transferProof'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ConfirmPartnerPayoutDto })
  @ApiOperation({
    summary: 'Staff confirm monthly payout transfer to partner',
    description:
      'Confirm transfer by uploading transfer proof image and saving confirmation for the partner/month.',
  })
  @ApiJsonResponse(ConfirmPartnerPayoutResultDto, {
    description: 'Partner payout confirmation saved successfully',
  })
  async confirmStaffPartnerPayout(
    @CurrentUser() currentUser: JwtPayload,
    @Body() body: ConfirmPartnerPayoutDto,
    @UploadedFile() transferProof: unknown,
  ): Promise<ConfirmPartnerPayoutResultDto> {
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

    const payout = await this.revenueService.confirmPartnerMonthlyPayout({
      currentUser,
      partnerId: body.partnerId,
      month: body.month,
      transferProofImageUrl,
      note: body.note,
    });

    return {
      payout,
    };
  }
}
