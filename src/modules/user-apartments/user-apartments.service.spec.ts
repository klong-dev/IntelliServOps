/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-argument, @typescript-eslint/unbound-method */
import { UserApartmentStatus } from '@prisma/client';
import { UserApartmentsService } from './user-apartments.service';
import {
  createPrismaMock,
  mockUserJwtPayload,
  resetPrismaMock,
} from '../../test-utils';

describe('UserApartmentsService', () => {
  let service: UserApartmentsService;
  let prisma: ReturnType<typeof createPrismaMock>;

  const baseAssignment = (overrides = {}) => ({
    id: 'ua-1',
    userId: 'user-123',
    apartmentId: 'apt-123',
    rentalContractId: 'contract-123',
    status: UserApartmentStatus.active,
    isPrimaryTenant: true,
    moveInDate: null,
    moveOutDate: null,
    buildingGateCode: null,
    smartLockPin: null,
    mailboxCode: null,
    parkingAccessCode: null,
    wifiName: null,
    wifiPassword: null,
    emergencyContactName: null,
    emergencyContactPhone: null,
    notes: null,
    apartment: {
      id: 'apt-123',
      apartmentNumber: 'A101',
      buildingName: 'Tower A',
      floorNumber: 10,
      wardCode: 'ward-1',
      provinceCode: 'province-1',
      streetAddress: '123 Nguyen Hue',
      images: [],
      status: 'occupied',
    },
    rentalContract: {
      id: 'contract-123',
      contractNumber: 'CNT-001',
      status: 'active',
    },
    createdAt: new Date('2026-01-01T00:00:00.000Z'),
    updatedAt: new Date('2026-01-02T00:00:00.000Z'),
    ...overrides,
  });

  beforeEach(() => {
    prisma = createPrismaMock();
    service = new UserApartmentsService(prisma as any);
  });

  afterEach(() => {
    resetPrismaMock(prisma);
  });

  it('returns isFirstPass false when apartment has no door smart lock device', async () => {
    prisma.userApartment.findMany.mockResolvedValue([baseAssignment()] as any);
    prisma.ioTDevice.findMany.mockResolvedValue([] as any);

    const result = await service.findMy(mockUserJwtPayload());

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      apartmentId: 'apt-123',
      isFirstPass: false,
    });
  });

  it('returns isFirstPass true when a door smart lock exists without pinHash', async () => {
    prisma.userApartment.findMany.mockResolvedValue([baseAssignment()] as any);
    prisma.ioTDevice.findMany.mockResolvedValue([
      {
        apartmentId: 'apt-123',
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        configuration: {
          mqtt: {
            topic: 'door',
            pinHash: null,
          },
        },
      },
    ] as any);

    const result = await service.findMy(mockUserJwtPayload());

    expect(result[0]).toMatchObject({
      apartmentId: 'apt-123',
      isFirstPass: true,
    });
  });

  it('returns isFirstPass false when a door smart lock exists with pinHash', async () => {
    prisma.userApartment.findMany.mockResolvedValue([baseAssignment()] as any);
    prisma.ioTDevice.findMany.mockResolvedValue([
      {
        apartmentId: 'apt-123',
        updatedAt: new Date('2026-01-03T00:00:00.000Z'),
        configuration: {
          mqtt: {
            topic: 'door',
            pinHash: '$2b$04$existinghash',
          },
        },
      },
    ] as any);

    const result = await service.findMy(mockUserJwtPayload());

    expect(result[0]).toMatchObject({
      apartmentId: 'apt-123',
      isFirstPass: false,
    });
  });

  it('does not flip isFirstPass when only apartmentDoorPassword is updated locally', async () => {
    prisma.userApartment.findFirst.mockResolvedValue({
      id: 'ua-1',
      apartmentId: 'apt-123',
      rentalContractId: 'contract-123',
      isPrimaryTenant: true,
    } as any);
    prisma.userApartment.updateMany.mockResolvedValue({ count: 1 } as any);
    prisma.userApartment.findUniqueOrThrow.mockResolvedValue(
      baseAssignment({
        apartmentDoorPassword: '7890',
      }) as any,
    );
    prisma.ioTDevice.findMany.mockResolvedValue([] as any);

    const result = await service.updateAccessInfo(
      'ua-1',
      { apartmentDoorPassword: '7890' },
      mockUserJwtPayload(),
    );

    expect(prisma.userApartment.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        data: {
          apartmentDoorPassword: '7890',
        },
      }),
    );
    expect(result).toMatchObject({
      apartmentId: 'apt-123',
      isFirstPass: false,
    });
  });

  it('reflects smart-lock first-pass state changes from IoT pinHash updates', async () => {
    prisma.userApartment.findMany
      .mockResolvedValueOnce([baseAssignment()] as any)
      .mockResolvedValueOnce([baseAssignment()] as any);
    prisma.ioTDevice.findMany
      .mockResolvedValueOnce([
        {
          apartmentId: 'apt-123',
          updatedAt: new Date('2026-01-03T00:00:00.000Z'),
          configuration: {
            mqtt: {
              topic: 'door',
              pinHash: '$2b$04$existinghash',
            },
          },
        },
      ] as any)
      .mockResolvedValueOnce([
        {
          apartmentId: 'apt-123',
          updatedAt: new Date('2026-01-04T00:00:00.000Z'),
          configuration: {
            mqtt: {
              topic: 'door',
              pinHash: null,
            },
          },
        },
      ] as any);

    const beforeReset = await service.findMy(mockUserJwtPayload());
    const afterReset = await service.findMy(mockUserJwtPayload());

    expect(beforeReset[0]?.isFirstPass).toBe(false);
    expect(afterReset[0]?.isFirstPass).toBe(true);
  });
});
