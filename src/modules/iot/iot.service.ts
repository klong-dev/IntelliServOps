import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  CreateIoTBoardDto,
  CreateIoTDeviceDto,
  CreateIoTBoardDeviceDto,
  CreateUtilityMeterDto,
  CreateUtilityReadingDto,
  UpdateIoTBoardDeviceDto,
  UpdateIoTBoardDto,
  UpdateIoTDeviceDto,
  UpdateUtilityMeterDto,
} from './dto';
import { IoTMqttService } from './iot-mqtt.service';
import {
  type DeviceMqttControlConfig,
  type MqttControlType,
} from './iot-mqtt.types';
import { IoTStatus, MeterStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class IoTService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly ioTMqttService: IoTMqttService,
  ) {}

  getGatewayStatus() {
    return this.ioTMqttService.getGatewayStatus();
  }

  // ============================================================================
  // IoT Boards
  // ============================================================================

  async findAllBoards(apartmentId?: string, status?: IoTStatus) {
    const where: Prisma.IoTDeviceWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    const devices = await this.findBoardSourceDevices(where);
    return this.groupDevicesIntoBoards(devices);
  }

  async findOneBoard(boardId: string) {
    const devices = await this.findBoardSourceDevices();
    const board = this.groupDevicesIntoBoards(devices).find(
      (item) => item.id === boardId,
    );

    if (!board) {
      throw new NotFoundException('IoT board not found');
    }

    return board;
  }

  async createBoard(createDto: CreateIoTBoardDto) {
    await this.ensureApartmentExists(createDto.apartmentId);
    await this.ensureBoardDoesNotExist(createDto.boardId);

    this.assertUniqueBoardAssignments(createDto.devices);

    for (const device of createDto.devices) {
      await this.ensureRoomBelongsToApartment(device.roomId, createDto.apartmentId);
    }

    const createdDevices = await this.prisma.$transaction(
      createDto.devices.map((device) =>
        this.prisma.ioTDevice.create({
          data: this.buildCreateDeviceData({
            ...device,
            apartmentId: createDto.apartmentId,
            mqttEspId: createDto.boardId,
            mqttBoardName: createDto.boardName,
          }),
          select: { id: true },
        }),
      ),
    );

    if (createdDevices.length === 0) {
      throw new BadRequestException('IoT board must contain at least one device');
    }

    return this.findOneBoard(createDto.boardId);
  }

  async updateBoard(boardId: string, updateDto: UpdateIoTBoardDto) {
    const board = await this.findOneBoard(boardId);

    if (updateDto.apartmentId) {
      await this.ensureApartmentExists(updateDto.apartmentId);
    }

    const targetApartmentId = updateDto.apartmentId ?? board.apartment.id;
    const targetBoardName = updateDto.boardName ?? board.name;

    await Promise.all(
      board.devices.map((device) =>
        this.updateDevice(device.id, {
          ...(updateDto.apartmentId && { apartmentId: updateDto.apartmentId }),
          mqttEspId: boardId,
          mqttBoardName: targetBoardName,
          ...(targetApartmentId && { apartmentId: targetApartmentId }),
        }),
      ),
    );

    return this.findOneBoard(boardId);
  }

  async removeBoard(boardId: string) {
    const board = await this.findOneBoard(boardId);

    await this.prisma.$transaction(
      board.devices.map((device) =>
        this.prisma.ioTDevice.update({
          where: { id: device.id },
          data: { status: IoTStatus.inactive },
          select: { id: true },
        }),
      ),
    );

    return {
      id: board.id,
      name: board.name,
      affectedDevices: board.devices.length,
      status: IoTStatus.inactive,
    };
  }

  async createBoardDevice(boardId: string, createDto: CreateIoTBoardDeviceDto) {
    const board = await this.findOneBoard(boardId);
    await this.ensureRoomBelongsToApartment(createDto.roomId, board.apartment.id);

    this.assertBoardAssignmentAvailable(
      board.devices,
      createDto.mqttControlType,
      createDto.mqttChannelId,
    );

    return this.createDevice({
      ...createDto,
      apartmentId: board.apartment.id,
      mqttEspId: boardId,
      mqttBoardName: board.name,
    });
  }

  async updateBoardDevice(
    boardId: string,
    deviceId: string,
    updateDto: UpdateIoTBoardDeviceDto,
  ) {
    const board = await this.findOneBoard(boardId);
    const boardDevice = board.devices.find((device) => device.id === deviceId);

    if (!boardDevice) {
      throw new NotFoundException('IoT board device not found');
    }

    if (updateDto.roomId) {
      await this.ensureRoomBelongsToApartment(updateDto.roomId, board.apartment.id);
    }

    const targetControlType =
      updateDto.mqttControlType ?? boardDevice.mqttControlType ?? undefined;
    const targetChannelId =
      updateDto.mqttChannelId ?? boardDevice.mqttChannelId ?? undefined;

    if (targetControlType && targetChannelId) {
      this.assertBoardAssignmentAvailable(
        board.devices,
        targetControlType,
        targetChannelId,
        deviceId,
      );
    }

    return this.updateDevice(deviceId, {
      ...updateDto,
      mqttEspId: boardId,
      mqttBoardName: board.name,
      apartmentId: board.apartment.id,
    });
  }

  async removeBoardDevice(boardId: string, deviceId: string) {
    const board = await this.findOneBoard(boardId);
    const boardDevice = board.devices.find((device) => device.id === deviceId);

    if (!boardDevice) {
      throw new NotFoundException('IoT board device not found');
    }

    return this.removeDevice(deviceId);
  }

  triggerLight(espId: string, id: number, action: string) {
    const normalizedAction = this.normalizeDeviceCommand('light', action);
    const details = this.ioTMqttService.triggerLight(
      espId,
      normalizedAction,
      id,
    );
    return {
      success: true,
      message: `The lights have been turned ${normalizedAction}`,
      details,
    };
  }

  triggerAlarm(espId: string, id: number, action: string) {
    const normalizedAction = this.normalizeDeviceCommand('alarm', action);
    const details = this.ioTMqttService.triggerAlarm(
      espId,
      normalizedAction,
      id,
    );
    return {
      success: true,
      message: `Alarm has been turned ${normalizedAction}`,
      details,
    };
  }

  triggerDoor(espId: string, id: number, action: string) {
    const normalizedAction = this.normalizeDeviceCommand('door', action);
    const details = this.ioTMqttService.triggerDoor(
      espId,
      normalizedAction,
      id,
    );
    return {
      success: true,
      message: `Door has been ${normalizedAction === 'open' ? 'opened' : 'closed'}`,
      details,
    };
  }

  triggerCurtain(espId: string, id: number, action: string) {
    const normalizedAction = this.normalizeDeviceCommand('curtain', action);
    const details = this.ioTMqttService.triggerCurtain(
      espId,
      normalizedAction,
      id,
    );
    return {
      success: true,
      message: `Curtain has been ${normalizedAction === 'open' ? 'opened' : 'closed'}`,
      details,
    };
  }

  configureDoorPassword(espId: string, id: number, password: string) {
    const details = this.ioTMqttService.sendDoorPassword(espId, id, password);
    return {
      success: true,
      message: 'Password sent successfully.',
      details,
    };
  }

  runDeviceTestSequence(espId: string, holdMs?: number) {
    return this.ioTMqttService.runTestSequence(espId, holdMs);
  }

  // ============================================================================
  // IoT Devices
  // ============================================================================

  async findAllDevices(apartmentId?: string, status?: IoTStatus) {
    const where: Prisma.IoTDeviceWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    const devices = await this.prisma.ioTDevice.findMany({
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
        createdAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
          },
        },
        room: {
          select: { id: true, roomNumber: true, roomType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return devices.map((device) => ({
      ...device,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
    }));
  }

  async findOneDevice(id: string) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        brand: true,
        model: true,
        serialNumber: true,
        macAddress: true,
        locationDescription: true,
        firmwareVersion: true,
        status: true,
        isControllableByTenant: true,
        lastOnlineAt: true,
        lastMaintenanceDate: true,
        nextMaintenanceDate: true,
        installationDate: true,
        warrantyExpiryDate: true,
        configuration: true,
        accessLogsEnabled: true,
        notes: true,
        createdAt: true,
        updatedAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
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

    return this.toDeviceDetail(device);
  }

  async findDevicesByApartment(apartmentId: string, currentUser?: JwtPayload) {
    if (currentUser?.actorType === 'user') {
      const hasAccess = await this.prisma.rentalContract.findFirst({
        where: {
          apartmentId,
          status: 'active',
          members: { some: { userId: currentUser.sub } },
        },
        select: { id: true },
      });

      if (!hasAccess) {
        throw new ForbiddenException('No active contract for this apartment');
      }
    }

    const devices = await this.prisma.ioTDevice.findMany({
      where: {
        apartmentId,
        ...(currentUser?.actorType === 'user'
          ? {
              status: IoTStatus.active,
              isControllableByTenant: true,
            }
          : {}),
      },
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
        createdAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
          },
        },
        room: {
          select: { id: true, roomNumber: true, roomType: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return devices.map((device) => ({
      ...device,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
    }));
  }

  async createDevice(createDto: CreateIoTDeviceDto) {
    await this.ensureApartmentExists(createDto.apartmentId);
    await this.ensureRoomBelongsToApartment(
      createDto.roomId,
      createDto.apartmentId,
    );

    const created = await this.prisma.ioTDevice.create({
      data: this.buildCreateDeviceData(createDto),
      select: { id: true },
    });

    return this.findOneDevice(created.id);
  }

  async updateDevice(id: string, updateDto: UpdateIoTDeviceDto) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentId: true,
        configuration: true,
      },
    });

    if (!device) {
      throw new NotFoundException('IoT device not found');
    }

    const targetApartmentId = updateDto.apartmentId ?? device.apartmentId;
    if (updateDto.apartmentId) {
      await this.ensureApartmentExists(updateDto.apartmentId);
    }

    await this.ensureRoomBelongsToApartment(
      updateDto.roomId,
      targetApartmentId,
    );

    const {
      mqttEspId,
      mqttBoardName,
      mqttControlType,
      mqttChannelId,
      mqttDoorPasswordChannelId,
      configuration,
      installationDate,
      warrantyExpiryDate,
      ...rest
    } = updateDto;

    const mergedConfiguration = this.buildMergedConfiguration(
      device.configuration,
      configuration,
      this.buildMqttControlConfig({
        mqttEspId,
        mqttControlType,
        mqttChannelId,
        mqttDoorPasswordChannelId,
      }),
      mqttBoardName,
    );

    const data: Prisma.IoTDeviceUncheckedUpdateInput = {
      ...rest,
      ...(installationDate !== undefined && {
        installationDate: installationDate ? new Date(installationDate) : null,
      }),
      ...(warrantyExpiryDate !== undefined && {
        warrantyExpiryDate: warrantyExpiryDate
          ? new Date(warrantyExpiryDate)
          : null,
      }),
      ...(mergedConfiguration && {
        configuration: mergedConfiguration as Prisma.InputJsonValue,
      }),
    };

    await this.prisma.ioTDevice.update({
      where: { id },
      data,
      select: { id: true },
    });

    return this.findOneDevice(id);
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

  async controlDevice(id: string, command: string, currentUser?: JwtPayload) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      select: {
        id: true,
        deviceType: true,
        status: true,
        isControllableByTenant: true,
        configuration: true,
        apartment: {
          select: {
            rentalContracts: {
              where: { status: 'active' },
              select: {
                id: true,
                members: {
                  select: { userId: true },
                },
              },
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

    if (currentUser?.actorType === 'user') {
      if (!device.isControllableByTenant) {
        throw new ForbiddenException(
          'This device is not controllable by tenants',
        );
      }

      const hasAccess = device.apartment.rentalContracts.some((contract) =>
        contract.members.some((member) => member.userId === currentUser.sub),
      );

      if (!hasAccess) {
        throw new ForbiddenException('No active contract for this apartment');
      }
    }

    const mqttConfig = this.requireMqttControlConfig(device);
    const normalizedCommand = this.normalizeDeviceCommand(
      mqttConfig.controlType,
      command,
    );

    const details = this.dispatchMqttCommand(mqttConfig, normalizedCommand);

    return {
      status: 'sent',
      deviceId: id,
      command,
      executedAt: details.publishedAt,
      mqttEspId: details.espId,
      mqttControlType: details.controlType,
      mqttChannelId: details.channelId,
      mqttTopic: details.topic,
      mqttPayload: details.payload,
    };
  }

  // ============================================================================
  // Utility Meters
  // ============================================================================

  async findAllMeters(apartmentId?: string, status?: MeterStatus) {
    const where: Prisma.UtilityMeterWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    const meters = await this.prisma.utilityMeter.findMany({
      where,
      select: {
        id: true,
        meterNumber: true,
        meterType: true,
        brand: true,
        model: true,
        currentReading: true,
        previousReading: true,
        readingDate: true,
        ratePerUnit: true,
        status: true,
        createdAt: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return meters.map((meter) => ({
      ...meter,
      apartment: this.toApartmentSummary(meter.apartment),
    }));
  }

  async findOneMeter(id: string) {
    const meter = await this.prisma.utilityMeter.findUnique({
      where: { id },
      include: {
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
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

    return {
      ...meter,
      apartment: this.toApartmentSummary(meter.apartment),
    };
  }

  async createMeter(createDto: CreateUtilityMeterDto) {
    await this.ensureApartmentExists(createDto.apartmentId);

    const created = await this.prisma.utilityMeter.create({
      data: {
        meterNumber: createDto.meterNumber,
        meterType: createDto.meterType,
        brand: createDto.brand,
        model: createDto.model,
        apartmentId: createDto.apartmentId,
        installationDate: new Date(createDto.installationDate),
        unitOfMeasurement: createDto.unitOfMeasurement,
        ratePerUnit: createDto.ratePerUnit,
        isDigital: createDto.isDigital ?? false,
        notes: createDto.notes,
        status: MeterStatus.active,
      },
      select: { id: true },
    });

    return this.findOneMeter(created.id);
  }

  async updateMeter(id: string, updateDto: UpdateUtilityMeterDto) {
    const meter = await this.prisma.utilityMeter.findUnique({
      where: { id },
      select: { id: true, apartmentId: true },
    });

    if (!meter) {
      throw new NotFoundException('Utility meter not found');
    }

    if (updateDto.apartmentId) {
      await this.ensureApartmentExists(updateDto.apartmentId);
    }

    const data: Prisma.UtilityMeterUncheckedUpdateInput = {
      ...updateDto,
      ...(updateDto.installationDate !== undefined && {
        installationDate: new Date(updateDto.installationDate),
      }),
    };

    await this.prisma.utilityMeter.update({
      where: { id },
      data,
      select: { id: true },
    });

    return this.findOneMeter(id);
  }

  // ============================================================================
  // Utility Readings
  // ============================================================================

  async createReading(
    createDto: CreateUtilityReadingDto,
    currentUser?: JwtPayload,
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
          currentUser?.actorType === 'staff'
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

  async verifyReading(id: string, staffId?: string) {
    return this.prisma.utilityReading.update({
      where: { id },
      data: {
        isVerified: true,
        ...(staffId
          ? {
              verifiedByStaff: { connect: { id: staffId } },
            }
          : {}),
        verifiedAt: new Date(),
      },
      select: {
        id: true,
        isVerified: true,
        verifiedAt: true,
      },
    });
  }

  private async ensureApartmentExists(apartmentId: string) {
    const apartment = await this.prisma.apartment.findUnique({
      where: { id: apartmentId },
      select: { id: true },
    });

    if (!apartment) {
      throw new NotFoundException('Apartment not found');
    }
  }

  private async ensureRoomBelongsToApartment(
    roomId: string | undefined,
    apartmentId: string,
  ) {
    if (!roomId) {
      return;
    }

    const room = await this.prisma.room.findUnique({
      where: { id: roomId },
      select: { id: true, apartmentId: true },
    });

    if (!room || room.apartmentId !== apartmentId) {
      throw new BadRequestException('Room does not belong to this apartment');
    }
  }

  private buildMqttControlConfig(dto: {
    mqttEspId?: string;
    mqttControlType?: MqttControlType;
    mqttChannelId?: number;
    mqttDoorPasswordChannelId?: number;
  }): DeviceMqttControlConfig | undefined {
    const hasAnyMqttField =
      dto.mqttEspId !== undefined ||
      dto.mqttControlType !== undefined ||
      dto.mqttChannelId !== undefined ||
      dto.mqttDoorPasswordChannelId !== undefined;

    if (!hasAnyMqttField) {
      return undefined;
    }

    if (!dto.mqttEspId?.trim() || !dto.mqttControlType || !dto.mqttChannelId) {
      throw new BadRequestException(
        'mqttEspId, mqttControlType, and mqttChannelId are required when configuring MQTT control',
      );
    }

    if (dto.mqttChannelId <= 0) {
      throw new BadRequestException('mqttChannelId must be a positive integer');
    }

    if (
      dto.mqttDoorPasswordChannelId !== undefined &&
      dto.mqttDoorPasswordChannelId <= 0
    ) {
      throw new BadRequestException(
        'mqttDoorPasswordChannelId must be a positive integer',
      );
    }

    return {
      espId: dto.mqttEspId.trim(),
      controlType: dto.mqttControlType,
      channelId: dto.mqttChannelId,
      ...(dto.mqttDoorPasswordChannelId !== undefined && {
        doorPasswordChannelId: dto.mqttDoorPasswordChannelId,
      }),
    };
  }

  private buildMergedConfiguration(
    existingConfiguration: unknown,
    incomingConfiguration?: Record<string, any>,
    mqttConfig?: DeviceMqttControlConfig,
    mqttBoardName?: string,
  ) {
    const merged = {
      ...this.toPlainObject(existingConfiguration),
      ...this.toPlainObject(incomingConfiguration),
    };

    if (mqttConfig || mqttBoardName !== undefined) {
      merged.mqtt = {
        ...this.toPlainObject(merged.mqtt),
        ...(mqttConfig ?? {}),
        ...(this.readString(mqttBoardName) && {
          boardName: this.readString(mqttBoardName),
        }),
      };
    }

    return Object.keys(merged).length > 0 ? merged : undefined;
  }

  private requireMqttControlConfig(device: {
    deviceType: string;
    configuration: unknown;
  }): DeviceMqttControlConfig {
    const metadata = this.extractMqttMetadata(
      device.configuration,
      device.deviceType,
    );

    const espId = metadata.espId;
    const controlType = metadata.controlType;
    const channelId = metadata.channelId ?? 1;
    const doorPasswordChannelId = metadata.doorPasswordChannelId ?? undefined;

    if (!espId || !controlType) {
      throw new BadRequestException(
        'Device is not configured for MQTT control. Set mqttEspId, mqttControlType, and mqttChannelId first.',
      );
    }

    return {
      espId,
      controlType,
      channelId,
      ...(doorPasswordChannelId !== undefined && { doorPasswordChannelId }),
    };
  }

  private normalizeDeviceCommand(
    controlType: MqttControlType,
    command: string,
  ): string {
    const normalized = command.trim().toLowerCase();

    if (controlType === 'door') {
      if (normalized === 'unlock') {
        return 'open';
      }

      if (normalized === 'lock') {
        return 'close';
      }
    }

    if (controlType === 'light' || controlType === 'alarm') {
      if (normalized === 'on' || normalized === 'off') {
        return normalized;
      }

      throw new BadRequestException(
        `${controlType} devices support only 'on' or 'off' commands`,
      );
    }

    if (controlType === 'door' || controlType === 'curtain') {
      if (normalized === 'open' || normalized === 'close') {
        return normalized;
      }

      throw new BadRequestException(
        `${controlType} devices support only 'open' or 'close' commands`,
      );
    }

    throw new BadRequestException('Unsupported device command');
  }

  private dispatchMqttCommand(
    config: DeviceMqttControlConfig,
    command: string,
  ) {
    switch (config.controlType) {
      case 'light':
        return this.ioTMqttService.triggerLight(
          config.espId,
          command,
          config.channelId,
        );
      case 'alarm':
        return this.ioTMqttService.triggerAlarm(
          config.espId,
          command,
          config.channelId,
        );
      case 'door':
        return this.ioTMqttService.triggerDoor(
          config.espId,
          command,
          config.channelId,
        );
      case 'curtain':
        return this.ioTMqttService.triggerCurtain(
          config.espId,
          command,
          config.channelId,
        );
      default:
        throw new BadRequestException('Unsupported MQTT control type');
    }
  }

  private toApartmentSummary(apartment: {
    id: string;
    apartmentNumber: string;
    streetAddress: string | null;
  }) {
    return {
      id: apartment.id,
      apartmentNumber: apartment.apartmentNumber,
      address: apartment.streetAddress ?? '',
    };
  }

  private toRoomSummary(
    room: {
      id: string;
      roomNumber: string;
      roomType: string;
    } | null,
  ) {
    if (!room) {
      return null;
    }

    return {
      id: room.id,
      roomNumber: room.roomNumber,
      roomType: room.roomType,
    };
  }

  private toDeviceDetail(device: {
    configuration: unknown;
    deviceType: string;
    apartment: {
      id: string;
      apartmentNumber: string;
      streetAddress: string | null;
    };
    room: { id: string; roomNumber: string; roomType: string } | null;
    [key: string]: any;
  }) {
    let mqttConfig: DeviceMqttControlConfig | null = null;

    try {
      mqttConfig = this.requireMqttControlConfig(device);
    } catch {
      mqttConfig = null;
    }

    return {
      ...device,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
      mqttEspId: mqttConfig?.espId ?? null,
      mqttBoardName:
        this.extractMqttMetadata(device.configuration, device.deviceType)
          .boardName ?? null,
      mqttControlType: mqttConfig?.controlType ?? null,
      mqttChannelId: mqttConfig?.channelId ?? null,
      mqttDoorPasswordChannelId: mqttConfig?.doorPasswordChannelId ?? null,
    };
  }

  private buildCreateDeviceData(
    createDto: CreateIoTDeviceDto,
  ): Prisma.IoTDeviceUncheckedCreateInput {
    const configuration = this.buildMergedConfiguration(
      undefined,
      createDto.configuration,
      this.buildMqttControlConfig(createDto),
      createDto.mqttBoardName,
    );

    return {
      deviceName: createDto.deviceName,
      deviceType: createDto.deviceType,
      brand: createDto.brand,
      model: createDto.model,
      serialNumber: createDto.serialNumber,
      macAddress: createDto.macAddress,
      apartmentId: createDto.apartmentId,
      roomId: createDto.roomId,
      locationDescription: createDto.locationDescription,
      firmwareVersion: createDto.firmwareVersion,
      isControllableByTenant: createDto.isControllableByTenant ?? true,
      installationDate: createDto.installationDate
        ? new Date(createDto.installationDate)
        : undefined,
      warrantyExpiryDate: createDto.warrantyExpiryDate
        ? new Date(createDto.warrantyExpiryDate)
        : undefined,
      ...(configuration && {
        configuration: configuration as Prisma.InputJsonValue,
      }),
      notes: createDto.notes,
      status: IoTStatus.active,
    };
  }

  private async findBoardSourceDevices(where: Prisma.IoTDeviceWhereInput = {}) {
    return this.prisma.ioTDevice.findMany({
      where,
      select: {
        id: true,
        deviceName: true,
        deviceType: true,
        status: true,
        isControllableByTenant: true,
        lastOnlineAt: true,
        createdAt: true,
        updatedAt: true,
        configuration: true,
        apartment: {
          select: {
            id: true,
            apartmentNumber: true,
            streetAddress: true,
          },
        },
        room: {
          select: {
            id: true,
            roomNumber: true,
            roomType: true,
          },
        },
      },
      orderBy: [{ createdAt: 'asc' }, { deviceName: 'asc' }],
    });
  }

  private groupDevicesIntoBoards(
    devices: Array<{
      id: string;
      deviceName: string;
      deviceType: string;
      status: IoTStatus;
      isControllableByTenant: boolean;
      lastOnlineAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      configuration: unknown;
      apartment: {
        id: string;
        apartmentNumber: string;
        streetAddress: string | null;
      };
      room: { id: string; roomNumber: string; roomType: string } | null;
    }>,
  ) {
    const boards = new Map<
      string,
      {
        id: string;
        name: string;
        apartment: {
          id: string;
          apartmentNumber: string;
          address: string;
        };
        createdAt: Date;
        updatedAt: Date;
        lastOnlineAt: Date | null;
        devices: Array<{
          id: string;
          deviceName: string;
          deviceType: string;
          status: IoTStatus;
          isControllableByTenant: boolean;
          mqttControlType: string | null;
          mqttChannelId: number | null;
          mqttDoorPasswordChannelId: number | null;
          room: {
            id: string;
            roomNumber: string;
            roomType: string;
          } | null;
        }>;
      }
    >();

    for (const device of devices) {
      const metadata = this.extractMqttMetadata(
        device.configuration,
        device.deviceType,
      );

      if (!metadata.espId) {
        continue;
      }

      const board = boards.get(metadata.espId) ?? {
        id: metadata.espId,
        name: metadata.boardName ?? metadata.espId,
        apartment: this.toApartmentSummary(device.apartment),
        createdAt: device.createdAt,
        updatedAt: device.updatedAt,
        lastOnlineAt: device.lastOnlineAt,
        devices: [],
      };

      if (metadata.boardName) {
        board.name = metadata.boardName;
      }

      if (device.createdAt < board.createdAt) {
        board.createdAt = device.createdAt;
      }

      if (device.updatedAt > board.updatedAt) {
        board.updatedAt = device.updatedAt;
      }

      if (
        device.lastOnlineAt &&
        (!board.lastOnlineAt || device.lastOnlineAt > board.lastOnlineAt)
      ) {
        board.lastOnlineAt = device.lastOnlineAt;
      }

      board.devices.push({
        id: device.id,
        deviceName: device.deviceName,
        deviceType: device.deviceType,
        status: device.status,
        isControllableByTenant: device.isControllableByTenant,
        mqttControlType: metadata.controlType ?? null,
        mqttChannelId: metadata.channelId ?? null,
        mqttDoorPasswordChannelId: metadata.doorPasswordChannelId ?? null,
        room: this.toRoomSummary(device.room),
      });

      boards.set(metadata.espId, board);
    }

    return Array.from(boards.values())
      .map((board) => ({
        ...board,
        status: this.resolveBoardStatus(
          board.devices.map((device) => device.status),
        ),
        deviceCount: board.devices.length,
        devices: board.devices.sort((left, right) => {
          const leftChannel = left.mqttChannelId ?? Number.MAX_SAFE_INTEGER;
          const rightChannel = right.mqttChannelId ?? Number.MAX_SAFE_INTEGER;

          if (leftChannel !== rightChannel) {
            return leftChannel - rightChannel;
          }

          return left.deviceName.localeCompare(right.deviceName);
        }),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private extractMqttMetadata(configuration: unknown, deviceType?: string) {
    const rootConfig = this.toPlainObject(configuration);
    const mqttConfig = this.toPlainObject(rootConfig.mqtt);

    return {
      espId:
        this.readString(mqttConfig.espId) ?? this.readString(rootConfig.espId),
      boardName:
        this.readString(mqttConfig.boardName) ??
        this.readString(rootConfig.boardName),
      controlType:
        this.readControlType(mqttConfig.controlType) ??
        this.readControlType(rootConfig.controlType) ??
        (deviceType ? this.mapDeviceTypeToControlType(deviceType) : undefined),
      channelId:
        this.readPositiveInteger(mqttConfig.channelId) ??
        this.readPositiveInteger(rootConfig.channelId),
      doorPasswordChannelId:
        this.readPositiveInteger(mqttConfig.doorPasswordChannelId) ??
        this.readPositiveInteger(rootConfig.doorPasswordChannelId),
    };
  }

  private resolveBoardStatus(statuses: IoTStatus[]) {
    if (statuses.some((status) => status === IoTStatus.error)) {
      return IoTStatus.error;
    }

    if (statuses.some((status) => status === IoTStatus.maintenance)) {
      return IoTStatus.maintenance;
    }

    if (statuses.every((status) => status === IoTStatus.inactive)) {
      return IoTStatus.inactive;
    }

    return IoTStatus.active;
  }

  private async ensureBoardDoesNotExist(boardId: string) {
    const devices = await this.findBoardSourceDevices();
    const exists = devices.some((device) => {
      const metadata = this.extractMqttMetadata(
        device.configuration,
        device.deviceType,
      );
      return metadata.espId === boardId;
    });

    if (exists) {
      throw new ConflictException('IoT board already exists');
    }
  }

  private assertUniqueBoardAssignments(
    devices: Array<{
      mqttControlType?: string;
      mqttChannelId?: number;
    }>,
  ) {
    const assignments = new Set<string>();

    for (const device of devices) {
      const assignmentKey = this.buildBoardAssignmentKey(
        device.mqttControlType,
        device.mqttChannelId,
      );

      if (!assignmentKey) {
        continue;
      }

      if (assignments.has(assignmentKey)) {
        throw new ConflictException(
          `Duplicate board device assignment for ${assignmentKey}`,
        );
      }

      assignments.add(assignmentKey);
    }
  }

  private assertBoardAssignmentAvailable(
    devices: Array<{
      id: string;
      mqttControlType: string | null;
      mqttChannelId: number | null;
    }>,
    controlType?: string | null,
    channelId?: number | null,
    excludedDeviceId?: string,
  ) {
    const assignmentKey = this.buildBoardAssignmentKey(controlType, channelId);

    if (!assignmentKey) {
      return;
    }

    const conflict = devices.find(
      (device) =>
        device.id !== excludedDeviceId &&
        this.buildBoardAssignmentKey(
          device.mqttControlType,
          device.mqttChannelId,
        ) === assignmentKey,
    );

    if (conflict) {
      throw new ConflictException(
        `Board device assignment ${assignmentKey} is already in use`,
      );
    }
  }

  private buildBoardAssignmentKey(
    controlType?: string | null,
    channelId?: number | null,
  ) {
    if (!controlType || !channelId) {
      return null;
    }

    return `${controlType}:${channelId}`;
  }

  private toPlainObject(value: unknown): Record<string, any> {
    if (!value || typeof value !== 'object' || Array.isArray(value)) {
      return {};
    }

    return { ...(value as Record<string, any>) };
  }

  private readString(value: unknown): string | undefined {
    if (typeof value !== 'string') {
      return undefined;
    }

    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }

  private readPositiveInteger(value: unknown): number | undefined {
    if (typeof value === 'number' && Number.isInteger(value) && value > 0) {
      return value;
    }

    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isInteger(parsed) && parsed > 0) {
        return parsed;
      }
    }

    return undefined;
  }

  private readControlType(value: unknown): MqttControlType | undefined {
    if (
      value === 'light' ||
      value === 'alarm' ||
      value === 'door' ||
      value === 'curtain'
    ) {
      return value;
    }

    return undefined;
  }

  private mapDeviceTypeToControlType(
    deviceType: string,
  ): MqttControlType | undefined {
    switch (deviceType) {
      case 'light':
        return 'light';
      case 'alarm':
        return 'alarm';
      case 'smart_lock':
        return 'door';
      default:
        return undefined;
    }
  }
}
