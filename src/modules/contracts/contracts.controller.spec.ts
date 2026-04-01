import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { ContractsController } from './contracts.controller';
import { ContractsService } from './contracts.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { mockUserJwtPayload } from '../../test-utils';

describe('ContractsController', () => {
  let controller: ContractsController;

  const contractsService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    getContractPdfPublic: jest.fn(),
    getContractPdf: jest.fn(),
    uploadSignedPdf: jest.fn(),
    signCooperationContract: jest.fn(),
    cancelCooperationContract: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    activate: jest.fn(),
    terminate: jest.fn(),
    cancelByUser: jest.fn(),
    addMemberByNationalId: jest.fn(),
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ContractsController],
      providers: [
        { provide: ContractsService, useValue: contractsService },
        { provide: SupabaseStorageService, useValue: storageService },
      ],
    }).compile();

    controller = module.get<ContractsController>(ContractsController);
    jest.clearAllMocks();
  });

  it('should upload signed cooperation PDF to apartment-cooperation bucket', async () => {
    const currentUser = mockUserJwtPayload();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1711111111111);
    const contractPdf = {
      mimetype: 'application/pdf',
      buffer: Buffer.from('pdf'),
    };

    storageService.uploadFile.mockResolvedValueOnce(
      'https://cdn.example.com/apartment-cooperation/cooperation-contracts/contract-123/user-123-1711111111111-signed.pdf',
    );
    contractsService.signCooperationContract.mockResolvedValueOnce({
      cooperationContractId: 'contract-123',
    });

    await controller.signCooperationContract(
      'contract-123',
      contractPdf,
      {},
      currentUser,
    );

    expect(storageService.uploadFile).toHaveBeenCalledWith(
      'apartment-cooperation',
      'cooperation-contracts/contract-123/user-123-1711111111111-signed.pdf',
      contractPdf,
    );
    expect(contractsService.signCooperationContract).toHaveBeenCalledWith(
      'contract-123',
      currentUser,
      contractPdf,
      expect.objectContaining({
        contractDocumentUrl:
          'https://cdn.example.com/apartment-cooperation/cooperation-contracts/contract-123/user-123-1711111111111-signed.pdf',
      }),
    );

    nowSpy.mockRestore();
  });

  it('should reject non-pdf cooperation contract uploads', async () => {
    await expect(
      controller.signCooperationContract(
        'contract-123',
        {
          mimetype: 'image/png',
          buffer: Buffer.from('png'),
        },
        {},
        mockUserJwtPayload(),
      ),
    ).rejects.toThrow(BadRequestException);
  });
});
