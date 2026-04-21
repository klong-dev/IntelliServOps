import { Test, TestingModule } from '@nestjs/testing';
import { ApartmentStatus, InvoiceType } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { createPrismaMock } from '../../test-utils';
import { RevenueService } from './revenue.service';

describe('RevenueService', () => {
  let service: RevenueService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const buildPaidInvoice = (overrides: Record<string, unknown> = {}) => ({
    id: 'invoice-1',
    invoiceNumber: 'INV-202604-00001',
    invoiceType: InvoiceType.rent,
    totalAmount: 10_000_000,
    paidAt: new Date('2026-04-05T00:00:00.000Z'),
    rentalContract: {
      id: 'contract-1',
      contractNumber: 'CTR-2026-00001',
      startDate: new Date('2026-04-01T00:00:00.000Z'),
      endDate: new Date('2027-03-31T00:00:00.000Z'),
      status: 'active',
      apartment: {
        id: 'apt-1',
        apartmentNumber: 'A101',
        buildingName: 'Alpha Tower',
        owner: {
          id: 'owner-1',
          fullName: 'Owner One',
          companyName: null,
          isPartner: false,
          commissionRate: null,
        },
        cooperationContracts: [],
      },
    },
    ...overrides,
  });

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        RevenueService,
        { provide: PrismaService, useValue: prisma },
      ],
    }).compile();

    service = module.get<RevenueService>(RevenueService);
    jest.clearAllMocks();
  });

  it('should build dashboard statistics for operator/admin', async () => {
    prisma.user.count
      .mockResolvedValueOnce(10 as any)
      .mockResolvedValueOnce(3 as any);
    prisma.apartment.findMany.mockResolvedValue([
      {
        id: 'apt-1',
        status: ApartmentStatus.occupied,
        rentalContracts: [{ id: 'contract-1' }],
      },
      {
        id: 'apt-2',
        status: ApartmentStatus.available,
        rentalContracts: [],
      },
      {
        id: 'apt-3',
        status: ApartmentStatus.pending,
        rentalContracts: [],
      },
      {
        id: 'apt-4',
        status: ApartmentStatus.maintenance,
        rentalContracts: [],
      },
    ] as any);
    prisma.invoice.findMany.mockResolvedValue([
      buildPaidInvoice(),
      buildPaidInvoice({
        id: 'invoice-2',
        invoiceNumber: 'INV-202604-00002',
        totalAmount: 5_000_000,
        rentalContract: {
          id: 'contract-2',
          contractNumber: 'CTR-2026-00002',
          startDate: new Date('2026-04-01T00:00:00.000Z'),
          endDate: new Date('2027-03-31T00:00:00.000Z'),
          status: 'active',
          apartment: {
            id: 'apt-2',
            apartmentNumber: 'B202',
            buildingName: 'Beta Tower',
            owner: {
              id: 'partner-1',
              fullName: 'Partner One',
              companyName: 'Partner Co',
              isPartner: true,
              commissionRate: 10,
            },
            cooperationContracts: [
              {
                id: 'coop-1',
                contractNumber: 'PCC-1',
                startDate: new Date('2026-01-01T00:00:00.000Z'),
                endDate: new Date('2026-12-31T23:59:59.999Z'),
                commissionRate: 10,
                status: 'active',
                createdAt: new Date('2025-12-01T00:00:00.000Z'),
              },
            ],
          },
        },
      }),
    ] as any);

    const result = await service.getDashboardStatistics({ topLimit: 1 });

    expect(result).toMatchObject({
      userStats: {
        totalActiveUsers: 10,
        totalActivePartners: 3,
        totalActiveNonPartnerUsers: 7,
        partnerRatio: 0.3,
        userRatio: 0.7,
      },
      occupancyStats: {
        occupiedApartmentCount: 1,
        vacantApartmentCount: 2,
      },
      apartmentRevenueStats: {
        topApartments: [
          expect.objectContaining({
            apartmentId: 'apt-1',
            paidRevenue: 10_000_000,
          }),
        ],
        bottomApartments: [
          expect.objectContaining({
            apartmentId: 'apt-2',
            paidRevenue: 5_000_000,
          }),
        ],
      },
      systemRevenueSummary: {
        invoiceCount: 2,
        totalPaidRevenue: 15_000_000,
        totalSystemRevenue: 10_500_000,
        totalPartnerGrossRevenue: 5_000_000,
        totalPartnerNetPayout: 4_500_000,
      },
    });
  });

  it('should group revenue timeseries by month', async () => {
    prisma.invoice.findMany.mockResolvedValue([
      buildPaidInvoice({
        id: 'invoice-jan',
        invoiceNumber: 'INV-202601-00001',
        totalAmount: 10_000_000,
        paidAt: new Date('2026-01-15T00:00:00.000Z'),
      }),
      buildPaidInvoice({
        id: 'invoice-feb-partner',
        invoiceNumber: 'INV-202602-00001',
        totalAmount: 5_000_000,
        paidAt: new Date('2026-02-10T00:00:00.000Z'),
        rentalContract: {
          id: 'contract-2',
          contractNumber: 'CTR-2026-00002',
          startDate: new Date('2026-02-01T00:00:00.000Z'),
          endDate: new Date('2027-01-31T00:00:00.000Z'),
          status: 'active',
          apartment: {
            id: 'apt-2',
            apartmentNumber: 'B202',
            buildingName: 'Beta Tower',
            owner: {
              id: 'partner-1',
              fullName: 'Partner One',
              companyName: 'Partner Co',
              isPartner: true,
              commissionRate: 10,
            },
            cooperationContracts: [
              {
                id: 'coop-1',
                contractNumber: 'PCC-1',
                startDate: new Date('2026-01-01T00:00:00.000Z'),
                endDate: new Date('2026-12-31T23:59:59.999Z'),
                commissionRate: 10,
                status: 'active',
                createdAt: new Date('2025-12-01T00:00:00.000Z'),
              },
            ],
          },
        },
      }),
      buildPaidInvoice({
        id: 'invoice-feb-system',
        invoiceNumber: 'INV-202602-00002',
        invoiceType: InvoiceType.utility,
        totalAmount: 2_000_000,
        paidAt: new Date('2026-02-18T00:00:00.000Z'),
      }),
    ] as any);

    const result = await service.getRevenueTimeseries({
      granularity: 'month',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-28T23:59:59.999Z',
    });

    expect(result).toEqual({
      granularity: 'month',
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-02-28T23:59:59.999Z',
      items: [
        {
          periodKey: '2026-01',
          periodLabel: '01/2026',
          totalPaidRevenue: 10_000_000,
          totalSystemRevenue: 10_000_000,
          totalPartnerGrossRevenue: 0,
          totalPartnerNetPayout: 0,
          invoiceCount: 1,
        },
        {
          periodKey: '2026-02',
          periodLabel: '02/2026',
          totalPaidRevenue: 7_000_000,
          totalSystemRevenue: 2_500_000,
          totalPartnerGrossRevenue: 5_000_000,
          totalPartnerNetPayout: 4_500_000,
          invoiceCount: 2,
        },
      ],
    });
  });
});
