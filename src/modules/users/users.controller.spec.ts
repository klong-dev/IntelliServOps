import { Test, TestingModule } from '@nestjs/testing';
import { UsersController } from './users.controller';
import { UsersService } from './users.service';
import {
  mockUser,
  mockUserJwtPayload,
  mockStaffJwtPayload,
} from '../../test-utils';
import { CreateUserDto, UpdateUserDto, SearchUserDto } from './dto';

describe('UsersController', () => {
  let controller: UsersController;
  let usersService: UsersService;

  const mockUsersService = {
    findAll: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    remove: jest.fn(),
    getProfile: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [UsersController],
      providers: [
        {
          provide: UsersService,
          useValue: mockUsersService,
        },
      ],
    }).compile();

    controller = module.get<UsersController>(UsersController);
    usersService = module.get<UsersService>(UsersService);
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
      mockUsersService.findAll.mockResolvedValue(users);

      const result = await controller.findAll({});

      expect(result).toEqual(users);
      expect(usersService.findAll).toHaveBeenCalled();
    });

    it('should support search query', async () => {
      const users = [mockUser({ fullName: 'John Doe' })];
      mockUsersService.findAll.mockResolvedValue(users);

      const query: SearchUserDto = { search: 'John' };
      const result = await controller.findAll(query);

      expect(result).toEqual(users);
      expect(usersService.findAll).toHaveBeenCalledWith(query);
    });
  });

  describe('findOne', () => {
    it('should return user by ID', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({ sub: user.id });
      mockUsersService.findOne.mockResolvedValue(user);

      const result = await controller.findOne(user.id, currentUser);

      expect(result).toEqual(user);
      expect(usersService.findOne).toHaveBeenCalledWith(user.id, currentUser);
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

    it('should create new user', async () => {
      const currentUser = mockStaffJwtPayload();
      const createdUser = mockUser(createDto);
      mockUsersService.create.mockResolvedValue(createdUser);

      const result = await controller.create(createDto, currentUser);

      expect(result).toEqual(createdUser);
      expect(usersService.create).toHaveBeenCalledWith(
        createDto,
        currentUser.sub,
      );
    });
  });

  describe('update', () => {
    const updateDto: UpdateUserDto = {
      fullName: 'Updated Name',
      phone: '+84908888888',
    };

    it('should update user', async () => {
      const user = mockUser();
      const currentUser = mockUserJwtPayload({ sub: user.id });
      const updatedUser = { ...user, ...updateDto };
      mockUsersService.update.mockResolvedValue(updatedUser);

      const result = await controller.update(user.id, updateDto, currentUser);

      expect(result).toEqual(updatedUser);
      expect(usersService.update).toHaveBeenCalledWith(
        user.id,
        updateDto,
        currentUser,
      );
    });
  });

  describe('remove', () => {
    it('should soft delete user', async () => {
      const user = mockUser({ isActive: false });
      mockUsersService.remove.mockResolvedValue(user);

      const result = await controller.remove('user-123');

      expect(result).toEqual(user);
      expect(usersService.remove).toHaveBeenCalledWith('user-123');
    });
  });

  describe('getProfile', () => {
    it('should return current user profile', async () => {
      const currentUser = mockUserJwtPayload();
      const user = mockUser({ id: currentUser.sub });
      mockUsersService.getProfile.mockResolvedValue(user);

      const result = await controller.getProfile(currentUser);

      expect(result).toEqual(user);
      expect(usersService.getProfile).toHaveBeenCalledWith(currentUser);
    });
  });
});
