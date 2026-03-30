import { Test, TestingModule } from '@nestjs/testing';
import { IoTController } from './iot.controller';
import { IoTService } from './iot.service';
import { mockUserJwtPayload } from '../../test-utils';

describe('IoTController', () => {
  let controller: IoTController;

  const iotService = {
    getGatewayStatus: jest.fn(),
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

    const result = controller.triggerLight('ESP_A101', 1, { action: 'on' });

    expect(result).toEqual({ success: true });
    expect(iotService.triggerLight).toHaveBeenCalledWith('ESP_A101', 1, 'on');
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
    const currentUser = mockUserJwtPayload();
    iotService.controlDevice.mockResolvedValue({ status: 'sent' });

    await expect(
      controller.controlDevice('device-123', { command: 'unlock' }, currentUser),
    ).resolves.toEqual({ status: 'sent' });
    expect(iotService.controlDevice).toHaveBeenCalledWith(
      'device-123',
      'unlock',
      currentUser,
    );
  });
});
