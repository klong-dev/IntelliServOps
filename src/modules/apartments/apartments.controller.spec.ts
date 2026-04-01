import { Test, TestingModule } from '@nestjs/testing';
import { ApartmentsController } from './apartments.controller';
import { ApartmentsService } from './apartments.service';
import { LocalMediaStorageService } from '../../shared/services/local-media-storage.service';
import { SupabaseStorageService } from '../../shared/services/supabase-storage.service';
import { mockUserJwtPayload } from '../../test-utils';

describe('ApartmentsController', () => {
  let controller: ApartmentsController;

  const apartmentsService = {
    create: jest.fn(),
    update: jest.fn(),
  };

  const storageService = {
    uploadFile: jest.fn(),
  };

  const localMediaStorageService = {
    saveApartmentVideo: jest.fn(),
  };

  const imageFile = {
    originalname: 'cover.jpg',
    mimetype: 'image/jpeg',
    buffer: Buffer.from('image'),
    size: 5,
  };

  const videoFile = {
    originalname: 'tour.mp4',
    mimetype: 'video/mp4',
    buffer: Buffer.from('video'),
    size: 10,
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [ApartmentsController],
      providers: [
        { provide: ApartmentsService, useValue: apartmentsService },
        { provide: SupabaseStorageService, useValue: storageService },
        {
          provide: LocalMediaStorageService,
          useValue: localMediaStorageService,
        },
      ],
    }).compile();

    controller = module.get<ApartmentsController>(ApartmentsController);
    jest.clearAllMocks();
  });

  it('should upload create images to Supabase and video to local disk', async () => {
    const currentUser = mockUserJwtPayload();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000000000);

    storageService.uploadFile.mockResolvedValueOnce(
      'https://cdn.example.com/apartment-1.jpg',
    );
    localMediaStorageService.saveApartmentVideo.mockResolvedValueOnce(
      'http://localhost:3000/uploads/apartment-videos/apartments/owner-user-123/video/1710000000000.mp4',
    );
    apartmentsService.create.mockResolvedValue({ id: 'apt-123' });

    await controller.create(
      { images: [imageFile], video: [videoFile] },
      { apartmentNumber: 'A-101' } as any,
      currentUser,
    );

    expect(storageService.uploadFile).toHaveBeenCalledWith(
      'apartment-cooperation',
      'apartments/owner-user-123/images/1710000000000-0.jpg',
      imageFile,
    );
    expect(localMediaStorageService.saveApartmentVideo).toHaveBeenCalledWith(
      'apartments/owner-user-123/video/1710000000000.mp4',
      videoFile,
    );
    expect(apartmentsService.create).toHaveBeenCalledWith(
      expect.objectContaining({ apartmentNumber: 'A-101' }),
      currentUser,
      {
        imageUrls: ['https://cdn.example.com/apartment-1.jpg'],
        videoUrl:
          'http://localhost:3000/uploads/apartment-videos/apartments/owner-user-123/video/1710000000000.mp4',
      },
    );

    nowSpy.mockRestore();
  });

  it('should upload update video to local disk instead of Supabase', async () => {
    const currentUser = mockUserJwtPayload();
    const nowSpy = jest.spyOn(Date, 'now').mockReturnValue(1710000001111);

    localMediaStorageService.saveApartmentVideo.mockResolvedValueOnce(
      'http://localhost:3000/uploads/apartment-videos/apartments/apt-123/video/1710000001111.mp4',
    );
    apartmentsService.update.mockResolvedValue({ id: 'apt-123' });

    await controller.update(
      'apt-123',
      { video: [videoFile] },
      { baseRentPrice: 15000000 } as any,
      currentUser,
    );

    expect(storageService.uploadFile).not.toHaveBeenCalled();
    expect(localMediaStorageService.saveApartmentVideo).toHaveBeenCalledWith(
      'apartments/apt-123/video/1710000001111.mp4',
      videoFile,
    );
    expect(apartmentsService.update).toHaveBeenCalledWith(
      'apt-123',
      expect.objectContaining({ baseRentPrice: 15000000 }),
      currentUser,
      {
        imageUrls: [],
        videoUrl:
          'http://localhost:3000/uploads/apartment-videos/apartments/apt-123/video/1710000001111.mp4',
      },
    );

    nowSpy.mockRestore();
  });
});
