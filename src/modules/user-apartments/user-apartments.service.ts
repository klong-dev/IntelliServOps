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

  private readonly userApartmentListSelect = {
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
        floorNumber: true,
        wardCode: true,
        provinceCode: true,
        streetAddress: true,
        images: true,
        status: true,
      },
    },
    rentalContract: {
      select: {
        id: true,
        contractNumber: true,
        status: true,
      },
    },
    createdAt: true,
    updatedAt: true,
  } as const;

  private readonly userApartmentDetailSelect = {
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
    createdAt: true,
    updatedAt: true,
    user: {
      select: {
        id: true,
        fullName: true,
        email: true,
        phone: true,
        profileImageUrl: true,
        dateOfBirth: true,
        isActive: true,
        isVerified: true,
        emergencyContactName: true,
        emergencyContactPhone: true,
        identity: {
          select: {
            id: true,
            nationalId: true,
            passportNumber: true,
            name: true,
            dob: true,
            sex: true,
            nationality: true,
            address: true,
            issueDate: true,
            doe: true,
            isVerified: true,
            verifiedAt: true,
          },
        },
      },
    },
    apartment: {
      select: {
        id: true,
        apartmentNumber: true,
        buildingName: true,
        maxConcurrentViewings: true,
        floorNumber: true,
        wardCode: true,
        provinceCode: true,
        streetAddress: true,
        latitude: true,
        longitude: true,
        totalArea: true,
        usableArea: true,
        maxOccupants: true,
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
        owner: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        approvedByOperator: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        apartmentAmenities: {
          select: {
            createdAt: true,
            amenity: {
              select: {
                id: true,
                code: true,
                name: true,
                description: true,
                icon: true,
                isActive: true,
              },
            },
          },
        },
        apartmentPolicies: {
          select: {
            id: true,
            isRequired: true,
            effectiveDate: true,
            expiryDate: true,
            notes: true,
            policy: {
              select: {
                id: true,
                policyType: true,
                title: true,
                version: true,
                language: true,
                effectiveDate: true,
                expiryDate: true,
                isActive: true,
                requiresAcceptance: true,
                displayOrder: true,
              },
            },
          },
        },
        rooms: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
            area: true,
            hasWindow: true,
            hasAirConditioning: true,
            hasPrivateBathroom: true,
            maxOccupancy: true,
            rentPrice: true,
            status: true,
            description: true,
            images: true,
            createdAt: true,
            updatedAt: true,
          },
        },
      },
    },
    rentalContract: {
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
        landlordName: true,
        landlordIdNumber: true,
        landlordIdIssueDate: true,
        landlordIdIssuePlace: true,
        landlordAddress: true,
        landlordPhone: true,
        status: true,
        category: true,
        renewedFromContractId: true,
        signedDate: true,
        contractDocumentUrl: true,
        terminationDate: true,
        terminationReason: true,
        earlyTerminationFee: true,
        createdByStaffId: true,
        createdAt: true,
        updatedAt: true,
        createdByStaff: {
          select: {
            id: true,
            fullName: true,
            email: true,
            phone: true,
          },
        },
        members: {
          select: {
            id: true,
            userId: true,
            rentalContractId: true,
            memberType: true,
            isPrimaryContact: true,
            moveInDate: true,
            moveOutDate: true,
            notificationEnabled: true,
            accessLevel: true,
            sharePercentage: true,
            status: true,
            createdAt: true,
            updatedAt: true,
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
        renewedFromContract: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            startDate: true,
            endDate: true,
          },
        },
        renewalContracts: {
          select: {
            id: true,
            contractNumber: true,
            status: true,
            category: true,
            startDate: true,
            endDate: true,
          },
        },
      },
    },
  } as const;

  async findMy(currentUser: JwtPayload) {
    if (currentUser.actorType !== 'user') {
      throw new ForbiddenException('Only users can view their apartment data');
    }

    return this.prisma.userApartment.findMany({
      where: {
        userId: currentUser.sub,
      },
      select: this.userApartmentListSelect,
      orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
    });
  }

  async findOne(id: string, currentUser: JwtPayload): Promise<unknown> {
    const isPrivilegedActor =
      currentUser.actorType === 'staff' ||
      currentUser.actorType === 'operator' ||
      currentUser.actorType === 'admin';

    if (currentUser.actorType !== 'user' && !isPrivilegedActor) {
      throw new ForbiddenException(
        'Only user/staff/operator/admin can view user-apartment details',
      );
    }

    const where =
      currentUser.actorType === 'user'
        ? {
            id,
            userId: currentUser.sub,
          }
        : {
            id,
          };

    const userApartment = await this.prisma.userApartment.findFirst({
      where,
      select: this.userApartmentDetailSelect,
    });

    if (!userApartment) {
      throw new NotFoundException('User apartment assignment not found');
    }

    return userApartment as unknown;
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
        select: this.userApartmentListSelect,
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
      select: this.userApartmentListSelect,
    });
  }
}
