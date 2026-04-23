import {
  Controller,
  Get,
  Post,
  Put,
  Body,
  Patch,
  Param,
  Query,
  Res,
  ParseUUIDPipe,
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
  ContractListPaginatedDto,
  ContractDetailDto,
  UploadContractPdfDto,
  CancelContractDto,
  AddContractMemberDto,
  RenewContractDto,
  RenewContractResponseDto,
  RenewalOption,
  UpdateContractPdfContentDto,
  SignCooperationContractDto,
  SignCooperationContractResultDto,
  CancelCooperationContractDto,
  CancelCooperationContractResultDto,
  SetGlobalCooperationCommissionPhasesDto,
  SetGlobalCooperationCommissionPhasesResultDto,
} from './dto';
import { ContractListQueryDto } from './dto/contract-list-query.dto';
import { Roles, CurrentUser, Public } from '../../common/decorators';
import { FileUploadPipe } from '../../common/pipes';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { ContractStatus } from '@prisma/client';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';

@ApiTags('Contracts')
@ApiBearerAuth('JWT-auth')
@Controller('contracts')
export class ContractsController {
  constructor(
    private readonly contractsService: ContractsService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List contracts' })
  @ApiQuery({ name: 'status', required: false, enum: ContractStatus })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiJsonResponse(ContractListPaginatedDto, {
    description: 'Paginated list of contracts',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: ContractListQueryDto,
  ) {
    return this.contractsService.findAll(currentUser, {
      status: query.status,
      page: query.page,
      limit: query.limit,
    });
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

  @Get('pdf/view')
  @Public()
  @ApiOperation({
    summary: 'View contract PDF by signed token',
    description:
      'Public endpoint to view contract PDF using a short-lived signed token.',
  })
  @ApiQuery({
    name: 'token',
    required: true,
    type: String,
    example:
      'ZWZmNTFjNGQtOGQwZS00Yzc4LTg5NTktOTI3ZWRhZDllYTIyOjE3NzU5ODkxNTEyOTY6OTM5ZTc1ZWI5ZGNmZWMxZGE3ODA0YzI0OTdjMDA4NDg0YWMzMjYxMDMxNGQwNGU1NTdjYmQ5Yzk0ZTczZjA2Mw',
    description: 'Signed token returned in contract publicPdfUrl',
  })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Contract PDF file' })
  @ApiResponse({ status: 401, description: 'Invalid or expired PDF token' })
  @ApiResponse({ status: 404, description: 'Contract or PDF not found' })
  async viewPdfByToken(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfData = await this.contractsService.getContractPdfByToken(token);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="contract-${pdfData.contractNumber}.pdf"`,
    });

    return new StreamableFile(pdfData.buffer);
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

  @Post('cooperation/:id/sign')
  @Roles(Role.USER)
  @UseInterceptors(FileInterceptor('contractPdf'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Partner upload signed cooperation contract PDF',
    type: SignCooperationContractDto,
  })
  @ApiOperation({
    summary: 'Partner sign cooperation contract',
    description:
      'Partner uploads signed cooperation contract PDF by cooperation contract ID.',
  })
  @ApiJsonResponse(SignCooperationContractResultDto, {
    status: 201,
    description: 'Cooperation contract signed successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or missing PDF file' })
  @ApiResponse({ status: 403, description: 'Not partner of this contract' })
  @ApiResponse({ status: 404, description: 'Cooperation contract not found' })
  @ApiResponse({ status: 409, description: 'Contract cannot be signed' })
  async signCooperationContract(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFile() contractPdf: any,
    @Body() body: SignCooperationContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    if (!contractPdf) {
      throw new BadRequestException('Signed contract PDF is required');
    }

    if (contractPdf.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const timestamp = Date.now();
    const storagePath = `cooperation-contracts/${id}/${currentUser.sub}-${timestamp}-signed.pdf`;
    const uploadedUrl = await this.storageService.uploadFile(
      'apartment-cooperation',
      storagePath,
      contractPdf,
    );

    return this.contractsService.signCooperationContract(
      id,
      currentUser,
      contractPdf,
      {
        signedDate: body.signedDate,
        contractDocumentUrl: uploadedUrl,
      },
    );
  }

  @Put('cooperation/commission-phases')
  @Roles(Role.ADMIN)
  @ApiOperation({
    summary: 'Admin setup global cooperation commission phases',
    description:
      'Replace all active global commission phases for partner cooperation contracts. New cooperation contracts use phase matched by contract start date.',
  })
  @ApiBody({ type: SetGlobalCooperationCommissionPhasesDto })
  @ApiJsonResponse(SetGlobalCooperationCommissionPhasesResultDto, {
    description: 'Global cooperation commission phases updated',
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid phase dates or overlapping phase ranges',
  })
  async setGlobalCooperationCommissionPhases(
    @Body() body: SetGlobalCooperationCommissionPhasesDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.setGlobalCooperationCommissionPhases(
      body,
      currentUser.sub,
    );
  }

  @Patch('cooperation/:id/cancel')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Partner cancel cooperation contract',
    description:
      'Partner cancels cooperation contract. Contract status becomes cancelled and linked apartment status is set to inactive.',
  })
  @ApiJsonResponse(CancelCooperationContractResultDto, {
    description: 'Cooperation contract cancelled successfully',
  })
  @ApiResponse({ status: 403, description: 'Not partner of this contract' })
  @ApiResponse({ status: 404, description: 'Cooperation contract not found' })
  @ApiResponse({ status: 409, description: 'Contract cannot be cancelled' })
  cancelCooperationContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelCooperationContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.cancelCooperationContract(
      id,
      currentUser,
      body,
    );
  }

  @Post()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Create contract' })
  @ApiBody({
    type: CreateContractDto,
    examples: {
      createWithMultipleMembers: {
        summary: 'Create contract with 2 members',
        value: {
          apartmentId: '11111111-2222-3333-4444-555555555555',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          monthlyRent: 15000000,
          depositAmount: 30000000,
          paymentDueDay: 5,
          paymentMethod: 'bank_transfer',
          utilitiesIncluded: {
            internet: true,
            cleaning: false,
          },
          utilitiesCharges: {
            electricity: 3500,
            water: 15000,
          },
          specialConditions: 'Không nuôi thú cưng trong căn hộ.',
          members: [
            {
              userId: 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee',
              memberType: 'primary',
              isPrimaryContact: true,
              sharePercentage: 60,
            },
            {
              userId: 'ffffffff-1111-2222-3333-444444444444',
              memberType: 'co_tenant',
              isPrimaryContact: false,
              sharePercentage: 40,
            },
          ],
        },
      },
    },
  })
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

  @Post(':id/renew')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Renew rental contract',
    description:
      'Create a new draft (unsigned) renewal contract from an existing contract with 2 options: keep_current (keep old duration and members) or customize (provide extensionMonths and new members by CCCD).',
  })
  @ApiBody({
    type: RenewContractDto,
    examples: {
      keepEverythingAsOldContract: {
        summary: 'Keep current months and members',
        value: {
          renewalOption: RenewalOption.KEEP_CURRENT,
        },
      },
      customizeMonthsAndMembers: {
        summary: 'Customize months and replace members by CCCD',
        value: {
          renewalOption: RenewalOption.CUSTOMIZE,
          extensionMonths: 12,
          memberNationalIds: ['079203009999', '079203008888'],
        },
      },
    },
  })
  @ApiJsonResponse(RenewContractResponseDto, {
    status: 201,
    description: 'Renewed draft contract created successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid renewal request data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({
    status: 409,
    description: 'Cannot renew contract due to status or date overlap',
  })
  async renewContract(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() renewDto: RenewContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.renewContract(id, renewDto, currentUser);
  }

  @Patch(':id/pdf-content')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({
    summary: 'Update editable PDF content of contract',
    description:
      'Update fields that are rendered in the rental contract PDF and regenerate the PDF immediately. landlordAddress is shown as business address, while landlordIdIssuePlace is kept only for backward compatibility.',
  })
  @ApiBody({
    type: UpdateContractPdfContentDto,
    examples: {
      updateRentAndDates: {
        summary: 'Update rental terms and regenerate PDF',
        value: {
          landlordName: 'Hoàng Kim Long',
          landlordIdNumber: '060204000351',
          landlordIdIssueDate: '19/04/2021',
          landlordAddress:
            'Chung cư Vinhomes Grand Park, phường Long Bình, TP Thủ Đức',
          landlordPhone: '0388969964',
          startDate: '2026-04-01',
          endDate: '2027-03-31',
          monthlyRent: 16500000,
          depositAmount: 33000000,
          paymentDueDay: 7,
          paymentMethod: 'bank_transfer',
          specialConditions: 'Không hút thuốc trong căn hộ.',
          contractTerms: 'Thông báo trước 30 ngày nếu kết thúc sớm.',
        },
      },
    },
  })
  @ApiJsonResponse(ContractDetailDto, {
    description: 'Contract PDF content updated and PDF regenerated',
  })
  @ApiResponse({ status: 400, description: 'Invalid update data' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({
    status: 409,
    description: 'Contract does not allow PDF content editing',
  })
  async updatePdfContent(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: UpdateContractPdfContentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.updateContractPdfContent(
      id,
      body,
      currentUser,
    );
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

  @Patch(':id/activate-paid')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({
    summary: 'Activate contract after deposit paid',
    description:
      'Frontend test helper. Bypasses status, deposit, and move-in validation to force activation for draft/pending/signed contracts, but still refuses expired contracts.',
  })
  @ApiJsonResponse(ContractDetailDto, {
    description: 'Contract force-activated for frontend testing',
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({
    status: 409,
    description:
      'Contract cannot be activated because it is expired or in an unsupported final status',
  })
  async activatePaid(@Param('id', ParseUUIDPipe) id: string) {
    return this.contractsService.activateWhenDepositPaid(id, {
      bypassValidation: true,
    });
  }

  @Patch(':id/cancel')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'Cancel contract by user' })
  @ApiJsonResponse(ContractDetailDto, {
    description: 'Contract cancelled by user',
  })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 409, description: 'Contract cannot be cancelled' })
  async cancelByUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CancelContractDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.cancelByUser(id, body, currentUser);
  }

  @Post(':id/members')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Add contract member by CCCD',
    description:
      'Add a verified user into a draft/pending contract by CCCD number and regenerate contract PDF. Signed contracts cannot add members.',
  })
  @ApiBody({
    type: AddContractMemberDto,
    examples: {
      addCoTenantByNationalId: {
        summary: 'Add co-tenant member into contract',
        value: {
          nationalId: '079203001234',
          memberType: 'co_tenant',
          isPrimaryContact: false,
          sharePercentage: 40,
        },
      },
    },
  })
  @ApiJsonResponse(ContractDetailDto, {
    description: 'Contract member added successfully',
  })
  @ApiResponse({ status: 400, description: 'Invalid or unverified CCCD' })
  @ApiResponse({ status: 404, description: 'Contract not found' })
  @ApiResponse({ status: 409, description: 'Contract cannot add members' })
  async addMemberByNationalId(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AddContractMemberDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.contractsService.addMemberByNationalId(id, body, currentUser);
  }
}
