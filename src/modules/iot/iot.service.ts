import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import * as bcrypt from 'bcrypt';
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
import {
  IoTDeviceType,
  IoTStatus,
  MeterStatus,
  MeterType,
  Prisma,
} from '@prisma/client';
import type { JwtPayload } from '../auth/auth.service';

type UtilityMqttTopic = Extract<MqttDeviceTopic, 'electric' | 'water'>;
const BOARD_ONLINE_WINDOW_MS = 30_000;
const BOARD_CONTROL_ACK_TIMEOUT_MS = 7000;
const DOOR_PIN_HASH_BCRYPT_ROUNDS = 12;

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

  async checkHealth(espId: string) {
    this.ioTMqttService.checkOnline(espId);
    const snapshot = await this.getBoardHealthSnapshot(espId);

    return {
      espId,
      online:
        !!snapshot.lastSeenAt &&
        Date.now() - snapshot.lastSeenAt.getTime() <= BOARD_ONLINE_WINDOW_MS,
      lastSeenAt: snapshot.lastSeenAt,
    };
  }

  // ============================================================================
  // IoT Boards
  // ============================================================================

  async findAllBoards(apartmentId?: string, status?: IoTStatus) {
    const where: Prisma.IoTDeviceWhereInput = {};

    if (apartmentId) where.apartmentId = apartmentId;
    if (status) where.status = status;

    const [storedBoards, devices] = await Promise.all([
      this.findStoredBoards(apartmentId, status),
      this.findBoardSourceDevices(where),
    ]);

    return this.mergeStoredBoardsWithDevices(
      storedBoards ?? [],
      this.groupDevicesIntoBoards(devices),
    );
  }

  async findOneBoard(boardId: string) {
    const [storedBoard, devices] = await Promise.all([
      this.findStoredBoard(boardId),
      this.findBoardSourceDevices(),
    ]);
    const board = this.mergeStoredBoardsWithDevices(
      storedBoard ? [storedBoard] : [],
      this.groupDevicesIntoBoards(devices).filter((item) => item.id === boardId),
    ).find((item) => item.id === boardId);

    if (!board) {
      throw new NotFoundException('IoT board not found');
    }

    return board;
  }

  async findUtilityMeters(
    boardId?: string,
    apartmentId?: string,
    status?: MeterStatus,
  ) {
    let resolvedApartmentId = apartmentId ?? null;
    let resolvedBoardId = boardId ?? null;

    if (!resolvedApartmentId && resolvedBoardId) {
      const board = await this.findOneBoard(resolvedBoardId);
      resolvedApartmentId = board.apartment?.id ?? null;
    }

    if (!resolvedApartmentId) {
      return {
        boardId: resolvedBoardId,
        apartmentId: null,
        electric: null,
        water: null,
      };
    }

    const where: Prisma.UtilityMeterWhereInput = {
      apartmentId: resolvedApartmentId,
      meterType: { in: [MeterType.electricity, MeterType.water] },
    };

    if (status) {
      where.status = status;
    }

    const meters = await this.prisma.utilityMeter.findMany({
      where,
      select: {
        id: true,
        meterNumber: true,
        meterType: true,
        currentReading: true,
        previousReading: true,
        ratePerUnit: true,
        unitOfMeasurement: true,
        readingDate: true,
        status: true,
        apartmentId: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    const electric =
      meters.find((meter) => meter.meterType === MeterType.electricity) ?? null;
    const water =
      meters.find((meter) => meter.meterType === MeterType.water) ?? null;

    return {
      boardId: resolvedBoardId,
      apartmentId: resolvedApartmentId,
      electric: this.toBoardMeterItem(electric),
      water: this.toBoardMeterItem(water),
    };
  }

  async createBoard(createDto: CreateIoTBoardDto) {
    const boardId = this.normalizeBoardId(createDto);
    const boardName =
      this.readString((createDto as { boardName?: string }).boardName) ?? boardId;
    const devices = (createDto.devices ?? []).map((device) =>
      this.normalizeBoardDeviceCreatePayload(device),
    );

    await this.ensureApartmentExists(createDto.apartmentId);
    await this.ensureBoardDoesNotExist(boardId);

    this.assertUniqueBoardAssignments(devices);

    const storedBoardCreated = await this.createStoredBoardRecord({
      id: boardId,
      name: boardName,
      apartmentId: createDto.apartmentId,
      status: IoTStatus.active,
    });

    if (!storedBoardCreated && devices.length === 0) {
      throw new BadRequestException(
        'Creating an empty board requires the iot_boards table. Please run the latest Prisma migration first.',
      );
    }

    if (devices.length > 0) {
      const createdDevices = await this.prisma.$transaction(
        devices.map((device) =>
          this.prisma.ioTDevice.create({
            data: this.buildCreateBoardDeviceData(
              boardId,
              createDto.apartmentId,
              device,
              boardName,
            ),
            select: { id: true },
          }),
        ),
      );

      await Promise.all(
        devices.map((device, index) =>
          this.syncUtilityMeterForBoardDevice(
            boardId,
            boardName,
            createDto.apartmentId,
            createdDevices[index].id,
            device,
          ),
        ),
      );
    }

    return this.findOneBoard(boardId);
  }

  async updateBoard(boardId: string, updateDto: UpdateIoTBoardDto) {
    const board = await this.findOneBoard(boardId);

    if (updateDto.apartmentId) {
      await this.ensureApartmentExists(updateDto.apartmentId);
    }

    const targetApartmentId = updateDto.apartmentId ?? board.apartment?.id;
    const targetStatus = updateDto.status ?? board.status;

    await this.upsertStoredBoardRecord({
      where: { id: boardId },
      create: {
        id: boardId,
        name: board.name,
        ...(targetApartmentId && { apartmentId: targetApartmentId }),
        status: targetStatus,
        ...(board.lastOnlineAt && { lastOnlineAt: board.lastOnlineAt }),
      },
      update: {
        ...(targetApartmentId !== undefined ? { apartmentId: targetApartmentId } : {}),
        ...(updateDto.status !== undefined ? { status: updateDto.status } : {}),
      },
      select: { id: true },
    });

    if (updateDto.apartmentId) {
      await this.prisma.ioTDevice.updateMany({
        where: {
          id: { in: board.devices.map((device) => device.id) },
        },
        data: { apartmentId: updateDto.apartmentId },
      });

      await Promise.all(
        board.devices.map((device) =>
          this.syncUtilityMeterForExistingBoardDevice(
            boardId,
            board.name,
            updateDto.apartmentId,
            device.id,
            device.topic,
            device.deviceId,
            device.deviceName,
          ),
        ),
      );
    }

    if (updateDto.status !== undefined && board.devices.length > 0) {
      await this.prisma.ioTDevice.updateMany({
        where: { id: { in: board.devices.map((device) => device.id) } },
        data: { status: updateDto.status },
      });
    }

    return this.findOneBoard(boardId);
  }

  async removeBoard(boardId: string) {
    const board = await this.findOneBoard(boardId);

    await this.upsertStoredBoardRecord({
      where: { id: boardId },
      create: {
        id: boardId,
        name: board.name,
        ...(board.apartment?.id && { apartmentId: board.apartment.id }),
        ...(board.lastOnlineAt && { lastOnlineAt: board.lastOnlineAt }),
        status: IoTStatus.inactive,
      },
      update: { status: IoTStatus.inactive },
      select: { id: true },
    });

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

  async unlinkBoardApartment(boardId: string) {
    const board = await this.findOneBoard(boardId);
    const previousApartmentId = board.apartment?.id ?? null;

    await this.updateStoredBoardMany({
      where: { id: boardId },
      data: { apartmentId: null },
    });

    const deviceIds = board.devices.map((device) => device.id);
    const updatedDevices = deviceIds.length
      ? await this.prisma.ioTDevice.updateMany({
          where: { id: { in: deviceIds } },
          data: { apartmentId: null },
        })
      : { count: 0 };

    return {
      boardId: board.id,
      boardName: board.name,
      previousApartmentId,
      affectedDevices: updatedDevices.count,
    };
  }

  async unlinkBoardsByApartment(apartmentId: string) {
    await this.ensureApartmentExists(apartmentId);

    const boards = await this.findAllBoards(apartmentId);
    const boardIds = boards.map((board) => board.id);

    const updatedBoards = boardIds.length
      ? await this.updateStoredBoardMany({
          where: { id: { in: boardIds } },
          data: { apartmentId: null },
        })
      : { count: 0 };

    const updatedDevices = await this.prisma.ioTDevice.updateMany({
      where: { apartmentId },
      data: { apartmentId: null },
    });

    return {
      apartmentId,
      affectedBoards: Math.max(updatedBoards.count, boards.length),
      affectedDevices: updatedDevices.count,
    };
  }

  async createBoardDevice(boardId: string, createDto: CreateIoTBoardDeviceDto) {
    const board = await this.findOneBoard(boardId);
    const normalizedDevice = this.normalizeBoardDeviceCreatePayload(createDto);

    this.assertBoardAssignmentAvailable(
      board.devices,
      normalizedDevice.topic,
      normalizedDevice.deviceId,
    );

    const created = await this.prisma.ioTDevice.create({
      data: this.buildCreateBoardDeviceData(
        boardId,
        board.apartment?.id,
        normalizedDevice,
        board.name,
      ),
      select: { id: true },
    });

    await this.syncUtilityMeterForBoardDevice(
      boardId,
      board.name,
      board.apartment?.id,
      created.id,
      normalizedDevice,
    );

    return this.findOneDevice(created.id);
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

    const targetTopic =
      updateDto.topic ?? boardDevice.topic ?? undefined;
    const targetDeviceId =
      updateDto.deviceId ?? boardDevice.deviceId ?? undefined;

    if (targetTopic && targetDeviceId) {
      this.assertBoardAssignmentAvailable(
        board.devices,
        targetTopic,
        targetDeviceId,
        deviceId,
      );
    }

    await this.updateBoardDeviceRecord(
      deviceId,
      boardId,
      board.apartment?.id,
      updateDto,
    );

    await this.syncUtilityMeterForExistingBoardDevice(
      boardId,
      board.name,
      board.apartment?.id,
      deviceId,
      targetTopic,
      targetDeviceId,
      updateDto.deviceName ?? boardDevice.deviceName,
    );

    return this.findOneDevice(deviceId);
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

  async controlDeviceByTopic(
    espId: string,
    deviceId: number,
    topic: MqttDeviceTopic,
    action: string,
  ) {
    const normalizedAction = this.normalizeDeviceAction(topic, action);
    const expectedState = normalizedAction;
    const ack = await this.ioTMqttService.controlDeviceAndWaitForAck(
      espId,
      normalizedAction,
      deviceId,
      topic,
      BOARD_CONTROL_ACK_TIMEOUT_MS,
    );
    const actualState =
      this.normalizeBoardDeviceState(ack.statusEvent?.state ?? null) ?? null;
    const success = !ack.timedOut && actualState === expectedState;

    return {
      success,
      message: this.buildBoardControlMessage(
        success,
        expectedState,
        actualState,
        ack.timeoutMs,
      ),
    };
  }

  async controlBoardDevice(
    boardId: string,
    deviceId: number,
    topic: MqttDeviceTopic,
    action: string,
  ) {
    const board = await this.findOneBoard(boardId);
    const assignment = board.devices.find(
      (device) => device.deviceId === deviceId && device.topic === topic,
    );

    if (!assignment) {
      throw new NotFoundException(
        'Board device assignment not found for the given topic and deviceId',
      );
    }

    const normalizedAction = this.normalizeDeviceAction(topic, action);
    const expectedState = normalizedAction;
    const ack = await this.ioTMqttService.controlDeviceAndWaitForAck(
      boardId,
      normalizedAction,
      deviceId,
      topic,
      BOARD_CONTROL_ACK_TIMEOUT_MS,
    );

    const actualState =
      this.normalizeBoardDeviceState(ack.statusEvent?.state ?? null) ?? null;
    const success = !ack.timedOut && actualState === expectedState;

    return {
      success,
      message: this.buildBoardControlMessage(
        success,
        expectedState,
        actualState,
        ack.timeoutMs,
      ),
    };
  }

  async controlDoor(
    boardId: string,
    deviceId: number,
    action: 'LOCK' | 'UNLOCK',
    currentUser: JwtPayload,
  ) {
    await this.assertDoorAccess(boardId, currentUser);
    const mqttAction = action === 'UNLOCK' ? 'ON' : 'OFF';
    return this.controlBoardDevice(boardId, deviceId, 'door', mqttAction);
  }

  async unlockDoor(
    boardId: string,
    deviceId: number,
    pin: string,
    currentUser: JwtPayload,
  ) {
    this.assertValidDoorPin(pin, 'pin');

    const { doorDevice, boardDoorDeviceId } = await this.assertDoorAccess(
      boardId,
      currentUser,
    );
    this.assertDoorDeviceMatch(boardDoorDeviceId, deviceId);

    const existingPinHash = this.readDoorPinHash(doorDevice.configuration);
    if (!existingPinHash) {
      throw new BadRequestException('Door PIN is not configured yet');
    }

    const matches = await bcrypt.compare(pin, existingPinHash);
    if (!matches) {
      return {
        success: false,
        message: 'Invalid door PIN.',
      };
    }

    return this.controlBoardDevice(boardId, deviceId, 'door', 'ON');
  }

  async updateDoorPin(
    boardId: string,
    deviceId: number,
    oldPin: string,
    newPin: string,
    currentUser: JwtPayload,
  ) {
    this.assertValidDoorPin(oldPin, 'oldPin');
    this.assertValidDoorPin(newPin, 'newPin');

    if (oldPin === newPin) {
      throw new BadRequestException('newPin must be different from oldPin');
    }

    const { board, doorDevice, boardDoorDeviceId } = await this.assertDoorAccess(
      boardId,
      currentUser,
      true,
    );
    this.assertDoorDeviceMatch(boardDoorDeviceId, deviceId);

    const existingPinHash = this.readDoorPinHash(doorDevice.configuration);
    if (existingPinHash) {
      const matches = await bcrypt.compare(oldPin, existingPinHash);
      if (!matches) {
        throw new BadRequestException('oldPin is incorrect');
      }
    }

    const details = this.ioTMqttService.sendDoorPassword(boardId, deviceId, newPin);
    const pinUpdateAck = await this.waitForDoorPinUpdateAck(boardId, deviceId);

    if (!pinUpdateAck.success) {
      return {
        success: false,
        message: pinUpdateAck.message,
      };
    }

    const pinHash = await bcrypt.hash(newPin, DOOR_PIN_HASH_BCRYPT_ROUNDS);
    const updatedConfiguration = this.mergeDoorPinHashIntoConfiguration(
      doorDevice.configuration,
      pinHash,
      pinUpdateAck.receivedAt ?? undefined,
    );

    await this.prisma.ioTDevice.update({
      where: { id: doorDevice.id },
      data: {
        configuration: updatedConfiguration as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await this.logDoorPinUpdate(board.apartment?.id, boardId, currentUser);

    return {
      success: true,
      message: 'Door PIN updated successfully.',
    };
  }

  async resetDoorPin(
    boardId: string,
    deviceId: number,
    newPin: string,
    currentUser: JwtPayload,
  ) {
    this.assertValidDoorPin(newPin, 'newPin');
    this.assertStaffLevelActor(currentUser);

    const { board, doorDevice, boardDoorDeviceId } = await this.assertDoorAccess(
      boardId,
      currentUser,
    );
    this.assertDoorDeviceMatch(boardDoorDeviceId, deviceId);

    const details = this.ioTMqttService.sendDoorPassword(boardId, deviceId, newPin);
    const pinUpdateAck = await this.waitForDoorPinUpdateAck(boardId, deviceId);

    if (!pinUpdateAck.success) {
      return {
        success: false,
        message: pinUpdateAck.message,
      };
    }

    const pinHash = await bcrypt.hash(newPin, DOOR_PIN_HASH_BCRYPT_ROUNDS);
    const updatedConfiguration = this.mergeDoorPinHashIntoConfiguration(
      doorDevice.configuration,
      pinHash,
      pinUpdateAck.receivedAt ?? undefined,
    );

    await this.prisma.ioTDevice.update({
      where: { id: doorDevice.id },
      data: {
        configuration: updatedConfiguration as Prisma.InputJsonValue,
      },
      select: { id: true },
    });

    await this.logDoorPinUpdate(board.apartment?.id, boardId, currentUser);

    return {
      success: true,
      message: 'Door PIN updated successfully.',
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

    const utilityLookup = await this.findUtilityMeterLookup(
      this.extractApartmentIds(devices),
    );

    return devices.map((device) =>
      this.toDeviceListItem(device, utilityLookup),
    );
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

    const utilityLookup = await this.findUtilityMeterLookup(
      this.extractApartmentIds([device]),
    );

    return this.toDeviceDetail(device, utilityLookup);
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

    const utilityLookup = await this.findUtilityMeterLookup([apartmentId]);

    return devices.map((device) =>
      this.toDeviceListItem(device, utilityLookup),
    );
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

      if (!device.apartment) {
        throw new ForbiddenException('Device is not assigned to an apartment');
      }

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
      targetApartmentId ?? undefined,
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

      if (!device.apartment) {
        throw new ForbiddenException('Device is not assigned to an apartment');
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
                  ? { state: this.normalizeBoardDeviceState(event.state) }
                  : {}),
              },
            ) as Prisma.InputJsonValue,
          },
          select: { id: true },
        });
      }),
    );

    await this.updateStoredBoardMany({
      where: { id: event.espId },
      data: { lastOnlineAt: event.receivedAt },
    });
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

    await this.updateStoredBoardMany({
      where: { id: event.espId },
      data: { lastOnlineAt: event.receivedAt },
    });

    const apartmentId = devices[0].apartmentId;

    if (!apartmentId) {
      this.logger.warn(
        `Skipping meter sync for ${event.espId} because the board is not assigned to an apartment`,
      );
      return;
    }

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
        lastOnlineAt: true,
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
    let meter = await this.prisma.utilityMeter.findFirst({
      where: {
        apartmentId,
        meterType,
        status: { not: MeterStatus.replaced },
      },
      select: {
        id: true,
        currentReading: true,
      },
      orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
    });

    if (!meter) {
      meter = await this.createUtilityMeterFromTelemetry(
        apartmentId,
        meterType,
        event,
      );
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

  private async ensureApartmentExists(apartmentId?: string) {
    if (!apartmentId) {
      return;
    }

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
    apartmentId?: string,
  ) {
    if (!roomId || !apartmentId) {
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
    mqttConfig?: Partial<DeviceMqttControlConfig>,
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
  } | null) {
    if (!apartment) {
      return null;
    }

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

  private extractApartmentIds(
    items: Array<{ apartment?: { id: string } | null }>,
  ): string[] {
    return Array.from(
      new Set(
        items
          .map((item) => item.apartment?.id)
          .filter((value): value is string => Boolean(value)),
      ),
    );
  }

  private async findUtilityMeterLookup(apartmentIds: string[]) {
    if (apartmentIds.length === 0) {
      return new Map<string, any>();
    }

    const meters = await this.prisma.utilityMeter.findMany({
      where: {
        apartmentId: { in: apartmentIds },
        meterType: { in: [MeterType.electricity, MeterType.water] },
      },
      select: {
        id: true,
        apartmentId: true,
        meterNumber: true,
        meterType: true,
        currentReading: true,
        previousReading: true,
        ratePerUnit: true,
        unitOfMeasurement: true,
        readingDate: true,
        status: true,
      },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    return new Map(
      meters.map((meter) => [
        this.getUtilityLookupKey(meter.apartmentId, meter.meterType),
        meter,
      ]),
    );
  }

  private getUtilityLookupKey(apartmentId: string, meterType: MeterType) {
    return `${apartmentId}:${meterType}`;
  }

  private findUtilityMeterForDevice(
    apartmentId?: string | null,
    topic?: MqttDeviceTopic,
    utilityLookup?: Map<string, any>,
  ) {
    if (!apartmentId || !this.isUtilityTopic(topic) || !utilityLookup) {
      return null;
    }

    return (
      utilityLookup.get(
        this.getUtilityLookupKey(
          apartmentId,
          this.mapUtilityTopicToMeterType(topic),
        ),
      ) ?? null
    );
  }

  private async assertDoorAccess(
    boardId: string,
    currentUser: JwtPayload,
    requirePrimaryTenant = false,
  ) {
    const board = await this.findOneBoard(boardId);
    const boardDoorDevice = board.devices.find((device) => device.topic === 'door');

    if (!boardDoorDevice) {
      throw new NotFoundException('Door device not found on this board');
    }

    const doorDevice = await this.findDoorDeviceRecord(boardId, boardDoorDevice.id);

    if (currentUser.actorType === 'user') {
      if (!board.apartment?.id) {
        throw new ForbiddenException('Board is not assigned to an apartment');
      }

      const membership = await this.prisma.userApartment.findFirst({
        where: {
          userId: currentUser.sub,
          apartmentId: board.apartment.id,
          status: 'active',
        },
        select: {
          id: true,
          isPrimaryTenant: true,
        },
      });

      if (!membership) {
        throw new ForbiddenException('No active apartment membership');
      }

      if (requirePrimaryTenant && !membership.isPrimaryTenant) {
        throw new ForbiddenException('Only primary tenant can update door PIN');
      }
    }

    return { board, doorDevice, boardDoorDeviceId: boardDoorDevice.deviceId };
  }

  private assertDoorDeviceMatch(actualDeviceId: number, expectedDeviceId: number) {
    if (actualDeviceId !== expectedDeviceId) {
      throw new NotFoundException('Door device id mismatch for this board');
    }
  }

  private assertValidDoorPin(
    value: string,
    fieldName: 'pin' | 'oldPin' | 'newPin',
  ) {
    if (!/^\d{6}$/.test(value)) {
      throw new BadRequestException(`${fieldName} must be exactly 6 digits`);
    }
  }

  private assertStaffLevelActor(currentUser: JwtPayload) {
    if (
      currentUser.actorType !== 'staff' &&
      currentUser.actorType !== 'operator' &&
      currentUser.actorType !== 'admin'
    ) {
      throw new ForbiddenException('Only staff/operator/admin can reset door PIN');
    }
  }

  private readDoorPinHash(configuration: unknown): string | undefined {
    const root = this.toPlainObject(configuration);
    const mqtt = this.toPlainObject(root.mqtt);
    return this.readString(mqtt.pinHash);
  }

  private mergeDoorPinHashIntoConfiguration(
    existingConfiguration: unknown,
    pinHash: string,
    receivedAt?: Date,
  ) {
    const root = this.toPlainObject(existingConfiguration);
    const mqtt = this.toPlainObject(root.mqtt);

    return {
      ...root,
      mqtt: {
        ...mqtt,
        pinHash,
        ...(receivedAt ? { pinUpdatedAt: receivedAt.toISOString() } : {}),
      },
    };
  }

  private async waitForDoorPinUpdateAck(boardId: string, deviceId: number) {
    const statusEvent = await this.ioTMqttService.waitForStatusEvent(
      (event) =>
        event.espId === boardId &&
        event.deviceTopic === 'door' &&
        (event.deviceId === undefined || event.deviceId === deviceId) &&
        event.type === 'door_pin_update',
      BOARD_CONTROL_ACK_TIMEOUT_MS,
    );

    if (!statusEvent) {
      return {
        success: false,
        message: `No door PIN update acknowledgement within ${BOARD_CONTROL_ACK_TIMEOUT_MS}ms.`,
        receivedAt: null as Date | null,
      };
    }

    if (statusEvent.pinUpdateResult !== 'success') {
      return {
        success: false,
        message: 'Board reported door PIN update failed.',
        receivedAt: statusEvent.receivedAt,
      };
    }

    return {
      success: true,
      message: 'Door PIN updated successfully.',
      receivedAt: statusEvent.receivedAt,
    };
  }

  private async logDoorPinUpdate(
    apartmentId: string | null | undefined,
    boardId: string,
    currentUser: JwtPayload,
  ) {
    try {
      await this.prisma.activityLog.create({
        data: {
          actorType: currentUser.actorType,
          actorId: currentUser.sub,
          action: 'IOT_DOOR_PIN_UPDATED',
          entityType: 'IoTBoard',
          entityId: boardId,
          description: `Door PIN was updated for board ${boardId}`,
          metadata: {
            apartmentId,
          },
          status: 'success',
        },
      });
    } catch (error) {
      this.logger.warn(
        `Failed to write activity log for door PIN update on ${boardId}: ${error instanceof Error ? error.message : 'unknown'}`,
      );
    }
  }

  private async findDoorDeviceRecord(boardId: string, deviceRecordId: string) {
    const device = await this.prisma.ioTDevice.findUnique({
      where: { id: deviceRecordId },
      select: {
        id: true,
        configuration: true,
        deviceType: true,
      },
    });

    if (!device) {
      throw new NotFoundException(`Door device record not found for board ${boardId}`);
    }

    return {
      id: device.id,
      configuration: device.configuration,
      deviceType: device.deviceType,
    };
  }

  private async createUtilityMeterFromTelemetry(
    apartmentId: string,
    meterType: MeterType,
    event: IoTMqttTelemetryEvent,
  ) {
    const meterNumber = this.buildTelemetryMeterNumber(
      event.espId,
      apartmentId,
      meterType,
    );

    try {
      return await this.prisma.utilityMeter.create({
        data: {
          meterNumber,
          meterType,
          apartmentId,
          installationDate: event.receivedAt,
          unitOfMeasurement: meterType === MeterType.electricity ? 'kWh' : 'm3',
          isDigital: true,
          status: MeterStatus.active,
          notes: `Auto-created from MQTT telemetry ${event.espId}`,
        },
        select: {
          id: true,
          currentReading: true,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        const existing = await this.prisma.utilityMeter.findFirst({
          where: {
            apartmentId,
            meterType,
            status: { not: MeterStatus.replaced },
          },
          select: {
            id: true,
            currentReading: true,
          },
          orderBy: [{ readingDate: 'desc' }, { createdAt: 'desc' }],
        });

        if (existing) {
          return existing;
        }
      }

      throw error;
    }
  }

  private toUtilityMeterMetadata(utilityMeter: any) {
    if (!utilityMeter) {
      return undefined;
    }

    return {
      isUtilityMeter: true,
      utilityMeterId: utilityMeter.id,
      utilityMeterType: utilityMeter.meterType,
      currentReading: utilityMeter.currentReading?.toString() ?? null,
      previousReading: utilityMeter.previousReading?.toString() ?? null,
      ratePerUnit: utilityMeter.ratePerUnit?.toString() ?? null,
      unitOfMeasurement: utilityMeter.unitOfMeasurement ?? null,
      readingDate: utilityMeter.readingDate ?? null,
    };
  }

  private toBoardMeterItem(utilityMeter: any) {
    if (!utilityMeter) {
      return null;
    }

    return {
      id: utilityMeter.id,
      meterNumber: utilityMeter.meterNumber,
      meterType: utilityMeter.meterType,
      currentReading: utilityMeter.currentReading?.toString() ?? null,
      previousReading: utilityMeter.previousReading?.toString() ?? null,
      ratePerUnit: utilityMeter.ratePerUnit?.toString() ?? null,
      unitOfMeasurement: utilityMeter.unitOfMeasurement ?? null,
      readingDate: utilityMeter.readingDate ?? null,
      status: utilityMeter.status,
    };
  }

  private toDeviceListItem(device: {
    configuration: unknown;
    deviceType: string;
    apartment: {
      id: string;
      apartmentNumber: string;
      streetAddress: string | null;
    } | null;
    room: { id: string; roomNumber: string; roomType: string } | null;
    [key: string]: any;
  }, utilityLookup?: Map<string, any>) {
    const metadata = this.extractMqttMetadata(
      device.configuration,
      device.deviceType,
    );
    const { configuration: _configuration, ...rest } = device;
    void _configuration;
    const utilityMeter = this.findUtilityMeterForDevice(
      device.apartment?.id,
      metadata.topic,
      utilityLookup,
    );

    return {
      ...rest,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
      mqttEspId: metadata.espId ?? null,
      mqttTopic: metadata.topic ?? null,
      mqttDeviceId: metadata.deviceId ?? null,
      mqttState: metadata.state ?? null,
      ...this.toUtilityMeterMetadata(utilityMeter),
    };
  }

  private toDeviceDetail(device: {
    configuration: unknown;
    deviceType: string;
    apartment: {
      id: string;
      apartmentNumber: string;
      streetAddress: string | null;
    } | null;
    room: { id: string; roomNumber: string; roomType: string } | null;
    [key: string]: any;
  }, utilityLookup?: Map<string, any>) {
    let mqttConfig: DeviceMqttControlConfig | null = null;

    try {
      mqttConfig = this.requireMqttControlConfig(device);
    } catch {
      mqttConfig = null;
    }

    const metadata = this.extractMqttMetadata(
      device.configuration,
      device.deviceType,
    );
    const utilityMeter = this.findUtilityMeterForDevice(
      device.apartment?.id,
      metadata.topic,
      utilityLookup,
    );

    return {
      ...device,
      apartment: this.toApartmentSummary(device.apartment),
      room: this.toRoomSummary(device.room),
      mqttEspId: mqttConfig?.espId ?? null,
      mqttBoardName: metadata.boardName ?? null,
      mqttTopic: mqttConfig?.topic ?? null,
      mqttDeviceId: mqttConfig?.deviceId ?? null,
      mqttDoorPasswordDeviceId: mqttConfig?.doorPasswordDeviceId ?? null,
      mqttState: metadata.state ?? null,
      mqttControlType: mqttConfig?.topic ?? null,
      mqttChannelId: mqttConfig?.deviceId ?? null,
      mqttDoorPasswordChannelId: mqttConfig?.doorPasswordDeviceId ?? null,
      ...this.toUtilityMeterMetadata(utilityMeter),
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
      ...(createDto.apartmentId && { apartmentId: createDto.apartmentId }),
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
    } as Prisma.IoTDeviceUncheckedCreateInput;
  }

  private buildCreateBoardDeviceData(
    boardId: string,
    apartmentId: string | undefined,
    device: CreateIoTBoardDeviceDto,
    boardName?: string,
  ): Prisma.IoTDeviceUncheckedCreateInput {
    const configuration = this.buildMergedConfiguration(
      undefined,
      device.icon ? { icon: device.icon } : undefined,
      {
        espId: boardId,
        topic: device.topic,
        deviceId: device.deviceId,
        ...(device.state !== undefined && { state: device.state }),
      },
      boardName,
    );

    return {
      deviceName: device.deviceName,
      deviceType: this.mapTopicToDeviceType(device.topic),
      ...(apartmentId && { apartmentId }),
      isControllableByTenant: true,
      ...(configuration && {
        configuration: configuration as Prisma.InputJsonValue,
      }),
      status: IoTStatus.active,
    } as Prisma.IoTDeviceUncheckedCreateInput;
  }

  private async findStoredBoards(apartmentId?: string, status?: IoTStatus) {
    return this.withStoredBoardFallback(
      () =>
        this.prisma.ioTBoard.findMany({
          where: {
            ...(apartmentId && { apartmentId }),
            ...(status && { status }),
          },
          select: {
            id: true,
            name: true,
            status: true,
            lastOnlineAt: true,
            createdAt: true,
            updatedAt: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                streetAddress: true,
              },
            },
          },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        }),
      [],
    );
  }

  private async findStoredBoard(boardId: string) {
    return this.withStoredBoardFallback(
      () =>
        this.prisma.ioTBoard.findUnique({
          where: { id: boardId },
          select: {
            id: true,
            name: true,
            status: true,
            lastOnlineAt: true,
            createdAt: true,
            updatedAt: true,
            apartment: {
              select: {
                id: true,
                apartmentNumber: true,
                streetAddress: true,
              },
            },
          },
        }),
      null,
    );
  }

  private async createStoredBoardRecord(data: {
    id: string;
    name: string;
    apartmentId?: string;
    status: IoTStatus;
  }) {
    return this.withStoredBoardFallback(
      async () => {
        await this.prisma.ioTBoard.create({
          data: {
            id: data.id,
            name: data.name,
            ...(data.apartmentId && { apartmentId: data.apartmentId }),
            status: data.status,
          },
          select: { id: true },
        });

        return true;
      },
      false,
    );
  }

  private async upsertStoredBoardRecord<T extends Prisma.IoTBoardUpsertArgs>(
    args: T,
  ) {
    return this.withStoredBoardFallback(
      () => this.prisma.ioTBoard.upsert(args),
      null,
    );
  }

  private async updateStoredBoardMany(args: Prisma.IoTBoardUpdateManyArgs) {
    return this.withStoredBoardFallback(
      () => this.prisma.ioTBoard.updateMany(args),
      { count: 0 },
    );
  }

  private async withStoredBoardFallback<T>(
    operation: () => Promise<T>,
    fallbackValue: T,
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (this.isMissingStoredBoardTableError(error)) {
        this.logger.warn(
          'iot_boards table is missing. Falling back to device-derived board data.',
        );
        return fallbackValue;
      }

      throw error;
    }
  }

  private isMissingStoredBoardTableError(error: unknown) {
    if (!error || typeof error !== 'object') {
      return false;
    }

    const code = 'code' in error ? error.code : undefined;
    const message = 'message' in error ? error.message : undefined;

    return (
      code === 'P2021' &&
      typeof message === 'string' &&
      message.includes('iot_boards')
    );
  }

  private async updateBoardDeviceRecord(
    deviceId: string,
    boardId: string,
    apartmentId: string | undefined,
    updateDto: UpdateIoTBoardDeviceDto,
  ) {
    const existing = await this.prisma.ioTDevice.findUnique({
      where: { id: deviceId },
      select: { configuration: true },
    });

    return this.prisma.ioTDevice.update({
      where: { id: deviceId },
      data: this.buildUpdateBoardDeviceData(
        existing?.configuration,
        boardId,
        apartmentId,
        updateDto,
      ),
      select: { id: true },
    });
  }

  private buildUpdateBoardDeviceData(
    existingConfiguration: unknown,
    boardId: string,
    apartmentId: string | undefined,
    updateDto: UpdateIoTBoardDeviceDto,
  ): Prisma.IoTDeviceUncheckedUpdateInput {
    const mqttConfig: Partial<DeviceMqttControlConfig> = {
      ...(updateDto.topic !== undefined && { topic: updateDto.topic }),
      ...(updateDto.deviceId !== undefined && { deviceId: updateDto.deviceId }),
      ...(updateDto.state !== undefined && {
        state: this.normalizeBoardDeviceState(updateDto.state),
      }),
      espId: boardId,
    };

    const configuration = this.buildMergedConfiguration(
      existingConfiguration,
      updateDto.icon !== undefined ? { icon: updateDto.icon } : undefined,
      mqttConfig,
    );

    return {
      ...(updateDto.deviceName !== undefined && { deviceName: updateDto.deviceName }),
      ...(updateDto.topic !== undefined && {
        deviceType: this.mapTopicToDeviceType(updateDto.topic),
      }),
      ...(apartmentId && { apartmentId }),
      ...(configuration && {
        configuration: configuration as Prisma.InputJsonValue,
      }),
    };
  }

  private async syncUtilityMeterForBoardDevice(
    boardId: string,
    boardName: string,
    apartmentId: string | undefined,
    deviceRecordId: string,
    device: {
      topic: MqttDeviceTopic;
      deviceId: number;
      deviceName: string;
    },
  ) {
    if (!this.isUtilityTopic(device.topic)) {
      return;
    }

    if (!apartmentId) {
      throw new BadRequestException(
        'Utility device requires the board to be linked to an apartment',
      );
    }

    const meterType = this.mapUtilityTopicToMeterType(device.topic);
    const existingMeter = await this.prisma.utilityMeter.findFirst({
      where: {
        apartmentId,
        meterType,
        status: { not: MeterStatus.replaced },
      },
      select: { id: true },
      orderBy: [{ updatedAt: 'desc' }, { createdAt: 'desc' }],
    });

    if (existingMeter) {
      return;
    }

    await this.prisma.utilityMeter.create({
      data: {
        meterNumber: this.buildUtilityMeterNumber(
          boardId,
          device.topic,
          device.deviceId,
        ),
        meterType,
        apartmentId,
        installationDate: new Date(),
        unitOfMeasurement: device.topic === 'electric' ? 'kWh' : 'm3',
        isDigital: true,
        status: MeterStatus.active,
        notes: `Auto-created from board ${boardName} (${boardId}) for device ${device.deviceName} [${deviceRecordId}]`,
      },
      select: { id: true },
    });
  }

  private async syncUtilityMeterForExistingBoardDevice(
    boardId: string,
    boardName: string,
    apartmentId: string | undefined,
    deviceRecordId: string,
    topic?: string | null,
    mqttDeviceId?: number | null,
    deviceName?: string,
  ) {
    if (!this.isUtilityTopic(topic) || !mqttDeviceId) {
      return;
    }

    await this.syncUtilityMeterForBoardDevice(
      boardId,
      boardName,
      apartmentId,
      deviceRecordId,
      {
        topic,
        deviceId: mqttDeviceId,
        deviceName: deviceName ?? `Utility ${mqttDeviceId}`,
      },
    );
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
      } | null;
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
        } | null;
        createdAt: Date;
        updatedAt: Date;
        lastOnlineAt: Date | null;
        devices: Array<{
          id: string;
          deviceName: string;
          deviceId: number;
          status: IoTStatus;
          icon: string | null;
          topic: string | null;
          state: string | null;
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

      if (this.isUtilityTopic(metadata.topic)) {
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

      if (!board.apartment && device.apartment) {
        board.apartment = this.toApartmentSummary(device.apartment);
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
        deviceId: metadata.deviceId ?? 1,
        status: device.status,
        icon: this.readString(this.toPlainObject(device.configuration).icon) ?? null,
        topic: metadata.topic ?? null,
        state: this.normalizeBoardDeviceState(metadata.state) ?? null,
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
          const leftChannel = left.deviceId ?? Number.MAX_SAFE_INTEGER;
          const rightChannel = right.deviceId ?? Number.MAX_SAFE_INTEGER;

          if (leftChannel !== rightChannel) {
            return leftChannel - rightChannel;
          }

          return left.deviceName.localeCompare(right.deviceName);
        }),
      }))
      .sort((left, right) => left.name.localeCompare(right.name));
  }

  private mergeStoredBoardsWithDevices(
    storedBoards: Array<{
      id: string;
      name: string;
      status: IoTStatus;
      lastOnlineAt: Date | null;
      createdAt: Date;
      updatedAt: Date;
      apartment: {
        id: string;
        apartmentNumber: string;
        streetAddress: string | null;
      } | null;
    }>,
    groupedBoards: Array<{
      id: string;
      name: string;
      status: IoTStatus;
      deviceCount: number;
      apartment: {
        id: string;
        apartmentNumber: string;
        address: string;
      } | null;
      devices: Array<{
        id: string;
        deviceName: string;
        deviceId: number;
        status: IoTStatus;
        icon: string | null;
        topic: string | null;
        state: string | null;
      }>;
      createdAt: Date;
      updatedAt: Date;
      lastOnlineAt: Date | null;
    }>,
  ) {
    const merged = new Map(
      groupedBoards.map((board) => [board.id, { ...board }]),
    );

    for (const storedBoard of storedBoards) {
      const existing = merged.get(storedBoard.id);

      if (!existing) {
        merged.set(storedBoard.id, {
          id: storedBoard.id,
          name: storedBoard.name,
          status: storedBoard.status,
          deviceCount: 0,
          apartment: this.toApartmentSummary(storedBoard.apartment),
          devices: [],
          createdAt: storedBoard.createdAt,
          updatedAt: storedBoard.updatedAt,
          lastOnlineAt: storedBoard.lastOnlineAt,
        });
        continue;
      }

      merged.set(storedBoard.id, {
        ...existing,
        name: storedBoard.name || existing.name,
        status:
          existing.devices.length > 0
            ? this.resolveBoardStatus(existing.devices.map((device) => device.status))
            : storedBoard.status,
        apartment: this.toApartmentSummary(storedBoard.apartment) ?? existing.apartment,
        createdAt: storedBoard.createdAt,
        updatedAt:
          storedBoard.updatedAt > existing.updatedAt
            ? storedBoard.updatedAt
            : existing.updatedAt,
        lastOnlineAt: storedBoard.lastOnlineAt ?? existing.lastOnlineAt,
      });
    }

    return Array.from(merged.values()).sort((left, right) =>
      left.name.localeCompare(right.name),
    );
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
        this.normalizeBoardDeviceState(
          this.readString(mqttConfig.state) ?? this.readString(rootConfig.state),
        ),
      icon: this.readString(mqttConfig.icon) ?? this.readString(rootConfig.icon),
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
    const [storedBoard, devices] = await Promise.all([
      this.findStoredBoard(boardId),
      this.findBoardSourceDevices(),
    ]);

    if (storedBoard) {
      throw new ConflictException('IoT board already exists');
    }

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
      topic?: string;
      deviceId?: number;
      mqttTopic?: string;
      mqttDeviceId?: number;
    }>,
  ) {
    const assignments = new Set<string>();

    for (const device of devices) {
      const assignmentKey = this.buildBoardAssignmentKey(
        device.topic ?? device.mqttTopic,
        device.deviceId ?? device.mqttDeviceId,
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
      topic?: string | null;
      deviceId?: number | null;
      mqttTopic?: string | null;
      mqttDeviceId?: number | null;
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
        this.buildBoardAssignmentKey(
          device.topic ?? device.mqttTopic,
          device.deviceId ?? device.mqttDeviceId,
        ) === assignmentKey,
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

  private readDate(value: unknown): Date | undefined {
    if (value instanceof Date && !Number.isNaN(value.getTime())) {
      return value;
    }

    if (typeof value === 'string' || typeof value === 'number') {
      const parsed = new Date(value);
      if (!Number.isNaN(parsed.getTime())) {
        return parsed;
      }
    }

    return undefined;
  }

  private async getBoardHealthSnapshot(espId: string) {
    const [storedBoard, devices] = await Promise.all([
      this.findStoredBoard(espId),
      this.findDevicesByEspId(espId),
    ]);

    let lastSeenAt: Date | null = storedBoard?.lastOnlineAt ?? null;
    for (const device of devices) {
      if (device.lastOnlineAt && (!lastSeenAt || device.lastOnlineAt > lastSeenAt)) {
        lastSeenAt = device.lastOnlineAt;
      }

      const rootConfig = this.toPlainObject(device.configuration);
      const mqttConfig = this.toPlainObject(rootConfig.mqtt);
      const deviceLastStatusAt = this.readDate(mqttConfig.lastMessageAt);
      const deviceLastTelemetryAt = this.readDate(mqttConfig.lastTelemetryAt);

      if (deviceLastStatusAt) {
        if (!lastSeenAt || deviceLastStatusAt > lastSeenAt) {
          lastSeenAt = deviceLastStatusAt;
        }
      }

      if (deviceLastTelemetryAt) {
        if (!lastSeenAt || deviceLastTelemetryAt > lastSeenAt) {
          lastSeenAt = deviceLastTelemetryAt;
        }
      }
    }

    return {
      espId,
      lastSeenAt,
    };
  }

  private readDeviceTopic(value: unknown): MqttDeviceTopic | undefined {
    if (
      value === 'light' ||
      value === 'alarm' ||
      value === 'door' ||
      value === 'curtain' ||
      value === 'electric' ||
      value === 'water'
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
      case 'sensor':
        return undefined;
      default:
        return undefined;
    }
  }

  private mapTopicToDeviceType(topic: MqttDeviceTopic): IoTDeviceType {
    switch (topic) {
      case 'light':
        return IoTDeviceType.light;
      case 'alarm':
        return IoTDeviceType.alarm;
      case 'door':
        return IoTDeviceType.smart_lock;
      case 'curtain':
      case 'electric':
      case 'water':
        return IoTDeviceType.sensor;
    }
  }

  private isUtilityTopic(topic?: string | null): topic is UtilityMqttTopic {
    return topic === 'electric' || topic === 'water';
  }

  private mapUtilityTopicToMeterType(topic: UtilityMqttTopic): MeterType {
    switch (topic) {
      case 'electric':
        return MeterType.electricity;
      case 'water':
        return MeterType.water;
    }
  }

  private buildUtilityMeterNumber(
    boardId: string,
    topic: UtilityMqttTopic,
    deviceId: number,
  ) {
    return `UTILITY-${boardId}-${topic}-${deviceId}`;
  }

  private buildTelemetryMeterNumber(
    espId: string,
    apartmentId: string,
    meterType: MeterType,
  ) {
    const typeLabel = meterType === MeterType.electricity ? 'electric' : 'water';
    return `AUTO-${espId}-${apartmentId}-${typeLabel}`;
  }

  private normalizeBoardId(input: { id?: string; boardId?: string }) {
    const boardId = this.readString(input.id) ?? this.readString(input.boardId);

    if (!boardId) {
      throw new BadRequestException('Board id is required');
    }

    return boardId;
  }

  private normalizeBoardDeviceCreatePayload(
    device: CreateIoTBoardDeviceDto & {
      mqttTopic?: MqttDeviceTopic;
      mqttDeviceId?: number;
      mqttState?: string;
    },
  ): CreateIoTBoardDeviceDto {
    const topic = device.topic ?? device.mqttTopic;
    const deviceId = device.deviceId ?? device.mqttDeviceId;

    if (!topic || !deviceId) {
      throw new BadRequestException('Board device requires topic and deviceId');
    }

    return {
      deviceName:
        this.readString(device.deviceName) ??
        this.readString((device as { name?: string }).name) ??
        `Device ${deviceId}`,
      deviceId,
      icon: device.icon,
      topic,
      state: this.normalizeBoardDeviceState(device.state ?? device.mqttState),
    };
  }

  private normalizeBoardDeviceState(value?: string | null) {
    if (!value) {
      return undefined;
    }

    const normalized = value.trim().toUpperCase();

    if (normalized === 'ON' || normalized === 'OPEN' || normalized === 'UNLOCK') {
      return 'ON';
    }

    if (
      normalized === 'OFF' ||
      normalized === 'CLOSE' ||
      normalized === 'CLOSED' ||
      normalized === 'LOCK'
    ) {
      return 'OFF';
    }

    return undefined;
  }

  private buildBoardControlMessage(
    success: boolean,
    expectedState: string,
    actualState: string | null,
    timeoutMs: number,
  ) {
    if (success) {
      return 'Board acknowledged the requested state.';
    }

    if (actualState === null) {
      return `No status response from board within ${timeoutMs}ms.`;
    }

    return `Board responded with ${actualState}, expected ${expectedState}.`;
  }
}
