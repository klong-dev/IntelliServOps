import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
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
import { InvoicesService } from './invoices.service';
import {
  CreateInvoiceDto,
  UpdateInvoiceDto,
  InvoiceListPaginatedDto,
  InvoiceListQueryDto,
  InvoiceDetailDto,
  InvoiceCreatedDto,
  InvoiceUpdatedDto,
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

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create invoice' })
  @ApiJsonResponse(InvoiceCreatedDto, {
    status: 201,
    description: 'Invoice created',
  })
  async create(
    @Body() createDto: CreateInvoiceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.invoicesService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update invoice' })
  @ApiJsonResponse(InvoiceUpdatedDto, { description: 'Invoice updated' })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateDto);
  }
}
