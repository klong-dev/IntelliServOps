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
});
