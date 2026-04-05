import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
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
  type IoTMqttStatusEvent,
  type IoTMqttTelemetryEvent,
  type MqttBinaryAction,
  type MqttDeviceTopic,
} from './iot-mqtt.types';
import { IoTStatus, MeterStatus, Prisma } from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

@Injectable()
export class IoTService {
  private readonly logger = new Logger(IoTService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly ioTMqttService: IoTMqttService,
  ) {}

  getGatewayStatus() {
    return this.ioTMqttService.getGatewayStatus();
  }

  requestTelemetry(espId: string) {
    const details = this.ioTMqttService.getTelemetry(espId);
    return {
      success: true,
      message: 'Telemetry request sent',
      details: this.toSignalDetails(details),
    };
  }

  checkHealth(espId: string) {
    const details = this.ioTMqttService.checkOnline(espId);
    return {
      success: true,
      message: 'Health check signal sent',
      details: this.toSignalDetails(details),
    };
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
      await this.ensureRoomBelongsToApartment(
        device.roomId,
        createDto.apartmentId,
      );
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
      throw new BadRequestException(
        'IoT board must contain at least one device',
      );
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
    await this.ensureRoomBelongsToApartment(
      createDto.roomId,
      board.apartment.id,
    );

    this.assertBoardAssignmentAvailable(
      board.devices,
      createDto.mqttTopic,
      createDto.mqttDeviceId,
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
      await this.ensureRoomBelongsToApartment(
        updateDto.roomId,
        board.apartment.id,
      );
    }

    const targetTopic =
      updateDto.mqttTopic ?? boardDevice.mqttTopic ?? undefined;
    const targetDeviceId =
      updateDto.mqttDeviceId ?? boardDevice.mqttDeviceId ?? undefined;

    if (targetTopic && targetDeviceId) {
      this.assertBoardAssignmentAvailable(
        board.devices,
        targetTopic,
        targetDeviceId,
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
    return this.controlDeviceByTopic(espId, id, 'light', action);
  }

  triggerAlarm(espId: string, id: number, action: string) {
    return this.controlDeviceByTopic(espId, id, 'alarm', action);
  }

  triggerDoor(espId: string, id: number, action: string) {
    return this.controlDeviceByTopic(espId, id, 'door', action);
  }

  triggerCurtain(espId: string, id: number, action: string) {
    return this.controlDeviceByTopic(espId, id, 'curtain', action);
  }

  configureDoorPassword(espId: string, id: number, password: string) {
    const details = this.ioTMqttService.sendDoorPassword(espId, id, password);
    return {
      success: true,
      message: 'Password sent successfully.',
      details: this.toSignalDetails(details, {
        deviceTopic: 'door',
        deviceId: details.doorId,
      }),
    };
  }

  runDeviceTestSequence(espId: string, holdMs?: number) {
    return this.ioTMqttService.runTestSequence(espId, holdMs);
  }

  controlDeviceByTopic(
    espId: string,
    deviceId: number,
    topic: MqttDeviceTopic,
    action: string,
  ) {
    const normalizedAction = this.normalizeDeviceAction(topic, action);
    const details = this.ioTMqttService.controlDevice(
      espId,
      normalizedAction,
      deviceId,
      topic,
    );

    return {
      success: true,
      message: `${topic} ${deviceId} has been ${normalizedAction}`,
      details: this.toPublishDetails(details),
    };
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
        configuration: true,
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

    return devices.map((device) => this.toDeviceListItem(device));
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
        configuration: true,
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

    return devices.map((device) => this.toDeviceListItem(device));
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

  async updateDevice(
    id: string,
    updateDto: UpdateIoTDeviceDto,
    currentUser?: JwtPayload,
  ) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id },
      select: {
        id: true,
        apartmentId: true,
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

    if (currentUser?.actorType === 'user') {
      this.assertUserCanRenameDevice(updateDto);

      const hasAccess = device.apartment.rentalContracts.some((contract) =>
        contract.members.some((member) => member.userId === currentUser.sub),
      );

      if (!hasAccess) {
        throw new ForbiddenException('No active contract for this apartment');
      }
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
      mqttTopic,
      mqttDeviceId,
      mqttDoorPasswordDeviceId,
      mqttState,
      configuration,
      installationDate,
      warrantyExpiryDate,
      ...rest
    } = updateDto;

    const incomingMqttFields =
      mqttEspId !== undefined ||
      mqttBoardName !== undefined ||
      mqttTopic !== undefined ||
      mqttDeviceId !== undefined ||
      mqttDoorPasswordDeviceId !== undefined ||
      mqttState !== undefined;

    const existingMqttMetadata = this.extractMqttMetadata(device.configuration);

    const mergedConfiguration = this.buildMergedConfiguration(
      device.configuration,
      configuration,
      incomingMqttFields
        ? this.buildMqttControlConfig({
            mqttEspId: mqttEspId ?? existingMqttMetadata.espId,
            mqttTopic: mqttTopic ?? existingMqttMetadata.topic,
            mqttDeviceId: mqttDeviceId ?? existingMqttMetadata.deviceId,
            mqttDoorPasswordDeviceId:
              mqttDoorPasswordDeviceId ??
              existingMqttMetadata.doorPasswordDeviceId,
            mqttState: mqttState ?? existingMqttMetadata.state,
          })
        : undefined,
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

  async controlDevice(id: string, action: string, currentUser?: JwtPayload) {
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
    const normalizedAction = this.normalizeDeviceAction(
      mqttConfig.topic,
      action,
    );
    const details = this.dispatchMqttCommand(mqttConfig, normalizedAction);

    return {
      status: 'sent',
      deviceId: id,
      action: normalizedAction,
      executedAt: details.publishedAt,
      mqttEspId: details.espId,
      mqttTopic: details.deviceTopic,
      mqttDeviceId: details.deviceId,
      mqttControlType: details.deviceTopic,
      mqttChannelId: details.deviceId,
      mqttPublishTopic: details.topic,
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
        images: createDto.images as Prisma.InputJsonValue | undefined,
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

  @OnEvent('iot.mqtt.status')
  async onMqttStatusEvent(event: IoTMqttStatusEvent) {
    const devices = await this.findDevicesByEspId(event.espId);

    if (devices.length === 0) {
      return;
    }

    await Promise.all(
      devices.map((device) => {
        const metadata = this.extractMqttMetadata(
          device.configuration,
          device.deviceType,
        );
        const matchesTopic =
          !event.deviceTopic || metadata.topic === event.deviceTopic;
        const matchesDeviceId =
          event.deviceId === undefined || metadata.deviceId === event.deviceId;

        return this.prisma.ioTDevice.update({
          where: { id: device.id },
          data: {
            lastOnlineAt: event.receivedAt,
            configuration: this.mergeDeviceRuntimeConfiguration(
              device.configuration,
              device.deviceType,
              {
                lastMessage: event.message,
                lastMessageAt: event.receivedAt,
                ...(matchesTopic && matchesDeviceId && event.state
                  ? { state: event.state }
                  : {}),
              },
            ) as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
      }),
    );
  }

  @OnEvent('iot.mqtt.telemetry')
  async onMqttTelemetryEvent(event: IoTMqttTelemetryEvent) {
    const devices = await this.findDevicesByEspId(event.espId);

    if (devices.length === 0) {
      return;
    }

    await Promise.all(
      devices.map((device) =>
        this.prisma.ioTDevice.update({
          where: { id: device.id },
          data: {
            lastOnlineAt: event.receivedAt,
            configuration: this.mergeDeviceRuntimeConfiguration(
              device.configuration,
              device.deviceType,
              {
                lastTelemetryAt: event.receivedAt,
                lastTelemetryMessage: event.message,
              },
            ) as Prisma.InputJsonValue,
          },
          select: { id: true },
        }),
      ),
    );

    const apartmentId = devices[0].apartmentId;

    if (event.waterTotal !== undefined) {
      await this.syncAutomaticMeterReading(
        apartmentId,
        'water',
        event.waterTotal,
        event,
      );
    }

    if (event.energyTotal !== undefined) {
      await this.syncAutomaticMeterReading(
        apartmentId,
        'electricity',
        event.energyTotal,
        event,
      );
    }
  }

  private assertUserCanRenameDevice(updateDto: UpdateIoTDeviceDto) {
    const keys = Object.entries(updateDto).filter(
      ([, value]) => value !== undefined,
    );

    const onlyDeviceName =
      keys.length === 1 && keys[0][0] === 'deviceName' && !!keys[0][1];

    if (!onlyDeviceName) {
      throw new ForbiddenException('Users can only update the device name');
    }
  }

  private toPublishDetails(details: {
    brokerUrl: string | null;
    topic: string;
    payload: string;
    espId: string;
    deviceTopic: string;
    deviceId: number;
    action?: string;
    publishedAt: Date;
  }) {
    return {
      ...details,
      deviceTopic: details.deviceTopic ?? null,
      deviceId: details.deviceId ?? null,
      action: details.action ?? null,
      controlType: details.deviceTopic ?? null,
      channelId: details.deviceId ?? null,
    };
  }

  private toSignalDetails(
    details: {
      brokerUrl: string | null;
      topic: string;
      payload: string;
      espId: string;
      publishedAt: Date;
    },
    metadata?: {
      deviceTopic?: string;
      deviceId?: number;
    },
  ) {
    return {
      ...details,
      deviceTopic: metadata?.deviceTopic ?? null,
      deviceId: metadata?.deviceId ?? null,
      action: null,
      controlType: metadata?.deviceTopic ?? null,
      channelId: metadata?.deviceId ?? null,
    };
  }

  private async findDevicesByEspId(espId: string) {
    const devices = await this.prisma.ioTDevice.findMany({
      select: {
        id: true,
        apartmentId: true,
        deviceType: true,
        configuration: true,
      },
    });

    return devices.filter((device) => {
      const metadata = this.extractMqttMetadata(
        device.configuration,
        device.deviceType,
      );
      return metadata.espId === espId;
    });
  }

  private mergeDeviceRuntimeConfiguration(
    existingConfiguration: unknown,
    deviceType: string,
    updates: {
      state?: string;
      lastMessage?: string;
      lastMessageAt?: Date;
      lastTelemetryAt?: Date;
      lastTelemetryMessage?: string;
    },
  ) {
    const root = this.toPlainObject(existingConfiguration);
    const mqtt = this.toPlainObject(root.mqtt);
    const metadata = this.extractMqttMetadata(
      existingConfiguration,
      deviceType,
    );

    return {
      ...root,
      mqtt: {
        ...mqtt,
        ...(metadata.espId ? { espId: metadata.espId } : {}),
        ...(metadata.boardName ? { boardName: metadata.boardName } : {}),
        ...(metadata.topic ? { topic: metadata.topic } : {}),
        ...(metadata.deviceId ? { deviceId: metadata.deviceId } : {}),
        ...(metadata.doorPasswordDeviceId
          ? { doorPasswordDeviceId: metadata.doorPasswordDeviceId }
          : {}),
        ...(updates.state !== undefined ? { state: updates.state } : {}),
        ...(updates.lastMessage !== undefined
          ? { lastMessage: updates.lastMessage }
          : {}),
        ...(updates.lastMessageAt !== undefined
          ? { lastMessageAt: updates.lastMessageAt.toISOString() }
          : {}),
        ...(updates.lastTelemetryAt !== undefined
          ? { lastTelemetryAt: updates.lastTelemetryAt.toISOString() }
          : {}),
        ...(updates.lastTelemetryMessage !== undefined
          ? { lastTelemetryMessage: updates.lastTelemetryMessage }
          : {}),
      },
    };
  }

  private async syncAutomaticMeterReading(
    apartmentId: string,
    meterType: 'water' | 'electricity',
    readingValue: number,
    event: IoTMqttTelemetryEvent,
  ) {
    const meter = await this.prisma.utilityMeter.findFirst({
      where: {
        apartmentId,
        meterType,
        status: MeterStatus.active,
      },
      select: {
        id: true,
        currentReading: true,
      },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (!meter) {
      this.logger.warn(
        `No active ${meterType} meter found for apartment ${apartmentId} while processing telemetry from ${event.espId}`,
      );
      return;
    }

    const normalizedReading = Number(readingValue.toFixed(2));
    const previousReading =
      meter.currentReading !== null ? Number(meter.currentReading) : null;

    if (
      previousReading !== null &&
      Math.abs(previousReading - normalizedReading) < 0.0001
    ) {
      await this.prisma.utilityMeter.update({
        where: { id: meter.id },
        data: {
          readingDate: event.receivedAt,
        },
        select: { id: true },
      });
      return;
    }

    const consumption =
      previousReading !== null && normalizedReading >= previousReading
        ? normalizedReading - previousReading
        : undefined;

    await this.prisma.utilityReading.create({
      data: {
        utilityMeter: { connect: { id: meter.id } },
        readingDate: event.receivedAt,
        readingValue: normalizedReading,
        previousReadingValue: meter.currentReading ?? undefined,
        consumption,
        readingType: 'automatic',
        notes: `Auto-synced from MQTT telemetry ${event.espId}`,
      },
      select: { id: true },
    });

    await this.prisma.utilityMeter.update({
      where: { id: meter.id },
      data: {
        previousReading: meter.currentReading,
        currentReading: normalizedReading,
        readingDate: event.receivedAt,
      },
      select: { id: true },
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
    mqttTopic?: MqttDeviceTopic;
    mqttDeviceId?: number;
    mqttDoorPasswordDeviceId?: number;
    mqttState?: string;
  }): DeviceMqttControlConfig | undefined {
    const hasAnyMqttField =
      dto.mqttEspId !== undefined ||
      dto.mqttTopic !== undefined ||
      dto.mqttDeviceId !== undefined ||
      dto.mqttDoorPasswordDeviceId !== undefined ||
      dto.mqttState !== undefined;

    if (!hasAnyMqttField) {
      return undefined;
    }

    if (!dto.mqttEspId?.trim() || !dto.mqttTopic || !dto.mqttDeviceId) {
      throw new BadRequestException(
        'mqttEspId, mqttTopic, and mqttDeviceId are required when configuring MQTT control',
      );
    }

    if (dto.mqttDeviceId <= 0) {
      throw new BadRequestException('mqttDeviceId must be a positive integer');
    }

    if (
      dto.mqttDoorPasswordDeviceId !== undefined &&
      dto.mqttDoorPasswordDeviceId <= 0
    ) {
      throw new BadRequestException(
        'mqttDoorPasswordDeviceId must be a positive integer',
      );
    }

    return {
      espId: dto.mqttEspId.trim(),
      topic: dto.mqttTopic,
      deviceId: dto.mqttDeviceId,
      ...(dto.mqttDoorPasswordDeviceId !== undefined && {
        doorPasswordDeviceId: dto.mqttDoorPasswordDeviceId,
      }),
      ...(dto.mqttState !== undefined && {
        state: dto.mqttState.trim(),
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
    const topic = metadata.topic;
    const deviceId = metadata.deviceId ?? 1;
    const doorPasswordDeviceId = metadata.doorPasswordDeviceId ?? undefined;

    if (!espId || !topic) {
      throw new BadRequestException(
        'Device is not configured for MQTT control. Set mqttEspId, mqttTopic, and mqttDeviceId first.',
      );
    }

    return {
      espId,
      topic,
      deviceId,
      ...(doorPasswordDeviceId !== undefined && { doorPasswordDeviceId }),
      ...(metadata.state !== undefined && { state: metadata.state }),
    };
  }

  private normalizeDeviceAction(
    topic: MqttDeviceTopic,
    action: string,
  ): MqttBinaryAction {
    const normalized = action.trim().toUpperCase();

    if (normalized === 'ON' || normalized === 'OFF') {
      return normalized;
    }

    if (topic === 'door' || topic === 'curtain') {
      if (normalized === 'OPEN' || normalized === 'UNLOCK') {
        return 'ON';
      }

      if (normalized === 'CLOSE' || normalized === 'LOCK') {
        return 'OFF';
      }
    }

    throw new BadRequestException(
      `${topic} devices support only ON/OFF commands in the current IoT backend`,
    );
  }

  private dispatchMqttCommand(
    config: DeviceMqttControlConfig,
    action: MqttBinaryAction,
  ) {
    return this.ioTMqttService.controlDevice(
      config.espId,
      action,
      config.deviceId,
      config.topic,
    );
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

  private toDeviceListItem(device: {
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
    const metadata = this.extractMqttMetadata(
      device.configuration,
      device.deviceType,
    );
    const { configuration: _configuration, ...rest } = device;
    void _configuration;

    return {
      ...rest,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
      mqttEspId: metadata.espId ?? null,
      mqttTopic: metadata.topic ?? null,
      mqttDeviceId: metadata.deviceId ?? null,
      mqttState: metadata.state ?? null,
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
      mqttTopic: mqttConfig?.topic ?? null,
      mqttDeviceId: mqttConfig?.deviceId ?? null,
      mqttDoorPasswordDeviceId: mqttConfig?.doorPasswordDeviceId ?? null,
      mqttState:
        this.extractMqttMetadata(device.configuration, device.deviceType)
          .state ?? null,
      mqttControlType: mqttConfig?.topic ?? null,
      mqttChannelId: mqttConfig?.deviceId ?? null,
      mqttDoorPasswordChannelId: mqttConfig?.doorPasswordDeviceId ?? null,
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
          mqttTopic: string | null;
          mqttDeviceId: number | null;
          mqttDoorPasswordDeviceId: number | null;
          mqttState: string | null;
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
        mqttTopic: metadata.topic ?? null,
        mqttDeviceId: metadata.deviceId ?? null,
        mqttDoorPasswordDeviceId: metadata.doorPasswordDeviceId ?? null,
        mqttState: metadata.state ?? null,
        mqttControlType: metadata.topic ?? null,
        mqttChannelId: metadata.deviceId ?? null,
        mqttDoorPasswordChannelId: metadata.doorPasswordDeviceId ?? null,
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
          const leftChannel = left.mqttDeviceId ?? Number.MAX_SAFE_INTEGER;
          const rightChannel = right.mqttDeviceId ?? Number.MAX_SAFE_INTEGER;

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
      topic:
        this.readDeviceTopic(mqttConfig.topic) ??
        this.readDeviceTopic(mqttConfig.controlType) ??
        this.readDeviceTopic(rootConfig.topic) ??
        this.readDeviceTopic(rootConfig.controlType) ??
        (deviceType ? this.mapDeviceTypeToTopic(deviceType) : undefined),
      deviceId:
        this.readPositiveInteger(mqttConfig.deviceId) ??
        this.readPositiveInteger(mqttConfig.channelId) ??
        this.readPositiveInteger(rootConfig.deviceId) ??
        this.readPositiveInteger(rootConfig.channelId),
      doorPasswordDeviceId:
        this.readPositiveInteger(mqttConfig.doorPasswordDeviceId) ??
        this.readPositiveInteger(mqttConfig.doorPasswordChannelId) ??
        this.readPositiveInteger(rootConfig.doorPasswordDeviceId) ??
        this.readPositiveInteger(rootConfig.doorPasswordChannelId),
      state:
        this.readString(mqttConfig.state) ?? this.readString(rootConfig.state),
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
      mqttTopic?: string;
      mqttDeviceId?: number;
    }>,
  ) {
    const assignments = new Set<string>();

    for (const device of devices) {
      const assignmentKey = this.buildBoardAssignmentKey(
        device.mqttTopic,
        device.mqttDeviceId,
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
      mqttTopic: string | null;
      mqttDeviceId: number | null;
    }>,
    topic?: string | null,
    deviceId?: number | null,
    excludedDeviceId?: string,
  ) {
    const assignmentKey = this.buildBoardAssignmentKey(topic, deviceId);

    if (!assignmentKey) {
      return;
    }

    const conflict = devices.find(
      (device) =>
        device.id !== excludedDeviceId &&
        this.buildBoardAssignmentKey(device.mqttTopic, device.mqttDeviceId) ===
          assignmentKey,
    );

    if (conflict) {
      throw new ConflictException(
        `Board device assignment ${assignmentKey} is already in use`,
      );
    }
  }

  private buildBoardAssignmentKey(
    topic?: string | null,
    deviceId?: number | null,
  ) {
    if (!topic || !deviceId) {
      return null;
    }

    return `${topic}:${deviceId}`;
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

  private readDeviceTopic(value: unknown): MqttDeviceTopic | undefined {
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

  private mapDeviceTypeToTopic(
    deviceType: string,
  ): MqttDeviceTopic | undefined {
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
