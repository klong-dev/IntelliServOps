import { PrismaClient, Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, 10);
}

async function main() {
  console.log('🌱 Starting database seed...');

  // ============================================================================
  // ADMINS
  // ============================================================================
  console.log('Creating admins...');
  const adminPassword = await hashPassword('Admin@123');

  const admin1 = await prisma.admin.upsert({
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
  });

  const admin2 = await prisma.admin.upsert({
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
  });

  // ============================================================================
  // OPERATORS
  // ============================================================================
  console.log('Creating operators...');
  const operatorPassword = await hashPassword('Operator@123');

  const operator1 = await prisma.operator.upsert({
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
  });

  const operator2 = await prisma.operator.upsert({
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
  });

  // ============================================================================
  // STAFF
  // ============================================================================
  console.log('Creating staff...');
  const staffPassword = await hashPassword('Staff@123');

  const staff1 = await prisma.staff.upsert({
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
  });

  const staff2 = await prisma.staff.upsert({
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
  });

  const staff3 = await prisma.staff.upsert({
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
  });

  // ============================================================================
  // PARTNERS
  // ============================================================================
  console.log('Creating partners...');
  const partnerPassword = await hashPassword('Partner@123');

  const partner1 = await prisma.partner.upsert({
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
      commissionRate: new Prisma.Decimal(8.0),
      isVerified: true,
      isActive: true,
    },
  });

  const partner2 = await prisma.partner.upsert({
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
      commissionRate: new Prisma.Decimal(10.0),
      isVerified: true,
      isActive: true,
    },
  });

  // ============================================================================
  // USERS (Tenants)
  // ============================================================================
  console.log('Creating users...');
  const userPassword = await hashPassword('User@123');

  const user1 = await prisma.user.upsert({
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
  });

  const user2 = await prisma.user.upsert({
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
  });

  const user3 = await prisma.user.upsert({
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
  });

  // ============================================================================
  // GUESTS
  // ============================================================================
  console.log('Creating guests...');

  const guest1 = await prisma.guest.upsert({
    where: { email: 'guest1@gmail.com' },
    update: {},
    create: {
      email: 'guest1@gmail.com',
      phone: '+84909666111',
      fullName: 'Khách Xem Nhà 1',
      preferredContactMethod: 'phone',
    },
  });

  const guest2 = await prisma.guest.upsert({
    where: { email: 'guest2@gmail.com' },
    update: {},
    create: {
      email: 'guest2@gmail.com',
      phone: '+84909666222',
      fullName: 'Khách Xem Nhà 2',
      preferredContactMethod: 'both',
    },
  });

  // ============================================================================
  // APARTMENTS
  // ============================================================================
  console.log('Creating apartments...');

  const apt1 = await prisma.apartment.create({
    data: {
      buildingName: 'Vinhomes Central Park',
      apartmentNumber: 'P1-2301',
      apartmentType: 'VIP',
      totalArea: new Prisma.Decimal(85.5),
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      floorNumber: 23,
      address: '208 Nguyễn Hữu Cảnh',
      ward: 'Phường 22',
      district: 'Quận Bình Thạnh',
      city: 'Hồ Chí Minh',
      latitude: new Prisma.Decimal(10.7915),
      longitude: new Prisma.Decimal(106.7218),
      baseRentPrice: new Prisma.Decimal(25000000),
      depositAmount: new Prisma.Decimal(50000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Hồ bơi', 'Gym', 'Công viên', 'Siêu thị', 'Bảo vệ 24/7'],
      description:
        'Căn hộ cao cấp view sông Sài Gòn, nội thất đầy đủ, tiện ích 5 sao',
      status: 'available',
      partnerId: partner1.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  });

  const apt2 = await prisma.apartment.create({
    data: {
      buildingName: 'Masteri Thảo Điền',
      apartmentNumber: 'T2-1505',
      apartmentType: 'NORMAL',
      totalArea: new Prisma.Decimal(70.0),
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      floorNumber: 15,
      address: '159 Xa Lộ Hà Nội',
      ward: 'Phường Thảo Điền',
      district: 'Quận 2',
      city: 'Hồ Chí Minh',
      latitude: new Prisma.Decimal(10.8024),
      longitude: new Prisma.Decimal(106.7398),
      baseRentPrice: new Prisma.Decimal(18000000),
      depositAmount: new Prisma.Decimal(36000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Hồ bơi', 'Gym', 'BBQ', 'Sân chơi trẻ em'],
      description: 'Căn hộ hiện đại gần Metro, view thành phố',
      status: 'occupied',
      partnerId: partner1.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  });

  const apt3 = await prisma.apartment.create({
    data: {
      buildingName: 'Saigon Pearl',
      apartmentNumber: 'R1-801',
      apartmentType: 'STANDARD',
      totalArea: new Prisma.Decimal(55.0),
      numberOfBedrooms: 1,
      numberOfBathrooms: 1,
      floorNumber: 8,
      address: '92 Nguyễn Hữu Cảnh',
      ward: 'Phường 22',
      district: 'Quận Bình Thạnh',
      city: 'Hồ Chí Minh',
      latitude: new Prisma.Decimal(10.788),
      longitude: new Prisma.Decimal(106.7195),
      baseRentPrice: new Prisma.Decimal(12000000),
      depositAmount: new Prisma.Decimal(24000000),
      furnishingStatus: 'semi_furnished',
      amenities: ['Hồ bơi', 'Gym'],
      description: 'Căn hộ 1 phòng ngủ, phù hợp độc thân hoặc cặp đôi',
      status: 'available',
      partnerId: partner2.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  });

  const apt4 = await prisma.apartment.create({
    data: {
      buildingName: 'The Manor',
      apartmentNumber: 'M3-2010',
      apartmentType: 'VIP',
      totalArea: new Prisma.Decimal(120.0),
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      floorNumber: 20,
      address: '91 Nguyễn Hữu Cảnh',
      ward: 'Phường 22',
      district: 'Quận Bình Thạnh',
      city: 'Hồ Chí Minh',
      latitude: new Prisma.Decimal(10.7905),
      longitude: new Prisma.Decimal(106.719),
      baseRentPrice: new Prisma.Decimal(35000000),
      depositAmount: new Prisma.Decimal(70000000),
      furnishingStatus: 'fully_furnished',
      amenities: ['Hồ bơi', 'Gym', 'Spa', 'Sân tennis', 'Nhà hàng'],
      description: 'Penthouse view panorama, nội thất sang trọng',
      status: 'available',
      partnerId: partner2.id,
      approvedByOperatorId: operator1.id,
      approvedAt: new Date(),
    },
  });

  // ============================================================================
  // ROOMS
  // ============================================================================
  console.log('Creating rooms...');

  await prisma.room.createMany({
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

  const contract1 = await prisma.rentalContract.create({
    data: {
      contractNumber: 'HD-2026-00001',
      apartmentId: apt2.id,
      startDate: new Date('2026-01-01'),
      endDate: new Date('2026-12-31'),
      monthlyRent: new Prisma.Decimal(18000000),
      depositAmount: new Prisma.Decimal(36000000),
      paymentDueDay: 5,
      status: 'active',
      signedDate: new Date('2025-12-25'),
    },
  });

  const contract2 = await prisma.rentalContract.create({
    data: {
      contractNumber: 'HD-2026-00002',
      apartmentId: apt1.id,
      startDate: new Date('2026-03-01'),
      endDate: new Date('2027-02-28'),
      monthlyRent: new Prisma.Decimal(25000000),
      depositAmount: new Prisma.Decimal(50000000),
      paymentDueDay: 1,
      status: 'pending',
    },
  });

  // ============================================================================
  // CONTRACT MEMBERS
  // ============================================================================
  console.log('Creating contract members...');

  await prisma.userContractMember.createMany({
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
    ],
  });

  // ============================================================================
  // IOT DEVICES
  // ============================================================================
  console.log('Creating IoT devices...');

  await prisma.ioTDevice.createMany({
    data: [
      {
        apartmentId: apt2.id,
        deviceName: 'Khóa cửa thông minh',
        deviceType: 'smart_lock',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt2.id,
        deviceName: 'Điều hòa Daikin',
        deviceType: 'thermostat',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt1.id,
        deviceName: 'Đèn phòng khách',
        deviceType: 'light',
        status: 'active',
        isControllableByTenant: true,
      },
      {
        apartmentId: apt1.id,
        deviceName: 'Camera cửa',
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

  const meter1 = await prisma.utilityMeter.create({
    data: {
      apartmentId: apt2.id,
      meterType: 'electricity',
      meterNumber: 'PE-2026-001',
      status: 'active',
      installationDate: new Date('2024-01-01'),
      currentReading: new Prisma.Decimal(1250),
      previousReading: new Prisma.Decimal(1000),
      ratePerUnit: new Prisma.Decimal(3500),
    },
  });

  const meter2 = await prisma.utilityMeter.create({
    data: {
      apartmentId: apt2.id,
      meterType: 'water',
      meterNumber: 'PW-2026-001',
      status: 'active',
      installationDate: new Date('2024-01-01'),
      currentReading: new Prisma.Decimal(125),
      previousReading: new Prisma.Decimal(100),
      ratePerUnit: new Prisma.Decimal(15000),
    },
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
    ],
  });

  // ============================================================================
  // INVOICES
  // ============================================================================
  console.log('Creating invoices...');

  const invoice1 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-202601-00001',
      rentalContractId: contract1.id,
      dueDate: new Date('2026-02-05'),
      issueDate: new Date('2026-01-28'),
      billingPeriodStart: new Date('2026-01-01'),
      billingPeriodEnd: new Date('2026-01-31'),
      baseRent: new Prisma.Decimal(18000000),
      totalAmount: new Prisma.Decimal(19900000),
      additionalCharges: [
        { description: 'Tiền điện', amount: 350000 },
        { description: 'Tiền nước', amount: 150000 },
        { description: 'Phí quản lý', amount: 1500000 },
      ],
      status: 'paid',
      paidAt: new Date('2026-02-03'),
    },
  });

  const invoice2 = await prisma.invoice.create({
    data: {
      invoiceNumber: 'INV-202602-00001',
      rentalContractId: contract1.id,
      dueDate: new Date('2026-03-05'),
      issueDate: new Date('2026-02-25'),
      billingPeriodStart: new Date('2026-02-01'),
      billingPeriodEnd: new Date('2026-02-28'),
      baseRent: new Prisma.Decimal(18000000),
      totalAmount: new Prisma.Decimal(20275000),
      additionalCharges: [
        { description: 'Tiền điện', amount: 525000 },
        { description: 'Tiền nước', amount: 375000 },
        { description: 'Phí quản lý', amount: 1500000 },
      ],
      status: 'issued',
    },
  });

  // ============================================================================
  // PAYMENTS
  // ============================================================================
  console.log('Creating payments...');

  await prisma.payment.create({
    data: {
      invoiceId: invoice1.id,
      userId: user1.id,
      amount: new Prisma.Decimal(19900000),
      paymentMethod: 'bank_transfer',
      paymentReference: 'VCB-2026020312345',
      transactionId: 'TXN-001',
      paymentDate: new Date('2026-02-03'),
      status: 'completed',
      notes: 'Thanh toán tiền thuê tháng 1/2026',
    },
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
      meetingLocation: 'Sảnh tầng 1 - Vinhomes Central Park',
      type: 'physical_viewing',
      status: 'scheduled',
      staffNotes: 'Khách quan tâm căn 2PN, hẹn xem 10h sáng',
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
        title: 'Điều hòa không mát',
        description:
          'Điều hòa phòng khách bật lên nhưng không ra hơi lạnh, đã thử nhiều lần',
        category: 'hvac',
        urgency: 'medium',
        preferredDate: new Date('2026-02-12'),
        status: 'submitted',
      },
      {
        rentalContractId: contract1.id,
        apartmentId: apt2.id,
        userId: user1.id,
        title: 'Bồn rửa bị nghẹt',
        description: 'Bồn rửa chén thoát nước rất chậm',
        category: 'plumbing',
        urgency: 'low',
        status: 'completed',
        completedAt: new Date('2026-02-01'),
        completionNotes:
          'Đã thông ống thoát, hướng dẫn khách sử dụng đúng cách',
        actualCost: new Prisma.Decimal(150000),
        costCoveredBy: 'landlord',
      },
    ],
  });

  // ============================================================================
  // TICKETS
  // ============================================================================
  console.log('Creating tickets...');

  await prisma.ticket.createMany({
    data: [
      {
        ticketNumber: 'TKT-2026-00001',
        userId: user1.id,
        rentalContractId: contract1.id,
        subject: 'Hỏi về hóa đơn tháng 2',
        description:
          'Tiền điện tháng này cao hơn bình thường, xin kiểm tra lại',
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
  });

  // ============================================================================
  // TASKS
  // ============================================================================
  console.log('Creating tasks...');

  await prisma.task.createMany({
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
  });

  // ============================================================================
  // PARTNER REQUESTS
  // ============================================================================
  console.log('Creating partner requests...');

  await prisma.partnerRequest.create({
    data: {
      partnerId: partner1.id,
      propertyType: 'apartment',
      address: '500 Điện Biên Phủ, Quận 3',
      city: 'Hồ Chí Minh',
      district: 'Quận 3',
      totalArea: new Prisma.Decimal(200),
      numberOfUnits: 3,
      expectedRentPrice: new Prisma.Decimal(15000000),
      description: 'Tòa nhà 3 căn hộ cho thuê',
      amenities: ['Thang máy', 'Bảo vệ', 'Hầm xe'],
      status: 'submitted',
    },
  });

  // ============================================================================
  // POLICIES
  // ============================================================================
  console.log('Creating policies...');

  await prisma.policy.createMany({
    data: [
      {
        policyType: 'building_regulations',
        title: 'Nội quy tòa nhà',
        content:
          'Cư dân phải tuân thủ giờ giấc sinh hoạt chung. Không gây tiếng ồn lớn sau 22h. Giữ gìn vệ sinh khu vực chung. Không xả rác ngoài nơi quy định...',
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
        title: 'Quy định đỗ xe',
        content:
          'Mỗi căn hộ được phân bổ 1 chỗ đỗ xe ô tô và 2 chỗ đỗ xe máy. Đỗ đúng vị trí quy định. Tốc độ tối đa trong hầm 5km/h...',
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
        title: 'Quy định nuôi thú cưng',
        content:
          'Cho phép nuôi thú cưng nhỏ (dưới 10kg). Phải đăng ký với ban quản lý. Khi ra khu vực chung phải có dây xích và túi dọn vệ sinh...',
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
        title: 'Quy định cho thuê căn hộ',
        content:
          'Các quy định về việc thuê và sử dụng căn hộ. Cư dân không được tự ý sửa chữa kết cấu căn hộ. Báo ngay cho ban quản lý khi có sự cố...',
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
        title: 'Quy định tiếng ồn',
        content:
          'Giờ yên tĩnh: 22h00 - 06h00. Không sử dụng thiết bị gây tiếng ồn lớn vào giờ yên tĩnh. Thi công sửa chữa chỉ được phép từ 08h-17h ngày thường...',
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

  await prisma.legalDocument.createMany({
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
  });

  // ============================================================================
  // NOTIFICATIONS
  // ============================================================================
  console.log('Creating notifications...');

  await prisma.notification.createMany({
    data: [
      {
        recipientType: 'user',
        recipientId: user1.id,
        title: 'Hóa đơn mới',
        message:
          'Hóa đơn tháng 2/2026 đã được tạo. Vui lòng thanh toán trước ngày 05/03/2026.',
        notificationType: 'info',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-02-25'),
      },
      {
        recipientType: 'user',
        recipientId: user1.id,
        title: 'Yêu cầu bảo trì đã tiếp nhận',
        message:
          'Yêu cầu sửa điều hòa của bạn đã được tiếp nhận. Kỹ thuật viên sẽ liên hệ sớm.',
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
        title: 'Task mới được giao',
        message: 'Bạn có task mới: Kiểm tra điều hòa căn P1-2301',
        notificationType: 'info',
        channel: 'in_app',
        deliveryStatus: 'delivered',
        sentAt: new Date('2026-02-10'),
      },
    ],
  });

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
  });

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
}

main()
  .catch((e) => {
    console.error('❌ Seed failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
