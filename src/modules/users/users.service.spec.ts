import { Test, TestingModule } from '@nestjs/testing';
import {
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
} from '@nestjs/common';
import { UsersService } from './users.service';
import { PrismaService } from '../../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';
import { FptAiService } from '../../shared/services/fpt-ai.service';
import { ConfigService } from '@nestjs/config';
import {
  createPrismaMock,
  mockUser,
  mockUserJwtPayload,
  MockPrisma,
} from '../../test-utils';
import { CreateUserDto, UpdateUserDto, SearchUserDto } from './dto';
import { ActorType } from '@prisma/client';

describe('UsersService', () => {
  let service: UsersService;
  let prisma: MockPrisma;
  let authService: AuthService;

  const mockAuthService = {
    hashPassword: jest.fn((password: string) =>
      Promise.resolve(`hashed_${password}`),
    ),
  };

  const mockFptAiService = {
    verifyIdCardFromBase64: jest.fn(),
    extractUserInfo: jest.fn(),
    extractIdNumber: jest.fn(),
    isVerificationSuccessful: jest.fn(),
    isVerificationSuccessfulForSide: jest.fn(),
  };

  const mockConfigService = {
    get: jest.fn(),
  };

  beforeEach(async () => {
    prisma = createPrismaMock();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        {
          provide: PrismaService,
          useValue: prisma,
        },
        {
          provide: AuthService,
          useValue: mockAuthService,
        },
        {
          provide: FptAiService,
          useValue: mockFptAiService,
        },
        {
          provide: ConfigService,
          useValue: mockConfigService,
        },
      ],
    }).compile();

    service = module.get<UsersService>(UsersService);
    authService = module.get<AuthService>(AuthService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('findAll', () => {
    it('should return all users', async () => {
      const users = [
        mockUser(),
        mockUser({ id: 'user-2', email: 'user2@example.com' }),
      ];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(users.length);

      const result = await service.findAll({});

      expect(result.items).toEqual(users);
      expect(prisma.user.findMany).toHaveBeenCalled();
    });

    it('should filter users by search query', async () => {
      const users = [mockUser({ fullName: 'John Doe' })];
      prisma.user.findMany.mockResolvedValue(users);
      prisma.user.count.mockResolvedValue(users.length);

      const result = await service.findAll({ search: 'John' });

      expect(result.items).toEqual(users);
      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: expect.arrayContaining([
              { email: expect.any(Object) },
              { fullName: expect.any(Object) },
              { phone: expect.any(Object) },
            ]),
          },
        }),
      );
    });
  });

  describe('findOne', () => {
    it('should return user with contracts', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({ sub: user.id });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne(user.id, currentUser);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });
      expect(prisma.user.findUnique).toHaveBeenCalledWith({
        where: { id: user.id },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      const currentUser = mockUserJwtPayload();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.findOne('non-existent', currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should allow user to view their own profile', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: user.id,
        actorType: ActorType.user,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne(user.id, currentUser);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
      });
    });

    it('should throw ForbiddenException if user tries to view another profile', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: 'different-user',
        actorType: ActorType.user,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(service.findOne(user.id, currentUser)).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should allow staff to view any user profile', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: 'staff-123',
        actorType: ActorType.staff,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      const result = await service.findOne(user.id, currentUser);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
      });
    });
  });

  describe('create', () => {
    const createDto: CreateUserDto = {
      email: 'newuser@example.com',
      phone: '+84909999999',
      fullName: 'New User',
      password: 'password123',
      dateOfBirth: '1990-01-01',
    };

    it('should create a new user', async () => {
      const createdUser = mockUser(createDto);
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue(createdUser);

      const result = await service.create(createDto, 'staff-123');

      expect(result).toEqual(createdUser);
      expect(authService.hashPassword).toHaveBeenCalledWith(createDto.password);
      expect(prisma.user.create).toHaveBeenCalled();
    });

    it('should throw ConflictException if email already exists', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(
        mockUser({ email: createDto.email }),
      );

      await expect(service.create(createDto)).rejects.toThrow(
        ConflictException,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      fullName: 'Updated Name',
      phone: '+84908888888',
    };

    it('should update user successfully', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: user.id,
        actorType: ActorType.user,
      });
      const updatedUser = { ...user, ...updateDto };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(updatedUser);

      const result = await service.update(user.id, updateDto, currentUser);

      expect(result).toEqual(updatedUser);
      expect(prisma.user.update).toHaveBeenCalled();
    });

    it('should throw NotFoundException if user not found', async () => {
      const currentUser = mockUserJwtPayload();
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(
        service.update('non-existent', updateDto, currentUser),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw ForbiddenException if user tries to update another profile', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: 'different-user',
        actorType: ActorType.user,
      });
      prisma.user.findUnique.mockResolvedValue(user);

      await expect(
        service.update(user.id, updateDto, currentUser),
      ).rejects.toThrow(ForbiddenException);
    });

    it('should prevent users from updating isActive and isVerified', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: user.id,
        actorType: ActorType.user,
      });
      const updateWithPrivileged = {
        ...updateDto,
        isActive: false,
        isVerified: false,
      };

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      await service.update(user.id, updateWithPrivileged, currentUser);

      expect(prisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.not.objectContaining({
            isActive: expect.anything(),
            isVerified: expect.anything(),
          }),
        }),
      );
    });

    it('should throw ConflictException if email already in use', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: user.id,
        actorType: ActorType.user,
      });

      prisma.user.findUnique.mockResolvedValueOnce(user);
      prisma.user.findUnique.mockResolvedValueOnce(
        mockUser({ id: 'other', email: 'taken@example.com' }),
      );

      await expect(
        service.update(user.id, { email: 'taken@example.com' }, currentUser),
      ).rejects.toThrow(ConflictException);
    });

    it('should hash password if provided', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({
        sub: user.id,
        actorType: ActorType.user,
      });

      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue(user);

      await service.update(user.id, { password: 'newpassword' }, currentUser);

      expect(authService.hashPassword).toHaveBeenCalledWith('newpassword');
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      const user = mockUser();
      prisma.user.findUnique.mockResolvedValue(user);
      prisma.user.update.mockResolvedValue({ ...user, isActive: false });

      const result = await service.remove(user.id);

      expect(result.isActive).toBe(false);
      expect(prisma.user.update).toHaveBeenCalledWith({
        where: { id: user.id },
        data: { isActive: false },
        select: expect.any(Object),
      });
    });

    it('should throw NotFoundException if user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(service.remove('non-existent')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getProfile', () => {
    it('should return user profile', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({ sub: user.id });
      prisma.user.findUnique.mockResolvedValue(user as any);

      const result = await service.getProfile(currentUser);

      expect(result).toMatchObject({
        id: user.id,
        email: user.email,
        fullName: user.fullName,
      });
    });
  });

  describe('updateIdentityCard', () => {
    it('should verify successfully when front and back match expected sides', async () => {
      const user = mockUser();
      const frontFile = {
        mimetype: 'image/jpeg',
        buffer: Buffer.from('front-image'),
      };
      const backFile = {
        mimetype: 'image/jpeg',
        buffer: Buffer.from('back-image'),
      };

      const frontResult = {
        errorCode: 0,
        errorMessage: '',
        data: [{ id: '079203001234', name: 'Nguyen Van A' }],
      };
      const backResult = {
        errorCode: 0,
        errorMessage: '',
        data: [{ id: '079203001234', issue_date: '01/01/2020' }],
      };

      prisma.user.findUnique.mockResolvedValue({
        ...user,
        identity: null,
      } as any);
      prisma.userIdentity.findUnique.mockResolvedValue(null as any);
      prisma.userIdentity.upsert.mockResolvedValue({} as any);
      prisma.user.update.mockResolvedValue({
        ...user,
        bankName: 'VCB',
        bankAccountNumber: '0123456789',
        identity: { nationalId: '079203001234' },
      } as any);

      mockConfigService.get.mockReturnValue(false);
      mockFptAiService.verifyIdCardFromBase64
        .mockResolvedValueOnce(frontResult as any)
        .mockResolvedValueOnce(backResult as any);
      mockFptAiService.isVerificationSuccessfulForSide
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(true);
      mockFptAiService.extractUserInfo
        .mockReturnValueOnce({ id: '079203001234', name: 'Nguyen Van A' })
        .mockReturnValueOnce({ issueDate: '01/01/2020' })
        .mockReturnValueOnce({ id: '079203001234' })
        .mockReturnValueOnce({ issueDate: '01/01/2020' });

      const result = await service.updateIdentityCard(
        user.id,
        frontFile,
        backFile,
        'VCB',
        '0123456789',
      );

      expect(result.aiVerification.front?.success).toBe(true);
      expect(result.aiVerification.back?.success).toBe(true);
      expect(
        mockFptAiService.isVerificationSuccessfulForSide,
      ).toHaveBeenCalledWith(frontResult, 'front');
      expect(
        mockFptAiService.isVerificationSuccessfulForSide,
      ).toHaveBeenCalledWith(backResult, 'back');
    });

    it('should reject when back image is actually front side', async () => {
      const user = mockUser();
      const frontFile = {
        mimetype: 'image/jpeg',
        buffer: Buffer.from('front-image'),
      };
      const backFile = {
        mimetype: 'image/jpeg',
        buffer: Buffer.from('front-image-duplicate'),
      };

      const frontLikeResult = {
        errorCode: 0,
        errorMessage: '',
        data: [{ id: '079203001234', name: 'Nguyen Van A' }],
      };

      prisma.user.findUnique.mockResolvedValue({
        ...user,
        identity: null,
      } as any);
      mockFptAiService.verifyIdCardFromBase64
        .mockResolvedValueOnce(frontLikeResult as any)
        .mockResolvedValueOnce(frontLikeResult as any);
      mockFptAiService.isVerificationSuccessfulForSide
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      await expect(
        service.updateIdentityCard(user.id, frontFile, backFile, 'VCB', '0123456789'),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
