/* eslint-disable @typescript-eslint/no-unsafe-argument */
import { Test, TestingModule } from '@nestjs/testing';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';

describe('IoTController', () => {
  let controller: IoTController;

  const iotService = {
    getGatewayStatus: jest.fn(),
    requestTelemetry: jest.fn(),
    checkHealth: jest.fn(),
    configureDoorPassword: jest.fn(),
    runDeviceTestSequence: jest.fn(),
    controlDeviceByTopic: jest.fn(),
    findAllBoards: jest.fn(),
    findOneBoard: jest.fn(),
    createBoard: jest.fn(),
    updateBoard: jest.fn(),
    removeBoard: jest.fn(),
    createBoardDevice: jest.fn(),
    updateBoardDevice: jest.fn(),
    removeBoardDevice: jest.fn(),
    findAllMeters: jest.fn(),
    findOneMeter: jest.fn(),
    createMeter: jest.fn(),
    updateMeter: jest.fn(),
    createReading: jest.fn(),
    getReadings: jest.fn(),
    verifyReading: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [IoTController],
      providers: [{ provide: IoTService, useValue: iotService }],
    }).compile();

    controller = module.get<IoTController>(IoTController);
    jest.clearAllMocks();
  });

  it('returns gateway status', () => {
    iotService.getGatewayStatus.mockReturnValue({
      success: true,
      mqttConnected: true,
    });

    expect(controller.getGatewayStatus()).toEqual({
      success: true,
      mqttConnected: true,
    });
  });

  it('delegates door password configuration', () => {
    iotService.configureDoorPassword.mockReturnValue({ success: true });

    expect(
      controller.configureDoorPassword('ESP_A101', 1, { password: '290304' }),
    ).toEqual({ success: true });
    expect(iotService.configureDoorPassword).toHaveBeenCalledWith(
      'ESP_A101',
      1,
      '290304',
    );
  });

  it('delegates telemetry request', () => {
    iotService.requestTelemetry.mockReturnValue({ success: true });

    expect(controller.requestTelemetry('ESP_A101')).toEqual({ success: true });
    expect(iotService.requestTelemetry).toHaveBeenCalledWith('ESP_A101');
  });

  it('delegates health check request', () => {
    iotService.checkHealth.mockReturnValue({ success: true });

    expect(controller.checkHealth('ESP_A101')).toEqual({ success: true });
    expect(iotService.checkHealth).toHaveBeenCalledWith('ESP_A101');
  });

  it('delegates test sequence execution', async () => {
    iotService.runDeviceTestSequence.mockResolvedValue({ success: true });

    await expect(
      controller.runTestSequence('ESP_A101', { holdMs: 500 }),
    ).resolves.toEqual({ success: true });
    expect(iotService.runDeviceTestSequence).toHaveBeenCalledWith(
      'ESP_A101',
      500,
    );
  });

  it('delegates generic topic control', () => {
    iotService.controlDeviceByTopic.mockReturnValue({ success: true });

    expect(
      controller.controlDeviceByTopic('ESP_A101', 1, {
        topic: 'light',
        action: 'ON',
      }),
    ).toEqual({ success: true });
    expect(iotService.controlDeviceByTopic).toHaveBeenCalledWith(
      'ESP_A101',
      1,
      'light',
      'ON',
    );
  });

  it('delegates board listing', async () => {
    iotService.findAllBoards.mockResolvedValue([{ id: 'ESP_A101' }]);

    await expect(controller.findAllBoards()).resolves.toEqual([
      { id: 'ESP_A101' },
    ]);
    expect(iotService.findAllBoards).toHaveBeenCalledWith(undefined, undefined);
  });

  it('delegates board creation', async () => {
    iotService.createBoard.mockResolvedValue({ id: 'ESP_A101' });

    await expect(
      controller.createBoard({
        boardId: 'ESP_A101',
        boardName: 'A101 Main Board',
        apartmentId: '11111111-1111-4111-8111-111111111111',
        devices: [],
      } as any),
    ).resolves.toEqual({ id: 'ESP_A101' });
    expect(iotService.createBoard).toHaveBeenCalled();
  });

  it('delegates board device update', async () => {
    iotService.updateBoardDevice.mockResolvedValue({ id: 'device-123' });

    await expect(
      controller.updateBoardDevice('ESP_A101', 'device-123', {
        deviceName: 'Updated Lamp',
      }),
    ).resolves.toEqual({ id: 'device-123' });
    expect(iotService.updateBoardDevice).toHaveBeenCalledWith(
      'ESP_A101',
      'device-123',
      { deviceName: 'Updated Lamp' },
    );
  });

  it('delegates meter listing', async () => {
    iotService.findAllMeters.mockResolvedValue([{ id: 'meter-123' }]);

    await expect(controller.findAllMeters()).resolves.toEqual([
      { id: 'meter-123' },
    ]);
    expect(iotService.findAllMeters).toHaveBeenCalledWith(undefined, undefined);
  });

  it('delegates reading verification', async () => {
    iotService.verifyReading.mockResolvedValue({ id: 'reading-123' });

    await expect(controller.verifyReading('reading-123')).resolves.toEqual({
      id: 'reading-123',
    });
    expect(iotService.verifyReading).toHaveBeenCalledWith(
      'reading-123',
      undefined,
    );
  });
});
