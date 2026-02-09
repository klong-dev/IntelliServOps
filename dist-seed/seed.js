"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
var client_1 = require("@prisma/client");
var bcrypt = __importStar(require("bcrypt"));
var prisma = new client_1.PrismaClient();
function hashPassword(password) {
    return __awaiter(this, void 0, void 0, function () {
        return __generator(this, function (_a) {
            return [2 /*return*/, bcrypt.hash(password, 10)];
        });
    });
}
function main() {
    return __awaiter(this, void 0, void 0, function () {
        var adminPassword, admin1, admin2, operatorPassword, operator1, operator2, staffPassword, staff1, staff2, staff3, partnerPassword, partner1, partner2, userPassword, user1, user2, user3, guest1, guest2, apt1, apt2, apt3, apt4, contract1, contract2, meter1, meter2, invoice1, invoice2;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    console.log('🌱 Starting database seed...');
                    // ============================================================================
                    // ADMINS
                    // ============================================================================
                    console.log('Creating admins...');
                    return [4 /*yield*/, hashPassword('Admin@123')];
                case 1:
                    adminPassword = _a.sent();
                    return [4 /*yield*/, prisma.admin.upsert({
                            where: { email: 'superadmin@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'superadmin@intellirentops.vn',
                                phone: '+84909111222',
                                fullName: 'Nguyễn Văn Admin',
                                username: 'superadmin',
                                passwordHash: adminPassword,
                                roleLevel: 'super_admin',
                                isActive: true,
                            },
                        })];
                case 2:
                    admin1 = _a.sent();
                    return [4 /*yield*/, prisma.admin.upsert({
                            where: { email: 'admin@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'admin@intellirentops.vn',
                                phone: '+84909111333',
                                fullName: 'Trần Thị Quản Lý',
                                username: 'admin',
                                passwordHash: adminPassword,
                                roleLevel: 'admin',
                                isActive: true,
                            },
                        })];
                case 3:
                    admin2 = _a.sent();
                    // ============================================================================
                    // OPERATORS
                    // ============================================================================
                    console.log('Creating operators...');
                    return [4 /*yield*/, hashPassword('Operator@123')];
                case 4:
                    operatorPassword = _a.sent();
                    return [4 /*yield*/, prisma.operator.upsert({
                            where: { email: 'operator1@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'operator1@intellirentops.vn',
                                phone: '+84909222111',
                                fullName: 'Lê Văn Điều Hành',
                                employeeCode: 'OP-001',
                                shift: 'morning',
                                passwordHash: operatorPassword,
                                isActive: true,
                            },
                        })];
                case 5:
                    operator1 = _a.sent();
                    return [4 /*yield*/, prisma.operator.upsert({
                            where: { email: 'operator2@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'operator2@intellirentops.vn',
                                phone: '+84909222222',
                                fullName: 'Phạm Thị Hỗ Trợ',
                                employeeCode: 'OP-002',
                                shift: 'afternoon',
                                passwordHash: operatorPassword,
                                isActive: true,
                            },
                        })];
                case 6:
                    operator2 = _a.sent();
                    // ============================================================================
                    // STAFF
                    // ============================================================================
                    console.log('Creating staff...');
                    return [4 /*yield*/, hashPassword('Staff@123')];
                case 7:
                    staffPassword = _a.sent();
                    return [4 /*yield*/, prisma.staff.upsert({
                            where: { email: 'staff1@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'staff1@intellirentops.vn',
                                phone: '+84909333111',
                                fullName: 'Hoàng Văn Kỹ Thuật',
                                employeeCode: 'ST-001',
                                role: 'technician',
                                department: 'Kỹ thuật',
                                passwordHash: staffPassword,
                                workingCity: 'Hồ Chí Minh',
                                workingDistrict: 'Quận 1',
                                hireDate: new Date('2024-01-15'),
                                isActive: true,
                            },
                        })];
                case 8:
                    staff1 = _a.sent();
                    return [4 /*yield*/, prisma.staff.upsert({
                            where: { email: 'staff2@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'staff2@intellirentops.vn',
                                phone: '+84909333222',
                                fullName: 'Ngô Thị Chăm Sóc',
                                employeeCode: 'ST-002',
                                role: 'customer_service',
                                department: 'CSKH',
                                passwordHash: staffPassword,
                                workingCity: 'Hồ Chí Minh',
                                workingDistrict: 'Quận 7',
                                hireDate: new Date('2024-03-01'),
                                isActive: true,
                            },
                        })];
                case 9:
                    staff2 = _a.sent();
                    return [4 /*yield*/, prisma.staff.upsert({
                            where: { email: 'staff3@intellirentops.vn' },
                            update: {},
                            create: {
                                email: 'staff3@intellirentops.vn',
                                phone: '+84909333333',
                                fullName: 'Đỗ Văn Bảo Trì',
                                employeeCode: 'ST-003',
                                role: 'maintenance',
                                department: 'Bảo trì',
                                passwordHash: staffPassword,
                                workingCity: 'Hồ Chí Minh',
                                workingDistrict: 'Quận 2',
                                hireDate: new Date('2024-06-01'),
                                isActive: true,
                            },
                        })];
                case 10:
                    staff3 = _a.sent();
                    // ============================================================================
                    // PARTNERS
                    // ============================================================================
                    console.log('Creating partners...');
                    return [4 /*yield*/, hashPassword('Partner@123')];
                case 11:
                    partnerPassword = _a.sent();
                    return [4 /*yield*/, prisma.partner.upsert({
                            where: { email: 'partner1@gmail.com' },
                            update: {},
                            create: {
                                email: 'partner1@gmail.com',
                                phone: '+84909444111',
                                fullName: 'Võ Văn Chủ Nhà',
                                companyName: 'Công ty BĐS Phú Mỹ',
                                taxCode: '0312345678',
                                nationalId: '079123456789',
                                passwordHash: partnerPassword,
                                address: '123 Nguyễn Huệ, Quận 1, TP.HCM',
                                bankName: 'Vietcombank',
                                bankAccountNumber: '0071000123456',
                                commissionRate: new client_1.Prisma.Decimal(8.0),
                                isVerified: true,
                                isActive: true,
                            },
                        })];
                case 12:
                    partner1 = _a.sent();
                    return [4 /*yield*/, prisma.partner.upsert({
                            where: { email: 'partner2@gmail.com' },
                            update: {},
                            create: {
                                email: 'partner2@gmail.com',
                                phone: '+84909444222',
                                fullName: 'Trương Thị Đầu Tư',
                                companyName: 'Công ty Đầu tư Hoàng Gia',
                                taxCode: '0398765432',
                                passwordHash: partnerPassword,
                                address: '456 Lê Lợi, Quận 3, TP.HCM',
                                bankName: 'Techcombank',
                                bankAccountNumber: '19028888888888',
                                commissionRate: new client_1.Prisma.Decimal(10.0),
                                isVerified: true,
                                isActive: true,
                            },
                        })];
                case 13:
                    partner2 = _a.sent();
                    // ============================================================================
                    // USERS (Tenants)
                    // ============================================================================
                    console.log('Creating users...');
                    return [4 /*yield*/, hashPassword('User@123')];
                case 14:
                    userPassword = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'user1@gmail.com' },
                            update: {},
                            create: {
                                email: 'user1@gmail.com',
                                phone: '+84909555111',
                                fullName: 'Nguyễn Văn Thuê',
                                passwordHash: userPassword,
                                dateOfBirth: new Date('1990-05-15'),
                                nationalId: '079987654321',
                                emergencyContactName: 'Nguyễn Văn Cha',
                                emergencyContactPhone: '+84909555999',
                                isActive: true,
                                isVerified: true,
                                createdByStaffId: staff2.id,
                            },
                        })];
                case 15:
                    user1 = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'user2@gmail.com' },
                            update: {},
                            create: {
                                email: 'user2@gmail.com',
                                phone: '+84909555222',
                                fullName: 'Trần Thị Ở Trọ',
                                passwordHash: userPassword,
                                dateOfBirth: new Date('1995-08-20'),
                                nationalId: '079111222333',
                                emergencyContactName: 'Trần Văn Mẹ',
                                emergencyContactPhone: '+84909555888',
                                isActive: true,
                                isVerified: true,
                                createdByStaffId: staff2.id,
                            },
                        })];
                case 16:
                    user2 = _a.sent();
                    return [4 /*yield*/, prisma.user.upsert({
                            where: { email: 'user3@gmail.com' },
                            update: {},
                            create: {
                                email: 'user3@gmail.com',
                                phone: '+84909555333',
                                fullName: 'Lê Minh Khách',
                                passwordHash: userPassword,
                                dateOfBirth: new Date('1988-12-10'),
                                isActive: true,
                                isVerified: true,
                            },
                        })];
                case 17:
                    user3 = _a.sent();
                    // ============================================================================
                    // GUESTS
                    // ============================================================================
                    console.log('Creating guests...');
                    return [4 /*yield*/, prisma.guest.upsert({
                            where: { email: 'guest1@gmail.com' },
                            update: {},
                            create: {
                                email: 'guest1@gmail.com',
                                phone: '+84909666111',
                                fullName: 'Khách Xem Nhà 1',
                                preferredContactMethod: 'phone',
                            },
                        })];
                case 18:
                    guest1 = _a.sent();
                    return [4 /*yield*/, prisma.guest.upsert({
                            where: { email: 'guest2@gmail.com' },
                            update: {},
                            create: {
                                email: 'guest2@gmail.com',
                                phone: '+84909666222',
                                fullName: 'Khách Xem Nhà 2',
                                preferredContactMethod: 'both',
                            },
                        })];
                case 19:
                    guest2 = _a.sent();
                    // ============================================================================
                    // APARTMENTS
                    // ============================================================================
                    console.log('Creating apartments...');
                    return [4 /*yield*/, prisma.apartment.create({
                            data: {
                                buildingName: 'Vinhomes Central Park',
                                apartmentNumber: 'P1-2301',
                                apartmentType: 'VIP',
                                totalArea: new client_1.Prisma.Decimal(85.5),
                                numberOfBedrooms: 2,
                                numberOfBathrooms: 2,
                                floorNumber: 23,
                                address: '208 Nguyễn Hữu Cảnh',
                                ward: 'Phường 22',
                                district: 'Quận Bình Thạnh',
                                city: 'Hồ Chí Minh',
                                latitude: new client_1.Prisma.Decimal(10.7915),
                                longitude: new client_1.Prisma.Decimal(106.7218),
                                baseRentPrice: new client_1.Prisma.Decimal(25000000),
                                depositAmount: new client_1.Prisma.Decimal(50000000),
                                furnishingStatus: 'fully_furnished',
                                amenities: ['Hồ bơi', 'Gym', 'Công viên', 'Siêu thị', 'Bảo vệ 24/7'],
                                description: 'Căn hộ cao cấp view sông Sài Gòn, nội thất đầy đủ, tiện ích 5 sao',
                                status: 'available',
                                partnerId: partner1.id,
                                approvedByOperatorId: operator1.id,
                                approvedAt: new Date(),
                            },
                        })];
                case 20:
                    apt1 = _a.sent();
                    return [4 /*yield*/, prisma.apartment.create({
                            data: {
                                buildingName: 'Masteri Thảo Điền',
                                apartmentNumber: 'T2-1505',
                                apartmentType: 'NORMAL',
                                totalArea: new client_1.Prisma.Decimal(70.0),
                                numberOfBedrooms: 2,
                                numberOfBathrooms: 2,
                                floorNumber: 15,
                                address: '159 Xa Lộ Hà Nội',
                                ward: 'Phường Thảo Điền',
                                district: 'Quận 2',
                                city: 'Hồ Chí Minh',
                                latitude: new client_1.Prisma.Decimal(10.8024),
                                longitude: new client_1.Prisma.Decimal(106.7398),
                                baseRentPrice: new client_1.Prisma.Decimal(18000000),
                                depositAmount: new client_1.Prisma.Decimal(36000000),
                                furnishingStatus: 'fully_furnished',
                                amenities: ['Hồ bơi', 'Gym', 'BBQ', 'Sân chơi trẻ em'],
                                description: 'Căn hộ hiện đại gần Metro, view thành phố',
                                status: 'occupied',
                                partnerId: partner1.id,
                                approvedByOperatorId: operator1.id,
                                approvedAt: new Date(),
                            },
                        })];
                case 21:
                    apt2 = _a.sent();
                    return [4 /*yield*/, prisma.apartment.create({
                            data: {
                                buildingName: 'Saigon Pearl',
                                apartmentNumber: 'R1-801',
                                apartmentType: 'STANDARD',
                                totalArea: new client_1.Prisma.Decimal(55.0),
                                numberOfBedrooms: 1,
                                numberOfBathrooms: 1,
                                floorNumber: 8,
                                address: '92 Nguyễn Hữu Cảnh',
                                ward: 'Phường 22',
                                district: 'Quận Bình Thạnh',
                                city: 'Hồ Chí Minh',
                                latitude: new client_1.Prisma.Decimal(10.7880),
                                longitude: new client_1.Prisma.Decimal(106.7195),
                                baseRentPrice: new client_1.Prisma.Decimal(12000000),
                                depositAmount: new client_1.Prisma.Decimal(24000000),
                                furnishingStatus: 'semi_furnished',
                                amenities: ['Hồ bơi', 'Gym'],
                                description: 'Căn hộ 1 phòng ngủ, phù hợp độc thân hoặc cặp đôi',
                                status: 'available',
                                partnerId: partner2.id,
                                approvedByOperatorId: operator1.id,
                                approvedAt: new Date(),
                            },
                        })];
                case 22:
                    apt3 = _a.sent();
                    return [4 /*yield*/, prisma.apartment.create({
                            data: {
                                buildingName: 'The Manor',
                                apartmentNumber: 'M3-2010',
                                apartmentType: 'VIP',
                                totalArea: new client_1.Prisma.Decimal(120.0),
                                numberOfBedrooms: 3,
                                numberOfBathrooms: 2,
                                floorNumber: 20,
                                address: '91 Nguyễn Hữu Cảnh',
                                ward: 'Phường 22',
                                district: 'Quận Bình Thạnh',
                                city: 'Hồ Chí Minh',
                                latitude: new client_1.Prisma.Decimal(10.7905),
                                longitude: new client_1.Prisma.Decimal(106.7190),
                                baseRentPrice: new client_1.Prisma.Decimal(35000000),
                                depositAmount: new client_1.Prisma.Decimal(70000000),
                                furnishingStatus: 'fully_furnished',
                                amenities: ['Hồ bơi', 'Gym', 'Spa', 'Sân tennis', 'Nhà hàng'],
                                description: 'Penthouse view panorama, nội thất sang trọng',
                                status: 'available',
                                partnerId: partner2.id,
                                approvedByOperatorId: operator1.id,
                                approvedAt: new Date(),
                            },
                        })];
                case 23:
                    apt4 = _a.sent();
                    // ============================================================================
                    // ROOMS
                    // ============================================================================
                    console.log('Creating rooms...');
                    return [4 /*yield*/, prisma.room.createMany({
                            data: [
                                { apartmentId: apt1.id, roomNumber: 'PN-01', roomType: 'bedroom', area: new client_1.Prisma.Decimal(25.0), status: 'available' },
                                { apartmentId: apt1.id, roomNumber: 'PN-02', roomType: 'bedroom', area: new client_1.Prisma.Decimal(15.0), status: 'available' },
                                { apartmentId: apt1.id, roomNumber: 'PK-01', roomType: 'living_room', area: new client_1.Prisma.Decimal(30.0), status: 'available' },
                                { apartmentId: apt1.id, roomNumber: 'BEP-01', roomType: 'kitchen', area: new client_1.Prisma.Decimal(10.0), status: 'available' },
                                { apartmentId: apt2.id, roomNumber: 'PN-01', roomType: 'bedroom', area: new client_1.Prisma.Decimal(20.0), status: 'occupied' },
                                { apartmentId: apt2.id, roomNumber: 'PK-01', roomType: 'living_room', area: new client_1.Prisma.Decimal(25.0), status: 'occupied' },
                            ],
                        })];
                case 24:
                    _a.sent();
                    // ============================================================================
                    // RENTAL CONTRACTS
                    // ============================================================================
                    console.log('Creating rental contracts...');
                    return [4 /*yield*/, prisma.rentalContract.create({
                            data: {
                                contractNumber: 'HD-2026-00001',
                                apartmentId: apt2.id,
                                startDate: new Date('2026-01-01'),
                                endDate: new Date('2026-12-31'),
                                monthlyRent: new client_1.Prisma.Decimal(18000000),
                                depositAmount: new client_1.Prisma.Decimal(36000000),
                                paymentDueDay: 5,
                                status: 'active',
                                signedDate: new Date('2025-12-25'),
                            },
                        })];
                case 25:
                    contract1 = _a.sent();
                    return [4 /*yield*/, prisma.rentalContract.create({
                            data: {
                                contractNumber: 'HD-2026-00002',
                                apartmentId: apt1.id,
                                startDate: new Date('2026-03-01'),
                                endDate: new Date('2027-02-28'),
                                monthlyRent: new client_1.Prisma.Decimal(25000000),
                                depositAmount: new client_1.Prisma.Decimal(50000000),
                                paymentDueDay: 1,
                                status: 'pending',
                            },
                        })];
                case 26:
                    contract2 = _a.sent();
                    // ============================================================================
                    // CONTRACT MEMBERS
                    // ============================================================================
                    console.log('Creating contract members...');
                    return [4 /*yield*/, prisma.userContractMember.createMany({
                            data: [
                                {
                                    rentalContractId: contract1.id,
                                    userId: user1.id,
                                    memberType: 'primary',
                                    sharePercentage: new client_1.Prisma.Decimal(100),
                                    moveInDate: new Date('2026-01-01'),
                                    status: 'active',
                                },
                                {
                                    rentalContractId: contract2.id,
                                    userId: user2.id,
                                    memberType: 'primary',
                                    sharePercentage: new client_1.Prisma.Decimal(70),
                                    status: 'active',
                                },
                                {
                                    rentalContractId: contract2.id,
                                    userId: user3.id,
                                    memberType: 'co_tenant',
                                    sharePercentage: new client_1.Prisma.Decimal(30),
                                    status: 'active',
                                },
                            ],
                        })];
                case 27:
                    _a.sent();
                    // ============================================================================
                    // IOT DEVICES
                    // ============================================================================
                    console.log('Creating IoT devices...');
                    return [4 /*yield*/, prisma.ioTDevice.createMany({
                            data: [
                                {
                                    apartmentId: apt2.id,
                                    deviceName: 'Khóa cửa thông minh',
                                    deviceType: 'smart_lock',
                                    tuyaDeviceId: 'tuya_lock_001',
                                    status: 'active',
                                    isTenantControllable: true,
                                    lastSyncedAt: new Date(),
                                },
                                {
                                    apartmentId: apt2.id,
                                    deviceName: 'Điều hòa Daikin',
                                    deviceType: 'thermostat',
                                    tuyaDeviceId: 'tuya_ac_001',
                                    status: 'active',
                                    isTenantControllable: true,
                                },
                                {
                                    apartmentId: apt1.id,
                                    deviceName: 'Đèn phòng khách',
                                    deviceType: 'light',
                                    tuyaDeviceId: 'tuya_light_001',
                                    status: 'active',
                                    isTenantControllable: true,
                                },
                                {
                                    apartmentId: apt1.id,
                                    deviceName: 'Camera cửa',
                                    deviceType: 'camera',
                                    tuyaDeviceId: 'tuya_cam_001',
                                    status: 'active',
                                    isTenantControllable: false,
                                },
                            ],
                        })];
                case 28:
                    _a.sent();
                    // ============================================================================
                    // UTILITY METERS
                    // ============================================================================
                    console.log('Creating utility meters...');
                    return [4 /*yield*/, prisma.utilityMeter.create({
                            data: {
                                apartmentId: apt2.id,
                                meterType: 'electricity',
                                meterNumber: 'PE-2026-001',
                                status: 'active',
                                initialReading: new client_1.Prisma.Decimal(1000),
                                currentReading: new client_1.Prisma.Decimal(1250),
                                unitPrice: new client_1.Prisma.Decimal(3500),
                            },
                        })];
                case 29:
                    meter1 = _a.sent();
                    return [4 /*yield*/, prisma.utilityMeter.create({
                            data: {
                                apartmentId: apt2.id,
                                meterType: 'water',
                                meterNumber: 'PW-2026-001',
                                status: 'active',
                                initialReading: new client_1.Prisma.Decimal(100),
                                currentReading: new client_1.Prisma.Decimal(125),
                                unitPrice: new client_1.Prisma.Decimal(15000),
                            },
                        })];
                case 30:
                    meter2 = _a.sent();
                    // ============================================================================
                    // UTILITY READINGS
                    // ============================================================================
                    console.log('Creating utility readings...');
                    return [4 /*yield*/, prisma.utilityReading.createMany({
                            data: [
                                {
                                    utilityMeterId: meter1.id,
                                    previousReading: new client_1.Prisma.Decimal(1000),
                                    currentReading: new client_1.Prisma.Decimal(1100),
                                    consumption: new client_1.Prisma.Decimal(100),
                                    readingDate: new Date('2026-01-31'),
                                    billingPeriodStart: new Date('2026-01-01'),
                                    billingPeriodEnd: new Date('2026-01-31'),
                                    readingType: 'manual',
                                    verifiedByStaffId: staff1.id,
                                    verifiedAt: new Date('2026-02-01'),
                                },
                                {
                                    utilityMeterId: meter1.id,
                                    previousReading: new client_1.Prisma.Decimal(1100),
                                    currentReading: new client_1.Prisma.Decimal(1250),
                                    consumption: new client_1.Prisma.Decimal(150),
                                    readingDate: new Date('2026-02-28'),
                                    billingPeriodStart: new Date('2026-02-01'),
                                    billingPeriodEnd: new Date('2026-02-28'),
                                    readingType: 'manual',
                                },
                                {
                                    utilityMeterId: meter2.id,
                                    previousReading: new client_1.Prisma.Decimal(100),
                                    currentReading: new client_1.Prisma.Decimal(125),
                                    consumption: new client_1.Prisma.Decimal(25),
                                    readingDate: new Date('2026-02-28'),
                                    billingPeriodStart: new Date('2026-02-01'),
                                    billingPeriodEnd: new Date('2026-02-28'),
                                    readingType: 'manual',
                                },
                            ],
                        })];
                case 31:
                    _a.sent();
                    // ============================================================================
                    // INVOICES
                    // ============================================================================
                    console.log('Creating invoices...');
                    return [4 /*yield*/, prisma.invoice.create({
                            data: {
                                invoiceNumber: 'INV-202601-00001',
                                rentalContractId: contract1.id,
                                dueDate: new Date('2026-02-05'),
                                issueDate: new Date('2026-01-28'),
                                billingPeriodStart: new Date('2026-01-01'),
                                billingPeriodEnd: new Date('2026-01-31'),
                                baseRent: new client_1.Prisma.Decimal(18000000),
                                totalAmount: new client_1.Prisma.Decimal(19900000),
                                additionalCharges: [
                                    { description: 'Tiền điện', amount: 350000 },
                                    { description: 'Tiền nước', amount: 150000 },
                                    { description: 'Phí quản lý', amount: 1500000 },
                                ],
                                status: 'paid',
                                paidAt: new Date('2026-02-03'),
                            },
                        })];
                case 32:
                    invoice1 = _a.sent();
                    return [4 /*yield*/, prisma.invoice.create({
                            data: {
                                invoiceNumber: 'INV-202602-00001',
                                rentalContractId: contract1.id,
                                dueDate: new Date('2026-03-05'),
                                issueDate: new Date('2026-02-25'),
                                billingPeriodStart: new Date('2026-02-01'),
                                billingPeriodEnd: new Date('2026-02-28'),
                                baseRent: new client_1.Prisma.Decimal(18000000),
                                totalAmount: new client_1.Prisma.Decimal(20275000),
                                additionalCharges: [
                                    { description: 'Tiền điện', amount: 525000 },
                                    { description: 'Tiền nước', amount: 375000 },
                                    { description: 'Phí quản lý', amount: 1500000 },
                                ],
                                status: 'issued',
                            },
                        })];
                case 33:
                    invoice2 = _a.sent();
                    // ============================================================================
                    // PAYMENTS
                    // ============================================================================
                    console.log('Creating payments...');
                    return [4 /*yield*/, prisma.payment.create({
                            data: {
                                invoiceId: invoice1.id,
                                userId: user1.id,
                                amount: new client_1.Prisma.Decimal(19900000),
                                paymentMethod: 'bank_transfer',
                                paymentReference: 'VCB-2026020312345',
                                transactionId: 'TXN-001',
                                paymentDate: new Date('2026-02-03'),
                                status: 'completed',
                                notes: 'Thanh toán tiền thuê tháng 1/2026',
                            },
                        })];
                case 34:
                    _a.sent();
                    // ============================================================================
                    // CONTACT REQUESTS
                    // ============================================================================
                    console.log('Creating contact requests...');
                    return [4 /*yield*/, prisma.contactRequest.createMany({
                            data: [
                                {
                                    guestId: guest1.id,
                                    apartmentId: apt1.id,
                                    fullName: 'Khách Xem Nhà 1',
                                    email: 'guest1@gmail.com',
                                    phone: '+84909666111',
                                    message: 'Tôi muốn xem căn hộ này vào cuối tuần',
                                    preferredContactMethod: 'phone',
                                    preferredContactTime: 'Sáng thứ 7',
                                    preferredMoveInDate: new Date('2026-04-01'),
                                    numberOfOccupants: 2,
                                    source: 'website',
                                    status: 'new',
                                },
                                {
                                    guestId: guest2.id,
                                    apartmentId: apt3.id,
                                    fullName: 'Khách Xem Nhà 2',
                                    email: 'guest2@gmail.com',
                                    phone: '+84909666222',
                                    message: 'Căn hộ này có cho nuôi thú cưng không?',
                                    preferredContactMethod: 'both',
                                    source: 'mobile_app',
                                    status: 'contacted',
                                    firstContactedAt: new Date(),
                                },
                            ],
                        })];
                case 35:
                    _a.sent();
                    // ============================================================================
                    // APPOINTMENTS
                    // ============================================================================
                    console.log('Creating appointments...');
                    return [4 /*yield*/, prisma.appointment.create({
                            data: {
                                apartmentId: apt1.id,
                                guestId: guest1.id,
                                assignedStaffId: staff2.id,
                                appointmentDate: new Date('2026-02-15'),
                                appointmentTime: new Date('2026-02-15T10:00:00'),
                                durationMinutes: 30,
                                meetingLocation: 'Sảnh tầng 1 - Vinhomes Central Park',
                                type: 'physical_viewing',
                                status: 'scheduled',
                                staffNotes: 'Khách quan tâm căn 2PN, hẹn xem 10h sáng',
                            },
                        })];
                case 36:
                    _a.sent();
                    // ============================================================================
                    // MAINTENANCE REQUESTS
                    // ============================================================================
                    console.log('Creating maintenance requests...');
                    return [4 /*yield*/, prisma.maintenanceRequest.createMany({
                            data: [
                                {
                                    rentalContractId: contract1.id,
                                    apartmentId: apt2.id,
                                    userId: user1.id,
                                    title: 'Điều hòa không mát',
                                    description: 'Điều hòa phòng khách bật lên nhưng không ra hơi lạnh, đã thử nhiều lần',
                                    category: 'hvac',
                                    urgency: 'medium',
                                    preferredDate: new Date('2026-02-12'),
                                    status: 'submitted',
                                },
                                {
                                    rentalContractId: contract1.id,
                                    apartmentId: apt2.id,
                                    userId: user1.id,
                                    assignedStaffId: staff1.id,
                                    title: 'Bồn rửa bị nghẹt',
                                    description: 'Bồn rửa chén thoát nước rất chậm',
                                    category: 'plumbing',
                                    urgency: 'low',
                                    status: 'completed',
                                    resolvedAt: new Date('2026-02-01'),
                                    resolutionNotes: 'Đã thông ống thoát, hướng dẫn khách sử dụng đúng cách',
                                    actualCost: new client_1.Prisma.Decimal(150000),
                                    costCoverage: 'landlord',
                                },
                            ],
                        })];
                case 37:
                    _a.sent();
                    // ============================================================================
                    // TICKETS
                    // ============================================================================
                    console.log('Creating tickets...');
                    return [4 /*yield*/, prisma.ticket.createMany({
                            data: [
                                {
                                    ticketNumber: 'TKT-2026-00001',
                                    userId: user1.id,
                                    rentalContractId: contract1.id,
                                    subject: 'Hỏi về hóa đơn tháng 2',
                                    description: 'Tiền điện tháng này cao hơn bình thường, xin kiểm tra lại',
                                    category: 'billing',
                                    priority: 'medium',
                                    status: 'open',
                                },
                                {
                                    ticketNumber: 'TKT-2026-00002',
                                    userId: user1.id,
                                    rentalContractId: contract1.id,
                                    assignedToStaffId: staff2.id,
                                    subject: 'Yêu cầu gia hạn hợp đồng',
                                    description: 'Tôi muốn gia hạn hợp đồng thêm 1 năm',
                                    category: 'contract',
                                    priority: 'low',
                                    status: 'in_progress',
                                },
                            ],
                        })];
                case 38:
                    _a.sent();
                    // ============================================================================
                    // TASKS
                    // ============================================================================
                    console.log('Creating tasks...');
                    return [4 /*yield*/, prisma.task.createMany({
                            data: [
                                {
                                    title: 'Kiểm tra điều hòa căn P1-2301',
                                    description: 'Khách báo điều hòa không mát, cần kiểm tra và sửa chữa',
                                    taskType: 'maintenance',
                                    priority: 'medium',
                                    status: 'assigned',
                                    apartmentId: apt2.id,
                                    assignedToStaffId: staff1.id,
                                    assignedByOperatorId: operator1.id,
                                    scheduledDate: new Date('2026-02-12'),
                                    estimatedDurationMins: 60,
                                },
                                {
                                    title: 'Follow up khách xem nhà',
                                    description: 'Gọi điện follow up khách đã hẹn xem căn Vinhomes',
                                    taskType: 'followup',
                                    priority: 'high',
                                    status: 'pending',
                                    assignedByOperatorId: operator1.id,
                                    scheduledDate: new Date('2026-02-16'),
                                    estimatedDurationMins: 15,
                                },
                                {
                                    title: 'Bàn giao căn hộ mới',
                                    description: 'Bàn giao căn P1-2301 cho khách thuê mới',
                                    taskType: 'delivery',
                                    priority: 'high',
                                    status: 'completed',
                                    apartmentId: apt1.id,
                                    assignedToStaffId: staff2.id,
                                    assignedByOperatorId: operator1.id,
                                    actualStartTime: new Date('2026-01-01T09:00:00'),
                                    actualEndTime: new Date('2026-01-01T11:00:00'),
                                    completionNotes: 'Đã bàn giao đầy đủ, khách hài lòng',
                                },
                            ],
                        })];
                case 39:
                    _a.sent();
                    // ============================================================================
                    // PARTNER REQUESTS
                    // ============================================================================
                    console.log('Creating partner requests...');
                    return [4 /*yield*/, prisma.partnerRequest.create({
                            data: {
                                partnerId: partner1.id,
                                propertyType: 'apartment',
                                address: '500 Điện Biên Phủ, Quận 3',
                                city: 'Hồ Chí Minh',
                                district: 'Quận 3',
                                totalArea: new client_1.Prisma.Decimal(200),
                                numberOfUnits: 3,
                                expectedRentPrice: new client_1.Prisma.Decimal(15000000),
                                description: 'Tòa nhà 3 căn hộ cho thuê',
                                amenities: ['Thang máy', 'Bảo vệ', 'Hầm xe'],
                                status: 'submitted',
                            },
                        })];
                case 40:
                    _a.sent();
                    // ============================================================================
                    // POLICIES
                    // ============================================================================
                    console.log('Creating policies...');
                    return [4 /*yield*/, prisma.policy.createMany({
                            data: [
                                {
                                    policyType: 'terms_of_service',
                                    title: 'Điều khoản sử dụng dịch vụ',
                                    content: 'Điều khoản sử dụng dịch vụ IntelliRentOps...',
                                    version: '1.0',
                                    language: 'vi',
                                    effectiveDate: new Date('2026-01-01'),
                                    requiresAcceptance: true,
                                    displayOrder: 1,
                                    isActive: true,
                                    createdByAdminId: admin1.id,
                                    approvedByAdminId: admin1.id,
                                    approvedAt: new Date('2025-12-20'),
                                },
                                {
                                    policyType: 'privacy_policy',
                                    title: 'Chính sách bảo mật',
                                    content: 'Chính sách bảo mật thông tin cá nhân...',
                                    version: '1.0',
                                    language: 'vi',
                                    effectiveDate: new Date('2026-01-01'),
                                    requiresAcceptance: true,
                                    displayOrder: 2,
                                    isActive: true,
                                    createdByAdminId: admin1.id,
                                    approvedByAdminId: admin1.id,
                                    approvedAt: new Date('2025-12-20'),
                                },
                                {
                                    policyType: 'rental_rules',
                                    title: 'Nội quy thuê nhà',
                                    content: 'Các quy định về việc thuê và sử dụng căn hộ...',
                                    version: '1.0',
                                    language: 'vi',
                                    effectiveDate: new Date('2026-01-01'),
                                    requiresAcceptance: false,
                                    displayOrder: 3,
                                    isActive: true,
                                    createdByAdminId: admin1.id,
                                },
                            ],
                        })];
                case 41:
                    _a.sent();
                    // ============================================================================
                    // LEGAL DOCUMENTS
                    // ============================================================================
                    console.log('Creating legal documents...');
                    return [4 /*yield*/, prisma.legalDocument.createMany({
                            data: [
                                {
                                    documentType: 'contract_template',
                                    title: 'Mẫu hợp đồng thuê nhà',
                                    description: 'Mẫu hợp đồng thuê nhà tiêu chuẩn',
                                    fileUrl: '/documents/contract_template_v1.pdf',
                                    fileType: 'pdf',
                                    category: 'Hợp đồng',
                                    language: 'vi',
                                    version: '1.0',
                                    isTemplate: true,
                                    requiresSignature: true,
                                    isPublic: true,
                                    createdByAdminId: admin1.id,
                                },
                                {
                                    documentType: 'disclosure',
                                    title: 'Biên bản bàn giao căn hộ',
                                    description: 'Mẫu biên bản bàn giao khi vào/ra căn hộ',
                                    fileUrl: '/documents/handover_form_v1.pdf',
                                    fileType: 'pdf',
                                    category: 'Biểu mẫu',
                                    language: 'vi',
                                    version: '1.0',
                                    isTemplate: true,
                                    isPublic: true,
                                    createdByAdminId: admin1.id,
                                },
                            ],
                        })];
                case 42:
                    _a.sent();
                    // ============================================================================
                    // NOTIFICATIONS
                    // ============================================================================
                    console.log('Creating notifications...');
                    return [4 /*yield*/, prisma.notification.createMany({
                            data: [
                                {
                                    recipientType: 'user',
                                    recipientId: user1.id,
                                    title: 'Hóa đơn mới',
                                    message: 'Hóa đơn tháng 2/2026 đã được tạo. Vui lòng thanh toán trước ngày 05/03/2026.',
                                    notificationType: 'info',
                                    channel: 'in_app',
                                    deliveryStatus: 'delivered',
                                    sentAt: new Date('2026-02-25'),
                                    deliveredAt: new Date('2026-02-25'),
                                },
                                {
                                    recipientType: 'user',
                                    recipientId: user1.id,
                                    title: 'Yêu cầu bảo trì đã tiếp nhận',
                                    message: 'Yêu cầu sửa điều hòa của bạn đã được tiếp nhận. Kỹ thuật viên sẽ liên hệ sớm.',
                                    notificationType: 'success',
                                    channel: 'in_app',
                                    deliveryStatus: 'delivered',
                                    sentAt: new Date('2026-02-10'),
                                    deliveredAt: new Date('2026-02-10'),
                                    isRead: true,
                                    readAt: new Date('2026-02-10'),
                                },
                                {
                                    recipientType: 'staff',
                                    recipientId: staff1.id,
                                    title: 'Task mới được giao',
                                    message: 'Bạn có task mới: Kiểm tra điều hòa căn P1-2301',
                                    notificationType: 'info',
                                    channel: 'in_app',
                                    deliveryStatus: 'delivered',
                                    sentAt: new Date('2026-02-10'),
                                    deliveredAt: new Date('2026-02-10'),
                                },
                            ],
                        })];
                case 43:
                    _a.sent();
                    // ============================================================================
                    // ACTIVITY LOGS
                    // ============================================================================
                    console.log('Creating activity logs...');
                    return [4 /*yield*/, prisma.activityLog.createMany({
                            data: [
                                {
                                    actorType: 'user',
                                    actorId: user1.id,
                                    action: 'LOGIN',
                                    entityType: 'Session',
                                    description: 'User đăng nhập thành công',
                                    ipAddress: '118.69.123.45',
                                    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
                                    status: 'success',
                                },
                                {
                                    actorType: 'user',
                                    actorId: user1.id,
                                    action: 'CREATE_MAINTENANCE_REQUEST',
                                    entityType: 'MaintenanceRequest',
                                    description: 'Tạo yêu cầu bảo trì: Điều hòa không mát',
                                    status: 'success',
                                },
                                {
                                    actorType: 'staff',
                                    actorId: staff1.id,
                                    action: 'COMPLETE_TASK',
                                    entityType: 'Task',
                                    description: 'Hoàn thành task: Bàn giao căn hộ mới',
                                    status: 'success',
                                },
                                {
                                    actorType: 'operator',
                                    actorId: operator1.id,
                                    action: 'APPROVE_APARTMENT',
                                    entityType: 'Apartment',
                                    entityId: apt1.id,
                                    description: 'Phê duyệt căn hộ mới từ partner',
                                    status: 'success',
                                },
                            ],
                        })];
                case 44:
                    _a.sent();
                    console.log('✅ Database seeding completed!');
                    console.log('');
                    console.log('📊 Summary:');
                    console.log('   - Admins: 2');
                    console.log('   - Operators: 2');
                    console.log('   - Staff: 3');
                    console.log('   - Partners: 2');
                    console.log('   - Users: 3');
                    console.log('   - Guests: 2');
                    console.log('   - Apartments: 4');
                    console.log('   - Rooms: 6');
                    console.log('   - Contracts: 2');
                    console.log('   - Contract Members: 3');
                    console.log('   - IoT Devices: 4');
                    console.log('   - Utility Meters: 2');
                    console.log('   - Utility Readings: 3');
                    console.log('   - Invoices: 2');
                    console.log('   - Payments: 1');
                    console.log('   - Contact Requests: 2');
                    console.log('   - Appointments: 1');
                    console.log('   - Maintenance Requests: 2');
                    console.log('   - Tickets: 2');
                    console.log('   - Tasks: 3');
                    console.log('   - Partner Requests: 1');
                    console.log('   - Policies: 3');
                    console.log('   - Legal Documents: 2');
                    console.log('   - Notifications: 3');
                    console.log('   - Activity Logs: 4');
                    console.log('');
                    console.log('🔑 Test Accounts:');
                    console.log('   Admin: superadmin@intellirentops.vn / Admin@123');
                    console.log('   Operator: operator1@intellirentops.vn / Operator@123');
                    console.log('   Staff: staff1@intellirentops.vn / Staff@123');
                    console.log('   Partner: partner1@gmail.com / Partner@123');
                    console.log('   User: user1@gmail.com / User@123');
                    return [2 /*return*/];
            }
        });
    });
}
main()
    .catch(function (e) {
    console.error('❌ Seed failed:', e);
    process.exit(1);
})
    .finally(function () { return __awaiter(void 0, void 0, void 0, function () {
    return __generator(this, function (_a) {
        switch (_a.label) {
            case 0: return [4 /*yield*/, prisma.$disconnect()];
            case 1:
                _a.sent();
                return [2 /*return*/];
        }
    });
}); });
