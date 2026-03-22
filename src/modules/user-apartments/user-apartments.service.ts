import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import type { JwtPayload } from '../auth/auth.service';
import { UpdateUserApartmentAccessDto } from './dto';

@Injectable()
export class UserApartmentsService {
  constructor(private readonly prisma: PrismaService) {}

  async findMy(currentUser: JwtPayload) {
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException('Only users can view their apartment data');
    }

    return this.prisma.userApartment.findMany({
      where: {
        userId: currentUser.sub,
      },
      select: {
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
      },
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async updateAccessInfo(
    id: string,
    dto: UpdateUserApartmentAccessDto,
    currentUser: JwtPayload,
  ) {
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
      select: {
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
      },
    });
  }
}
