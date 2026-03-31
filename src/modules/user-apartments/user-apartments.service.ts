import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { UserApartmentStatus } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';
import { UpdateUserApartmentAccessDto } from './dto';

@Injectable()
export class UserApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  private readonly userApartmentSelect = {
    id: true,
    userId: true,
    apartmentId: true,
    rentalContractId: true,
    status: true,
    isPrimaryTenant: true,
    moveInDate: true,
    moveOutDate: true,
    apartmentDoorPassword: true,
    buildingGateCode: true,
    smartLockPin: true,
    mailboxCode: true,
    parkingAccessCode: true,
    wifiName: true,
    wifiPassword: true,
    emergencyContactName: true,
    emergencyContactPhone: true,
    notes: true,
    apartment: {
      select: {
        id: true,
        apartmentNumber: true,
        buildingName: true,
        maxConcurrentViewings: true,
        floorNumber: true,
        provinceCode: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        totalArea: true,
        usableArea: true,
        numberOfBedrooms: true,
        numberOfBathrooms: true,
        furnishingStatus: true,
        amenities: true,
        baseRentPrice: true,
        depositAmount: true,
        status: true,
        description: true,
        images: true,
        videoTourUrl: true,
        yearBuilt: true,
        ownerId: true,
        approvedByOperatorId: true,
        approvedAt: true,
        createdAt: true,
        updatedAt: true,
      },
    },
    rentalContract: {
      select: {
        id: true,
        contractNumber: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  } as const;

  async findMy(currentUser: JwtPayload) {
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException('Only users can view their apartment data');
    }

    return this.prisma.userApartment.findMany({
      where: {
        userId: currentUser.sub,
      },
      select: this.userApartmentSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async updateAccessInfo(
    id: string,
    dto: UpdateUserApartmentAccessDto,
    currentUser: JwtPayload,
  ) {
    if (currentUser.actorType === 'user') {
      const existing = await this.prisma.userApartment.findFirst({
        where: {
          id,
          userId: currentUser.sub,
          status: UserApartmentStatus.active,
        },
        select: { id: true },
      });

      if (!existing) {
        throw new NotFoundException('User apartment assignment not found');
      }

      const userAllowedOnlyPassword = Object.keys(dto).every(
        (key) => key === 'apartmentDoorPassword',
      );
      if (!userAllowedOnlyPassword) {
        throw new ForbiddenException(
          'Users can only update their own house password',
        );
      }

      return this.prisma.userApartment.update({
        where: { id },
        data: {
          apartmentDoorPassword: dto.apartmentDoorPassword,
        },
        select: this.userApartmentSelect,
      });
    }

    if (
      currentUser.actorType !== 'staff' &&
      currentUser.actorType !== 'operator' &&
      currentUser.actorType !== 'admin'
    ) {
      throw new ForbiddenException(
        'Only staff/operator/admin can update access info',
      );
    }

    const existing = await this.prisma.userApartment.findUnique({
      where: { id },
      select: { id: true },
    });

    if (!existing) {
      throw new NotFoundException('User apartment assignment not found');
    }

    return this.prisma.userApartment.update({
      where: { id },
      data: {
        apartmentDoorPassword: dto.apartmentDoorPassword,
        buildingGateCode: dto.buildingGateCode,
        smartLockPin: dto.smartLockPin,
        mailboxCode: dto.mailboxCode,
        parkingAccessCode: dto.parkingAccessCode,
        wifiName: dto.wifiName,
        wifiPassword: dto.wifiPassword,
        emergencyContactName: dto.emergencyContactName,
        emergencyContactPhone: dto.emergencyContactPhone,
        notes: dto.notes,
      },
      select: this.userApartmentSelect,
    });
  }
}
