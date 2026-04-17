import { Controller, Get, Param, Query, ParseUUIDPipe } from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { InvoicesService } from './invoices.service';
import {
  InvoiceListPaginatedDto,
  InvoiceListQueryDto,
  InvoiceDetailDto,
  InvoiceMeListDto,
  InvoiceMeQueryDto,
  MonthlyUtilityInvoiceListDto,
  MonthlyUtilityQueryDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Invoices')
@ApiBearerAuth('JWT-auth')
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

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
