import { Test, TestingModule } from '@nestjs/testing';
import { ReservationsService } from './reservations.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ContractsService } from '../contracts/contracts.service';
import { createPrismaMock } from '../../test-utils';
import { DEFAULT_CONTRACT_PARTY_A } from '../contracts/contract-party-a-defaults';
import { BadRequestException } from '@nestjs/common';

describe('ReservationsService', () => {
  let service: ReservationsService;
  let prisma: ReturnType<typeof createPrismaMock>;
  const contractsService = {
    assertLeaseTermWithinCooperationContract: jest.fn(),
    regenerateContractPdf: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();
    contractsService.assertLeaseTermWithinCooperationContract
      .mockReset()
      .mockResolvedValue(undefined);
    contractsService.regenerateContractPdf
      .mockReset()
      .mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ReservationsService,
        { provide: PrismaService, useValue: prisma },
        { provide: ContractsService, useValue: contractsService },
      ],
    }).compile();

    service = module.get<ReservationsService>(ReservationsService);
  });

  it('should seed default Party A fields when creating draft contract from reservation flow', async () => {
    const userId = 'user-123';
    const desiredStartDate = new Date();
    desiredStartDate.setUTCDate(desiredStartDate.getUTCDate() + 7);
    const desiredEndDate = new Date(desiredStartDate);
    desiredEndDate.setUTCDate(desiredEndDate.getUTCDate() + 364);

    const createReservationDto = {
      apartmentId: 'apt-123',
      desiredStartDate: desiredStartDate.toISOString(),
      desiredEndDate: desiredEndDate.toISOString(),
      numberOfOccupants: 1,
      specialRequests: 'Need parking spot',
    };

    const createContractInTx = jest
      .fn()
      .mockResolvedValue({ id: 'contract-123' });

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      isVerified: true,
      isActive: true,
    } as any);
    prisma.apartment.findUnique
      .mockResolvedValueOnce({
        id: 'apt-123',
        status: 'available',
        apartmentNumber: 'A-101',
        wardCode: null,
      } as any)
      .mockResolvedValueOnce({
        id: 'apt-123',
        baseRentPrice: 10000000,
        depositAmount: 20000000,
        maxOccupants: 2,
      } as any);
    prisma.reservation.findFirst.mockResolvedValue(null as any);
    prisma.rentalContract.count.mockResolvedValue(0);
    prisma.$transaction.mockImplementation(async (callback) =>
      callback({
        apartment: {
          update: jest.fn().mockResolvedValue({}),
        },
        reservation: {
          create: jest.fn().mockResolvedValue({
            id: 'reservation-123',
            userId,
            apartmentId: 'apt-123',
            desiredStartDate,
            desiredEndDate,
            numberOfOccupants: 1,
            specialRequests: 'Need parking spot',
            status: 'pending',
            expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000),
            createdAt: new Date(),
            updatedAt: new Date(),
            apartment: {
              id: 'apt-123',
              apartmentNumber: 'A-101',
              wardCode: null,
              baseRentPrice: 10000000,
            },
          }),
          update: jest.fn().mockResolvedValue({}),
        },
        rentalContract: {
          create: createContractInTx,
        },
        userContractMember: {
          create: jest.fn().mockResolvedValue({}),
          createMany: jest.fn().mockResolvedValue({ count: 0 }),
        },
      }),
    );

    const result = await service.create(userId, createReservationDto);

    expect(createContractInTx).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          ...DEFAULT_CONTRACT_PARTY_A,
          specialConditions: 'Need parking spot',
        }),
      }),
    );
    expect(contractsService.regenerateContractPdf).toHaveBeenCalledWith(
      'contract-123',
    );
    expect(result.contractId).toBe('contract-123');
  });

  it('should reject reservation when desired lease exceeds cooperation contract term', async () => {
    const userId = 'user-123';
    const desiredStartDate = new Date();
    desiredStartDate.setUTCDate(desiredStartDate.getUTCDate() + 7);
    const desiredEndDate = new Date(desiredStartDate);
    desiredEndDate.setUTCFullYear(desiredEndDate.getUTCFullYear() + 2);

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      isVerified: true,
      isActive: true,
    } as any);
    prisma.apartment.findUnique
      .mockResolvedValueOnce({
        id: 'apt-123',
        status: 'available',
        apartmentNumber: 'A-101',
        wardCode: null,
      } as any)
      .mockResolvedValueOnce({
        id: 'apt-123',
        baseRentPrice: 10000000,
        depositAmount: 20000000,
        maxOccupants: 2,
      } as any);
    prisma.reservation.findFirst.mockResolvedValue(null as any);
    contractsService.assertLeaseTermWithinCooperationContract.mockRejectedValueOnce(
      new BadRequestException(
        'Apartment can only be rented within cooperation term',
      ),
    );

    await expect(
      service.create(userId, {
        apartmentId: 'apt-123',
        desiredStartDate: desiredStartDate.toISOString(),
        desiredEndDate: desiredEndDate.toISOString(),
        numberOfOccupants: 1,
      }),
    ).rejects.toThrow(BadRequestException);

    expect(
      contractsService.assertLeaseTermWithinCooperationContract,
    ).toHaveBeenCalledWith('apt-123', desiredStartDate, desiredEndDate);
  });

  it('should reject reservation when desired move-in date is more than 15 days from today', async () => {
    const userId = 'user-123';
    const desiredStartDate = new Date();
    desiredStartDate.setUTCDate(desiredStartDate.getUTCDate() + 16);

    const desiredEndDate = new Date(desiredStartDate);
    desiredEndDate.setUTCDate(desiredEndDate.getUTCDate() + 30);

    prisma.user.findUnique.mockResolvedValue({
      id: userId,
      isVerified: true,
      isActive: true,
    } as any);
    prisma.apartment.findUnique.mockResolvedValue({
      id: 'apt-123',
      status: 'available',
      apartmentNumber: 'A-101',
      wardCode: null,
    } as any);

    await expect(
      service.create(userId, {
        apartmentId: 'apt-123',
        desiredStartDate: desiredStartDate.toISOString(),
        desiredEndDate: desiredEndDate.toISOString(),
        numberOfOccupants: 1,
      }),
    ).rejects.toThrow(BadRequestException);
  });
});
