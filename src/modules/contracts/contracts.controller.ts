import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
  NotFoundException,
  StreamableFile,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiProduces,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import type { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { ContractsService } from './contracts.service';
import {
  CreateContractDto,
  UpdateContractDto,
  ContractListItemDto,
  ContractDetailDto,
  UploadContractPdfDto,
} from './dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { FileUploadPipe } from '../../common/pipes';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { ContractStatus } from '@prisma/client';

@ApiTags('Contracts')
@ApiBearerAuth('JWT-auth')
@Controller('contracts')
export class ContractsController {
  constructor(private readonly contractsService: ContractsService) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List contracts' })
  @ApiQuery({ name: 'status', required: false, enum: ContractStatus })
  @ApiJsonResponse(ContractListItemDto, {
    isArray: true,
    description: 'List of contracts',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: ContractStatus,
  ) {
    return this.contractsService.findAll(currentUser, status);
  }

  @Get('pdf/view')
  @Public()
  @ApiOperation({
    summary: 'View contract PDF (public with token)',
    description:
      'View contract PDF using a signed token. Token is valid for 5 minutes.',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Signed PDF token' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Contract PDF file' })
  @ApiResponse({ status: 401, description: 'Invalid or expired token' })
  @ApiResponse({ status: 404, description: 'Contract or PDF not found' })
  async viewPdfPublic(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfData = await this.contractsService.getContractPdfPublic(token);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${pdfData.contractNumber}.pdf"`,
    });

    return new StreamableFile(pdfData.buffer);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get contract details' })
  @ApiJsonResponse(ContractDetailDto, { description: 'Contract details' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.findOne(id, currentUser);
  }

  @Get(':id/pdf')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Download contract PDF',
    description: 'Download the generated PDF document for a contract.',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Contract PDF file' })
  @ApiResponse({ status: 404, description: 'Contract or PDF not found' })
  async downloadPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfData = await this.contractsService.getContractPdf(id, currentUser);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${pdfData.contractNumber}.pdf"`,
    });

    return new StreamableFile(pdfData.buffer);
  }

  @Post(':id/upload')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(FileInterceptor('contractPdf'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Upload a signed contract PDF file',
    type: UploadContractPdfDto,
  })
  @ApiOperation({ summary: 'Upload signed contract PDF' })
  @ApiJsonResponse(ContractDetailDto, {
    description: 'Signed contract PDF uploaded',
  })
  @ApiResponse({ status: 400, description: 'Invalid or missing PDF file' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 409, description: 'Contract PDF already uploaded' })
  async uploadSignedPdf(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() contractPdf: any,
    @Body() body: UploadContractPdfDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    if (!contractPdf) {
      throw new BadRequestException('Signed contract PDF is required');
    }

    return this.contractsService.uploadSignedPdf(
      id,
      contractPdf,
      currentUser,
      body,
    );
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create contract' })
  @ApiJsonResponse(ContractDetailDto, {
    status: 201,
    description: 'Contract created',
  })
  async create(
    @Body() createDto: CreateContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.create(createDto, currentUser);
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update contract' })
  @ApiJsonResponse(ContractDetailDto, { description: 'Contract updated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateContractDto,
  ) {
    return this.contractsService.update(id, updateDto);
  }

  @Patch(':id/activate')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Activate contract' })
  @ApiJsonResponse(ContractDetailDto, { description: 'Contract activated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async activate(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.activate(id);
  }

  @Patch(':id/terminate')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Terminate contract' })
  @ApiJsonResponse(ContractDetailDto, { description: 'Contract terminated' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  async terminate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: { reason: string; terminationFee?: number },
  ) {
    return this.contractsService.terminate(
      id,
      body.reason,
      body.terminationFee,
    );
  }
}
