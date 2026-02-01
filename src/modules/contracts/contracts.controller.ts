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
import { ContractsService } from './contracts.service';
import { CreateContractDto, UpdateContractDto } from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { ContractStatus } from '@prisma/client';

@ApiTags('Contracts')
@ApiBearerAuth()
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'List contracts',
    description: 'Get all contracts. Users only see their own contracts.',
  })
  @ApiQuery({ name: 'status', required: false, enum: ContractStatus })
  @ApiResponse({ status: 200, description: 'List of contracts' })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: ContractStatus,
  ) {
    return this.contractsService.findAll(currentUser, status);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get contract details',
    description: 'Get contract by ID. Users only see their own contracts.',
  })
  @ApiResponse({ status: 200, description: 'Contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.findOne(id, currentUser);
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Create contract',
    description: 'Create new rental contract with members.',
  })
  @ApiResponse({ status: 201, description: 'Contract created' })
  @ApiResponse({ status: 409, description: 'Apartment not available or overlapping contract' })
  async create(
    @Body() createDto: CreateContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Update contract',
    description: 'Update contract details. Cannot modify active contracts.',
  })
  @ApiResponse({ status: 200, description: 'Contract updated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateContractDto,
  ) {
    return this.contractsService.update(id, updateDto);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Activate contract',
    description: 'Sign and activate pending contract. Updates apartment to occupied.',
  })
  @ApiResponse({ status: 200, description: 'Contract activated' })
  @ApiResponse({ status: 409, description: 'Contract not in pending status' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.activate(id);
  }

  @Patch(':id/terminate')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Terminate contract',
    description: 'Terminate active contract early. Updates apartment to available.',
  })
  @ApiResponse({ status: 200, description: 'Contract terminated' })
  @ApiResponse({ status: 409, description: 'Contract not active' })
  async terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string; terminationFee?: number },
  ) {
    return this.contractsService.terminate(id, body.reason, body.terminationFee);
  }
}
