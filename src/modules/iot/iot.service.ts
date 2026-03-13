import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIoTDeviceDto,
  UpdateIoTDeviceDto,
  CreateUtilityMeterDto,
  UpdateUtilityMeterDto,
  CreateUtilityReadingDto,
} from './dto';
import { IoTStatus, MeterStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class IoTService {
  constructor(private readonly prisma: PrismaService) {}

  // ============================================================================
  // IoT Devices
  // ============================================================================

  async findAllDevices(apartmentId?: string, status?: IoTStatus) {
    const where: Prisma.IoTDeviceWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    return this.prisma.ioTDevice.findMany({
      where,
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        brand: true,
        model: true,
        serialNumber: true,
        status: true,
        isControllableByTenant: true,
        lastOnlineAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
        room: {
          select: { id: true, roomNumber: true, roomType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneDevice(id: string) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
        room: {
          select: { id: true, roomNumber: true, roomType: true },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('IoT device not found');
    }

    return device;
  }

  async findDevicesByApartment(apartmentId: string, currentUser: JwtPayload) {
    // Tenants can only see controllable devices in their contracted apartment
    if (currentUser.actorType === 'user') {
      const hasAccess = await this.prisma.rentalContract.findFirst({
        where: {
          apartmentId,
          status: 'active',
          members: { some: { userId: currentUser.sub } },
        },
      });

      if (!hasAccess) {
        throw new ForbiddenException('No active contract for this apartment');
      }

      return this.prisma.ioTDevice.findMany({
        where: {
          apartmentId,
          status: IoTStatus.active,
          isControllableByTenant: true,
        },
        select: {
          id: true,
          deviceName: true,
          deviceType: true,
          status: true,
          lastOnlineAt: true,
          room: {
            select: { roomNumber: true, roomType: true },
          },
        },
      });
    }

    return this.prisma.ioTDevice.findMany({
      where: { apartmentId },
      include: {
        room: { select: { roomNumber: true, roomType: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async createDevice(createDto: CreateIoTDeviceDto) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    if (createDto.roomId) {
      const room = await this.prisma.room.findUnique({
        where: { id: createDto.roomId },
      });
      if (!room || room.apartmentId !== createDto.apartmentId) {
        throw new BadRequestException('Room does not belong to this apartment');
      }
    }

    return this.prisma.ioTDevice.create({
      data: {
        deviceName: createDto.deviceName,
        deviceType: createDto.deviceType,
        brand: createDto.brand,
        model: createDto.model,
        serialNumber: createDto.serialNumber,
        macAddress: createDto.macAddress,
        apartment: { connect: { id: createDto.apartmentId } },
        ...(createDto.roomId && {
          room: { connect: { id: createDto.roomId } },
        }),
        locationDescription: createDto.locationDescription,
        firmwareVersion: createDto.firmwareVersion,
        isControllableByTenant: createDto.isControllableByTenant ?? true,
        installationDate: createDto.installationDate
          ? new Date(createDto.installationDate)
          : undefined,
        warrantyExpiryDate: createDto.warrantyExpiryDate
          ? new Date(createDto.warrantyExpiryDate)
          : undefined,
        configuration: createDto.configuration as any,
        notes: createDto.notes,
        status: IoTStatus.active,
      },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        serialNumber: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async updateDevice(id: string, updateDto: UpdateIoTDeviceDto) {
    const device = await this.prisma.ioTDevice.findUnique({ where: { id } });

    if (!device) {
      throw new NotFoundException('IoT device not found');
    }

    return this.prisma.ioTDevice.update({
      where: { id },
      data: updateDto as any,
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  async removeDevice(id: string) {
    const device = await this.prisma.ioTDevice.findUnique({ where: { id } });

    if (!device) {
      throw new NotFoundException('IoT device not found');
    }

    return this.prisma.ioTDevice.update({
      where: { id },
      data: { status: IoTStatus.inactive },
      select: { id: true, deviceName: true, status: true },
    });
  }

  async controlDevice(id: string, command: string, currentUser: JwtPayload) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      include: {
        apartment: {
          include: {
            rentalContracts: {
              where: { status: 'active' },
              include: { members: true },
            },
          },
        },
      },
    });

    if (!device) {
      throw new NotFoundException('IoT device not found');
    }

    if (device.status !== IoTStatus.active) {
      throw new BadRequestException('Device is not active');
    }

    if (currentUser.actorType === 'user') {
      if (!device.isControllableByTenant) {
        throw new ForbiddenException(
          'This device is not controllable by tenants',
        );
      }

      const hasAccess = device.apartment.rentalContracts.some((c) =>
        c.members.some((m) => m.userId === currentUser.sub),
      );

      if (!hasAccess) {
        throw new ForbiddenException('No active contract for this apartment');
      }
    }

    // TODO: Integrate with Tuya API to send actual command
    return {
      deviceId: id,
      command,
      status: 'sent',
      message: 'Command sent to device (Tuya integration pending)',
    };
  }

  // ============================================================================
  // Utility Meters
  // ============================================================================

  async findAllMeters(apartmentId?: string, status?: MeterStatus) {
    const where: Prisma.UtilityMeterWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    return this.prisma.utilityMeter.findMany({
      where,
      select: {
        id: true,
        meterNumber: true,
        meterType: true,
        currentReading: true,
        previousReading: true,
        readingDate: true,
        ratePerUnit: true,
        status: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOneMeter(id: string) {
    const meter = await this.prisma.utilityMeter.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            newWardCode: true,
            oldWardCode: true,
          },
        },
        readings: {
          take: 12,
          orderBy: { readingDate: 'desc' },
          select: {
            id: true,
            readingDate: true,
            readingValue: true,
            consumption: true,
            readingType: true,
            isVerified: true,
          },
        },
      },
    });

    if (!meter) {
      throw new NotFoundException('Utility meter not found');
    }

    return meter;
  }

  async createMeter(createDto: CreateUtilityMeterDto) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: createDto.apartmentId },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }

    return this.prisma.utilityMeter.create({
      data: {
        meterNumber: createDto.meterNumber,
        meterType: createDto.meterType,
        brand: createDto.brand,
        model: createDto.model,
        apartment: { connect: { id: createDto.apartmentId } },
        installationDate: new Date(createDto.installationDate),
        unitOfMeasurement: createDto.unitOfMeasurement,
        ratePerUnit: createDto.ratePerUnit,
        isDigital: createDto.isDigital ?? false,
        notes: createDto.notes,
        status: MeterStatus.active,
      },
      select: {
        id: true,
        meterNumber: true,
        meterType: true,
        status: true,
        createdAt: true,
      },
    });
  }

  async updateMeter(id: string, updateDto: UpdateUtilityMeterDto) {
    const meter = await this.prisma.utilityMeter.findUnique({ where: { id } });

    if (!meter) {
      throw new NotFoundException('Utility meter not found');
    }

    return this.prisma.utilityMeter.update({
      where: { id },
      data: updateDto as any,
      select: {
        id: true,
        meterNumber: true,
        meterType: true,
        status: true,
        updatedAt: true,
      },
    });
  }

  // ============================================================================
  // Utility Readings
  // ============================================================================

  async createReading(
    createDto: CreateUtilityReadingDto,
    currentUser: JwtPayload,
  ) {
    const meter = await this.prisma.utilityMeter.findUnique({
      where: { id: createDto.utilityMeterId },
    });

    if (!meter) {
      throw new NotFoundException('Utility meter not found');
    }

    const consumption =
      meter.currentReading !== null
        ? createDto.readingValue - Number(meter.currentReading)
        : undefined;

    const reading = await this.prisma.utilityReading.create({
      data: {
        utilityMeter: { connect: { id: createDto.utilityMeterId } },
        ...(createDto.rentalContractId && {
          rentalContract: { connect: { id: createDto.rentalContractId } },
        }),
        readingDate: new Date(createDto.readingDate),
        readingValue: createDto.readingValue,
        previousReadingValue: meter.currentReading ?? undefined,
        consumption,
        readingType: createDto.readingType ?? 'manual',
        readByStaff:
          currentUser.actorType === 'staff'
            ? { connect: { id: currentUser.sub } }
            : undefined,
        images: createDto.images as any,
        notes: createDto.notes,
      },
      select: {
        id: true,
        readingDate: true,
        readingValue: true,
        previousReadingValue: true,
        consumption: true,
        readingType: true,
      },
    });

    // Update meter's current reading
    await this.prisma.utilityMeter.update({
      where: { id: createDto.utilityMeterId },
      data: {
        previousReading: meter.currentReading,
        currentReading: createDto.readingValue,
        readingDate: new Date(createDto.readingDate),
      },
    });

    return reading;
  }

  async getReadings(meterId: string, limit = 12) {
    return this.prisma.utilityReading.findMany({
      where: { utilityMeterId: meterId },
      select: {
        id: true,
        readingDate: true,
        readingValue: true,
        previousReadingValue: true,
        consumption: true,
        readingType: true,
        isVerified: true,
        readByStaff: {
          select: { fullName: true },
        },
      },
      orderBy: { readingDate: 'desc' },
      take: limit,
    });
  }

  async verifyReading(id: string, staffId: string) {
    return this.prisma.utilityReading.update({
      where: { id },
      data: {
        isVerified: true,
        verifiedByStaff: { connect: { id: staffId } },
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        isVerified: true,
        verifiedAt: true,
      },
    });
  }
}
