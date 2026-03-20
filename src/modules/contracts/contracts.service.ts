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
} from './dto';
import {
  ContractStatus,
  ApartmentStatus,
  MemberStatus,
  InvoiceStatus,
  InvoiceType,
  PaymentMethodType,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { ApartmentsService } from '../apartments/apartments.service';
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

  constructor(
    private readonly prisma: PrismaService,
    private readonly apartmentsService: ApartmentsService,
  ) {}

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
    const where: Prisma.RentalContractWhereInput = {
      ...(status && { status }),
    };

    // Users can only see their own contracts
    if (currentUser.actorType === 'user') {
      where.members = {
        some: { userId: currentUser.sub },
      };
    }

    const contracts = await this.prisma.rentalContract.findMany({
      where,
      select: {
        id: true,
        contractNumber: true,
        startDate: true,
        endDate: true,
        monthlyRent: true,
        status: true,
        createdAt: true,
        contractPdfData: true,
        terminationReason: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
            buildingName: true,
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
      },
      orderBy: { createdAt: 'desc' },
    });

    const lookupCache = new Map<string, any>();
    const items = await Promise.all(
      contracts.map(async ({ contractPdfData, ...contract }) => {
        const pdfToken = contractPdfData
          ? this.generatePdfToken(contract.id)
          : null;

        const addressInfo = contract.apartment
          ? await this.apartmentsService.getApartmentAddressByWardCodes(
              contract.apartment.newWardCode,
              contract.apartment.oldWardCode,
              'both',
              lookupCache,
            )
          : { newAddress: null, oldAddress: null, displayAddress: null };

        return {
          ...contract,
          apartment: contract.apartment
            ? {
                ...contract.apartment,
                ...addressInfo,
              }
            : contract.apartment,
          hasPdf: !!contractPdfData,
          pdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
        };
      }),
    );

    return items;
  }

  /**
   * Get contract by ID with full details
   */
  async findOne(id: string, currentUser: JwtPayload) {
    const contract = await this.prisma.rentalContract.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
            numberOfBedrooms: true,
            numberOfBathrooms: true,
            totalArea: true,
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

    // Convert binary PDF to base64 for JSON response
    const { contractPdfData, landlordSignature, tenantSignature, ...rest } =
      contract as any;

    const pdfToken = contractPdfData ? this.generatePdfToken(id) : null;
    const addressInfo = contract.apartment
      ? await this.apartmentsService.getApartmentAddressByWardCodes(
          contract.apartment.newWardCode,
          contract.apartment.oldWardCode,
          'both',
          new Map<string, any>(),
        )
      : { newAddress: null, oldAddress: null, displayAddress: null };

    return {
      ...rest,
      apartment: contract.apartment
        ? {
            ...contract.apartment,
            ...addressInfo,
          }
        : contract.apartment,
      hasPdf: !!contractPdfData,
      pdfUrl: `/contracts/${id}/pdf`,
      publicPdfUrl: pdfToken ? `/contracts/pdf/view?token=${pdfToken}` : null,
      hasLandlordSignature: !!landlordSignature,
      hasTenantSignature: !!tenantSignature,
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
    // lo lo
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

  /**
   * Create new rental contract
   */
  async create(createDto: CreateContractDto, currentUser: JwtPayload) {
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

    // Validate at least one primary member
    const hasPrimary = createDto.members.some(
      (m) => m.memberType === 'primary',
    );
    if (!hasPrimary) {
      throw new BadRequestException('At least one primary tenant is required');
    }

    // Generate contract number
    const contractNumber = await this.generateContractNumber();

    // Create contract with members in transaction
    return this.prisma.$transaction(async (tx) => {
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
        data: createDto.members.map((m) => ({
          userId: m.userId,
          rentalContractId: contract.id,
          memberType: m.memberType,
          isPrimaryContact: m.isPrimaryContact ?? m.memberType === 'primary',
          sharePercentage: m.sharePercentage,
          status: MemberStatus.active,
        })),
      });

      return contract;
    });
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

  /**
   * Activate contract (sign)
   */
  async activate(id: string) {
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
      this.prisma.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: new Date() },
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
      await tx.reservation.update({
        where: { createdContractId: id },
        data: { status: 'cancelled' },
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

      await tx.userContractMember.updateMany({
        where: { rentalContractId: id },
        data: { status: MemberStatus.moved_out, moveOutDate: terminatedAt },
      });
    });

    return await this.findOne(id, currentUser);
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
