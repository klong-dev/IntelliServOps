import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Delete,
  Param,
  Query,
  ParseUUIDPipe,
  UseInterceptors,
  UploadedFiles,
  BadRequestException,
  Res,
  StreamableFile,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
  ApiConsumes,
  ApiBody,
  ApiProduces,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { ApartmentsService } from './apartments.service';
import {
  CreateApartmentDto,
  UpdateApartmentDto,
  SearchApartmentDto,
  ApartmentListItemDto,
  ApartmentDetailDto,
  ApartmentMutationResultDto,
  ApartmentStatusResultDto,
  RateApartmentDto,
  ApartmentRatingResultDto,
  SubmitPartnerCooperationRequestDto,
  PartnerCooperationSubmitResultDto,
  ApartmentMediaUploadResultDto,
  UpdatePartnerCooperationApartmentInUploadDto,
  UploadPartnerCooperationMediaRequestDto,
  ApprovePartnerCooperationResultDto,
  PartnerCooperationContractDetailDto,
  RejectPartnerCooperationApartmentDto,
  RejectPartnerCooperationResultDto,
} from './dto';
import { ApiJsonResponse } from '../../common/dto';
import { Public, Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import type { Response } from 'express';

type UploadedMediaFile = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags('Apartments')
@Controller('apartments')
export class ApartmentsController {
  constructor(
    private readonly apartmentsService: ApartmentsService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  @Get('search')
  @Public()
  @ApiOperation({
    summary: 'Search apartments',
    description:
      'Public endpoint to search apartments with filters. If status is not provided, all statuses are returned.',
  })
  @ApiJsonResponse(ApartmentListItemDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated apartment search results',
  })
  async search(@Query() searchDto: SearchApartmentDto) {
    return this.apartmentsService.search(searchDto);
  }

  @Get(':id')
  @Public()
  @ApiOperation({ summary: 'Get apartment details' })
  @ApiJsonResponse(ApartmentDetailDto, { description: 'Apartment details' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.findOne(id);
  }

  @Get('cooperation-contracts/pdf/view')
  @Public()
  @ApiOperation({
    summary: 'View partner cooperation contract PDF (public token)',
  })
  @ApiQuery({ name: 'token', required: true, description: 'Signed PDF token' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Cooperation contract PDF file' })
  async viewCooperationPdfPublic(
    @Query('token') token: string,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfData =
      await this.apartmentsService.getCooperationContractPdfPublic(token);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cooperation-${pdfData.contractNumber}.pdf"`,
    });

    return new StreamableFile(pdfData.buffer);
  }

  @Get('cooperation-contracts/:contractId/pdf')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Download partner cooperation contract PDF' })
  @ApiProduces('application/pdf')
  @ApiResponse({ status: 200, description: 'Cooperation contract PDF file' })
  async downloadCooperationPdf(
    @Param('contractId', ParseUUIDPipe) contractId: string,
    @CurrentUser() currentUser: JwtPayload,
    @Res({ passthrough: true }) res: Response,
  ) {
    const pdfData = await this.apartmentsService.getCooperationContractPdf(
      contractId,
      currentUser,
    );

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="cooperation-${pdfData.contractNumber}.pdf"`,
    });

    return new StreamableFile(pdfData.buffer);
  }

  @Post(':id/rating')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Rate apartment by user',
    description:
      'User can rate only once per apartment and only when they have an active contract for that apartment.',
  })
  @ApiJsonResponse(ApartmentRatingResultDto, {
    status: 201,
    description: 'Apartment rated successfully',
  })
  @ApiResponse({ status: 403, description: 'No active contract for apartment' })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  @ApiResponse({ status: 409, description: 'Apartment already rated by user' })
  async rateApartment(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() rateDto: RateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.rateApartment(id, rateDto, currentUser);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Create apartment' })
  @ApiJsonResponse(ApartmentMutationResultDto, {
    status: 201,
    description: 'Apartment created',
  })
  async create(
    @Body() createDto: CreateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.create(createDto, currentUser);
  }

  @Post('partner/cooperation')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.USER)
  @ApiOperation({
    summary: 'Partner submit apartment cooperation information',
    description:
      'Partner submits apartment information for cooperation and can upload apartment images/video in the same request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: SubmitPartnerCooperationRequestDto,
  })
  @ApiJsonResponse(PartnerCooperationSubmitResultDto, {
    status: 201,
    description: 'Partner cooperation apartment submitted successfully',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 10 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  async submitPartnerCooperation(
    @UploadedFiles() files: { images?: unknown[]; video?: unknown[] },
    @Body() createDto: SubmitPartnerCooperationRequestDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const isUploadedMediaFile = (
      value: unknown,
    ): value is UploadedMediaFile => {
      if (!value || typeof value !== 'object') {
        return false;
      }

      const candidate = value as Record<string, unknown>;
      return (
        typeof candidate.originalname === 'string' &&
        typeof candidate.mimetype === 'string' &&
        Buffer.isBuffer(candidate.buffer) &&
        typeof candidate.size === 'number'
      );
    };

    const imageFiles = (
      Array.isArray(files?.images) ? files.images : []
    ).filter(isUploadedMediaFile);
    const videoFile = (Array.isArray(files?.video) ? files.video : []).find(
      isUploadedMediaFile,
    );

    const validImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validVideoMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

    for (const imageFile of imageFiles) {
      if (!validImageMimeTypes.includes(imageFile.mimetype)) {
        throw new BadRequestException(
          `Invalid image format: ${imageFile.originalname}. Allowed: JPEG, PNG, WebP`,
        );
      }
    }

    if (videoFile && !validVideoMimeTypes.includes(videoFile.mimetype)) {
      throw new BadRequestException(
        `Invalid video format: ${videoFile.originalname}. Allowed: MP4, MOV, WEBM`,
      );
    }

    const timestamp = Date.now();
    const imageUrls: string[] = [];
    let videoUrl: string | undefined;

    for (let i = 0; i < imageFiles.length; i++) {
      const ext =
        imageFiles[i].mimetype.split('/')[1] === 'jpeg'
          ? 'jpg'
          : imageFiles[i].mimetype.split('/')[1];
      const filePath = `partner-${currentUser.sub}/images/${timestamp}-${i}.${ext}`;
      const url = await this.storageService.uploadFile(
        'apartment-cooperation',
        filePath,
        imageFiles[i],
      );
      imageUrls.push(url);
    }

    if (videoFile) {
      const ext =
        videoFile.mimetype === 'video/quicktime'
          ? 'mov'
          : videoFile.mimetype.split('/')[1];
      const videoPath = `partner-${currentUser.sub}/video/${timestamp}.${ext}`;
      videoUrl = await this.storageService.uploadFile(
        'apartment-cooperation',
        videoPath,
        videoFile,
      );
    }

    return this.apartmentsService.submitPartnerCooperation(
      createDto,
      currentUser,
      {
        imageUrls,
        videoUrl,
      },
    );
  }

  @Get(':id/cooperation-contract')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Get partner cooperation contract by apartment',
    description:
      'Get latest cooperation contract information for an apartment, including internal/public PDF links so partner can review the contract.',
  })
  @ApiJsonResponse(PartnerCooperationContractDetailDto, {
    description: 'Partner cooperation contract details',
  })
  @ApiResponse({ status: 403, description: 'Not allowed to access contract' })
  @ApiResponse({ status: 404, description: 'Apartment or contract not found' })
  async getCooperationContract(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.getCooperationContractByApartment(
      id,
      currentUser,
    );
  }

  @Patch(':id/cooperation-media')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.STAFF, Role.USER)
  @ApiOperation({
    summary: 'Upload media for partner cooperation apartment',
    description:
      'Partner or staff uploads images/video for a partner cooperation apartment. Staff can also update apartment information in this same request.',
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: UploadPartnerCooperationMediaRequestDto,
  })
  @ApiJsonResponse(ApartmentMediaUploadResultDto, {
    status: 200,
    description: 'Apartment media updated successfully',
  })
  @ApiResponse({
    status: 400,
    description:
      'No media or apartment info provided, or media format is invalid',
  })
  @UseInterceptors(
    FileFieldsInterceptor([
      { name: 'images', maxCount: 10 },
      { name: 'video', maxCount: 1 },
    ]),
  )
  async uploadCooperationMedia(
    @Param('id', ParseUUIDPipe) id: string,
    @UploadedFiles() files: { images?: unknown[]; video?: unknown[] },
    @Body() updateDto: UpdatePartnerCooperationApartmentInUploadDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const isUploadedMediaFile = (
      value: unknown,
    ): value is UploadedMediaFile => {
      if (!value || typeof value !== 'object') {
        return false;
      }

      const candidate = value as Record<string, unknown>;
      return (
        typeof candidate.originalname === 'string' &&
        typeof candidate.mimetype === 'string' &&
        Buffer.isBuffer(candidate.buffer) &&
        typeof candidate.size === 'number'
      );
    };

    const imageFiles = (
      Array.isArray(files?.images) ? files.images : []
    ).filter(isUploadedMediaFile);
    const videoFile = (Array.isArray(files?.video) ? files.video : []).find(
      isUploadedMediaFile,
    );

    const hasUpdateFields = Object.values(updateDto ?? {}).some((value) => {
      if (value === undefined) {
        return false;
      }

      if (typeof value === 'string') {
        return value.trim().length > 0;
      }

      return true;
    });

    if (imageFiles.length === 0 && !videoFile && !hasUpdateFields) {
      throw new BadRequestException(
        'At least one image, one video, or apartment info field is required',
      );
    }

    const validImageMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];
    const validVideoMimeTypes = ['video/mp4', 'video/quicktime', 'video/webm'];

    for (const imageFile of imageFiles) {
      if (!validImageMimeTypes.includes(imageFile.mimetype)) {
        throw new BadRequestException(
          `Invalid image format: ${imageFile.originalname}. Allowed: JPEG, PNG, WebP`,
        );
      }
    }

    if (videoFile && !validVideoMimeTypes.includes(videoFile.mimetype)) {
      throw new BadRequestException(
        `Invalid video format: ${videoFile.originalname}. Allowed: MP4, MOV, WEBM`,
      );
    }

    const timestamp = Date.now();
    const imageUrls: string[] = [];
    let videoUrl: string | undefined;

    for (let i = 0; i < imageFiles.length; i++) {
      const ext =
        imageFiles[i].mimetype.split('/')[1] === 'jpeg'
          ? 'jpg'
          : imageFiles[i].mimetype.split('/')[1];
      const filePath = `${id}/images/${currentUser.sub}-${timestamp}-${i}.${ext}`;
      const url = await this.storageService.uploadFile(
        'apartment-cooperation',
        filePath,
        imageFiles[i],
      );
      imageUrls.push(url);
    }

    if (videoFile) {
      const ext =
        videoFile.mimetype === 'video/quicktime'
          ? 'mov'
          : videoFile.mimetype.split('/')[1];
      const videoPath = `${id}/video/${currentUser.sub}-${timestamp}.${ext}`;
      videoUrl = await this.storageService.uploadFile(
        'apartment-cooperation',
        videoPath,
        videoFile,
      );
    }

    return this.apartmentsService.uploadCooperationMedia(
      id,
      {
        imageUrls,
        videoUrl,
      },
      currentUser,
      updateDto,
    );
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Update apartment' })
  @ApiJsonResponse(ApartmentMutationResultDto, {
    description: 'Apartment updated',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.update(id, updateDto, currentUser);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN)
  @ApiOperation({ summary: 'Delete apartment (soft delete)' })
  @ApiJsonResponse(ApartmentStatusResultDto, {
    description: 'Apartment deactivated',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async remove(@Param('id', ParseUUIDPipe) id: string) {
    return this.apartmentsService.remove(id);
  }

  @Get('owner/:ownerId')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.USER)
  @ApiOperation({ summary: 'Get apartments by owner' })
  @ApiJsonResponse(ApartmentListItemDto, {
    isArray: true,
    description: 'Owner apartments',
  })
  async findByOwner(@Param('ownerId', ParseUUIDPipe) ownerId: string) {
    return this.apartmentsService.findByOwner(ownerId);
  }

  @Patch(':id/approve')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.ADMIN, Role.OPERATOR)
  @ApiOperation({ summary: 'Approve apartment' })
  @ApiJsonResponse(ApartmentStatusResultDto, {
    description: 'Apartment approved',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async approve(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.approve(id, currentUser.sub);
  }

  @Patch(':id/approve-cooperation')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.OPERATOR)
  @ApiOperation({
    summary: 'Operator approve partner cooperation apartment',
    description:
      'Operator approves an apartment submitted by partner cooperation flow only after staff has uploaded at least one image and one video.',
  })
  @ApiJsonResponse(ApprovePartnerCooperationResultDto, {
    description: 'Partner cooperation apartment approved',
  })
  @ApiResponse({
    status: 400,
    description:
      'Apartment has already been approved, is not verified, or does not have enough media',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  async approvePartnerCooperation(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.approvePartnerCooperation(
      id,
      currentUser.sub,
    );
  }

  @Patch(':id/reject-cooperation')
  @ApiBearerAuth('JWT-auth')
  @Roles(Role.OPERATOR)
  @ApiOperation({
    summary: 'Operator reject partner cooperation apartment',
    description:
      'Operator rejects partner cooperation apartment, sets apartment status to inactive, and sends notification to partner with reject reason.',
  })
  @ApiJsonResponse(RejectPartnerCooperationResultDto, {
    description: 'Partner cooperation apartment rejected',
  })
  @ApiResponse({ status: 404, description: 'Apartment not found' })
  @ApiResponse({ status: 409, description: 'Apartment cannot be rejected' })
  async rejectPartnerCooperation(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectPartnerCooperationApartmentDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.apartmentsService.rejectPartnerCooperation(
      id,
      currentUser.sub,
      body.reason,
    );
  }
}
