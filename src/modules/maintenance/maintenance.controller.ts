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
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceDto,
  UpdateMaintenanceDto,
  MaintenanceListItemDto,
  MaintenanceDetailDto,
  MaintenanceCreatedDto,
  MaintenanceUpdatedDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { MaintenanceStatus } from '@prisma/client';

@ApiTags('Maintenance')
@ApiBearerAuth()
@Controller('maintenance')
export class MaintenanceController {
  constructor(private readonly maintenanceService: MaintenanceService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List maintenance requests' })
  @ApiQuery({ name: 'status', required: false, enum: MaintenanceStatus })
  @ApiResponse({ status: 200, description: 'List of maintenance requests', type: [MaintenanceListItemDto] })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: MaintenanceStatus,
  ) {
    return this.maintenanceService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get maintenance request details' })
  @ApiResponse({ status: 200, description: 'Maintenance request details', type: MaintenanceDetailDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.maintenanceService.findOne(id);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Create maintenance request' })
  @ApiResponse({ status: 201, description: 'Request created', type: MaintenanceCreatedDto })
  async create(
    @Body() createDto: CreateMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.maintenanceService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update maintenance request' })
  @ApiResponse({ status: 200, description: 'Request updated', type: MaintenanceUpdatedDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(id, updateDto);
  }

  @Patch(':id/complete')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Complete maintenance request' })
  @ApiResponse({ status: 200, description: 'Request completed', type: MaintenanceDetailDto })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { resolutionNotes: string; cost?: number },
  ) {
    return this.maintenanceService.complete(id, body.resolutionNotes, body.cost);
  }
}
