import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import { Pool } from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/intelliservops?schema=public';

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function ensureAdmin(data: Prisma.AdminUncheckedCreateInput) {
  const existing = await prisma.admin.findFirst({
    where: {
      OR: [{ email: data.email }, { username: data.username }],
    },
  });

  if (existing) {
    return prisma.admin.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.admin.create({ data });
}

async function ensureOperator(data: Prisma.OperatorUncheckedCreateInput) {
  const existing = await prisma.operator.findFirst({
    where: {
      OR: [{ email: data.email }, { employeeCode: data.employeeCode }],
    },
  });

  if (existing) {
    return prisma.operator.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.operator.create({ data });
}

async function ensureStaff(data: Prisma.StaffUncheckedCreateInput) {
  const existing = await prisma.staff.findFirst({
    where: {
      OR: [{ email: data.email }, { employeeCode: data.employeeCode }],
    },
  });

  if (existing) {
    return prisma.staff.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.staff.create({ data });
}

async function ensureUser(data: Prisma.UserUncheckedCreateInput) {
  const orConditions: Prisma.UserWhereInput[] = [{ email: data.email }];

  if (data.taxCode) {
    orConditions.push({ taxCode: data.taxCode });
  }

  if (typeof data.phone === 'string' && data.phone.length > 0) {
    orConditions.push({ phone: data.phone });
  }

  const existing = await prisma.user.findFirst({
    where: { OR: orConditions },
  });

  if (existing) {
    return prisma.user.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.user.create({ data });
}

async function ensureGuest(data: Prisma.GuestUncheckedCreateInput) {
  const existing = await prisma.guest.findUnique({
    where: { email: data.email },
  });

  if (existing) {
    return prisma.guest.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.guest.create({ data });
}

async function ensureApartment(
  where: Prisma.ApartmentWhereInput,
  data: Prisma.ApartmentUncheckedCreateInput,
) {
  const existing = await prisma.apartment.findFirst({ where });

  if (existing) {
    return prisma.apartment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.apartment.create({ data });
}

async function ensureContract(data: Prisma.RentalContractUncheckedCreateInput) {
  const existing = await prisma.rentalContract.findUnique({
    where: { contractNumber: data.contractNumber },
  });

  if (existing) {
    return prisma.rentalContract.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.rentalContract.create({ data });
}

async function ensureInvoice(data: Prisma.InvoiceUncheckedCreateInput) {
  const existing = await prisma.invoice.findUnique({
    where: { invoiceNumber: data.invoiceNumber },
  });

  if (existing) {
    return prisma.invoice.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.invoice.create({ data });
}

async function ensurePayment(data: Prisma.PaymentUncheckedCreateInput) {
  const existing = await prisma.payment.findUnique({
    where: { paymentReference: data.paymentReference },
  });

  if (existing) {
    return prisma.payment.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.payment.create({ data });
}

async function ensureUtilityMeter(data: Prisma.UtilityMeterUncheckedCreateInput) {
  const existing = await prisma.utilityMeter.findUnique({
    where: { meterNumber: data.meterNumber },
  });

  if (existing) {
    return prisma.utilityMeter.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.utilityMeter.create({ data });
}

async function ensureUtilityReading(
  data: Prisma.UtilityReadingUncheckedCreateInput,
) {
  const existing = await prisma.utilityReading.findFirst({
    where: {
      utilityMeterId: data.utilityMeterId,
      readingDate: data.readingDate,
      notes: data.notes ?? null,
    },
  });

  if (existing) {
    return prisma.utilityReading.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.utilityReading.create({ data });
}

function monthStartUtc(reference: Date, offsetMonths: number) {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + offsetMonths,
      1,
      0,
      0,
      0,
      0,
    ),
  );
}

function monthEndUtc(reference: Date, offsetMonths: number) {
  return new Date(
    Date.UTC(
      reference.getUTCFullYear(),
      reference.getUTCMonth() + offsetMonths + 1,
      0,
      23,
      59,
      59,
      999,
    ),
  );
}

function monthToken(date: Date) {
  return `${date.getUTCFullYear()}${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function toNumber(value: unknown, fallback: number) {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  if (
    typeof value === 'object' &&
    value !== null &&
    typeof (value as { toString?: () => string }).toString === 'function'
  ) {
    const parsed = Number((value as { toString: () => string }).toString());
    if (Number.isFinite(parsed)) {
      return parsed;
    }
  }

  return fallback;
}

async function ensureReservation(data: Prisma.ReservationUncheckedCreateInput) {
  const existing = data.createdContractId
    ? await prisma.reservation.findFirst({
        where: { createdContractId: data.createdContractId },
      })
    : await prisma.reservation.findFirst({
        where: {
          userId: data.userId,
          apartmentId: data.apartmentId,
          desiredStartDate: data.desiredStartDate,
          desiredEndDate: data.desiredEndDate,
        },
      });

  if (existing) {
    return prisma.reservation.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.reservation.create({ data });
}

async function ensurePartnerRequest(data: Prisma.PartnerRequestUncheckedCreateInput) {
  const partnerRequestModel = (
    prisma as unknown as {
      partnerRequest?: {
        findFirst: (args: { where: Record<string, unknown> }) => Promise<any>;
        update: (args: { where: { id: string }; data: Record<string, unknown> }) => Promise<any>;
        create: (args: { data: Record<string, unknown> }) => Promise<any>;
      };
    }
  ).partnerRequest;

  if (!partnerRequestModel) {
    console.log('Skipping partner request seed because PartnerRequest model is not present.');
    return null;
  }

  const existing = await partnerRequestModel.findFirst({
    where: {
      userId: data.userId,
      propertyType: data.propertyType,
      address: data.address,
    },
  });

  if (existing) {
    return partnerRequestModel.update({
      where: { id: existing.id },
      data,
    });
  }

  return partnerRequestModel.create({ data });
}

async function ensurePartnerPayoutTransfer(
  data: Prisma.PartnerPayoutTransferUncheckedCreateInput,
) {
  const existing = await prisma.partnerPayoutTransfer.findFirst({
    where: {
      partnerId: data.partnerId,
      periodMonth: data.periodMonth,
    },
  });

  if (existing) {
    return prisma.partnerPayoutTransfer.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.partnerPayoutTransfer.create({ data });
}

async function main() {
  console.log('đŸŒ± Starting database seed...');

  // ============================================================================
  // ADMINS
  // ============================================================================
  console.log('Creating admins...');
  const adminPassword = await hashPassword('Admin@123');

  const admin1 = await ensureAdmin({
    email: 'superadmin@intellirentops.vn',
    phone: '+84909111222',
    fullName: 'Nguyá»…n VÄƒn Admin',
    username: 'superadmin',
    passwordHash: adminPassword,
    roleLevel: 'super_admin',
    isActive: true,
  });

  const admin2 = await ensureAdmin({
    email: 'admin@intellirentops.vn',
    phone: '+84909111333',
    fullName: 'Tráº§n Thá»‹ Quáº£n LĂ½',
    username: 'admin',
    passwordHash: adminPassword,
    roleLevel: 'admin',
    isActive: true,
  });

  // ============================================================================
  // OPERATORS
  // ============================================================================
  console.log('Creating operators...');
  const operatorPassword = await hashPassword('Operator@123');

  const operator1 = await ensureOperator({
    email: 'operator1@intellirentops.vn',
    phone: '+84909222111',
    fullName: 'LĂª VÄƒn Äiá»u HĂ nh',
    employeeCode: 'OP-001',
    shift: 'morning',
    passwordHash: operatorPassword,
    isActive: true,
  });

  const operator2 = await ensureOperator({
    email: 'operator2@intellirentops.vn',
    phone: '+84909222222',
    fullName: 'Pháº¡m Thá»‹ Há»— Trá»£',
    employeeCode: 'OP-002',
    shift: 'afternoon',
    passwordHash: operatorPassword,
    isActive: true,
  });

  // ============================================================================
  // STAFF
  // ============================================================================
  console.log('Creating staff...');
  const staffPassword = await hashPassword('Staff@123');

  const staff1 = await ensureStaff({
    email: 'staff1@intellirentops.vn',
    phone: '+84909333111',
    fullName: 'HoĂ ng VÄƒn Ká»¹ Thuáº­t',
    employeeCode: 'ST-001',
    role: 'technician',
    department: 'Ká»¹ thuáº­t',
    passwordHash: staffPassword,
    workingCity: 'Há»“ ChĂ­ Minh',
    workingDistrict: 'Quáº­n 1',
    hireDate: new Date('2024-01-15'),
    isActive: true,
  });

  const staff2 = await ensureStaff({
    email: 'staff2@intellirentops.vn',
    phone: '+84909333222',
    fullName: 'NgĂ´ Thá»‹ ChÄƒm SĂ³c',
    employeeCode: 'ST-002',
    role: 'customer_service',
    department: 'CSKH',
    passwordHash: staffPassword,
    workingCity: 'Há»“ ChĂ­ Minh',
    workingDistrict: 'Quáº­n 7',
    hireDate: new Date('2024-03-01'),
    isActive: true,
  });

  const staff3 = await ensureStaff({
    email: 'staff3@intellirentops.vn',
    phone: '+84909333333',
    fullName: 'Äá»— VÄƒn Báº£o TrĂ¬',
    employeeCode: 'ST-003',
    role: 'maintenance',
    department: 'Báº£o trĂ¬',
    passwordHash: staffPassword,
    workingCity: 'Há»“ ChĂ­ Minh',
    workingDistrict: 'Quáº­n 2',
    hireDate: new Date('2024-06-01'),
    isActive: true,
  });

  // ============================================================================
  // PARTNER-USERS (users with business/partner info)
  // ============================================================================
  console.log('Creating partner users...');
  const partnerPassword = await hashPassword('Partner@123');

  const partner1 = await ensureUser({
    email: 'partner1@gmail.com',
    phone: '+84909444111',
    fullName: 'VĂµ VÄƒn Chá»§ NhĂ ',
    companyName: 'CĂ´ng ty BÄS PhĂº Má»¹',
    taxCode: '0312345678',
    passwordHash: partnerPassword,
    bankName: 'Vietcombank',
    bankAccountNumber: '0071000123456',
    commissionRate: new Prisma.Decimal(8.0),
    isPartner: true,
    isVerified: true,
    isActive: true,
  });

  const partner2 = await ensureUser({
    email: 'partner2@gmail.com',
    phone: '+84909444222',
    fullName: 'TrÆ°Æ¡ng Thá»‹ Äáº§u TÆ°',
    companyName: 'CĂ´ng ty Äáº§u tÆ° HoĂ ng Gia',
    taxCode: '0398765432',
    passwordHash: partnerPassword,
    bankName: 'Techcombank',
    bankAccountNumber: '19028888888888',
    commissionRate: new Prisma.Decimal(10.0),
    isPartner: true,
    isVerified: true,
    isActive: true,
  });

  // ============================================================================
  // USERS (Tenants)
  // ============================================================================
  console.log('Creating users...');
  const userPassword = await hashPassword('User@123');

  const user1 = await ensureUser({
    email: 'user1@gmail.com',
    phone: '+84909555111',
    fullName: 'Nguyá»…n VÄƒn ThuĂª',
    passwordHash: userPassword,
    dateOfBirth: new Date('1990-05-15'),
    emergencyContactName: 'Nguyá»…n VÄƒn Cha',
    emergencyContactPhone: '+84909555999',
    isActive: true,
    isVerified: true,
    createdByStaffId: staff2.id,
  });

  const user2 = await ensureUser({
    email: 'user2@gmail.com',
    phone: '+84909555222',
    fullName: 'Tráº§n Thá»‹ á» Trá»',
    passwordHash: userPassword,
    dateOfBirth: new Date('1995-08-20'),
    emergencyContactName: 'Tráº§n VÄƒn Máº¹',
    emergencyContactPhone: '+84909555888',
    isActive: true,
    isVerified: true,
    createdByStaffId: staff2.id,
  });

  const user3 = await ensureUser({
    email: 'user3@gmail.com',
    phone: '+84909555333',
    fullName: 'LĂª Minh KhĂ¡ch',
    passwordHash: userPassword,
    dateOfBirth: new Date('1988-12-10'),
    isActive: true,
    isVerified: true,
  });

  const user4 = await ensureUser({
    email: 'demo.tenant@intellirentops.vn',
    phone: '+84909555444',
    fullName: 'Demo Tenant One',
    passwordHash: userPassword,
    dateOfBirth: new Date('1997-09-12'),
    emergencyContactName: 'Demo Emergency Contact',
    emergencyContactPhone: '+84909555777',
    isActive: true,
    isVerified: true,
    createdByStaffId: staff2.id,
  });

  // ============================================================================
  // GUESTS
  // ============================================================================
  console.log('Creating guests...');

  const guest1 = await ensureGuest({
    email: 'guest1@gmail.com',
    phone: '+84909666111',
    fullName: 'KhĂ¡ch Xem NhĂ  1',
    preferredContactMethod: 'phone',
  });

  const guest2 = await ensureGuest({
    email: 'guest2@gmail.com',
    phone: '+84909666222',
    fullName: 'KhĂ¡ch Xem NhĂ  2',
    preferredContactMethod: 'both',
  });

  const guest3 = await ensureGuest({
    email: 'guest3@gmail.com',
    phone: '+84909666333',
    fullName: 'Demo Funnel Guest',
    preferredContactMethod: 'email',
  });

  // ============================================================================
  // APARTMENTS
  // ============================================================================
  console.log('Creating apartments...');

  const apt1 = await ensureApartment(
    { apartmentNumber: 'P1-2301' },
    {
      buildingName: 'Vinhomes Central Park',
      apartmentNumber: 'P1-2301',
      totalArea: new Prisma.Decimal(85.5),
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      floorNumber: 23,
      wardCode: 26728,
      streetAddress: '208 Nguyá»…n Há»¯u Cáº£nh, PhÆ°á»ng 22',
      latitude: new Prisma.Decimal(10.7915),
      longitude: new Prisma.Decimal(106.7218),
      baseRentPrice: new Prisma.Decimal(25000000),
      depositAmount: new Prisma.Decimal(50000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Há»“ bÆ¡i', 'Gym', 'CĂ´ng viĂªn', 'SiĂªu thá»‹', 'Báº£o vá»‡ 24/7'],
      description:
        'CÄƒn há»™ cao cáº¥p view sĂ´ng SĂ i GĂ²n, ná»™i tháº¥t Ä‘áº§y Ä‘á»§, tiá»‡n Ă­ch 5 sao',
      status: 'available',
      ownerId: partner1.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  );

  const apt2 = await ensureApartment(
    { apartmentNumber: 'T2-1505' },
    {
      buildingName: 'Masteri Tháº£o Äiá»n',
      apartmentNumber: 'T2-1505',
      totalArea: new Prisma.Decimal(70.0),
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      floorNumber: 15,
      wardCode: 26728,
      streetAddress: '159 Xa Lá»™ HĂ  Ná»™i, PhÆ°á»ng Tháº£o Äiá»n',
      latitude: new Prisma.Decimal(10.8024),
      longitude: new Prisma.Decimal(106.7398),
      baseRentPrice: new Prisma.Decimal(18000000),
      depositAmount: new Prisma.Decimal(36000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Há»“ bÆ¡i', 'Gym', 'BBQ', 'SĂ¢n chÆ¡i tráº» em'],
      description: 'CÄƒn há»™ hiá»‡n Ä‘áº¡i gáº§n Metro, view thĂ nh phá»‘',
      status: 'occupied',
      ownerId: partner1.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  );

  const apt3 = await ensureApartment(
    { apartmentNumber: 'R1-801' },
    {
      buildingName: 'Saigon Pearl',
      apartmentNumber: 'R1-801',
      totalArea: new Prisma.Decimal(55.0),
      numberOfBedrooms: 1,
      numberOfBathrooms: 1,
      floorNumber: 8,
      wardCode: 26728,
      streetAddress: '92 Nguyá»…n Há»¯u Cáº£nh, PhÆ°á»ng 22',
      latitude: new Prisma.Decimal(10.788),
      longitude: new Prisma.Decimal(106.7195),
      baseRentPrice: new Prisma.Decimal(12000000),
      depositAmount: new Prisma.Decimal(24000000),
      furnishingStatus: 'semi_furnished',
      amenities: ['Há»“ bÆ¡i', 'Gym'],
      description: 'CÄƒn há»™ 1 phĂ²ng ngá»§, phĂ¹ há»£p Ä‘á»™c thĂ¢n hoáº·c cáº·p Ä‘Ă´i',
      status: 'available',
      ownerId: partner2.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  );

  const apt4 = await ensureApartment(
    { apartmentNumber: 'M3-2010' },
    {
      buildingName: 'The Manor',
      apartmentNumber: 'M3-2010',
      totalArea: new Prisma.Decimal(120.0),
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      floorNumber: 20,
      wardCode: 26728,
      streetAddress: '89 Nguyá»…n Há»¯u Cáº£nh, PhÆ°á»ng 22',
      latitude: new Prisma.Decimal(10.7905),
      longitude: new Prisma.Decimal(106.719),
      baseRentPrice: new Prisma.Decimal(35000000),
      depositAmount: new Prisma.Decimal(70000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Há»“ bÆ¡i', 'Gym', 'Spa', 'SĂ¢n tennis', 'NhĂ  hĂ ng'],
      description: 'Penthouse view panorama, ná»™i tháº¥t sang trá»ng',
      status: 'available',
      ownerId: partner2.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  );

  // ============================================================================
  // ROOMS
  // ============================================================================
  console.log('Creating rooms...');

  await prisma.room.createMany({
    skipDuplicates: true,
    data: [
      {
        apartmentId: apt1.id,
        roomNumber: 'PN-01',
        roomType: 'bedroom',
        area: new Prisma.Decimal(25.0),
        status: 'available',
      },
      {
        apartmentId: apt1.id,
        roomNumber: 'PN-02',
        roomType: 'bedroom',
        area: new Prisma.Decimal(15.0),
        status: 'available',
      },
      {
        apartmentId: apt1.id,
        roomNumber: 'PK-01',
        roomType: 'living_room',
        area: new Prisma.Decimal(30.0),
        status: 'available',
      },
      {
        apartmentId: apt1.id,
        roomNumber: 'BEP-01',
        roomType: 'kitchen',
        area: new Prisma.Decimal(10.0),
        status: 'available',
      },
      {
        apartmentId: apt2.id,
        roomNumber: 'PN-01',
        roomType: 'bedroom',
        area: new Prisma.Decimal(20.0),
        status: 'occupied',
      },
      {
        apartmentId: apt2.id,
        roomNumber: 'PK-01',
        roomType: 'living_room',
        area: new Prisma.Decimal(25.0),
        status: 'occupied',
      },
    ],
  });

  // ============================================================================
  // RENTAL CONTRACTS
  // ============================================================================
  console.log('Creating rental contracts...');

  const contract1 = await ensureContract({
      contractNumber: 'HD-2026-00001',
      apartmentId: apt2.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: new Prisma.Decimal(18000000),
      depositAmount: new Prisma.Decimal(36000000),
      paymentDueDay: 5,
      status: 'active',
      signedDate: new Date('2025-12-25'),
  });

  const contract2 = await ensureContract({
      contractNumber: 'HD-2026-00002',
      apartmentId: apt1.id,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2027-02-28'),
      monthlyRent: new Prisma.Decimal(25000000),
      depositAmount: new Prisma.Decimal(50000000),
      paymentDueDay: 1,
      status: 'pending',
  });

  const contract3 = await ensureContract({
      contractNumber: 'HD-2026-00003',
      apartmentId: apt4.id,
      startDate: new Date('2026-03-15'),
      endDate: new Date('2027-03-14'),
      monthlyRent: new Prisma.Decimal(35000000),
      depositAmount: new Prisma.Decimal(70000000),
      paymentDueDay: 10,
      status: 'active',
      signedDate: new Date('2026-03-10'),
      createdByStaffId: staff2.id,
  });

  // ============================================================================
  // CONTRACT MEMBERS
  // ============================================================================
  console.log('Creating contract members...');

  await prisma.userContractMember.createMany({
    skipDuplicates: true,
    data: [
      {
        rentalContractId: contract1.id,
        userId: user1.id,
        memberType: 'primary',
        sharePercentage: new Prisma.Decimal(100),
        moveInDate: new Date('2026-01-01'),
        status: 'active',
      },
      {
        rentalContractId: contract2.id,
        userId: user2.id,
        memberType: 'primary',
        sharePercentage: new Prisma.Decimal(70),
        status: 'active',
      },
      {
        rentalContractId: contract2.id,
        userId: user3.id,
        memberType: 'co_tenant',
        sharePercentage: new Prisma.Decimal(30),
        status: 'active',
      },
      {
        rentalContractId: contract3.id,
        userId: user4.id,
        memberType: 'primary',
        sharePercentage: new Prisma.Decimal(100),
        moveInDate: new Date('2026-03-15'),
        status: 'active',
      },
    ],
  });

  // ============================================================================
  // USER APARTMENT ACCESS
  // ============================================================================
  console.log('Creating user apartment access...');

  await prisma.userApartment.createMany({
    skipDuplicates: true,
    data: [
      {
        userId: user1.id,
        apartmentId: apt2.id,
        rentalContractId: contract1.id,
        moveInDate: new Date('2026-01-01'),
        isPrimaryTenant: true,
        status: 'active',
        apartmentDoorPassword: '1805',
        buildingGateCode: 'A2-9988',
        smartLockPin: '2580',
        wifiName: 'Masteri-T2-1505',
        wifiPassword: 'Masteri@2026',
      },
      {
        userId: user4.id,
        apartmentId: apt4.id,
        rentalContractId: contract3.id,
        moveInDate: new Date('2026-03-15'),
        isPrimaryTenant: true,
        status: 'active',
        apartmentDoorPassword: '2468',
        buildingGateCode: 'M3-2010',
        smartLockPin: '6810',
        mailboxCode: 'MB-2010',
        parkingAccessCode: 'PK-2010',
        wifiName: 'TheManor-M3-2010',
        wifiPassword: 'TheManor@2026',
        emergencyContactName: 'Demo Emergency Contact',
        emergencyContactPhone: '+84909555777',
        notes: 'Demo tenant access package for lecturer showcase.',
      },
    ],
  });

  const activeRentalContracts = await prisma.rentalContract.findMany({
    where: { status: 'active' },
    select: {
      contractNumber: true,
      apartment: {
        select: {
          apartmentNumber: true,
        },
      },
      members: {
        select: {
          user: {
            select: {
              email: true,
              fullName: true,
            },
          },
        },
      },
      createdAt: true,
    },
    orderBy: { createdAt: 'asc' },
  });

  console.log('Active apartment rentals in database:');
  if (activeRentalContracts.length === 0) {
    console.log(' - No active rentals found. user1 will be assigned through demo seed flow.');
  } else {
    for (const rental of activeRentalContracts) {
      const renters = rental.members
        .map((member) => member.user.email)
        .join(', ');
      console.log(
        ` - Apartment ${rental.apartment.apartmentNumber}: ${renters} (${rental.contractNumber})`,
      );
    }
  }

  await prisma.apartment.update({
    where: { id: apt4.id },
    data: { status: 'occupied' },
  });

  // ============================================================================
  // PARTNER COOPERATION CONTRACTS
  // ============================================================================
  console.log('Creating partner cooperation contracts...');

  await prisma.partnerCooperationContract.createMany({
    skipDuplicates: true,
    data: [
      {
        contractNumber: 'PCC-2026-00001',
        apartmentId: apt2.id,
        partnerId: partner1.id,
        approvedByOperatorId: operator1.id,
        startDate: new Date('2025-12-01'),
        endDate: new Date('2026-12-31'),
        commissionRate: new Prisma.Decimal(8.0),
        status: 'active',
        signedAt: new Date('2025-12-01'),
        notes: 'Demo partner cooperation for occupied apartment revenue.',
      },
      {
        contractNumber: 'PCC-2026-00002',
        apartmentId: apt4.id,
        partnerId: partner2.id,
        approvedByOperatorId: operator1.id,
        startDate: new Date('2026-03-01'),
        endDate: new Date('2027-03-31'),
        commissionRate: new Prisma.Decimal(10.0),
        status: 'active',
        signedAt: new Date('2026-03-01'),
        notes: 'Demo partner cooperation for premium unit.',
      },
    ],
  });

  // ============================================================================
  // IOT DEVICES
  // ============================================================================
  console.log('Creating IoT devices...');

  await prisma.ioTDevice.createMany({
    skipDuplicates: true,
    data: [
      {
        apartmentId: apt2.id,
        deviceName: 'KhĂ³a cá»­a thĂ´ng minh',
        deviceType: 'smart_lock',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt2.id,
        deviceName: 'Äiá»u hĂ²a Daikin',
        deviceType: 'thermostat',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt1.id,
        deviceName: 'ÄĂ¨n phĂ²ng khĂ¡ch',
        deviceType: 'light',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt1.id,
        deviceName: 'Camera cá»­a',
        deviceType: 'camera',
        status: 'active',
        isControllableByTenant: false,
      },
    ],
  });

  // ============================================================================
  // UTILITY METERS
  // ============================================================================
  console.log('Creating utility meters...');

  const meter1 = await ensureUtilityMeter({
      apartmentId: apt2.id,
      meterType: 'electricity',
      meterNumber: 'PE-2026-001',
      status: 'active',
      installationDate: new Date('2024-01-01'),
      currentReading: new Prisma.Decimal(1250),
      previousReading: new Prisma.Decimal(1000),
      ratePerUnit: new Prisma.Decimal(3500),
  });

  const meter2 = await ensureUtilityMeter({
      apartmentId: apt2.id,
      meterType: 'water',
      meterNumber: 'PW-2026-001',
      status: 'active',
      installationDate: new Date('2024-01-01'),
      currentReading: new Prisma.Decimal(125),
      previousReading: new Prisma.Decimal(100),
      ratePerUnit: new Prisma.Decimal(15000),
  });

  const meter3 = await ensureUtilityMeter({
      apartmentId: apt4.id,
      meterType: 'electricity',
      meterNumber: 'PE-2026-002',
      status: 'active',
      installationDate: new Date('2026-03-01'),
      currentReading: new Prisma.Decimal(420),
      previousReading: new Prisma.Decimal(260),
      ratePerUnit: new Prisma.Decimal(3800),
  });

  const meter4 = await ensureUtilityMeter({
      apartmentId: apt4.id,
      meterType: 'water',
      meterNumber: 'PW-2026-002',
      status: 'active',
      installationDate: new Date('2026-03-01'),
      currentReading: new Prisma.Decimal(42),
      previousReading: new Prisma.Decimal(25),
      ratePerUnit: new Prisma.Decimal(17000),
  });

  // ============================================================================
  // UTILITY READINGS
  // ============================================================================
  console.log('Creating utility readings...');

  await prisma.utilityReading.createMany({
    data: [
      {
        utilityMeterId: meter1.id,
        readingValue: new Prisma.Decimal(1100),
        previousReadingValue: new Prisma.Decimal(1000),
        consumption: new Prisma.Decimal(100),
        readingDate: new Date('2026-01-31'),
        readingType: 'manual',
        verifiedByStaffId: staff1.id,
        verifiedAt: new Date('2026-02-01'),
        isVerified: true,
      },
      {
        utilityMeterId: meter1.id,
        readingValue: new Prisma.Decimal(1250),
        previousReadingValue: new Prisma.Decimal(1100),
        consumption: new Prisma.Decimal(150),
        readingDate: new Date('2026-02-28'),
        readingType: 'manual',
      },
      {
        utilityMeterId: meter2.id,
        readingValue: new Prisma.Decimal(125),
        previousReadingValue: new Prisma.Decimal(100),
        consumption: new Prisma.Decimal(25),
        readingDate: new Date('2026-02-28'),
        readingType: 'manual',
      },
      {
        utilityMeterId: meter3.id,
        readingValue: new Prisma.Decimal(260),
        previousReadingValue: new Prisma.Decimal(120),
        consumption: new Prisma.Decimal(140),
        readingDate: new Date('2026-03-31'),
        readingType: 'manual',
        verifiedByStaffId: staff1.id,
        verifiedAt: new Date('2026-04-01'),
        isVerified: true,
      },
      {
        utilityMeterId: meter3.id,
        readingValue: new Prisma.Decimal(420),
        previousReadingValue: new Prisma.Decimal(260),
        consumption: new Prisma.Decimal(160),
        readingDate: new Date('2026-04-30'),
        readingType: 'manual',
      },
      {
        utilityMeterId: meter4.id,
        readingValue: new Prisma.Decimal(42),
        previousReadingValue: new Prisma.Decimal(25),
        consumption: new Prisma.Decimal(17),
        readingDate: new Date('2026-04-30'),
        readingType: 'manual',
      },
    ],
  });

  // ============================================================================
  // INVOICES
  // ============================================================================
  console.log('Creating invoices...');

  const invoice1 = await ensureInvoice({
      invoiceNumber: 'INV-202601-00001',
      rentalContractId: contract1.id,
      dueDate: new Date('2026-02-05'),
      issueDate: new Date('2026-01-28'),
      billingPeriodStart: new Date('2026-01-01'),
      billingPeriodEnd: new Date('2026-01-31'),
      baseRent: new Prisma.Decimal(18000000),
      totalAmount: new Prisma.Decimal(19900000),
      additionalCharges: [
        { description: 'Tiá»n Ä‘iá»‡n', amount: 350000 },
        { description: 'Tiá»n nÆ°á»›c', amount: 150000 },
        { description: 'PhĂ­ quáº£n lĂ½', amount: 1500000 },
      ],
      status: 'paid',
      paidAt: new Date('2026-02-03'),
  });

  const invoice2 = await ensureInvoice({
      invoiceNumber: 'INV-202602-00001',
      rentalContractId: contract1.id,
      dueDate: new Date('2026-03-05'),
      issueDate: new Date('2026-02-25'),
      billingPeriodStart: new Date('2026-02-01'),
      billingPeriodEnd: new Date('2026-02-28'),
      baseRent: new Prisma.Decimal(18000000),
      totalAmount: new Prisma.Decimal(20275000),
      additionalCharges: [
        { description: 'Tiá»n Ä‘iá»‡n', amount: 525000 },
        { description: 'Tiá»n nÆ°á»›c', amount: 375000 },
        { description: 'PhĂ­ quáº£n lĂ½', amount: 1500000 },
      ],
      status: 'issued',
  });

  const invoice3 = await ensureInvoice({
      invoiceNumber: 'INV-202603-00002',
      rentalContractId: contract3.id,
      dueDate: new Date('2026-04-10'),
      issueDate: new Date('2026-03-28'),
      billingPeriodStart: new Date('2026-03-15'),
      billingPeriodEnd: new Date('2026-03-31'),
      baseRent: new Prisma.Decimal(17500000),
      totalAmount: new Prisma.Decimal(18947000),
      additionalCharges: [
        { description: 'Electricity', amount: 532000 },
        { description: 'Water', amount: 290000 },
        { description: 'Management fee', amount: 625000 },
      ],
      status: 'paid',
      paidAt: new Date('2026-04-05'),
  });

  const invoice4 = await ensureInvoice({
      invoiceNumber: 'INV-202604-00002',
      rentalContractId: contract3.id,
      dueDate: new Date('2026-05-10'),
      issueDate: new Date('2026-04-28'),
      billingPeriodStart: new Date('2026-04-01'),
      billingPeriodEnd: new Date('2026-04-30'),
      baseRent: new Prisma.Decimal(35000000),
      totalAmount: new Prisma.Decimal(36957000),
      additionalCharges: [
        { description: 'Electricity', amount: 608000 },
        { description: 'Water', amount: 289000 },
        { description: 'Management fee', amount: 1060000 },
      ],
      status: 'paid',
      paidAt: new Date('2026-05-06'),
  });

  const invoice5 = await ensureInvoice({
      invoiceNumber: 'INV-202605-00002',
      rentalContractId: contract3.id,
      dueDate: new Date('2026-06-10'),
      issueDate: new Date('2026-05-28'),
      billingPeriodStart: new Date('2026-05-01'),
      billingPeriodEnd: new Date('2026-05-31'),
      baseRent: new Prisma.Decimal(35000000),
      totalAmount: new Prisma.Decimal(37215000),
      additionalCharges: [
        { description: 'Electricity', amount: 684000 },
        { description: 'Water', amount: 321000 },
        { description: 'Management fee', amount: 1210000 },
      ],
      status: 'issued',
  });

  // ============================================================================
  // PAYMENTS
  // ============================================================================
  console.log('Creating payments...');

  await ensurePayment({
      invoiceId: invoice1.id,
      userId: user1.id,
      amount: new Prisma.Decimal(19900000),
      paymentMethod: 'bank_transfer',
      paymentReference: 'VCB-2026020312345',
      transactionId: 'TXN-001',
      paymentDate: new Date('2026-02-03'),
      status: 'completed',
      notes: 'Thanh toĂ¡n tiá»n thuĂª thĂ¡ng 1/2026',
  });

  await prisma.payment.createMany({
    skipDuplicates: true,
    data: [
      {
        invoiceId: invoice3.id,
        userId: user4.id,
        amount: new Prisma.Decimal(18947000),
        paymentMethod: 'bank_transfer',
        paymentReference: 'VCB-2026040518888',
        transactionId: 'TXN-003',
        paymentDate: new Date('2026-04-05'),
        status: 'completed',
        notes: 'Demo tenant payment for premium apartment period 1',
      },
      {
        invoiceId: invoice4.id,
        userId: user4.id,
        amount: new Prisma.Decimal(36957000),
        paymentMethod: 'bank_transfer',
        paymentReference: 'TCB-2026050619999',
        transactionId: 'TXN-004',
        paymentDate: new Date('2026-05-06'),
        status: 'completed',
        notes: 'Demo tenant payment for premium apartment period 2',
      },
    ],
  });

  // ============================================================================
  // DEMO MONTHLY UTILITY INVOICES FOR FRONTEND
  // ============================================================================
  console.log('Creating demo monthly utility invoices...');

  await prisma.apartment.update({
    where: { id: apt2.id },
    data: { status: 'occupied' },
  });

  const utilityDemoReference = new Date(Date.UTC(2026, 3, 1, 0, 0, 0, 0));
  let latestElectricPrevious = toNumber(meter1.previousReading, 900);
  let latestElectricCurrent = toNumber(meter1.currentReading, 1050);
  let latestWaterPrevious = toNumber(meter2.previousReading, 80);
  let latestWaterCurrent = toNumber(meter2.currentReading, 100);

  for (let index = 0; index < 10; index += 1) {
    const offsetMonths = -9 + index;
    const periodStart = monthStartUtc(utilityDemoReference, offsetMonths);
    const periodEnd = monthEndUtc(utilityDemoReference, offsetMonths);
    const token = monthToken(periodStart);

    const electricPrevious = index === 0 ? 720 : latestElectricCurrent;
    const electricConsumption = 118 + index * 7;
    const electricCurrent = electricPrevious + electricConsumption;
    const waterPrevious = index === 0 ? 52 : latestWaterCurrent;
    const waterConsumption = 18 + index;
    const waterCurrent = waterPrevious + waterConsumption;
    const electricRate = 3500;
    const waterRate = 15000;
    const electricAmount = electricConsumption * electricRate;
    const waterAmount = waterConsumption * waterRate;
    const totalUtilityAmount = electricAmount + waterAmount;
    const issueDate = new Date(periodEnd.getTime() + 24 * 60 * 60 * 1000);
    const dueDate = new Date(periodEnd.getTime() + 5 * 24 * 60 * 60 * 1000);
    const isPaid = index < 9;

    await ensureUtilityReading({
      utilityMeterId: meter1.id,
      rentalContractId: contract1.id,
      readingDate: periodEnd,
      readingValue: new Prisma.Decimal(electricCurrent),
      previousReadingValue: new Prisma.Decimal(electricPrevious),
      consumption: new Prisma.Decimal(electricConsumption),
      readingType: 'manual',
      isVerified: true,
      verifiedByStaffId: staff1.id,
      verifiedAt: issueDate,
      notes: `DEMO_UTILITY_ELECTRIC_${token}`,
    });

    await ensureUtilityReading({
      utilityMeterId: meter2.id,
      rentalContractId: contract1.id,
      readingDate: periodEnd,
      readingValue: new Prisma.Decimal(waterCurrent),
      previousReadingValue: new Prisma.Decimal(waterPrevious),
      consumption: new Prisma.Decimal(waterConsumption),
      readingType: 'manual',
      isVerified: true,
      verifiedByStaffId: staff1.id,
      verifiedAt: issueDate,
      notes: `DEMO_UTILITY_WATER_${token}`,
    });

    const utilityInvoice = await ensureInvoice({
      invoiceNumber: `UTIL-${token}-${apt2.apartmentNumber}`,
      rentalContractId: contract1.id,
      invoiceType: 'utility',
      billingMonth: `${periodStart.getUTCFullYear()}-${String(periodStart.getUTCMonth() + 1).padStart(2, '0')}`,
      dueDate,
      issueDate,
      billingPeriodStart: periodStart,
      billingPeriodEnd: periodEnd,
      baseRent: new Prisma.Decimal(0),
      utilityCharges: {
        electricity: {
          previousReading: electricPrevious,
          currentReading: electricCurrent,
          consumption: electricConsumption,
          unit: 'kWh',
          ratePerUnit: electricRate,
          amount: electricAmount,
        },
        water: {
          previousReading: waterPrevious,
          currentReading: waterCurrent,
          consumption: waterConsumption,
          unit: 'm3',
          ratePerUnit: waterRate,
          amount: waterAmount,
        },
        totalUtilityAmount,
      },
      totalAmount: new Prisma.Decimal(totalUtilityAmount),
      currency: 'VND',
      status: isPaid ? 'paid' : 'issued',
      paidAt: isPaid ? new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000) : null,
      notes: `Demo utility invoice for ${apt2.apartmentNumber} (${token})`,
    });

    if (isPaid) {
      await ensurePayment({
        invoiceId: utilityInvoice.id,
        userId: user1.id,
        amount: new Prisma.Decimal(totalUtilityAmount),
        paymentMethod: 'bank_transfer',
        paymentReference: `UTIL-PAY-${token}-${apt2.apartmentNumber}`,
        transactionId: `UTIL-TXN-${token}`,
        paymentDate: new Date(dueDate.getTime() - 2 * 24 * 60 * 60 * 1000),
        status: 'completed',
        notes: `Demo utility payment for ${apt2.apartmentNumber} (${token})`,
      });
    }

    latestElectricPrevious = electricPrevious;
    latestElectricCurrent = electricCurrent;
    latestWaterPrevious = waterPrevious;
    latestWaterCurrent = waterCurrent;
  }

  await prisma.utilityMeter.update({
    where: { id: meter1.id },
    data: {
      previousReading: new Prisma.Decimal(latestElectricPrevious),
      currentReading: new Prisma.Decimal(latestElectricCurrent),
      readingDate: monthEndUtc(utilityDemoReference, 0),
      status: 'active',
    },
  });

  await prisma.utilityMeter.update({
    where: { id: meter2.id },
    data: {
      previousReading: new Prisma.Decimal(latestWaterPrevious),
      currentReading: new Prisma.Decimal(latestWaterCurrent),
      readingDate: monthEndUtc(utilityDemoReference, 0),
      status: 'active',
    },
  });

  // ============================================================================
  // PARTNER PAYOUT TRANSFERS
  // ============================================================================
  console.log('Creating partner payout transfers...');

  await ensurePartnerPayoutTransfer({
      partnerId: partner2.id,
      periodMonth: '2026-05',
      periodStart: new Date('2026-05-01T00:00:00.000Z'),
      periodEnd: new Date('2026-05-31T23:59:59.999Z'),
      totalGrossAmount: new Prisma.Decimal(36957000),
      totalSystemCommissionAmount: new Prisma.Decimal(3695700),
      totalNetPayoutAmount: new Prisma.Decimal(33261300),
      transferProofImageUrl: '/uploads/payouts/partner2-2026-05-transfer.png',
      transferNote: 'Demo payout transfer for lecturer dashboard.',
      confirmedByStaffId: staff2.id,
      confirmedAt: new Date('2026-06-02T09:30:00'),
  });

  // ============================================================================
  // CONTACT REQUESTS
  // ============================================================================
  console.log('Creating contact requests...');

  await prisma.contactRequest.createMany({
    data: [
      {
        guestId: guest1.id,
        apartmentId: apt1.id,
        fullName: 'KhĂ¡ch Xem NhĂ  1',
        email: 'guest1@gmail.com',
        phone: '+84909666111',
        message: 'TĂ´i muá»‘n xem cÄƒn há»™ nĂ y vĂ o cuá»‘i tuáº§n',
        preferredContactMethod: 'phone',
        preferredContactTime: 'SĂ¡ng thá»© 7',
        preferredMoveInDate: new Date('2026-04-01'),
        numberOfOccupants: 2,
        source: 'website',
        status: 'new',
      },
      {
        guestId: guest2.id,
        apartmentId: apt3.id,
        fullName: 'KhĂ¡ch Xem NhĂ  2',
        email: 'guest2@gmail.com',
        phone: '+84909666222',
        message: 'CÄƒn há»™ nĂ y cĂ³ cho nuĂ´i thĂº cÆ°ng khĂ´ng?',
        preferredContactMethod: 'both',
        source: 'mobile_app',
        status: 'contacted',
        firstContactedAt: new Date(),
      },
      {
        guestId: guest3.id,
        apartmentId: apt4.id,
        fullName: 'Demo Funnel Guest',
        email: 'guest3@gmail.com',
        phone: '+84909666333',
        message: 'Interested in the premium apartment for a long-term stay.',
        preferredContactMethod: 'email',
        preferredMoveInDate: new Date('2026-03-15'),
        numberOfOccupants: 1,
        source: 'website',
        status: 'converted',
        assignedToOperatorId: operator1.id,
        firstContactedAt: new Date('2026-03-02T09:00:00'),
      },
    ],
  });

  const demoContactRequest = await prisma.contactRequest.findFirstOrThrow({
    where: {
      guestId: guest3.id,
      apartmentId: apt4.id,
      email: 'guest3@gmail.com',
    },
  });

  await prisma.bookingRequest.create({
    data: {
      guestId: guest3.id,
      apartmentId: apt4.id,
      contactRequestId: demoContactRequest.id,
      desiredStartDate: new Date('2026-03-15'),
      desiredEndDate: new Date('2027-03-14'),
      numberOfOccupants: 1,
      totalAmount: new Prisma.Decimal(105000000),
      depositAmount: new Prisma.Decimal(70000000),
      specialRequests: 'Need a quiet unit for remote work and client hosting.',
      status: 'approved',
      approvedByOperatorId: operator1.id,
      approvedAt: new Date('2026-03-05T10:00:00'),
      createdRentalContractId: contract3.id,
    },
  });

  await ensureReservation({
    userId: user4.id,
    apartmentId: apt4.id,
    createdContractId: contract3.id,
    desiredStartDate: new Date('2026-03-15'),
    desiredEndDate: new Date('2027-03-14'),
    numberOfOccupants: 1,
    specialRequests: 'Converted from website funnel demo.',
    status: 'confirmed',
    expiresAt: new Date('2026-03-12T23:59:59'),
  });

  // ============================================================================
  // APPOINTMENTS
  // ============================================================================
  console.log('Creating appointments...');

  await prisma.appointment.create({
    data: {
      apartmentId: apt1.id,
      guestId: guest1.id,
      assignedStaffId: staff2.id,
      appointmentDate: new Date('2026-02-15'),
      appointmentTime: new Date('2026-02-15T10:00:00'),
      durationMinutes: 30,
      meetingLocation: 'Sáº£nh táº§ng 1 - Vinhomes Central Park',
      type: 'physical_viewing',
      status: 'scheduled',
      staffNotes: 'KhĂ¡ch quan tĂ¢m cÄƒn 2PN, háº¹n xem 10h sĂ¡ng',
    },
  });

  await prisma.appointment.create({
    data: {
      apartmentId: apt4.id,
      guestId: guest3.id,
      contactRequestId: demoContactRequest.id,
      assignedStaffId: staff2.id,
      appointmentDate: new Date('2026-03-04'),
      appointmentTime: new Date('2026-03-04T15:00:00'),
      durationMinutes: 45,
      meetingLocation: 'Lobby - The Manor',
      type: 'physical_viewing',
      status: 'completed',
      outcome: 'booked',
      followupRequired: false,
      guestNotes: 'Needs move-in before mid-March.',
      staffNotes: 'Guest liked the view and agreed to reserve immediately.',
    },
  });

  // ============================================================================
  // MAINTENANCE REQUESTS
  // ============================================================================
  console.log('Creating maintenance requests...');

  await prisma.maintenanceRequest.createMany({
    data: [
      {
        rentalContractId: contract1.id,
        apartmentId: apt2.id,
        userId: user1.id,
        title: 'Äiá»u hĂ²a khĂ´ng mĂ¡t',
        description:
          'Äiá»u hĂ²a phĂ²ng khĂ¡ch báº­t lĂªn nhÆ°ng khĂ´ng ra hÆ¡i láº¡nh, Ä‘Ă£ thá»­ nhiá»u láº§n',
        category: 'hvac',
        urgency: 'medium',
        preferredDate: new Date('2026-02-12'),
        status: 'submitted',
      },
      {
        rentalContractId: contract1.id,
        apartmentId: apt2.id,
        userId: user1.id,
        title: 'Bá»“n rá»­a bá»‹ ngháº¹t',
        description: 'Bá»“n rá»­a chĂ©n thoĂ¡t nÆ°á»›c ráº¥t cháº­m',
        category: 'plumbing',
        urgency: 'low',
        status: 'completed',
        completedAt: new Date('2026-02-01'),
        completionNotes:
          'ÄĂ£ thĂ´ng á»‘ng thoĂ¡t, hÆ°á»›ng dáº«n khĂ¡ch sá»­ dá»¥ng Ä‘Ăºng cĂ¡ch',
        actualCost: new Prisma.Decimal(150000),
        costCoveredBy: 'landlord',
      },
      {
        rentalContractId: contract3.id,
        apartmentId: apt4.id,
        userId: user4.id,
        title: 'Smart lock battery is low',
        description:
          'The lock starts beeping every evening and battery status is red in the tenant app.',
        category: 'electrical',
        urgency: 'medium',
        preferredDate: new Date('2026-05-08'),
        preferredTimeSlot: '18:00-20:00',
        status: 'scheduled',
        costEstimate: new Prisma.Decimal(250000),
      },
    ],
  });

  // ============================================================================
  // APARTMENT RATINGS
  // ============================================================================
  console.log('Creating apartment ratings...');

  await prisma.apartmentRating.createMany({
    skipDuplicates: true,
    data: [
      {
        apartmentId: apt2.id,
        userId: user1.id,
        rentalContractId: contract1.id,
        rating: 4,
        comment: 'Good service and quick maintenance response.',
      },
      {
        apartmentId: apt4.id,
        userId: user4.id,
        rentalContractId: contract3.id,
        rating: 5,
        comment: 'Premium apartment with stable operations, ideal for demo.',
      },
    ],
  });

  // ============================================================================
  // TICKETS
  // ============================================================================
  console.log('Creating tickets...');

  if ((prisma as unknown as { ticket?: { createMany: Function } }).ticket) {
    await (
      prisma as unknown as {
        ticket: {
          createMany: (args: {
            skipDuplicates: boolean;
            data: Array<Record<string, unknown>>;
          }) => Promise<unknown>;
        };
      }
    ).ticket.createMany({
      skipDuplicates: true,
      data: [
        {
          ticketNumber: 'TKT-2026-00001',
          userId: user1.id,
          rentalContractId: contract1.id,
          subject: 'Hoi ve hoa don thang 2',
          description:
            'Tien dien thang nay cao hon binh thuong, xin kiem tra lai',
          category: 'billing',
          priority: 'medium',
          status: 'open',
        },
        {
          ticketNumber: 'TKT-2026-00002',
          userId: user1.id,
          rentalContractId: contract1.id,
          assignedToStaffId: staff2.id,
          subject: 'Yeu cau gia han hop dong',
          description: 'Toi muon gia han hop dong them 1 nam',
          category: 'contract',
          priority: 'low',
          status: 'in_progress',
        },
      ],
    });
  } else {
    console.log('Skipping ticket seed because Ticket model is not present.');
  }

  // ============================================================================
  // TASKS
  // ============================================================================
  console.log('Creating tasks...');

  await prisma.task.createMany({
    skipDuplicates: true,
    data: [
      {
        title: 'Kiá»ƒm tra Ä‘iá»u hĂ²a cÄƒn P1-2301',
        description: 'KhĂ¡ch bĂ¡o Ä‘iá»u hĂ²a khĂ´ng mĂ¡t, cáº§n kiá»ƒm tra vĂ  sá»­a chá»¯a',
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
        title: 'Follow up khĂ¡ch xem nhĂ ',
        description: 'Gá»i Ä‘iá»‡n follow up khĂ¡ch Ä‘Ă£ háº¹n xem cÄƒn Vinhomes',
        taskType: 'followup',
        priority: 'high',
        status: 'pending',
        assignedByOperatorId: operator1.id,
        scheduledDate: new Date('2026-02-16'),
        estimatedDurationMins: 15,
      },
      {
        title: 'BĂ n giao cÄƒn há»™ má»›i',
        description: 'BĂ n giao cÄƒn P1-2301 cho khĂ¡ch thuĂª má»›i',
        taskType: 'delivery',
        priority: 'high',
        status: 'completed',
        apartmentId: apt1.id,
        assignedToStaffId: staff2.id,
        assignedByOperatorId: operator1.id,
        actualStartTime: new Date('2026-01-01T09:00:00'),
        actualEndTime: new Date('2026-01-01T11:00:00'),
        completionNotes: 'ÄĂ£ bĂ n giao Ä‘áº§y Ä‘á»§, khĂ¡ch hĂ i lĂ²ng',
      },
    ],
  });

  // ============================================================================
  // PARTNER REQUESTS
  // ============================================================================
  console.log('Creating partner requests...');

  await ensurePartnerRequest({
    userId: partner1.id,
    propertyType: 'apartment',
    address: '500 Äiá»‡n BiĂªn Phá»§, Quáº­n 3',
    city: 'Há»“ ChĂ­ Minh',
    district: 'Quáº­n 3',
    totalArea: new Prisma.Decimal(200),
    numberOfUnits: 3,
    expectedRentPrice: new Prisma.Decimal(15000000),
    description: 'TĂ²a nhĂ  3 cÄƒn há»™ cho thuĂª',
    amenities: ['Thang mĂ¡y', 'Báº£o vá»‡', 'Háº§m xe'],
    status: 'submitted',
  });

  // ============================================================================
  // POLICIES
  // ============================================================================
  console.log('Creating policies...');

  await prisma.policy.createMany({
    skipDuplicates: true,
    data: [
      {
        policyType: 'building_regulations',
        title: 'Ná»™i quy tĂ²a nhĂ ',
        content:
          'CÆ° dĂ¢n pháº£i tuĂ¢n thá»§ giá» giáº¥c sinh hoáº¡t chung. KhĂ´ng gĂ¢y tiáº¿ng á»“n lá»›n sau 22h. Giá»¯ gĂ¬n vá»‡ sinh khu vá»±c chung. KhĂ´ng xáº£ rĂ¡c ngoĂ i nÆ¡i quy Ä‘á»‹nh...',
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
        policyType: 'parking_rules',
        title: 'Quy Ä‘á»‹nh Ä‘á»— xe',
        content:
          'Má»—i cÄƒn há»™ Ä‘Æ°á»£c phĂ¢n bá»• 1 chá»— Ä‘á»— xe Ă´ tĂ´ vĂ  2 chá»— Ä‘á»— xe mĂ¡y. Äá»— Ä‘Ăºng vá»‹ trĂ­ quy Ä‘á»‹nh. Tá»‘c Ä‘á»™ tá»‘i Ä‘a trong háº§m 5km/h...',
        version: '1.0',
        language: 'vi',
        effectiveDate: new Date('2026-01-01'),
        requiresAcceptance: false,
        displayOrder: 2,
        isActive: true,
        createdByAdminId: admin1.id,
        approvedByAdminId: admin1.id,
        approvedAt: new Date('2025-12-20'),
      },
      {
        policyType: 'pet_policy',
        title: 'Quy Ä‘á»‹nh nuĂ´i thĂº cÆ°ng',
        content:
          'Cho phĂ©p nuĂ´i thĂº cÆ°ng nhá» (dÆ°á»›i 10kg). Pháº£i Ä‘Äƒng kĂ½ vá»›i ban quáº£n lĂ½. Khi ra khu vá»±c chung pháº£i cĂ³ dĂ¢y xĂ­ch vĂ  tĂºi dá»n vá»‡ sinh...',
        version: '1.0',
        language: 'vi',
        effectiveDate: new Date('2026-01-01'),
        requiresAcceptance: true,
        displayOrder: 3,
        isActive: true,
        createdByAdminId: admin1.id,
      },
      {
        policyType: 'rental_rules',
        title: 'Quy Ä‘á»‹nh cho thuĂª cÄƒn há»™',
        content:
          'CĂ¡c quy Ä‘á»‹nh vá» viá»‡c thuĂª vĂ  sá»­ dá»¥ng cÄƒn há»™. CÆ° dĂ¢n khĂ´ng Ä‘Æ°á»£c tá»± Ă½ sá»­a chá»¯a káº¿t cáº¥u cÄƒn há»™. BĂ¡o ngay cho ban quáº£n lĂ½ khi cĂ³ sá»± cá»‘...',
        version: '1.0',
        language: 'vi',
        effectiveDate: new Date('2026-01-01'),
        requiresAcceptance: true,
        displayOrder: 4,
        isActive: true,
        createdByAdminId: admin1.id,
        approvedByAdminId: admin1.id,
        approvedAt: new Date('2025-12-20'),
      },
      {
        policyType: 'noise_policy',
        title: 'Quy Ä‘á»‹nh tiáº¿ng á»“n',
        content:
          'Giá» yĂªn tÄ©nh: 22h00 - 06h00. KhĂ´ng sá»­ dá»¥ng thiáº¿t bá»‹ gĂ¢y tiáº¿ng á»“n lá»›n vĂ o giá» yĂªn tÄ©nh. Thi cĂ´ng sá»­a chá»¯a chá»‰ Ä‘Æ°á»£c phĂ©p tá»« 08h-17h ngĂ y thÆ°á»ng...',
        version: '1.0',
        language: 'vi',
        effectiveDate: new Date('2026-01-01'),
        requiresAcceptance: false,
        displayOrder: 5,
        isActive: true,
        createdByAdminId: admin1.id,
        approvedByAdminId: admin1.id,
        approvedAt: new Date('2025-12-20'),
      },
    ],
  });

  // ============================================================================
  // LEGAL DOCUMENTS
  // ============================================================================
  console.log('Creating legal documents...');

  if (
    (
      prisma as unknown as {
        legalDocument?: { createMany: (args: unknown) => Promise<unknown> };
      }
    ).legalDocument
  ) {
    await (
      prisma as unknown as {
        legalDocument: { createMany: (args: unknown) => Promise<unknown> };
      }
    ).legalDocument.createMany({
    skipDuplicates: true,
    data: [
      {
        documentType: 'contract_template',
        title: 'Máº«u há»£p Ä‘á»“ng thuĂª nhĂ ',
        description: 'Máº«u há»£p Ä‘á»“ng thuĂª nhĂ  tiĂªu chuáº©n',
        fileUrl: '/documents/contract_template_v1.pdf',
        fileType: 'pdf',
        category: 'Há»£p Ä‘á»“ng',
        language: 'vi',
        version: '1.0',
        isTemplate: true,
        requiresSignature: true,
        isPublic: true,
        createdByAdminId: admin1.id,
      },
      {
        documentType: 'disclosure',
        title: 'BiĂªn báº£n bĂ n giao cÄƒn há»™',
        description: 'Máº«u biĂªn báº£n bĂ n giao khi vĂ o/ra cÄƒn há»™',
        fileUrl: '/documents/handover_form_v1.pdf',
        fileType: 'pdf',
        category: 'Biá»ƒu máº«u',
        language: 'vi',
        version: '1.0',
        isTemplate: true,
        isPublic: true,
        createdByAdminId: admin1.id,
      },
    ],
  });

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  console.log('Creating notifications...');

  await prisma.notification.createMany({
    skipDuplicates: true,
    data: [
      {
        recipientType: 'user',
        recipientId: user1.id,
        title: 'HĂ³a Ä‘Æ¡n má»›i',
        message:
          'HĂ³a Ä‘Æ¡n thĂ¡ng 2/2026 Ä‘Ă£ Ä‘Æ°á»£c táº¡o. Vui lĂ²ng thanh toĂ¡n trÆ°á»›c ngĂ y 05/03/2026.',
        notificationType: 'info',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-02-25'),
      },
      {
        recipientType: 'user',
        recipientId: user1.id,
        title: 'YĂªu cáº§u báº£o trĂ¬ Ä‘Ă£ tiáº¿p nháº­n',
        message:
          'YĂªu cáº§u sá»­a Ä‘iá»u hĂ²a cá»§a báº¡n Ä‘Ă£ Ä‘Æ°á»£c tiáº¿p nháº­n. Ká»¹ thuáº­t viĂªn sáº½ liĂªn há»‡ sá»›m.',
        notificationType: 'success',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-02-10'),
        isRead: true,
        readAt: new Date('2026-02-10'),
      },
      {
        recipientType: 'staff',
        recipientId: staff1.id,
        title: 'Task má»›i Ä‘Æ°á»£c giao',
        message: 'Báº¡n cĂ³ task má»›i: Kiá»ƒm tra Ä‘iá»u hĂ²a cÄƒn P1-2301',
        notificationType: 'info',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-02-10'),
      },
      {
        recipientType: 'user',
        recipientId: user4.id,
        title: 'Welcome to IntelliRentOps',
        message:
          'Your premium apartment contract is active. You can now use all tenant features for demo.',
        notificationType: 'success',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-03-15'),
        isRead: true,
        readAt: new Date('2026-03-15'),
      },
    ],
    });
  } else {
    console.log('Skipping legal document seed because LegalDocument model is not present.');
  }

  // ============================================================================
  // ACTIVITY LOGS
  // ============================================================================
  console.log('Creating activity logs...');

  await prisma.activityLog.createMany({
    data: [
      {
        actorType: 'user',
        actorId: user1.id,
        action: 'LOGIN',
        entityType: 'Session',
        description: 'User Ä‘Äƒng nháº­p thĂ nh cĂ´ng',
        ipAddress: '118.69.123.45',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 15_0)',
        status: 'success',
      },
      {
        actorType: 'user',
        actorId: user1.id,
        action: 'CREATE_MAINTENANCE_REQUEST',
        entityType: 'MaintenanceRequest',
        description: 'Táº¡o yĂªu cáº§u báº£o trĂ¬: Äiá»u hĂ²a khĂ´ng mĂ¡t',
        status: 'success',
      },
      {
        actorType: 'staff',
        actorId: staff1.id,
        action: 'COMPLETE_TASK',
        entityType: 'Task',
        description: 'HoĂ n thĂ nh task: BĂ n giao cÄƒn há»™ má»›i',
        status: 'success',
      },
      {
        actorType: 'operator',
        actorId: operator1.id,
        action: 'APPROVE_APARTMENT',
        entityType: 'Apartment',
        entityId: apt1.id,
        description: 'PhĂª duyá»‡t cÄƒn há»™ má»›i tá»« partner',
        status: 'success',
      },
    ],
  });

  console.log('âœ… Database seeding completed!');
  console.log('');
  console.log('đŸ“ Summary:');
  console.log('   - Admins: 2');
  console.log('   - Operators: 2');
  console.log('   - Staff: 3');
  console.log('   - Users (incl. partner users): 6');
  console.log('   - Guests: 3');
  console.log('   - Apartments: 4');
  console.log('   - Rooms: 6');
  console.log('   - Contracts: 3');
  console.log('   - Contract Members: 4');
  console.log('   - User Apartments: 2');
  console.log('   - Partner Cooperation Contracts: 2');
  console.log('   - IoT Devices: 4');
  console.log('   - Utility Meters: 4');
  console.log('   - Utility Readings: 6');
  console.log('   - Invoices: 5');
  console.log('   - Payments: 3');
  console.log('   - Partner Payout Transfers: 1');
  console.log('   - Contact Requests: 3');
  console.log('   - Booking Requests: 1');
  console.log('   - Reservations: 1');
  console.log('   - Appointments: 2');
  console.log('   - Maintenance Requests: 3');
  console.log('   - Apartment Ratings: 2');
  console.log('   - Tickets: 2');
  console.log('   - Tasks: 3');
  console.log('   - Partner Requests: 1');
  console.log('   - Policies: 5');
  console.log('   - Legal Documents: 2');
  console.log('   - Notifications: 4');
  console.log('   - Activity Logs: 4');
  console.log('');
  console.log('đŸ”‘ Test Accounts:');
  console.log('   Admin: superadmin@intellirentops.vn / Admin@123');
  console.log('   Operator: operator1@intellirentops.vn / Operator@123');
  console.log('   Staff: staff1@intellirentops.vn / Staff@123');
  console.log('   User (partner): partner1@gmail.com / Partner@123');
  console.log('   User: user1@gmail.com / User@123');
  console.log('   Demo Tenant: demo.tenant@intellirentops.vn / User@123');
}

main()
  .catch((e) => {
    console.error('âŒ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
