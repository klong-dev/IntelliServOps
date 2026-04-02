import { Test, TestingModule } from '@nestjs/testing';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';

describe('IoTController', () => {
  let controller: IoTController;

  const iotService = {
    getGatewayStatus: jest.fn(),
    findAllBoards: jest.fn(),
    findOneBoard: jest.fn(),
    createBoard: jest.fn(),
    updateBoard: jest.fn(),
    removeBoard: jest.fn(),
    createBoardDevice: jest.fn(),
    updateBoardDevice: jest.fn(),
    removeBoardDevice: jest.fn(),
    triggerLight: jest.fn(),
    triggerAlarm: jest.fn(),
    triggerDoor: jest.fn(),
    triggerCurtain: jest.fn(),
    configureDoorPassword: jest.fn(),
    runDeviceTestSequence: jest.fn(),
    findAllDevices: jest.fn(),
    findOneDevice: jest.fn(),
    findDevicesByApartment: jest.fn(),
    createDevice: jest.fn(),
    updateDevice: jest.fn(),
    removeDevice: jest.fn(),
    controlDevice: jest.fn(),
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

  it('should return gateway status', () => {
    iotService.getGatewayStatus.mockReturnValue({
      success: true,
      mqttConnected: true,
    });

    expect(controller.getGatewayStatus()).toEqual({
      success: true,
      mqttConnected: true,
    });
  });

  it('should delegate direct light control to service', () => {
    iotService.triggerLight.mockReturnValue({ success: true });

    const result = controller.triggerLight('ESP_A101', 1, { action: 'ON' });

    expect(result).toEqual({ success: true });
    expect(iotService.triggerLight).toHaveBeenCalledWith('ESP_A101', 1, 'ON');
  });

  it('should delegate board listing to service', async () => {
    iotService.findAllBoards.mockResolvedValue([{ id: 'ESP_A101' }]);

    await expect(controller.findAllBoards()).resolves.toEqual([
      { id: 'ESP_A101' },
    ]);
    expect(iotService.findAllBoards).toHaveBeenCalledWith(undefined, undefined);
  });

  it('should delegate board creation to service', async () => {
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

  it('should delegate board device update to service', async () => {
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

  it('should delegate door password configuration to service', () => {
    iotService.configureDoorPassword.mockReturnValue({ success: true });

    const result = controller.configureDoorPassword('ESP_A101', 1, {
      password: '290304',
    });

    expect(result).toEqual({ success: true });
    expect(iotService.configureDoorPassword).toHaveBeenCalledWith(
      'ESP_A101',
      1,
      '290304',
    );
  });

  it('should delegate MQTT test sequence execution to service', async () => {
    iotService.runDeviceTestSequence.mockResolvedValue({ success: true });

    await expect(
      controller.runTestSequence('ESP_A101', { holdMs: 500 }),
    ).resolves.toEqual({ success: true });
    expect(iotService.runDeviceTestSequence).toHaveBeenCalledWith(
      'ESP_A101',
      500,
    );
  });

  it('should delegate DB-backed control route to service', async () => {
    iotService.controlDevice.mockResolvedValue({ status: 'sent' });

    await expect(
      controller.controlDevice('device-123', { command: 'unlock' }),
    ).resolves.toEqual({ status: 'sent' });
    expect(iotService.controlDevice).toHaveBeenCalledWith(
      'device-123',
      'unlock',
      undefined,
    );
  });
});
