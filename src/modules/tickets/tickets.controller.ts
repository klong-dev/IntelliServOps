import {
  BadRequestException,
  Controller,
  Get,
  Param,
  Post,
  Body,
  Query,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { memoryStorage } from 'multer';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Roles, CurrentUser } from '../../common/decorators';
import { Role } from '../../common/enums/role.enum';
import type { JwtPayload } from '../auth/auth.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { TicketsService } from './tickets.service';
import {
  ResolveTicketDto,
  ResolveTicketRequestDto,
  TicketListQueryDto,
  TicketResponseDto,
} from './dto';

type UploadedTicketImage = {
  originalname: string;
  mimetype: string;
  buffer: Buffer;
  size: number;
};

@ApiTags('tickets')
@ApiBearerAuth('JWT-auth')
@Controller('tickets')
@Roles(Role.STAFF)
export class TicketsController {
  constructor(
    private readonly ticketsService: TicketsService,
    private readonly storageService: SupabaseStorageService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'List rent overdue tickets' })
  @ApiOkResponse({ type: TicketResponseDto, isArray: true })
  findAll(
    @CurrentUser() currentUser: JwtPayload,
    @Query() query: TicketListQueryDto,
  ) {
    return this.ticketsService.findAll(currentUser, query);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get ticket detail' })
  @ApiOkResponse({ type: TicketResponseDto })
  findOne(@Param('id') id: string, @CurrentUser() currentUser: JwtPayload) {
    return this.ticketsService.findOne(id, currentUser);
  }

  @Post(':id/resolve')
  @ApiOperation({ summary: 'Resolve rent overdue ticket' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    type: ResolveTicketRequestDto,
  })
  @ApiOkResponse({ type: TicketResponseDto })
  @UseInterceptors(
    FilesInterceptor('images', 10, {
      storage: memoryStorage(),
      fileFilter: (_req, file, cb) => {
        if (['image/jpeg', 'image/png', 'image/webp'].includes(file.mimetype))
          return cb(null, true);
        return cb(new BadRequestException('Invalid image format'), false);
      },
    }),
  )
  async resolve(
    @Param('id') id: string,
    @Body() dto: ResolveTicketDto,
    @UploadedFiles() files: UploadedTicketImage[] = [],
    @CurrentUser() currentUser: JwtPayload,
  ) {
    const imageUrls = await Promise.all(
      files.map((file, index) =>
        this.storageService.uploadFile(
          'apartment-cooperation',
          `tickets/${id}/${Date.now()}-${index}-${file.originalname}`,
          file,
        ),
      ),
    );
    return this.ticketsService.resolve(id, dto, imageUrls, currentUser);
  }
}
