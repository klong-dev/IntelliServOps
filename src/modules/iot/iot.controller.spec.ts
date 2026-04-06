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
  });

  it('delegates telemetry request', () => {
    iotService.requestTelemetry.mockReturnValue({ success: true });

    expect(controller.requestTelemetry('ESP_A101')).toEqual({ success: true });
  });

  it('delegates health check request', () => {
    iotService.checkHealth.mockReturnValue({ success: true });

    expect(controller.checkHealth('ESP_A101')).toEqual({ success: true });
  });

  it('delegates test sequence execution', async () => {
    iotService.runDeviceTestSequence.mockResolvedValue({ success: true });

    await expect(
      controller.runTestSequence('ESP_A101', { holdMs: 500 }),
    ).resolves.toEqual({ success: true });
  });

  it('delegates generic topic control', () => {
    iotService.controlDeviceByTopic.mockReturnValue({ success: true });

    expect(
      controller.controlDeviceByTopic('ESP_A101', 1, {
        topic: 'light',
        action: 'ON',
      }),
    ).toEqual({ success: true });
  });

  it('delegates board listing', async () => {
    iotService.findAllBoards.mockResolvedValue([{ id: 'ESP_A101' }]);

    await expect(controller.findAllBoards()).resolves.toEqual([
      { id: 'ESP_A101' },
    ]);
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
  });

  it('delegates board device update', async () => {
    iotService.updateBoardDevice.mockResolvedValue({ id: 'device-123' });

    await expect(
      controller.updateBoardDevice('ESP_A101', 'device-123', {
        deviceName: 'Updated Lamp',
      }),
    ).resolves.toEqual({ id: 'device-123' });
  });
});
