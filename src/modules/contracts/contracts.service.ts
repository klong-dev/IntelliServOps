import {
  Injectable,
  NotFoundException,
  ConflictException,
  BadRequestException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateContractDto,
  UpdateContractDto,
  UploadContractPdfDto,
  CancelContractDto,
  AddContractMemberDto,
} from './dto';
import type { UpdateContractPdfContentDto } from './dto/update-contract-pdf-content.dto';
import { RenewContractDto } from './dto/renew-contract.dto';
import {
  ContractStatus,
  ActorType,
  ApartmentStatus,
  MemberStatus,
  PartnerCooperationContractStatus,
  UserApartmentStatus,
  ReservationStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
  MemberType,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { ApartmentsService } from '../apartments/apartments.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ContractPdfData, ContractPdfService } from './contract-pdf.service';
import * as crypto from 'crypto';

@Injectable()
export class ContractsService {
  private readonly PDF_TOKEN_SECRET =
    process.env.JWT_SECRET || 'pdf-token-secret';
  private readonly PDF_TOKEN_EXPIRY = 5 * 60 * 1000; // 5 minutes

  private readonly depositInvoiceSelect = {
    id: true,
    invoiceNumber: true,
    invoiceType: true,
    status: true,
    totalAmount: true,
    dueDate: true,
  } as const;

  private readonly cancellableInvoiceStatuses: InvoiceStatus[] = [
    InvoiceStatus.draft,
    InvoiceStatus.issued,
    InvoiceStatus.sent,
    InvoiceStatus.partially_paid,
    InvoiceStatus.overdue,
  ];

  constructor(
    private readonly prisma: PrismaService,
    private readonly apartmentsService: ApartmentsService,
    private readonly notificationsService: NotificationsService,
    private readonly contractPdfService: ContractPdfService,
  ) {}

  private formatDate(d: Date): string {
    return `${d.getDate().toString().padStart(2, '0')}/${(d.getMonth() + 1)
      .toString()
      .padStart(2, '0')}/${d.getFullYear()}`;
  }

  private formatCurrency(amount: Prisma.Decimal | number | null | undefined) {
    if (amount === null || amount === undefined) {
      return undefined;
    }
    const num =
      typeof amount === 'object' && 'toNumber' in amount
        ? amount.toNumber()
        : Number(amount);
    if (!Number.isFinite(num)) {
      return undefined;
    }
    return num.toLocaleString('vi-VN');
  }

  private addMonthsKeepingContractDay(baseDate: Date, months: number): Date {
    const d = new Date(baseDate);
    const day = d.getDate();
    d.setMonth(d.getMonth() + months);
    if (d.getDate() < day) {
      d.setDate(0);
    }
    return d;
  }

  private getUtcDayStart(date = new Date()): Date {
    return new Date(
      Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
    );
  }

  private async syncExpiredContractsByDate(): Promise<void> {
    const todayStart = this.getUtcDayStart();

    await this.prisma.rentalContract.updateMany({
      where: {
        status: {
          in: [
            ContractStatus.pending,
            ContractStatus.signed,
            ContractStatus.active,
          ],
        },
        endDate: { lt: todayStart },
      },
      data: {
        status: ContractStatus.expired,
      },
    });
  }

  async regenerateContractPdf(contractId: string): Promise<void> {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        depositAmount: true,
        paymentDueDay: true,
        paymentMethod: true,
        specialConditions: true,
        landlordName: true,
        landlordIdNumber: true,
        landlordIdIssueDate: true,
        landlordIdIssuePlace: true,
        landlordAddress: true,
        landlordPhone: true,
        landlordSignature: true,
        tenantSignature: true,
        apartment: {
          select: {
            apartmentNumber: true,
            buildingName: true,
            totalArea: true,
            usableArea: true,
            numberOfBedrooms: true,
            numberOfBathrooms: true,
          },
        },
        members: {
          where: { status: MemberStatus.active },
          select: {
            memberType: true,
            isPrimaryContact: true,
            user: {
              select: {
                fullName: true,
                phone: true,
                email: true,
                identity: {
                  select: {
                    nationalId: true,
                    issueDate: true,
                    address: true,
                  },
                },
              },
            },
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const members = contract.members;
    const primaryMember =
      members.find((m) => m.memberType === 'primary' || m.isPrimaryContact) ||
      members[0];

    const apartmentAddress = [
      contract.apartment?.buildingName,
      contract.apartment?.apartmentNumber,
    ]
      .filter(Boolean)
      .join(' - ');

    const tenantMembers = members.map((member) => ({
      fullName: member.user.fullName || undefined,
      idNumber: member.user.identity?.nationalId || undefined,
      idIssueDate: member.user.identity?.issueDate || undefined,
      address: member.user.identity?.address || undefined,
      phone: member.user.phone || undefined,
      email: member.user.email || undefined,
      memberType: member.memberType,
    }));

    const pdfData: ContractPdfData = {
      contractNumber: contract.contractNumber,
      landlordName: contract.landlordName || undefined,
      landlordIdNumber: contract.landlordIdNumber || undefined,
      landlordIdIssueDate: contract.landlordIdIssueDate || undefined,
      landlordIdIssuePlace: contract.landlordIdIssuePlace || undefined,
      landlordAddress: contract.landlordAddress || undefined,
      landlordPhone: contract.landlordPhone || undefined,
      tenantName: primaryMember?.user.fullName || undefined,
      tenantIdNumber: primaryMember?.user.identity?.nationalId || undefined,
      tenantIdIssueDate: primaryMember?.user.identity?.issueDate || undefined,
      tenantAddress: primaryMember?.user.identity?.address || undefined,
      tenantPhone: primaryMember?.user.phone || undefined,
      tenantEmail: primaryMember?.user.email || undefined,
      tenantMembers,
      apartmentAddress: apartmentAddress || undefined,
      apartmentNumber: contract.apartment?.apartmentNumber || undefined,
      apartmentArea: contract.apartment?.totalArea?.toString() || undefined,
      apartmentUsableArea:
        contract.apartment?.usableArea?.toString() || undefined,
      apartmentBedrooms: contract.apartment?.numberOfBedrooms || undefined,
      apartmentBathrooms: contract.apartment?.numberOfBathrooms || undefined,
      startDate: this.formatDate(contract.startDate),
      endDate: this.formatDate(contract.endDate),
      monthlyRent: this.formatCurrency(contract.monthlyRent),
      depositAmount: this.formatCurrency(contract.depositAmount),
      paymentDueDay: contract.paymentDueDay,
      paymentMethod: contract.paymentMethod,
      specialConditions: contract.specialConditions || undefined,
      landlordSignature: contract.landlordSignature
        ? Buffer.from(contract.landlordSignature)
        : null,
      tenantSignature: contract.tenantSignature
        ? Buffer.from(contract.tenantSignature)
        : null,
    };

    const pdfBuffer =
      await this.contractPdfService.generateContractPdf(pdfData);

    await this.prisma.rentalContract.update({
      where: { id: contractId },
      data: { contractPdfData: new Uint8Array(pdfBuffer) },
    });
  }

  private async notifySafely(params: {
    recipientType: ActorType;
    recipientId: string;
    title: string;
    message: string;
    actionUrl?: string;
    actionLabel?: string;
    relatedEntityType?: string;
    relatedEntityId?: string;
  }): Promise<void> {
    try {
      await this.notificationsService.createAndPush({
        recipientType: params.recipientType,
        recipientId: params.recipientId,
        notificationType: 'info',
        channel: 'in_app',
        title: params.title,
        message: params.message,
        actionUrl: params.actionUrl,
        actionLabel: params.actionLabel,
        priority: 'high',
        relatedEntityType: params.relatedEntityType,
        relatedEntityId: params.relatedEntityId,
      });
    } catch {
      // Do not block contract flow when notification delivery fails.
    }
  }

  /**
   * Generate a signed token for PDF access (valid for 5 minutes)
   */
  generatePdfToken(contractId: string): string {
    const expiry = Date.now() + this.PDF_TOKEN_EXPIRY;
    const data = `${contractId}:${expiry}`;
    const signature = crypto
      .createHmac('sha256', this.PDF_TOKEN_SECRET)
      .update(data)
      .digest('hex');
    return Buffer.from(`${data}:${signature}`).toString('base64url');
  }

  /**
   * Verify PDF token and return contractId if valid
   */
  verifyPdfToken(token: string): string {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const [contractId, expiryStr, signature] = decoded.split(':');
      const expiry = parseInt(expiryStr, 10);

      if (Date.now() > expiry) {
        throw new UnauthorizedException('PDF token expired');
      }

      const expectedSignature = crypto
        .createHmac('sha256', this.PDF_TOKEN_SECRET)
        .update(`${contractId}:${expiryStr}`)
        .digest('hex');

      if (signature !== expectedSignature) {
        throw new UnauthorizedException('Invalid PDF token');
      }

      return contractId;
    } catch {
      throw new UnauthorizedException('Invalid PDF token');
    }
  }

  /**
   * Get contract PDF for public access (with valid token)
   */
  async getContractPdfPublic(token: string) {
    const contractId = this.verifyPdfToken(token);

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (!contract.contractPdfData) {
      throw new NotFoundException('Contract PDF not generated yet');
    }

    return {
      buffer: Buffer.from(contract.contractPdfData),
      contractNumber: contract.contractNumber,
    };
  }

  /**
   * Get all contracts with filters
   * Admin/Operator see all, Staff see assigned, User see own
   */
  async findAll(currentUser: JwtPayload, status?: ContractStatus) {
    await this.syncExpiredContractsByDate();

    const where: Prisma.RentalContractWhereInput = {
      ...(status && { status }),
    };

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      where.members = {
        some: { userId: currentUser.sub },
      };
    }

    const findAllArgs = Prisma.validator<Prisma.RentalContractFindManyArgs>()({
      where,
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        status: true,
        category: true,
        createdAt: true,
        contractPdfData: true,
        terminationReason: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
            provinceCode: true,
            buildingName: true,
            streetAddress: true,
          },
        },
        members: {
          select: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
              },
            },
            memberType: true,
            isPrimaryContact: true,
          },
        },
        renewalContracts: {
          select: {
            id: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
        invoices: {
          where: {
            invoiceType: InvoiceType.contractDeposit,
            status: InvoiceStatus.paid,
          },
          select: {
            id: true,
            paidAt: true,
          },
          take: 1,
          orderBy: { paidAt: 'desc' },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    const contracts = await this.prisma.rentalContract.findMany(findAllArgs);

    const items = contracts.map(
      ({ contractPdfData, invoices, renewalContracts, ...contract }) => {
        const pdfToken = contractPdfData
          ? this.generatePdfToken(contract.id)
          : null;
        const paidDepositInvoice = invoices?.[0] ?? null;
        const latestRenewal = renewalContracts?.[0] ?? null;

        return {
          ...contract,
          hasPdf: !!contractPdfData,
          pdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
          isDepositPaid: !!paidDepositInvoice,
          depositPaidAt: paidDepositInvoice?.paidAt ?? null,
          isRenewed: !!latestRenewal,
          latestRenewalContractId: latestRenewal?.id ?? null,
        };
      },
    );

    return items;
  }

  /**
   * Get contract by ID with full details
   */
  async findOne(id: string, currentUser: JwtPayload) {
    await this.syncExpiredContractsByDate();

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            wardCode: true,
            provinceCode: true,
            buildingName: true,
            streetAddress: true,
            numberOfBedrooms: true,
            numberOfBathrooms: true,
            totalArea: true,
            usableArea: true,
          },
        },
        members: {
          include: {
            user: {
              select: {
                id: true,
                fullName: true,
                email: true,
                phone: true,
                identity: {
                  select: {
                    nationalId: true,
                  },
                },
              },
            },
          },
        },
        createdByStaff: {
          select: {
            id: true,
            fullName: true,
          },
        },
        invoices: {
          take: 5,
          orderBy: { createdAt: 'desc' },
          select: {
            id: true,
            invoiceNumber: true,
            totalAmount: true,
            status: true,
            dueDate: true,
          },
        },
        renewalContracts: {
          select: {
            id: true,
          },
          take: 1,
          orderBy: { createdAt: 'desc' },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      const isMember = contract.members.some(
        (m) => m.user.id === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Contract not found');
      }
    }

    const paidDepositInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: id,
        invoiceType: InvoiceType.contractDeposit,
        status: InvoiceStatus.paid,
      },
      select: {
        paidAt: true,
      },
      orderBy: { paidAt: 'desc' },
    });

    // Convert binary PDF to base64 for JSON response
    const { contractPdfData, landlordSignature, tenantSignature, ...rest } =
      contract as any;

    const pdfToken = contractPdfData ? this.generatePdfToken(id) : null;
    const membersWithNationalId = (rest.members ?? []).map((member: any) => ({
      ...member,
      user: {
        id: member.user.id,
        fullName: member.user.fullName,
        email: member.user.email,
        phone: member.user.phone,
        nationalId: member.user.identity?.nationalId || null,
      },
    }));

    return {
      ...rest,
      members: membersWithNationalId,
      hasPdf: !!contractPdfData,
      pdfUrl: `/contracts/${id}/pdf`,
      publicPdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
      hasLandlordSignature: !!landlordSignature,
      hasTenantSignature: !!tenantSignature,
      isDepositPaid: !!paidDepositInvoice,
      depositPaidAt: paidDepositInvoice?.paidAt ?? null,
      isRenewed: !!rest.renewalContracts?.length,
      latestRenewalContractId: rest.renewalContracts?.[0]?.id ?? null,
    };
  }

  /**
   * Get contract PDF data for download
   */
  async getContractPdf(id: string, currentUser: JwtPayload) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
        members: {
          select: { userId: true },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Users can only access their own contracts
    if (currentUser.actorType === 'user') {
      const isMember = contract.members.some(
        (m) => m.userId === currentUser.sub,
      );
      if (!isMember) {
        throw new NotFoundException('Contract not found');
      }
    }

    if (!contract.contractPdfData) {
      throw new NotFoundException('Contract PDF has not been generated yet');
    }

    return {
      buffer: contract.contractPdfData,
      contractNumber: contract.contractNumber,
    };
  }

  /**
   * Upload signed contract PDF from frontend
   */
  async uploadSignedPdf(
    id: string,
    contractPdf: any,
    currentUser: JwtPayload,
    body?: UploadContractPdfDto,
  ) {
    const validMimeTypes = ['application/pdf'];
    if (!validMimeTypes.includes(contractPdf.mimetype)) {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        contractNumber: true,
        contractPdfData: true,
        startDate: true,
        depositAmount: true,
        paymentMethod: true,
        apartment: {
          select: {
            depositAmount: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const updateData: Prisma.RentalContractUpdateInput = {
      contractPdfData: new Uint8Array(contractPdf.buffer),
      status: ContractStatus.signed,
    };

    if (body?.signedDate) {
      updateData.signedDate = new Date(body.signedDate);
    }

    if (body?.contractDocumentUrl) {
      updateData.contractDocumentUrl = body.contractDocumentUrl;
    }

    await this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
    });

    await this.prisma.reservation.updateMany({
      where: { createdContractId: id },
      data: {
        status: ReservationStatus.confirmed,
        cancelReason: null,
      },
    });

    const depositInvoice =
      await this.createDepositInvoiceForSignedContract(contract);

    if (!depositInvoice) {
      throw new BadRequestException(
        'Cannot create contract deposit invoice because deposit amount is missing or invalid',
      );
    }

    const contractDetail = await this.findOne(id, currentUser);
    return {
      ...contractDetail,
      depositInvoice,
    };
  }

  async signCooperationContract(
    contractId: string,
    currentUser: JwtPayload,
    contractPdf: {
      mimetype: string;
      buffer: Buffer;
    },
    options?: { signedDate?: string; contractDocumentUrl?: string },
  ) {
    if (contractPdf.mimetype !== 'application/pdf') {
      throw new BadRequestException(
        `Invalid PDF format. Allowed: application/pdf. Received: ${contractPdf.mimetype}`,
      );
    }

    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        partnerId: true,
        apartmentId: true,
        approvedByOperatorId: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            status: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (contract.partnerId !== currentUser.sub) {
      throw new UnauthorizedException(
        'You can only sign your own cooperation contract',
      );
    }

    if (contract.apartment.status !== ('pending' as ApartmentStatus)) {
      throw new BadRequestException(
        'Apartment must be pending before partner signs cooperation contract',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.cancelled ||
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired
    ) {
      throw new ConflictException('Cooperation contract cannot be signed');
    }

    const signedDate = options?.signedDate
      ? new Date(options.signedDate)
      : new Date();

    const updated = await this.prisma.$transaction(async (tx) => {
      const signedContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          contractPdfData: new Uint8Array(contractPdf.buffer),
          contractDocumentUrl: options?.contractDocumentUrl,
          signedAt: signedDate,
          status: PartnerCooperationContractStatus.signed,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
          signedAt: true,
          contractDocumentUrl: true,
        },
      });

      const updatedApartment = await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: {
          status: ApartmentStatus.available,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });

      return { signedContract, updatedApartment };
    });

    const token = this.generatePdfToken(updated.signedContract.id);

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner da ky hop dong hop tac',
        message: `Partner da ky va upload hop dong cho can ho ${updated.updatedApartment.apartmentNumber}.`,
        actionUrl: `/apartments/${updated.updatedApartment.id}/cooperation-contract`,
        actionLabel: 'Xem hop dong',
        relatedEntityType: 'Apartment',
        relatedEntityId: updated.updatedApartment.id,
      });
    }

    return {
      apartmentId: updated.updatedApartment.id,
      apartmentNumber: updated.updatedApartment.apartmentNumber,
      apartmentStatus: updated.updatedApartment.status,
      cooperationContractId: updated.signedContract.id,
      cooperationContractNumber: updated.signedContract.contractNumber,
      cooperationContractStatus: updated.signedContract.status,
      signedDate: updated.signedContract.signedAt,
      contractDocumentUrl: updated.signedContract.contractDocumentUrl,
      cooperationContractPdfUrl: `/apartments/cooperation-contracts/${updated.signedContract.id}/pdf`,
      cooperationContractPublicPdfUrl: `/apartments/cooperation-contracts/pdf/view?token=${token}`,
    };
  }

  async cancelCooperationContract(
    contractId: string,
    currentUser: JwtPayload,
    body?: { reason?: string },
  ) {
    const contract = await this.prisma.partnerCooperationContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        status: true,
        notes: true,
        partnerId: true,
        approvedByOperatorId: true,
        apartmentId: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Cooperation contract not found');
    }

    if (contract.partnerId !== currentUser.sub) {
      throw new UnauthorizedException(
        'You can only cancel your own cooperation contract',
      );
    }

    if (
      contract.status === PartnerCooperationContractStatus.cancelled ||
      contract.status === PartnerCooperationContractStatus.terminated ||
      contract.status === PartnerCooperationContractStatus.expired
    ) {
      throw new ConflictException('Cooperation contract cannot be cancelled');
    }

    const cancelledAt = new Date();
    const cancelReason = body?.reason?.trim() || null;

    const updated = await this.prisma.$transaction(async (tx) => {
      const cancelledContract = await tx.partnerCooperationContract.update({
        where: { id: contract.id },
        data: {
          status: PartnerCooperationContractStatus.cancelled,
          endDate: cancelledAt,
          notes: cancelReason
            ? `${contract.notes ?? ''}${contract.notes ? '\n' : ''}Cancelled by partner: ${cancelReason}`
            : contract.notes,
        },
        select: {
          id: true,
          contractNumber: true,
          status: true,
        },
      });

      const updatedApartment = await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: {
          status: ApartmentStatus.inactive,
        },
        select: {
          id: true,
          apartmentNumber: true,
          status: true,
        },
      });

      return { cancelledContract, updatedApartment };
    });

    if (contract.approvedByOperatorId) {
      await this.notifySafely({
        recipientType: ActorType.operator,
        recipientId: contract.approvedByOperatorId,
        title: 'Partner da huy hop dong hop tac',
        message: `Partner da huy hop dong hop tac cua can ho ${updated.updatedApartment.apartmentNumber}.`,
        actionUrl: `/apartments/${updated.updatedApartment.id}/cooperation-contract`,
        actionLabel: 'Xem hop dong',
        relatedEntityType: 'Apartment',
        relatedEntityId: updated.updatedApartment.id,
      });
    }

    return {
      apartmentId: updated.updatedApartment.id,
      apartmentNumber: updated.updatedApartment.apartmentNumber,
      apartmentStatus: updated.updatedApartment.status,
      cooperationContractId: updated.cancelledContract.id,
      cooperationContractNumber: updated.cancelledContract.contractNumber,
      cooperationContractStatus: updated.cancelledContract.status,
      cancelledAt,
      cancelReason,
    };
  }

  /**
   * Create new rental contract
   */
  async create(createDto: CreateContractDto, currentUser: JwtPayload) {
    if (!createDto.members?.length) {
      throw new BadRequestException('At least one contract member is required');
    }

    const normalizedMembers = createDto.members.map((member) => ({
      ...member,
      isPrimaryContact:
        member.isPrimaryContact ?? member.memberType === 'primary',
    }));

    const memberUserIds = normalizedMembers.map((member) => member.userId);
    const uniqueMemberUserIds = new Set(memberUserIds);
    if (uniqueMemberUserIds.size !== memberUserIds.length) {
      throw new BadRequestException(
        'Duplicate userId is not allowed in contract members',
      );
    }

    const primaryMembers = normalizedMembers.filter(
      (member) => member.memberType === MemberType.primary,
    );
    if (primaryMembers.length !== 1) {
      throw new BadRequestException(
        'Contract must have exactly one primary member',
      );
    }

    const primaryContacts = normalizedMembers.filter(
      (member) => member.isPrimaryContact,
    );
    if (primaryContacts.length > 1) {
      throw new BadRequestException(
        'Only one primary contact is allowed in contract members',
      );
    }

    const primaryUserId = primaryMembers[0].userId;
    const primaryContactUserId = primaryContacts[0]?.userId;
    if (primaryContactUserId && primaryContactUserId !== primaryUserId) {
      throw new BadRequestException(
        'Primary contact must be the same user as primary member',
      );
    }

    // Check if apartment is available
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
      select: { id: true, status: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (apartment.status !== ApartmentStatus.available) {
      throw new ConflictException('Apartment is not available for rent');
    }

    // Check for overlapping contracts
    const overlapping = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: createDto.apartmentId,
        status: { in: ['active', 'pending', 'signed'] },
        OR: [
          {
            startDate: { lte: new Date(createDto.endDate) },
            endDate: { gte: new Date(createDto.startDate) },
          },
        ],
      },
    });

    if (overlapping) {
      throw new ConflictException('Apartment has an overlapping contract');
    }

    // Generate contract number
    const contractNumber = await this.generateContractNumber();

    // Create contract with members in transaction
    const createdContract = await this.prisma.$transaction(async (tx) => {
      const contract = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: createDto.apartmentId } },
          startDate: new Date(createDto.startDate),
          endDate: new Date(createDto.endDate),
          monthlyRent: createDto.monthlyRent,
          depositAmount: createDto.depositAmount,
          paymentDueDay: createDto.paymentDueDay,
          paymentMethod: createDto.paymentMethod,
          utilitiesIncluded: createDto.utilitiesIncluded as any,
          utilitiesCharges: createDto.utilitiesCharges as any,
          contractTerms: createDto.contractTerms,
          specialConditions: createDto.specialConditions,
          status: ContractStatus.draft,
          createdByStaff:
            currentUser.actorType === 'staff'
              ? { connect: { id: currentUser.sub } }
              : undefined,
        },
        select: {
          id: true,
          contractNumber: true,
        },
      });

      // Create contract members
      await tx.userContractMember.createMany({
        data: normalizedMembers.map((m) => ({
          userId: m.userId,
          rentalContractId: contract.id,
          memberType: m.memberType,
          isPrimaryContact: m.isPrimaryContact,
          sharePercentage: m.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return contract;
    });

    return this.findOne(createdContract.id, currentUser);
  }

  /**
   * Update contract
   */
  async update(id: string, updateDto: UpdateContractDto) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    // Prevent editing active/signed contracts (except status changes)
    if (
      (contract.status === ContractStatus.active ||
        contract.status === ContractStatus.signed) &&
      updateDto.status !== ContractStatus.terminated
    ) {
      throw new ConflictException('Cannot modify active contract');
    }

    const updateData: any = { ...updateDto };

    if (updateDto.startDate) {
      updateData.startDate = new Date(updateDto.startDate);
    }
    if (updateDto.endDate) {
      updateData.endDate = new Date(updateDto.endDate);
    }
    if (updateDto.signedDate) {
      updateData.signedDate = new Date(updateDto.signedDate);
    }
    if (updateDto.terminationDate) {
      updateData.terminationDate = new Date(updateDto.terminationDate);
    }

    return this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
      select: {
        id: true,
        contractNumber: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async updateContractPdfContent(
    id: string,
    updateDto: UpdateContractPdfContentDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      select: {
        id: true,
        status: true,
        startDate: true,
        endDate: true,
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException(
        'Cannot edit PDF content of terminated or expired contract',
      );
    }

    const nextStartDate = updateDto.startDate
      ? new Date(updateDto.startDate)
      : contract.startDate;
    const nextEndDate = updateDto.endDate
      ? new Date(updateDto.endDate)
      : contract.endDate;

    if (nextStartDate >= nextEndDate) {
      throw new BadRequestException('startDate must be earlier than endDate');
    }

    const updateData: Prisma.RentalContractUpdateInput = {
      ...(updateDto.landlordName !== undefined && {
        landlordName: updateDto.landlordName,
      }),
      ...(updateDto.landlordIdNumber !== undefined && {
        landlordIdNumber: updateDto.landlordIdNumber,
      }),
      ...(updateDto.landlordIdIssueDate !== undefined && {
        landlordIdIssueDate: updateDto.landlordIdIssueDate,
      }),
      ...(updateDto.landlordIdIssuePlace !== undefined && {
        landlordIdIssuePlace: updateDto.landlordIdIssuePlace,
      }),
      ...(updateDto.landlordAddress !== undefined && {
        landlordAddress: updateDto.landlordAddress,
      }),
      ...(updateDto.landlordPhone !== undefined && {
        landlordPhone: updateDto.landlordPhone,
      }),
      ...(updateDto.startDate && { startDate: new Date(updateDto.startDate) }),
      ...(updateDto.endDate && { endDate: new Date(updateDto.endDate) }),
      ...(updateDto.monthlyRent !== undefined && {
        monthlyRent: updateDto.monthlyRent,
      }),
      ...(updateDto.depositAmount !== undefined && {
        depositAmount: updateDto.depositAmount,
      }),
      ...(updateDto.paymentDueDay !== undefined && {
        paymentDueDay: updateDto.paymentDueDay,
      }),
      ...(updateDto.paymentMethod && {
        paymentMethod: updateDto.paymentMethod,
      }),
      ...(updateDto.specialConditions !== undefined && {
        specialConditions: updateDto.specialConditions,
      }),
      ...(updateDto.contractTerms !== undefined && {
        contractTerms: updateDto.contractTerms,
      }),
    };

    await this.prisma.rentalContract.update({
      where: { id },
      data: updateData,
    });

    await this.regenerateContractPdf(id);

    return this.findOne(id, currentUser);
  }

  /**
   * Activate contract (sign)
   */
  async activate(id: string) {
    await this.syncExpiredContractsByDate();

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status !== ContractStatus.pending &&
      contract.status !== ContractStatus.signed
    ) {
      throw new ConflictException(
        'Contract must be pending or signed to activate',
      );
    }

    const todayStart = this.getUtcDayStart();
    if (contract.startDate > todayStart) {
      throw new ConflictException(
        'Contract can only be activated on or after startDate',
      );
    }

    if (contract.endDate < todayStart) {
      await this.prisma.rentalContract.update({
        where: { id },
        data: { status: ContractStatus.expired },
      });
      throw new ConflictException('Contract already expired');
    }

    // Update contract and apartment status in transaction
    return this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.active,
          signedDate: new Date(),
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.occupied },
      }),
    ]);
  }

  /**
   * Terminate contract
   */
  async terminate(id: string, reason: string, terminationFee?: number) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (contract.status !== ContractStatus.active) {
      throw new ConflictException('Only active contracts can be terminated');
    }

    return this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.terminated,
          terminationDate: new Date(),
          terminationReason: reason,
          earlyTerminationFee: terminationFee,
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.available },
      }),
      this.prisma.invoice.updateMany({
        where: {
          rentalContractId: id,
          status: { in: this.cancellableInvoiceStatuses },
        },
        data: {
          status: InvoiceStatus.cancelled,
          cancelledAt: new Date(),
          cancellationReason: `Contract terminated: ${reason}`,
        },
      }),
      this.prisma.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: new Date() },
      }),
      this.prisma.userApartment.updateMany({
        where: { rentalContractId: id },
        data: {
          status: UserApartmentStatus.moved_out,
          moveOutDate: new Date(),
        },
      }),
    ]);
  }

  async cancelByUser(
    id: string,
    cancelDto: CancelContractDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        members: {
          select: {
            userId: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    const isMember = contract.members.some((m) => m.userId === currentUser.sub);
    if (!isMember) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException('Contract cannot be cancelled');
    }

    const cancelReason = `User cancelled: ${cancelDto.reason}`;
    const terminatedAt = new Date();

    await this.prisma.$transaction(async (tx) => {
      await tx.reservation.updateMany({
        where: { createdContractId: id },
        data: { status: ReservationStatus.cancelled },
      });

      await tx.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.terminated,
          terminationDate: terminatedAt,
          terminationReason: cancelReason,
          earlyTerminationFee: null,
        },
      });

      await tx.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.available },
      });

      await tx.invoice.updateMany({
        where: {
          rentalContractId: id,
          status: { in: this.cancellableInvoiceStatuses },
        },
        data: {
          status: InvoiceStatus.cancelled,
          cancelledAt: terminatedAt,
          cancellationReason: cancelReason,
        },
      });

      await tx.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: terminatedAt },
      });

      await tx.userApartment.updateMany({
        where: { rentalContractId: id },
        data: {
          status: UserApartmentStatus.moved_out,
          moveOutDate: terminatedAt,
        },
      });
    });

    return await this.findOne(id, currentUser);
  }

  /**
   * Activate contract when deposit has been paid and contract is still valid.
   */
  async activateWhenDepositPaid(id: string) {
    await this.syncExpiredContractsByDate();

    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: { apartment: true },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status !== ContractStatus.pending &&
      contract.status !== ContractStatus.signed
    ) {
      throw new ConflictException(
        'Contract must be pending or signed to activate',
      );
    }

    const todayStart = this.getUtcDayStart();
    if (contract.endDate < todayStart) {
      await this.prisma.rentalContract.update({
        where: { id },
        data: { status: ContractStatus.expired },
      });
      throw new ConflictException('Contract already expired');
    }

    const paidDepositInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: id,
        invoiceType: InvoiceType.contractDeposit,
        status: InvoiceStatus.paid,
      },
      select: { id: true },
    });

    if (!paidDepositInvoice) {
      throw new ConflictException(
        'Contract deposit invoice must be paid before activation',
      );
    }

    return this.prisma.$transaction([
      this.prisma.rentalContract.update({
        where: { id },
        data: {
          status: ContractStatus.active,
          signedDate: new Date(),
        },
      }),
      this.prisma.apartment.update({
        where: { id: contract.apartmentId },
        data: { status: ApartmentStatus.occupied },
      }),
    ]);
  }

  async addMemberByNationalId(
    contractId: string,
    body: AddContractMemberDto,
    currentUser: JwtPayload,
  ) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        status: true,
        members: {
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
          },
        },
      },
    });

    if (!contract) {
      throw new NotFoundException('Contract not found');
    }

    if (
      contract.status === ContractStatus.signed ||
      contract.status === ContractStatus.active ||
      contract.status === ContractStatus.terminated ||
      contract.status === ContractStatus.expired
    ) {
      throw new ConflictException(
        'Cannot add members after contract is signed',
      );
    }

    if (currentUser.actorType === 'user') {
      const hasPermission = contract.members.some(
        (member) => member.userId === currentUser.sub,
      );
      if (!hasPermission) {
        throw new NotFoundException('Contract not found');
      }
    }

    const normalizedNationalId = body.nationalId.trim();
    if (!normalizedNationalId) {
      throw new BadRequestException('nationalId is required');
    }

    const identity = await this.prisma.userIdentity.findFirst({
      where: {
        nationalId: normalizedNationalId,
        isVerified: true,
      },
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            isActive: true,
            isVerified: true,
          },
        },
      },
    });

    if (!identity || !identity.user.isActive || !identity.user.isVerified) {
      throw new BadRequestException(
        'No active verified user found for this CCCD number',
      );
    }

    const existedMember = contract.members.some(
      (member) => member.userId === identity.userId,
    );
    if (existedMember) {
      throw new ConflictException('This user is already a contract member');
    }

    const targetMemberType = body.memberType ?? MemberType.co_tenant;
    const targetIsPrimaryContact = body.isPrimaryContact ?? false;

    if (targetMemberType === MemberType.primary) {
      throw new BadRequestException(
        'Cannot add another primary member to this contract',
      );
    }

    if (targetIsPrimaryContact) {
      const hasPrimaryContact = contract.members.some(
        (member) => member.isPrimaryContact,
      );
      if (hasPrimaryContact) {
        throw new BadRequestException(
          'Contract already has a primary contact member',
        );
      }
    }

    await this.prisma.userContractMember.create({
      data: {
        userId: identity.userId,
        rentalContractId: contractId,
        memberType: targetMemberType,
        isPrimaryContact: targetIsPrimaryContact,
        sharePercentage: body.sharePercentage,
        status: MemberStatus.active,
      },
    });

    await this.regenerateContractPdf(contractId);

    return this.findOne(contractId, currentUser);
  }

  async renewContract(
    contractId: string,
    renewDto: RenewContractDto,
    currentUser: JwtPayload,
  ) {
    await this.syncExpiredContractsByDate();

    const sourceContract = await this.prisma.rentalContract.findUnique({
      where: { id: contractId },
      select: {
        id: true,
        contractNumber: true,
        apartmentId: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        depositAmount: true,
        paymentDueDay: true,
        paymentMethod: true,
        utilitiesIncluded: true,
        utilitiesCharges: true,
        contractTerms: true,
        specialConditions: true,
        status: true,
        members: {
          where: { status: MemberStatus.active },
          select: {
            userId: true,
            memberType: true,
            isPrimaryContact: true,
            sharePercentage: true,
          },
        },
      },
    });

    if (!sourceContract) {
      throw new NotFoundException('Contract not found');
    }

    if (currentUser.actorType !== 'user') {
      throw new UnauthorizedException('Only users can renew rental contracts');
    }

    const isMember = sourceContract.members.some(
      (member) => member.userId === currentUser.sub,
    );
    if (!isMember) {
      throw new NotFoundException('Contract not found');
    }

    if (
      sourceContract.status !== ContractStatus.active &&
      sourceContract.status !== ContractStatus.signed &&
      sourceContract.status !== ContractStatus.expired
    ) {
      throw new ConflictException(
        'Only active/signed/expired contracts can be renewed',
      );
    }

    if (!sourceContract.members.length) {
      throw new BadRequestException('Source contract has no active members');
    }

    const autoStartDate = new Date(sourceContract.endDate);
    autoStartDate.setDate(autoStartDate.getDate() + 1);

    const nextStartDate = renewDto.startDate
      ? new Date(renewDto.startDate)
      : autoStartDate;

    if (isNaN(nextStartDate.getTime())) {
      throw new BadRequestException('Invalid startDate');
    }

    let nextEndDate: Date;
    if (renewDto.endDate) {
      nextEndDate = new Date(renewDto.endDate);
      if (isNaN(nextEndDate.getTime())) {
        throw new BadRequestException('Invalid endDate');
      }
    } else {
      if (!renewDto.extensionMonths) {
        throw new BadRequestException(
          'extensionMonths is required when endDate is not provided',
        );
      }
      nextEndDate = this.addMonthsKeepingContractDay(
        nextStartDate,
        renewDto.extensionMonths,
      );
      nextEndDate.setDate(nextEndDate.getDate() - 1);
    }

    if (nextEndDate <= nextStartDate) {
      throw new BadRequestException('endDate must be after startDate');
    }

    const overlappingContract = await this.prisma.rentalContract.findFirst({
      where: {
        apartmentId: sourceContract.apartmentId,
        id: { not: sourceContract.id },
        status: {
          in: [
            ContractStatus.draft,
            ContractStatus.pending,
            ContractStatus.signed,
            ContractStatus.active,
          ],
        },
        startDate: { lte: nextEndDate },
        endDate: { gte: nextStartDate },
      },
      select: { id: true },
    });

    if (overlappingContract) {
      throw new ConflictException('Apartment has an overlapping contract');
    }

    const normalizedMembers: Array<{
      userId: string;
      memberType: MemberType;
      isPrimaryContact: boolean;
      sharePercentage: Prisma.Decimal | number | null;
    }> = sourceContract.members.map((member) => ({
      userId: member.userId,
      memberType: member.memberType,
      isPrimaryContact: member.isPrimaryContact,
      sharePercentage: member.sharePercentage,
    }));

    for (const additionalMember of renewDto.additionalMembers ?? []) {
      const nationalId = additionalMember.nationalId?.trim();
      if (!nationalId) {
        throw new BadRequestException(
          'additionalMembers.nationalId is required',
        );
      }

      const identity = await this.prisma.userIdentity.findFirst({
        where: {
          nationalId,
          isVerified: true,
        },
        select: {
          userId: true,
          user: {
            select: {
              id: true,
              isActive: true,
              isVerified: true,
            },
          },
        },
      });

      if (!identity || !identity.user.isActive || !identity.user.isVerified) {
        throw new BadRequestException(
          `No active verified user found for CCCD: ${nationalId}`,
        );
      }

      const existedMember = normalizedMembers.some(
        (member) => member.userId === identity.userId,
      );
      if (existedMember) {
        throw new ConflictException(
          `User with CCCD ${nationalId} is already in renewed contract members`,
        );
      }

      normalizedMembers.push({
        userId: identity.userId,
        memberType: additionalMember.memberType ?? MemberType.co_tenant,
        isPrimaryContact: additionalMember.isPrimaryContact ?? false,
        sharePercentage: additionalMember.sharePercentage ?? null,
      });
    }

    const primaryMembers = normalizedMembers.filter(
      (member) => member.memberType === MemberType.primary,
    );
    if (primaryMembers.length !== 1) {
      throw new BadRequestException(
        'Renewed contract must have exactly one primary member',
      );
    }

    const primaryContacts = normalizedMembers.filter(
      (member) => member.isPrimaryContact,
    );
    if (primaryContacts.length > 1) {
      throw new BadRequestException(
        'Only one primary contact is allowed in renewed contract members',
      );
    }

    const primaryUserId = primaryMembers[0].userId;
    const primaryContactUserId = primaryContacts[0]?.userId;
    if (primaryContactUserId && primaryContactUserId !== primaryUserId) {
      throw new BadRequestException(
        'Primary contact must be the same user as primary member',
      );
    }

    const contractNumber = await this.generateContractNumber();

    const renewedContract = await this.prisma.$transaction(async (tx) => {
      const created = await tx.rentalContract.create({
        data: {
          contractNumber,
          apartment: { connect: { id: sourceContract.apartmentId } },
          startDate: nextStartDate,
          endDate: nextEndDate,
          monthlyRent: renewDto.monthlyRent ?? sourceContract.monthlyRent,
          depositAmount: renewDto.depositAmount ?? sourceContract.depositAmount,
          paymentDueDay: renewDto.paymentDueDay ?? sourceContract.paymentDueDay,
          paymentMethod: renewDto.paymentMethod ?? sourceContract.paymentMethod,
          utilitiesIncluded:
            (renewDto.utilitiesIncluded as any) ??
            (sourceContract.utilitiesIncluded as any),
          utilitiesCharges:
            (renewDto.utilitiesCharges as any) ??
            (sourceContract.utilitiesCharges as any),
          contractTerms: renewDto.contractTerms ?? sourceContract.contractTerms,
          specialConditions:
            renewDto.specialConditions ?? sourceContract.specialConditions,
          status: ContractStatus.draft,
          category: 'renewal',
          renewedFromContract: { connect: { id: sourceContract.id } },
        } as any,
        select: { id: true },
      });

      await tx.userContractMember.createMany({
        data: normalizedMembers.map((member) => ({
          userId: member.userId,
          rentalContractId: created.id,
          memberType: member.memberType,
          isPrimaryContact: member.isPrimaryContact,
          sharePercentage: member.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return created;
    });

    await this.regenerateContractPdf(renewedContract.id);

    const detail = await this.findOne(renewedContract.id, currentUser);
    const effectiveMonths = renewDto.extensionMonths ?? null;

    return {
      sourceContractId: sourceContract.id,
      sourceContractNumber: sourceContract.contractNumber,
      extensionMonths: effectiveMonths,
      renewedContract: detail,
    };
  }

  private async generateContractNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const count = await this.prisma.rentalContract.count({
      where: {
        contractNumber: { startsWith: `CTR-${year}` },
      },
    });
    return `CTR-${year}-${String(count + 1).padStart(5, '0')}`;
  }

  private async createDepositInvoiceForSignedContract(contract: {
    id: string;
    contractNumber: string;
    startDate: Date;
    depositAmount: Prisma.Decimal;
    paymentMethod: PaymentMethodType;
    apartment: { depositAmount: Prisma.Decimal | null } | null;
  }) {
    const marker = `DEPOSIT_INVOICE_FOR_CONTRACT:${contract.id}`;

    const existingDepositInvoice = await this.prisma.invoice.findFirst({
      where: {
        rentalContractId: contract.id,
        notes: {
          contains: marker,
        },
      },
      select: this.depositInvoiceSelect,
    });

    if (existingDepositInvoice) {
      if (existingDepositInvoice.invoiceType === InvoiceType.deposit) {
        const updated = await this.prisma.invoice.update({
          where: { id: existingDepositInvoice.id },
          data: { invoiceType: InvoiceType.contractDeposit },
          select: this.depositInvoiceSelect,
        });
        return updated;
      }
      return existingDepositInvoice;
    }

    const apartmentDeposit = contract.apartment?.depositAmount
      ? Number(contract.apartment.depositAmount)
      : 0;
    const contractDeposit = Number(contract.depositAmount);
    const depositAmount =
      apartmentDeposit > 0 ? apartmentDeposit : contractDeposit;

    if (!Number.isFinite(depositAmount) || depositAmount <= 0) {
      return null;
    }

    const invoiceNumber = await this.generateDepositInvoiceNumber();
    const now = new Date();
    const depositCharge: Prisma.InputJsonArray = [
      {
        description: `Deposit for contract ${contract.contractNumber}`,
        amount: depositAmount,
        quantity: 1,
        itemType: 'contractDeposit',
      },
    ];
    const invoiceContent: Prisma.InputJsonObject = {
      title: `Deposit invoice for ${contract.contractNumber}`,
      description: 'Security deposit payment',
      items: depositCharge,
    };

    return this.prisma.invoice.create({
      data: {
        invoiceNumber,
        rentalContract: { connect: { id: contract.id } },
        invoiceType: InvoiceType.contractDeposit,
        invoiceContent,
        billingPeriodStart: contract.startDate,
        billingPeriodEnd: contract.startDate,
        issueDate: now,
        dueDate: now,
        baseRent: 0,
        additionalCharges: depositCharge,
        totalAmount: depositAmount,
        paymentMethod: contract.paymentMethod,
        status: InvoiceStatus.issued,
        notes: `Auto-created deposit invoice. ${marker}`,
      },
      select: this.depositInvoiceSelect,
    });
  }

  private async generateDepositInvoiceNumber(): Promise<string> {
    const year = new Date().getFullYear();
    const month = String(new Date().getMonth() + 1).padStart(2, '0');
    const prefix = `INV-DEP-${year}${month}`;
    const count = await this.prisma.invoice.count({
      where: {
        invoiceNumber: { startsWith: prefix },
      },
    });

    return `${prefix}-${String(count + 1).padStart(5, '0')}`;
  }
}
