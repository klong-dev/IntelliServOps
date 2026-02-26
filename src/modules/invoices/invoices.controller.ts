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
  InvoiceListItemDto,
  InvoiceDetailDto,
  InvoiceCreatedDto,
  InvoiceUpdatedDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { InvoiceStatus } from '@prisma/client';

@ApiTags('Invoices')
@ApiBearerAuth()
@Controller('invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List invoices' })
  @ApiQuery({ name: 'status', required: false, enum: InvoiceStatus })
  @ApiResponse({ status: 200, description: 'List of invoices', type: [InvoiceListItemDto] })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: InvoiceStatus,
  ) {
    return this.invoicesService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get invoice details' })
  @ApiResponse({ status: 200, description: 'Invoice details', type: InvoiceDetailDto })
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
  @ApiResponse({ status: 201, description: 'Invoice created', type: InvoiceCreatedDto })
  async create(
    @Body() createDto: CreateInvoiceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.invoicesService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update invoice' })
  @ApiResponse({ status: 200, description: 'Invoice updated', type: InvoiceUpdatedDto })
  @ApiResponse({ status: 404, description: 'Invoice not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(id, updateDto);
  }
}
