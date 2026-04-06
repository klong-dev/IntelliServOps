import {
  BadRequestException,
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Query,
  ParseUUIDPipe,
  UploadedFiles,
  UseInterceptors,
  UsePipes,
} from '@nestjs/common';
import {
  ApiTags,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiQuery,
} from '@nestjs/swagger';
import { FileFieldsInterceptor } from '@nestjs/platform-express';
import { MaintenanceService } from './maintenance.service';
import {
  CreateMaintenanceDto,
  CreateMaintenanceRequestDto,
  UpdateMaintenanceDto,
  MaintenanceListItemDto,
  MaintenanceHistoryItemDto,
  MaintenanceHistoryQueryDto,
  MaintenanceDetailDto,
  MaintenanceCreatedDto,
  MaintenanceUpdatedDto,
  AcceptMaintenanceDto,
  RejectMaintenanceDto,
  RejectMaintenanceRequestDto,
  CompleteMaintenanceDto,
  CompleteMaintenanceRequestDto,
  RateMaintenanceDto,
} from './dto';
import { Roles, CurrentUser } from '../../common/decorators';
import { ApiJsonResponse } from '../../common/dto';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { MaintenanceStatus } from '@prisma/client';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { FileUploadPipe } from '../../common/pipes';

type UploadedImageFile = {
  originalname?: string;
  mimetype?: string;
  size?: number;
  buffer?: Buffer;
};

@ApiTags('Maintenance')
@ApiBearerAuth('JWT-auth')
@Controller('maintenance')
export class MaintenanceController {
  constructor(
    private readonly maintenanceService: MaintenanceService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  private isUploadedImageFile(value: unknown): value is UploadedImageFile {
    if (!value || typeof value !== 'object') {
      return false;
    }

    const candidate = value as UploadedImageFile;
    return (
      typeof candidate.originalname === 'string' &&
      typeof candidate.mimetype === 'string' &&
      typeof candidate.size === 'number'
    );
  }

  private hasFileBuffer(
    value: UploadedImageFile,
  ): value is UploadedImageFile & { buffer: Buffer } {
    return Buffer.isBuffer(value.buffer);
  }

  private normalizeUploadedImageFiles(files: unknown[]): UploadedImageFile[] {
    return files.filter((file): file is UploadedImageFile => {
      if (!this.isUploadedImageFile(file)) {
        return false;
      }

      return this.hasFileBuffer(file);
    });
  }

  private async uploadMaintenanceImages(
    requestId: string,
    scope: 'issue' | 'rejection' | 'completion',
    files?: unknown[],
  ): Promise<string[]> {
    if (!files?.length) {
      return [];
    }

    const normalizedFiles = this.normalizeUploadedImageFiles(files);
    if (!normalizedFiles.length) {
      return [];
    }

    const validMimeTypes = ['image/jpeg', 'image/png', 'image/webp'];

    return Promise.all(
      normalizedFiles.map(async (file, index) => {
        const mimeType = file.mimetype ?? '';
        if (!validMimeTypes.includes(mimeType)) {
          throw new BadRequestException(
            `Invalid image format. Allowed: ${validMimeTypes.join(', ')}. Received: ${mimeType || 'unknown'}`,
          );
        }

        const extension =
          mimeType === 'image/png'
            ? 'png'
            : mimeType === 'image/webp'
              ? 'webp'
              : 'jpg';
        const timestamp = Date.now();
        const path = `maintenance/${requestId}/${scope}/${timestamp}-${index}.${extension}`;

        return this.storageService.uploadFile(
          'apartment-cooperation',
          path,
          file,
        );
      }),
    );
  }

  @Get()
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'List maintenance requests' })
  @ApiQuery({ name: 'status', required: false, enum: MaintenanceStatus })
  @ApiJsonResponse(MaintenanceListItemDto, {
    isArray: true,
    description: 'List of maintenance requests',
  })
  async findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query('status') status?: MaintenanceStatus,
  ) {
    return this.maintenanceService.findAll(currentUser, status);
  }

  @Get('history')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get maintenance request history' })
  @ApiJsonResponse(MaintenanceHistoryItemDto, {
    isArray: true,
    isPaginated: true,
    description: 'Paginated maintenance request history',
  })
  async findHistory(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: MaintenanceHistoryQueryDto,
  ) {
    return this.maintenanceService.findHistory(currentUser, query);
  }

  @Get(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF, Role.USER)
  @ApiOperation({ summary: 'Get maintenance request details' })
  @ApiJsonResponse(MaintenanceDetailDto, {
    description: 'Maintenance request details',
  })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async findOne(
    @Param('id', ParseUUIDPipe) id: string,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.maintenanceService.findOne(id, currentUser);
  }

  @Post()
  @Roles(Role.USER)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Create maintenance request with optional issue images',
    type: CreateMaintenanceRequestDto,
  })
  @ApiOperation({ summary: 'Create maintenance request' })
  @ApiJsonResponse(MaintenanceCreatedDto, {
    status: 201,
    description: 'Request created',
  })
  async create(
    @Body() createDto: CreateMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFiles() files?: { images?: unknown[] },
  ) {
    const uploadedImageUrls = await this.uploadMaintenanceImages(
      createDto.apartmentId,
      'issue',
      files?.images,
    );

    return this.maintenanceService.create(
      {
        ...createDto,
        images: uploadedImageUrls.length ? uploadedImageUrls : createDto.images,
      },
      currentUser,
    );
  }

  @Patch(':id/accept')
  @Roles(Role.STAFF)
  @ApiOperation({ summary: 'Staff accept maintenance request' })
  @ApiJsonResponse(MaintenanceUpdatedDto, {
    description: 'Request accepted by staff',
  })
  accept(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: AcceptMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.maintenanceService.accept(id, currentUser, body.note);
  }

  @Patch(':id/reject')
  @Roles(Role.STAFF)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(FileFieldsInterceptor([{ name: 'images', maxCount: 10 }]))
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Reject maintenance request with optional evidence images',
    type: RejectMaintenanceRequestDto,
  })
  @ApiOperation({ summary: 'Staff reject maintenance request' })
  @ApiJsonResponse(MaintenanceUpdatedDto, {
    description: 'Request rejected by staff',
  })
  async reject(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RejectMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFiles() files?: { images?: unknown[] },
  ) {
    const uploadedImageUrls = await this.uploadMaintenanceImages(
      id,
      'rejection',
      files?.images,
    );

    return this.maintenanceService.reject(
      id,
      currentUser,
      body.reason,
      uploadedImageUrls.length ? uploadedImageUrls : body.images,
    );
  }

  @Patch(':id')
  @Roles(Role.ADMIN, Role.OPERATOR, Role.STAFF)
  @ApiOperation({ summary: 'Update maintenance request' })
  @ApiJsonResponse(MaintenanceUpdatedDto, { description: 'Request updated' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() updateDto: UpdateMaintenanceDto,
  ) {
    return this.maintenanceService.update(id, updateDto);
  }

  @Patch(':id/complete')
  @Roles(Role.STAFF)
  @UsePipes(FileUploadPipe)
  @UseInterceptors(
    FileFieldsInterceptor([{ name: 'completionImages', maxCount: 10 }]),
  )
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'Complete maintenance request with optional completion images',
    type: CompleteMaintenanceRequestDto,
  })
  @ApiOperation({ summary: 'Complete maintenance request' })
  @ApiJsonResponse(MaintenanceDetailDto, { description: 'Request completed' })
  @ApiResponse({ status: 404, description: 'Request not found' })
  async complete(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: CompleteMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
    @UploadedFiles() files?: { completionImages?: unknown[] },
  ) {
    const uploadedImageUrls = await this.uploadMaintenanceImages(
      id,
      'completion',
      files?.completionImages,
    );

    return this.maintenanceService.complete(
      id,
      currentUser,
      body.resolutionNotes,
      body.cost,
      uploadedImageUrls.length ? uploadedImageUrls : body.completionImages,
    );
  }

  @Patch(':id/rate')
  @Roles(Role.USER)
  @ApiOperation({ summary: 'User rate completed maintenance support' })
  @ApiJsonResponse(MaintenanceUpdatedDto, { description: 'Request rated' })
  rate(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() body: RateMaintenanceDto,
    @CurrentUser() currentUser: JwtPayload,
  ) {
    return this.maintenanceService.rate(
      id,
      currentUser,
      body.rating,
      body.feedback,
    );
  }
}
