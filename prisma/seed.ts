import 'dotenv/config';
import { PrismaClient, Prisma } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import * as bcrypt from 'bcrypt';
import iconv from 'iconv-lite';
import { Pool } from 'pg';

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/intelliservops?schema=public';

const pool = new Pool({ connectionString: databaseUrl });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const SEED_NAMESPACE = 'HOMEIQ-SEED-VI-202604';
const REFERENCE_NOW = new Date('2026-04-22T09:00:00+07:00');
const CURRENCY = 'VND';

type AnyRecord = Record<string, any>;

function decimal(value: number | string) {
  return new Prisma.Decimal(value);
}

function seedCode(group: string, index: number) {
  return `${SEED_NAMESPACE}-${group}-${String(index).padStart(2, '0')}`;
}

function seedEmail(group: string, index: number) {
  return `seed.${group}.${String(index).padStart(2, '0')}@homeiq.vn`;
}

function seedPhone(index: number) {
  return `090${String(1_000_000 + index).padStart(7, '0')}`;
}

function seedNationalId(index: number) {
  return `07920${String(1_000_000 + index).padStart(7, '0')}`;
}

function localDate(date: string) {
  return new Date(`${date}T00:00:00+07:00`);
}

function localDateTime(dateTime: string) {
  return new Date(dateTime);
}

function addDays(date: Date, days: number) {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

function addMonths(date: Date, months: number) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + months);
  return next;
}

function monthToken(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
}

function monthStart(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1, 0, 0, 0, 0);
}

function monthEnd(date: Date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0, 23, 59, 59, 999);
}

function slugify(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .replace(/-{2,}/g, '-');
}

async function hashPassword(password: string) {
  return bcrypt.hash(password, 10);
}

function countMojibakeMarkers(input: string) {
  const matches = input.match(
    /Ã|Â|Ä|Å|Æ|Ç|È|É|Ê|Ë|Ì|Í|Î|Ï|Ð|Ñ|Ò|Ó|Ô|Õ|Ö|×|Ø|Ù|Ú|Û|Ü|Ý|Þ|ß|á»|áº|Ä‘|Æ°|Ã´|Æ¡/g,
  );
  return matches ? matches.length : 0;
}

function fixMojibakeString(input: string) {
  if (!input || countMojibakeMarkers(input) === 0) {
    return input;
  }

  let current = input;

  for (let i = 0; i < 3; i += 1) {
    let candidate = current;

    try {
      candidate = iconv.encode(current, 'win1252').toString('utf8');
    } catch {
      break;
    }

    if (countMojibakeMarkers(candidate) < countMojibakeMarkers(current)) {
      current = candidate;
      continue;
    }

    break;
  }

  return current;
}

function sanitizeSeedValue<T>(value: T): T {
  if (typeof value === 'string') {
    return fixMojibakeString(value) as T;
  }

  if (Array.isArray(value)) {
    return value.map((item) => sanitizeSeedValue(item)) as T;
  }

  if (value && typeof value === 'object') {
    if (
      value instanceof Date ||
      value instanceof Prisma.Decimal ||
      Buffer.isBuffer(value) ||
      value instanceof Uint8Array ||
      (value as { constructor?: { name?: string } }).constructor?.name ===
        'Decimal'
    ) {
      return value;
    }

    const entries = Object.entries(value as Record<string, unknown>).map(
      ([key, nestedValue]) => [key, sanitizeSeedValue(nestedValue)],
    );

    return Object.fromEntries(entries) as T;
  }

  return value;
}

function splitCreateUpdateData(data: AnyRecord) {
  const createData = sanitizeSeedValue(data);
  const updateData = sanitizeSeedValue({ ...data });
  delete updateData.id;
  delete updateData.createdAt;
  return { createData, updateData };
}

async function ensureRecord(delegate: any, where: AnyRecord, data: AnyRecord) {
  const sanitizedWhere = sanitizeSeedValue(where);
  const existing = await delegate.findFirst({ where: sanitizedWhere });
  const { createData, updateData } = splitCreateUpdateData(data);

  if (existing) {
    return delegate.update({
      where: { id: existing.id },
      data: updateData,
    });
  }

  return delegate.create({ data: createData });
}

async function createManySkipDuplicates(delegate: any, data: AnyRecord[]) {
  if (data.length === 0) {
    return;
  }

  await delegate.createMany({
    data: sanitizeSeedValue(data),
    skipDuplicates: true,
  });
}

async function main() {
  console.log(`🌱 Bắt đầu seed dữ liệu mẫu ${SEED_NAMESPACE}...`);

  const passwordHashes = {
    admin: await hashPassword('Admin@123'),
    operator: await hashPassword('Operator@123'),
    staff: await hashPassword('Staff@123'),
    partner: await hashPassword('Partner@123'),
    user: await hashPassword('User@123'),
  };

  const admins: Record<string, any> = {};
  const operators: Record<string, any> = {};
  const staffMembers: Record<string, any> = {};
  const partners: Record<string, any> = {};
  const tenants: Record<string, any> = {};
  const guests: Record<string, any> = {};
  const userIdentities: Record<string, any> = {};
  const amenities: Record<string, any> = {};
  const policies: Record<string, any> = {};
  const apartments: Record<string, any> = {};
  const rooms: Record<string, any> = {};
  const iotBoards: Record<string, any> = {};
  const contracts: Record<string, any> = {};
  const invoices: Record<string, any> = {};
  const meters: Record<string, any> = {};
  const contactRequests: Record<string, any> = {};
  const bookingRequests: Record<string, any> = {};
  const reservations: Record<string, any> = {};
  const appointments: Record<string, any> = {};
  const tasks: Record<string, any> = {};
  const maintenanceRequests: Record<string, any> = {};
  const chatConversations: Record<string, any> = {};

  await prisma.utilityRateSetting.upsert({
    where: { key: 'global' },
    create: {
      key: 'global',
      electricityRatePerUnit: decimal(3500),
      waterRatePerUnit: decimal(15000),
      currency: CURRENCY,
      notes: 'Giá điện/nước mặc định toàn hệ thống, dùng cho đồng hồ mới tạo.',
    },
    update: {
      electricityRatePerUnit: decimal(3500),
      waterRatePerUnit: decimal(15000),
      currency: CURRENCY,
      notes: 'Giá điện/nước mặc định toàn hệ thống, dùng cho đồng hồ mới tạo.',
    },
  });

  const adminSeeds = [
    {
      key: 'admin-01',
      email: seedEmail('admin', 1),
      username: 'seed_super_admin',
      fullName: 'Nguyễn Hoàng Quân',
      phone: seedPhone(1),
      roleLevel: 'super_admin',
    },
    {
      key: 'admin-02',
      email: seedEmail('admin', 2),
      username: 'seed_admin_ops',
      fullName: 'Trần Ngọc Hà',
      phone: seedPhone(2),
      roleLevel: 'admin',
    },
    {
      key: 'admin-03',
      email: seedEmail('admin', 3),
      username: 'seed_admin_policy',
      fullName: 'Phạm Gia Khánh',
      phone: seedPhone(3),
      roleLevel: 'manager',
    },
  ];

  const operatorSeeds = [
    {
      key: 'operator-01',
      email: seedEmail('operator', 1),
      fullName: 'Lê Minh Trí',
      phone: seedPhone(11),
      employeeCode: 'SEED-OP-001',
      shift: 'morning',
    },
    {
      key: 'operator-02',
      email: seedEmail('operator', 2),
      fullName: 'Vũ Khánh Linh',
      phone: seedPhone(12),
      employeeCode: 'SEED-OP-002',
      shift: 'afternoon',
    },
    {
      key: 'operator-03',
      email: seedEmail('operator', 3),
      fullName: 'Đặng Quốc Việt',
      phone: seedPhone(13),
      employeeCode: 'SEED-OP-003',
      shift: 'night',
    },
    {
      key: 'operator-04',
      email: seedEmail('operator', 4),
      fullName: 'Nguyễn Thuỳ Dương',
      phone: seedPhone(14),
      employeeCode: 'SEED-OP-004',
      shift: 'flexible',
    },
  ];

  const staffBlueprints = [
    ['staff-01', 'Ngô Quốc Bảo', 'technician', 'Kỹ thuật', 'Thành phố Thủ Đức'],
    [
      'staff-02',
      'Phan Mỹ Linh',
      'customer_service',
      'Chăm sóc khách hàng',
      'Quận 7',
    ],
    ['staff-03', 'Hoàng Đức Huy', 'maintenance', 'Bảo trì', 'Quận Bình Thạnh'],
    ['staff-04', 'Bùi Nhã Phương', 'general', 'Vận hành', 'Quận 2'],
    ['staff-05', 'Lâm Tuấn Kiệt', 'technician', 'IoT', 'Quận 9'],
    ['staff-06', 'Trịnh Bảo Yến', 'customer_service', 'CRM', 'Quận 1'],
    ['staff-07', 'Mai Anh Tú', 'maintenance', 'Bảo trì', 'Quận 4'],
    ['staff-08', 'Đỗ Khả Vy', 'general', 'Bàn giao', 'Quận 3'],
  ] as const;

  const partnerBlueprints = [
    {
      key: 'partner-01',
      fullName: 'Nguyễn Đức An',
      companyName: 'Công ty An Gia Residence',
      taxCode: '0319980001',
      bankName: 'Vietcombank',
      bankAccountNumber: '0071000001111',
      commissionRate: 10,
      address: '12 Nguyễn Cơ Thạch, Phường An Khánh, Thành phố Thủ Đức',
    },
    {
      key: 'partner-02',
      fullName: 'Trần Bảo Châu',
      companyName: 'Công ty TBC Property',
      taxCode: '0319980002',
      bankName: 'Techcombank',
      bankAccountNumber: '1903888800022',
      commissionRate: 10,
      address: '88 Xa lộ Hà Nội, Phường An Phú, Thành phố Thủ Đức',
    },
    {
      key: 'partner-03',
      fullName: 'Lê Hoàng Dũng',
      companyName: 'Công ty LHD Urban Stay',
      taxCode: '0319980003',
      bankName: 'ACB',
      bankAccountNumber: '2638999900033',
      commissionRate: 10,
      address: '26 Mai Chí Thọ, Phường Thủ Thiêm, Thành phố Thủ Đức',
    },
    {
      key: 'partner-04',
      fullName: 'Phạm Ngọc Hân',
      companyName: 'Công ty Phúc Hân Living',
      taxCode: '0319980004',
      bankName: 'BIDV',
      bankAccountNumber: '581100000444',
      commissionRate: 10,
      address: '55 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh',
    },
    {
      key: 'partner-05',
      fullName: 'Võ Quốc Khánh',
      companyName: 'Công ty Khang Minh Real',
      taxCode: '0319980005',
      bankName: 'MB Bank',
      bankAccountNumber: '6868999900055',
      commissionRate: 10,
      address: '39 Tôn Dật Tiên, Phường Tân Phú, Quận 7',
    },
    {
      key: 'partner-06',
      fullName: 'Đặng Minh Tâm',
      companyName: 'Công ty Minh Tâm Asset',
      taxCode: '0319980006',
      bankName: 'VPBank',
      bankAccountNumber: '9704000000666',
      commissionRate: 10,
      address: '11 Song Hành, Phường An Phú, Thành phố Thủ Đức',
    },
  ];

  const tenantNames = [
    'Nguyễn Minh Anh',
    'Trần Bảo Uyên',
    'Lê Thanh Tùng',
    'Phạm Khánh Vân',
    'Võ Gia Hưng',
    'Đỗ Quỳnh Mai',
    'Bùi Nhật Nam',
    'Huỳnh Ngọc Trâm',
    'Ngô Tiến Đạt',
    'Mai Thảo Nhi',
    'Đặng Tuấn Khang',
    'Phan Hải Yến',
    'Tạ Hoàng Sơn',
    'Lưu Bích Phương',
    'Dương Anh Khoa',
    'Cao Gia Linh',
    'Trịnh Minh Khôi',
    'Đinh Thuỳ Chi',
  ];

  const guestNames = [
    'Khánh Vy',
    'Minh Triết',
    'Lan Anh',
    'Hoài Phương',
    'Trọng Hiếu',
    'Thảo My',
    'Gia Bảo',
    'Ngọc Bích',
    'Thiên Ân',
    'Bảo Hân',
    'Hải Đăng',
    'Phúc An',
  ];

  console.log('Tạo admin, operator, staff, partner, tenant, guest...');

  for (const adminSeed of adminSeeds) {
    admins[adminSeed.key] = await ensureRecord(
      prisma.admin,
      { email: adminSeed.email },
      {
        email: adminSeed.email,
        username: adminSeed.username,
        fullName: adminSeed.fullName,
        phone: adminSeed.phone,
        passwordHash: passwordHashes.admin,
        roleLevel: adminSeed.roleLevel,
        isActive: true,
      },
    );
  }

  for (const operatorSeed of operatorSeeds) {
    operators[operatorSeed.key] = await ensureRecord(
      prisma.operator,
      { email: operatorSeed.email },
      {
        email: operatorSeed.email,
        phone: operatorSeed.phone,
        fullName: operatorSeed.fullName,
        employeeCode: operatorSeed.employeeCode,
        shift: operatorSeed.shift,
        passwordHash: passwordHashes.operator,
        isActive: true,
      },
    );
  }

  for (let i = 0; i < staffBlueprints.length; i += 1) {
    const [key, fullName, role, department, workingDistrict] =
      staffBlueprints[i];
    const email = seedEmail('staff', i + 1);
    const phone = seedPhone(20 + i);

    staffMembers[key] = await ensureRecord(
      prisma.staff,
      { email },
      {
        email,
        phone,
        fullName,
        employeeCode: `SEED-ST-${String(i + 1).padStart(3, '0')}`,
        role,
        department,
        passwordHash: passwordHashes.staff,
        workingCity: 'Hồ Chí Minh',
        workingDistrict,
        hireDate: addMonths(REFERENCE_NOW, -(i + 10)),
        isActive: true,
      },
    );
  }

  for (let i = 0; i < partnerBlueprints.length; i += 1) {
    const seed = partnerBlueprints[i];
    const email = seedEmail('partner', i + 1);
    const phone = seedPhone(40 + i);

    partners[seed.key] = await ensureRecord(
      prisma.user,
      { email },
      {
        email,
        phone,
        fullName: seed.fullName,
        companyName: seed.companyName,
        taxCode: seed.taxCode,
        bankName: seed.bankName,
        bankAccountNumber: seed.bankAccountNumber,
        address: seed.address,
        commissionRate: decimal(seed.commissionRate),
        contractStartDate: addMonths(REFERENCE_NOW, -18),
        contractEndDate: addMonths(REFERENCE_NOW, 18),
        paymentTerms:
          'Chuyển khoản trong vòng 05 ngày làm việc kể từ ngày đối soát.',
        passwordHash: passwordHashes.partner,
        isPartner: true,
        isActive: true,
        isVerified: true,
        lastLoginAt: addDays(REFERENCE_NOW, -(i + 1)),
        createdByStaffId: staffMembers['staff-02'].id,
      },
    );
  }

  const tenantDistricts = [
    'Quận 1',
    'Quận 3',
    'Quận 4',
    'Quận 7',
    'Quận Bình Thạnh',
    'Thành phố Thủ Đức',
  ];

  for (let i = 0; i < tenantNames.length; i += 1) {
    const key = `tenant-${String(i + 1).padStart(2, '0')}`;
    const email = seedEmail('tenant', i + 1);
    const phone = seedPhone(80 + i);

    tenants[key] = await ensureRecord(
      prisma.user,
      { email },
      {
        email,
        phone,
        fullName: tenantNames[i],
        passwordHash: passwordHashes.user,
        dateOfBirth: addMonths(localDate('1991-01-15'), i * 3),
        emergencyContactName: `Người thân của ${tenantNames[i]}`,
        emergencyContactPhone: seedPhone(200 + i),
        address: `${12 + i} Đường nội bộ, ${tenantDistricts[i % tenantDistricts.length]}, Hồ Chí Minh`,
        isActive: true,
        isVerified: i % 5 !== 0,
        lastLoginAt: addDays(REFERENCE_NOW, -(i + 2)),
        createdByStaffId:
          i % 2 === 0
            ? staffMembers['staff-02'].id
            : staffMembers['staff-06'].id,
      },
    );
  }

  for (let i = 0; i < guestNames.length; i += 1) {
    const key = `guest-${String(i + 1).padStart(2, '0')}`;
    const email = seedEmail('guest', i + 1);
    const phone = seedPhone(140 + i);

    guests[key] = await ensureRecord(
      prisma.guest,
      { email },
      {
        email,
        phone,
        fullName: `Khách ${guestNames[i]}`,
        preferredContactMethod: ['phone', 'email', 'both', 'whatsapp'][i % 4],
      },
    );
  }

  console.log('Tạo hồ sơ định danh cho partner và tenant...');

  const allUserEntries = [
    ...Object.entries(partners),
    ...Object.entries(tenants),
  ] as Array<[string, any]>;

  for (let i = 0; i < allUserEntries.length; i += 1) {
    const [key, user] = allUserEntries[i];
    userIdentities[key] = await ensureRecord(
      prisma.userIdentity,
      { userId: user.id },
      {
        userId: user.id,
        nationalId: seedNationalId(i + 1),
        name: user.fullName,
        dob: `${String(1 + (i % 27)).padStart(2, '0')}/0${(i % 9) + 1}/199${i % 10}`,
        sex: i % 2 === 0 ? 'Nam' : 'Nữ',
        nationality: 'Việt Nam',
        ethnicity: 'Kinh',
        home: `Phường ${1 + (i % 10)}, ${tenantDistricts[i % tenantDistricts.length]}, Hồ Chí Minh`,
        address:
          user.address ||
          `${20 + i} Đường số ${1 + (i % 9)}, ${tenantDistricts[i % tenantDistricts.length]}, Hồ Chí Minh`,
        province: 'Hồ Chí Minh',
        district: tenantDistricts[i % tenantDistricts.length],
        ward: `Phường ${1 + (i % 10)}`,
        street: `${20 + i} Đường số ${1 + (i % 9)}`,
        features: i % 3 === 0 ? 'Nốt ruồi nhỏ ở cằm' : 'Không',
        issueDate: `${String(10 + (i % 15)).padStart(2, '0')}/0${(i % 9) + 1}/2023`,
        doe: `${String(10 + (i % 15)).padStart(2, '0')}/0${(i % 9) + 1}/2038`,
        isVerified: i % 4 !== 0,
        verifiedAt: i % 4 !== 0 ? addDays(REFERENCE_NOW, -(30 + i)) : null,
      },
    );
  }

  console.log('Tạo tiện ích, chính sách và giai đoạn hoa hồng...');

  const amenitySeeds = [
    ['ho-boi', 'Hồ bơi', 'Khu hồ bơi dành cho cư dân', 'pool'],
    ['phong-gym', 'Phòng gym', 'Phòng tập với thiết bị đầy đủ', 'dumbbell'],
    ['bai-do-xe', 'Bãi đỗ xe', 'Bãi giữ xe có kiểm soát', 'parking'],
    ['camera-an-ninh', 'Camera an ninh', 'Giám sát 24/7', 'camera'],
    [
      'khoa-thong-minh',
      'Khóa cửa thông minh',
      'Khóa cửa điều khiển từ xa',
      'lock',
    ],
    ['ban-cong', 'Ban công', 'Căn hộ có ban công thoáng', 'balcony'],
    ['may-giat', 'Máy giặt', 'Máy giặt riêng trong căn', 'washing-machine'],
    ['may-rua-chen', 'Máy rửa chén', 'Máy rửa chén âm tủ', 'dishwasher'],
    ['le-tan-247', 'Lễ tân 24/7', 'Quầy lễ tân trực liên tục', 'reception'],
    ['khu-bbq', 'Khu BBQ', 'Khu tiệc nướng ngoài trời', 'bbq'],
    ['co-working', 'Khu co-working', 'Không gian làm việc chung', 'work'],
    [
      'thu-cung',
      'Cho phép thú cưng',
      'Cho phép nuôi thú cưng theo quy định',
      'pet',
    ],
  ] as const;

  for (const [code, name, description, icon] of amenitySeeds) {
    amenities[code] = await ensureRecord(
      prisma.amenity,
      { code },
      {
        code,
        name,
        description,
        icon,
        isActive: true,
      },
    );
  }

  const policySeeds = [
    {
      key: 'rental-rules',
      policyType: 'rental_rules',
      title: 'Quy định thuê căn hộ',
      content:
        'Người thuê cần sử dụng căn hộ đúng mục đích, không tự ý cải tạo kết cấu và phải thông báo ngay khi phát sinh sự cố ảnh hưởng đến an toàn vận hành.',
      displayOrder: 1,
      requiresAcceptance: true,
    },
    {
      key: 'building-regulations',
      policyType: 'building_regulations',
      title: 'Nội quy tòa nhà',
      content:
        'Cư dân cần tuân thủ quy định giờ yên tĩnh, giữ gìn vệ sinh khu vực chung, sử dụng thẻ cư dân đúng quy định và phối hợp với ban quản lý khi có kiểm tra.',
      displayOrder: 2,
      requiresAcceptance: true,
    },
    {
      key: 'pet-policy',
      policyType: 'pet_policy',
      title: 'Quy định thú cưng',
      content:
        'Chỉ được nuôi thú cưng nhỏ, phải đăng ký với ban quản lý và đảm bảo vệ sinh khi di chuyển tại khu vực chung.',
      displayOrder: 3,
      requiresAcceptance: true,
    },
    {
      key: 'parking-rules',
      policyType: 'parking_rules',
      title: 'Quy định bãi xe',
      content:
        'Xe máy và ô tô phải đỗ đúng vị trí phân bổ, tuân thủ tốc độ tối đa trong hầm và xuất trình thẻ khi được yêu cầu.',
      displayOrder: 4,
      requiresAcceptance: false,
    },
    {
      key: 'noise-policy',
      policyType: 'noise_policy',
      title: 'Quy định tiếng ồn',
      content:
        'Không gây tiếng ồn lớn sau 22h00, hạn chế thi công ngoài khung giờ được ban quản lý cho phép và phối hợp khi có phản ánh từ cư dân khác.',
      displayOrder: 5,
      requiresAcceptance: false,
    },
    {
      key: 'maintenance-policy',
      policyType: 'maintenance_policy',
      title: 'Quy trình bảo trì',
      content:
        'Yêu cầu bảo trì cần mô tả rõ hiện trạng, gửi kèm hình ảnh nếu có và phối hợp lịch hẹn để kỹ thuật viên xử lý nhanh chóng.',
      displayOrder: 6,
      requiresAcceptance: true,
    },
    {
      key: 'security-policy',
      policyType: 'security_policy',
      title: 'Quy định an ninh',
      content:
        'Không chia sẻ mã cửa, mã thang máy và thông tin truy cập nội bộ cho bên thứ ba khi chưa được HomeIQ xác nhận.',
      displayOrder: 7,
      requiresAcceptance: true,
    },
    {
      key: 'common-area-usage',
      policyType: 'common_area_usage',
      title: 'Sử dụng khu vực chung',
      content:
        'Khu vực chung chỉ phục vụ cư dân và khách đã đăng ký, mọi hư hỏng phát sinh do sử dụng sai quy định sẽ bị tính phí khắc phục.',
      displayOrder: 8,
      requiresAcceptance: false,
    },
    {
      key: 'cancellation-policy',
      policyType: 'cancellation_policy',
      title: 'Điều khoản hủy đặt cọc',
      content:
        'Việc hủy đặt cọc cần thực hiện theo thời hạn trong hợp đồng hoặc booking request, các khoản phạt sẽ áp dụng theo điều khoản đã xác nhận.',
      displayOrder: 9,
      requiresAcceptance: true,
    },
    {
      key: 'move-in-out',
      policyType: 'move_in_out_rules',
      title: 'Quy định nhận và trả căn',
      content:
        'Cư dân cần đăng ký lịch nhận/trả căn trước ít nhất 24 giờ, phối hợp kiểm kê tài sản và bàn giao lại đầy đủ thẻ, chìa khóa, mã truy cập.',
      displayOrder: 10,
      requiresAcceptance: true,
    },
  ];

  for (const policySeed of policySeeds) {
    policies[policySeed.key] = await ensureRecord(
      prisma.policy,
      {
        title: policySeed.title,
        version: '1.0',
        language: 'vi',
      },
      {
        policyType: policySeed.policyType,
        title: policySeed.title,
        content: policySeed.content,
        version: '1.0',
        language: 'vi',
        effectiveDate: localDate('2026-01-01'),
        isActive: true,
        requiresAcceptance: policySeed.requiresAcceptance,
        displayOrder: policySeed.displayOrder,
        createdByAdminId: admins['admin-01'].id,
        approvedByAdminId: admins['admin-02'].id,
        approvedAt: localDateTime('2026-01-01T09:00:00+07:00'),
      },
    );
  }

  const commissionPhaseSeeds = [
    {
      phaseName: 'Giai đoạn khởi động 2025',
      effectiveFrom: localDate('2025-01-01'),
      effectiveTo: localDate('2025-12-31'),
      commissionRate: decimal(10),
      isActive: false,
    },
    {
      phaseName: 'Giai đoạn tăng trưởng 2026',
      effectiveFrom: localDate('2026-01-01'),
      effectiveTo: localDate('2026-09-30'),
      commissionRate: decimal(10),
      isActive: false,
    },
    {
      phaseName: 'Giai đoạn tối ưu 2026-Q4',
      effectiveFrom: localDate('2026-10-01'),
      effectiveTo: null,
      commissionRate: decimal(10),
      isActive: true,
    },
  ];

  for (const phaseSeed of commissionPhaseSeeds) {
    await ensureRecord(
      prisma.cooperationCommissionPhase,
      {
        phaseName: phaseSeed.phaseName,
        effectiveFrom: phaseSeed.effectiveFrom,
      },
      {
        ...phaseSeed,
        createdByAdminId: admins['admin-01'].id,
        updatedByAdminId: admins['admin-03'].id,
      },
    );
  }

  console.log('Tạo căn hộ và phòng...');

  const apartmentSeeds = [
    {
      key: 'apartment-01',
      buildingName: 'Vinhomes Grand Park',
      apartmentNumber: 'S1.12-1805',
      floorNumber: 18,
      wardCode: 27184,
      streetAddress: '512 Nguyễn Xiển, Phường Long Bình, Thành phố Thủ Đức',
      latitude: 10.84351,
      longitude: 106.83011,
      totalArea: 68,
      usableArea: 63,
      maxOccupants: 3,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 18_500_000,
      depositAmount: 37_000_000,
      status: 'occupied',
      ownerKey: 'partner-01',
      approvedByOperatorKey: 'operator-01',
      yearBuilt: 2021,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'bai-do-xe',
        'camera-an-ninh',
        'khoa-thong-minh',
        'may-giat',
      ],
      description:
        'Căn hộ 2 phòng ngủ phù hợp gia đình trẻ, nội thất đồng bộ, view công viên nội khu.',
    },
    {
      key: 'apartment-02',
      buildingName: 'Lumiere Riverside',
      apartmentNumber: 'T3-2208',
      floorNumber: 22,
      wardCode: 27181,
      streetAddress: '259 Võ Nguyên Giáp, Phường An Phú, Thành phố Thủ Đức',
      latitude: 10.79964,
      longitude: 106.74435,
      totalArea: 95,
      usableArea: 88,
      maxOccupants: 5,
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 32_000_000,
      depositAmount: 64_000_000,
      status: 'occupied',
      ownerKey: 'partner-02',
      approvedByOperatorKey: 'operator-01',
      yearBuilt: 2023,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'le-tan-247',
        'camera-an-ninh',
        'khoa-thong-minh',
        'co-working',
      ],
      description:
        'Căn hộ 3 phòng ngủ cao cấp, phù hợp chuyên gia nước ngoài và gia đình đông người.',
    },
    {
      key: 'apartment-03',
      buildingName: 'Masteri Thảo Điền',
      apartmentNumber: 'T5-1503',
      floorNumber: 15,
      wardCode: 27181,
      streetAddress: '159 Xa lộ Hà Nội, Phường Thảo Điền, Thành phố Thủ Đức',
      latitude: 10.80231,
      longitude: 106.73956,
      totalArea: 72,
      usableArea: 66,
      maxOccupants: 3,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'semi_furnished',
      baseRentPrice: 21_000_000,
      depositAmount: 42_000_000,
      status: 'available',
      ownerKey: 'partner-02',
      approvedByOperatorKey: 'operator-02',
      yearBuilt: 2019,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'bai-do-xe',
        'camera-an-ninh',
        'ban-cong',
      ],
      description:
        'Căn hộ sáng, thoáng, phù hợp khách trẻ cần vị trí gần Metro và tiện ích đầy đủ.',
    },
    {
      key: 'apartment-04',
      buildingName: 'Empire City',
      apartmentNumber: 'Cove-1002',
      floorNumber: 10,
      wardCode: 27182,
      streetAddress: '2 Mai Chí Thọ, Phường Thủ Thiêm, Thành phố Thủ Đức',
      latitude: 10.7776,
      longitude: 106.7278,
      totalArea: 58,
      usableArea: 54,
      maxOccupants: 2,
      numberOfBedrooms: 1,
      numberOfBathrooms: 1,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 26_000_000,
      depositAmount: 52_000_000,
      status: 'reserved',
      ownerKey: 'partner-03',
      approvedByOperatorKey: 'operator-02',
      yearBuilt: 2022,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'khoa-thong-minh',
        'le-tan-247',
        'co-working',
      ],
      description:
        'Căn hộ 1 phòng ngủ cao cấp, dành cho khách hàng làm việc tại khu trung tâm tài chính mới.',
    },
    {
      key: 'apartment-05',
      buildingName: 'Saigon Pearl',
      apartmentNumber: 'Ruby-0811',
      floorNumber: 8,
      wardCode: 26728,
      streetAddress: '92 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh',
      latitude: 10.79112,
      longitude: 106.71995,
      totalArea: 74,
      usableArea: 68,
      maxOccupants: 3,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'semi_furnished',
      baseRentPrice: 19_500_000,
      depositAmount: 39_000_000,
      status: 'maintenance',
      ownerKey: 'partner-04',
      approvedByOperatorKey: 'operator-03',
      yearBuilt: 2015,
      amenityCodes: ['phong-gym', 'bai-do-xe', 'camera-an-ninh', 'ban-cong'],
      description:
        'Căn hộ đang trong giai đoạn bảo trì thay mới thiết bị điện và cải tạo khu bếp.',
    },
    {
      key: 'apartment-06',
      buildingName: 'Sunrise City',
      apartmentNumber: 'North-X3-1207',
      floorNumber: 12,
      wardCode: 27289,
      streetAddress: '27 Nguyễn Hữu Thọ, Phường Tân Hưng, Quận 7',
      latitude: 10.73346,
      longitude: 106.70478,
      totalArea: 102,
      usableArea: 94,
      maxOccupants: 5,
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 27_500_000,
      depositAmount: 55_000_000,
      status: 'occupied',
      ownerKey: 'partner-05',
      approvedByOperatorKey: 'operator-01',
      yearBuilt: 2017,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'bai-do-xe',
        'camera-an-ninh',
        'may-rua-chen',
        'khu-bbq',
      ],
      description:
        'Căn hộ 3 phòng ngủ có không gian sinh hoạt rộng, phù hợp gia đình ở dài hạn.',
    },
    {
      key: 'apartment-07',
      buildingName: 'Feliz En Vista',
      apartmentNumber: 'C1-1906',
      floorNumber: 19,
      wardCode: 27181,
      streetAddress: '1 Phan Văn Đáng, Phường Thạnh Mỹ Lợi, Thành phố Thủ Đức',
      latitude: 10.77693,
      longitude: 106.75944,
      totalArea: 80,
      usableArea: 74,
      maxOccupants: 4,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 24_000_000,
      depositAmount: 48_000_000,
      status: 'pending',
      ownerKey: 'partner-05',
      approvedByOperatorKey: 'operator-04',
      yearBuilt: 2020,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'co-working',
        'camera-an-ninh',
        'khoa-thong-minh',
        'thu-cung',
      ],
      description:
        'Căn hộ đang chờ hoàn tất thủ tục thuê, có thể bàn giao ngay sau khi ký hợp đồng.',
    },
    {
      key: 'apartment-08',
      buildingName: 'Gateway Thảo Điền',
      apartmentNumber: 'B-1701',
      floorNumber: 17,
      wardCode: 27181,
      streetAddress: '2 Lê Thước, Phường Thảo Điền, Thành phố Thủ Đức',
      latitude: 10.80388,
      longitude: 106.73521,
      totalArea: 76,
      usableArea: 71,
      maxOccupants: 3,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 23_500_000,
      depositAmount: 47_000_000,
      status: 'occupied',
      ownerKey: 'partner-06',
      approvedByOperatorKey: 'operator-02',
      yearBuilt: 2018,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'le-tan-247',
        'camera-an-ninh',
        'khoa-thong-minh',
      ],
      description:
        'Căn hộ góc có ánh sáng tốt, phù hợp khách thuê làm việc khu Đông Sài Gòn.',
    },
    {
      key: 'apartment-09',
      buildingName: 'Estella Heights',
      apartmentNumber: 'T1-1104',
      floorNumber: 11,
      wardCode: 27181,
      streetAddress: '88 Song Hành, Phường An Phú, Thành phố Thủ Đức',
      latitude: 10.80147,
      longitude: 106.74481,
      totalArea: 56,
      usableArea: 52,
      maxOccupants: 2,
      numberOfBedrooms: 1,
      numberOfBathrooms: 1,
      furnishingStatus: 'semi_furnished',
      baseRentPrice: 17_500_000,
      depositAmount: 35_000_000,
      status: 'available',
      ownerKey: 'partner-03',
      approvedByOperatorKey: 'operator-03',
      yearBuilt: 2016,
      amenityCodes: ['ho-boi', 'phong-gym', 'bai-do-xe', 'ban-cong'],
      description:
        'Căn hộ 1 phòng ngủ yên tĩnh, thích hợp người độc thân hoặc cặp đôi mới cưới.',
    },
    {
      key: 'apartment-10',
      buildingName: 'New City',
      apartmentNumber: 'Babylon-0609',
      floorNumber: 6,
      wardCode: 27182,
      streetAddress: '17 Mai Chí Thọ, Phường Bình Khánh, Thành phố Thủ Đức',
      latitude: 10.77713,
      longitude: 106.72351,
      totalArea: 84,
      usableArea: 77,
      maxOccupants: 4,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 20_500_000,
      depositAmount: 41_000_000,
      status: 'occupied',
      ownerKey: 'partner-04',
      approvedByOperatorKey: 'operator-01',
      yearBuilt: 2019,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'bai-do-xe',
        'camera-an-ninh',
        'may-giat',
      ],
      description:
        'Căn hộ có layout tối ưu cho gia đình nhỏ, gần khu trung tâm hành chính Thủ Thiêm.',
    },
    {
      key: 'apartment-11',
      buildingName: 'The Manor',
      apartmentNumber: 'M3-2010',
      floorNumber: 20,
      wardCode: 26728,
      streetAddress: '91 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh',
      latitude: 10.79411,
      longitude: 106.72013,
      totalArea: 108,
      usableArea: 99,
      maxOccupants: 5,
      numberOfBedrooms: 3,
      numberOfBathrooms: 2,
      furnishingStatus: 'fully_furnished',
      baseRentPrice: 35_000_000,
      depositAmount: 70_000_000,
      status: 'occupied',
      ownerKey: 'partner-06',
      approvedByOperatorKey: 'operator-04',
      yearBuilt: 2014,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'le-tan-247',
        'camera-an-ninh',
        'co-working',
        'may-rua-chen',
      ],
      description:
        'Căn hộ hạng sang phục vụ nhóm chuyên gia hoặc gia đình cần không gian làm việc tại nhà.',
    },
    {
      key: 'apartment-12',
      buildingName: 'Vinhomes Central Park',
      apartmentNumber: 'P6-2502',
      floorNumber: 25,
      wardCode: 26728,
      streetAddress: '208 Nguyễn Hữu Cảnh, Phường 22, Quận Bình Thạnh',
      latitude: 10.79248,
      longitude: 106.72162,
      totalArea: 82,
      usableArea: 76,
      maxOccupants: 4,
      numberOfBedrooms: 2,
      numberOfBathrooms: 2,
      furnishingStatus: 'semi_furnished',
      baseRentPrice: 26_500_000,
      depositAmount: 53_000_000,
      status: 'inactive',
      ownerKey: 'partner-01',
      approvedByOperatorKey: 'operator-03',
      yearBuilt: 2018,
      amenityCodes: [
        'ho-boi',
        'phong-gym',
        'bai-do-xe',
        'camera-an-ninh',
        'ban-cong',
        'le-tan-247',
      ],
      description:
        'Căn hộ tạm ngưng khai thác để chuẩn bị nâng cấp gói nội thất và hệ thống điều khiển thông minh.',
    },
  ];

  for (const apartmentSeed of apartmentSeeds) {
    apartments[apartmentSeed.key] = await ensureRecord(
      prisma.apartment,
      {
        slug: `${slugify(apartmentSeed.buildingName)}-${slugify(apartmentSeed.apartmentNumber)}-${slugify(SEED_NAMESPACE)}`,
      },
      {
        buildingName: apartmentSeed.buildingName,
        apartmentNumber: apartmentSeed.apartmentNumber,
        slug: `${slugify(apartmentSeed.buildingName)}-${slugify(apartmentSeed.apartmentNumber)}-${slugify(SEED_NAMESPACE)}`,
        maxConcurrentViewings: 2,
        floorNumber: apartmentSeed.floorNumber,
        wardCode: apartmentSeed.wardCode,
        provinceCode: 79,
        streetAddress: apartmentSeed.streetAddress,
        latitude: decimal(apartmentSeed.latitude),
        longitude: decimal(apartmentSeed.longitude),
        totalArea: decimal(apartmentSeed.totalArea),
        usableArea: decimal(apartmentSeed.usableArea),
        maxOccupants: apartmentSeed.maxOccupants,
        numberOfBedrooms: apartmentSeed.numberOfBedrooms,
        numberOfBathrooms: apartmentSeed.numberOfBathrooms,
        furnishingStatus: apartmentSeed.furnishingStatus,
        amenities: apartmentSeed.amenityCodes.map(
          (amenityCode) => amenities[amenityCode].name,
        ),
        baseRentPrice: decimal(apartmentSeed.baseRentPrice),
        depositAmount: decimal(apartmentSeed.depositAmount),
        status: apartmentSeed.status,
        description: apartmentSeed.description,
        images: [
          `/seed-images/${slugify(apartmentSeed.apartmentNumber)}-01.jpg`,
          `/seed-images/${slugify(apartmentSeed.apartmentNumber)}-02.jpg`,
        ],
        videoTourUrl: `https://demo.homeiq.vn/tour/${slugify(apartmentSeed.apartmentNumber)}`,
        yearBuilt: apartmentSeed.yearBuilt,
        ownerId: partners[apartmentSeed.ownerKey].id,
        approvedByOperatorId: operators[apartmentSeed.approvedByOperatorKey].id,
        approvedAt: addMonths(REFERENCE_NOW, -2),
      },
    );
  }

  const roomRecords: AnyRecord[] = [];

  for (const apartmentSeed of apartmentSeeds) {
    const apartment = apartments[apartmentSeed.key];
    const roomBlueprints: Array<{
      roomNumber: string;
      roomType: string;
      area: number;
      hasWindow: boolean;
      hasAirConditioning: boolean;
      hasPrivateBathroom: boolean;
      maxOccupancy: number;
      status: string;
      description: string;
    }> = [];

    for (
      let bedroomIndex = 0;
      bedroomIndex < apartmentSeed.numberOfBedrooms;
      bedroomIndex += 1
    ) {
      roomBlueprints.push({
        roomNumber: `PN-${String(bedroomIndex + 1).padStart(2, '0')}`,
        roomType: 'bedroom',
        area:
          apartmentSeed.numberOfBedrooms === 1
            ? 22
            : bedroomIndex === 0
              ? 20
              : 15,
        hasWindow: true,
        hasAirConditioning: true,
        hasPrivateBathroom:
          bedroomIndex === 0 && apartmentSeed.numberOfBathrooms > 1,
        maxOccupancy: 2,
        status:
          apartmentSeed.status === 'maintenance'
            ? 'maintenance'
            : apartmentSeed.status === 'occupied'
              ? 'occupied'
              : 'available',
        description: `Phòng ngủ ${bedroomIndex + 1} của căn ${apartmentSeed.apartmentNumber}.`,
      });
    }

    roomBlueprints.push({
      roomNumber: 'PK-01',
      roomType: 'living_room',
      area: apartmentSeed.numberOfBedrooms >= 3 ? 30 : 24,
      hasWindow: true,
      hasAirConditioning: true,
      hasPrivateBathroom: false,
      maxOccupancy: apartmentSeed.maxOccupants,
      status:
        apartmentSeed.status === 'maintenance'
          ? 'maintenance'
          : apartmentSeed.status === 'occupied'
            ? 'occupied'
            : 'available',
      description: `Phòng khách chính của căn ${apartmentSeed.apartmentNumber}.`,
    });
    roomBlueprints.push({
      roomNumber: 'BEP-01',
      roomType: 'kitchen',
      area: apartmentSeed.numberOfBedrooms >= 3 ? 12 : 9,
      hasWindow: false,
      hasAirConditioning: false,
      hasPrivateBathroom: false,
      maxOccupancy: 1,
      status:
        apartmentSeed.status === 'maintenance' ? 'maintenance' : 'available',
      description: `Khu bếp mở của căn ${apartmentSeed.apartmentNumber}.`,
    });
    roomBlueprints.push({
      roomNumber: 'BANCONG-01',
      roomType: 'balcony',
      area: apartmentSeed.numberOfBedrooms >= 3 ? 8 : 6,
      hasWindow: false,
      hasAirConditioning: false,
      hasPrivateBathroom: false,
      maxOccupancy: 1,
      status: 'available',
      description: `Ban công thông thoáng của căn ${apartmentSeed.apartmentNumber}.`,
    });

    if (apartmentSeed.numberOfBedrooms >= 2) {
      roomBlueprints.push({
        roomNumber: 'KHO-01',
        roomType: 'storage',
        area: 4,
        hasWindow: false,
        hasAirConditioning: false,
        hasPrivateBathroom: false,
        maxOccupancy: 1,
        status: 'available',
        description: `Kho chứa đồ của căn ${apartmentSeed.apartmentNumber}.`,
      });
    }

    for (
      let bathroomIndex = 0;
      bathroomIndex < apartmentSeed.numberOfBathrooms;
      bathroomIndex += 1
    ) {
      roomBlueprints.push({
        roomNumber: `WC-${String(bathroomIndex + 1).padStart(2, '0')}`,
        roomType: 'bathroom',
        area: 4.5,
        hasWindow: bathroomIndex === 0,
        hasAirConditioning: false,
        hasPrivateBathroom: true,
        maxOccupancy: 1,
        status:
          apartmentSeed.status === 'maintenance' ? 'maintenance' : 'available',
        description: `Phòng tắm ${bathroomIndex + 1} của căn ${apartmentSeed.apartmentNumber}.`,
      });
    }

    for (const roomBlueprint of roomBlueprints) {
      const room = await ensureRecord(
        prisma.room,
        {
          apartmentId: apartment.id,
          roomNumber: roomBlueprint.roomNumber,
        },
        {
          apartmentId: apartment.id,
          roomNumber: roomBlueprint.roomNumber,
          roomType: roomBlueprint.roomType,
          area: decimal(roomBlueprint.area),
          hasWindow: roomBlueprint.hasWindow,
          hasAirConditioning: roomBlueprint.hasAirConditioning,
          hasPrivateBathroom: roomBlueprint.hasPrivateBathroom,
          maxOccupancy: roomBlueprint.maxOccupancy,
          rentPrice:
            roomBlueprint.roomType === 'bedroom'
              ? decimal(
                  apartmentSeed.numberOfBedrooms >= 3 ? 11_500_000 : 9_500_000,
                )
              : null,
          status: roomBlueprint.status,
          description: roomBlueprint.description,
          images: [
            `/seed-rooms/${slugify(apartmentSeed.apartmentNumber)}-${slugify(roomBlueprint.roomNumber)}.jpg`,
          ],
        },
      );

      rooms[`${apartmentSeed.key}:${roomBlueprint.roomNumber}`] = room;
      roomRecords.push(room);
    }
  }

  await createManySkipDuplicates(
    prisma.apartmentAmenity,
    apartmentSeeds.flatMap((apartmentSeed) =>
      apartmentSeed.amenityCodes.map((amenityCode) => ({
        apartmentId: apartments[apartmentSeed.key].id,
        amenityId: amenities[amenityCode].id,
      })),
    ),
  );

  await createManySkipDuplicates(
    prisma.apartmentPolicy,
    apartmentSeeds.flatMap((apartmentSeed, apartmentIndex) =>
      policySeeds
        .filter((_, policyIndex) => policyIndex < 6 || apartmentIndex % 2 === 0)
        .map((policySeed) => ({
          apartmentId: apartments[apartmentSeed.key].id,
          policyId: policies[policySeed.key].id,
          isRequired: policySeed.requiresAcceptance,
          effectiveDate: localDate('2026-01-01'),
          notes: `Áp dụng cho căn ${apartmentSeed.apartmentNumber} trong bộ dữ liệu mẫu.`,
        })),
    ),
  );

  console.log('Tạo board IoT và thiết bị IoT...');

  for (let i = 0; i < apartmentSeeds.length; i += 1) {
    const apartmentSeed = apartmentSeeds[i];
    const apartment = apartments[apartmentSeed.key];
    const boardId = `ESP_SEED_${String(i + 1).padStart(3, '0')}`;

    iotBoards[apartmentSeed.key] = await ensureRecord(
      prisma.ioTBoard,
      { id: boardId },
      {
        id: boardId,
        name: `Board điều khiển ${apartmentSeed.apartmentNumber}`,
        apartmentId: apartment.id,
        status:
          apartmentSeed.status === 'inactive'
            ? 'inactive'
            : apartmentSeed.status === 'maintenance'
              ? 'maintenance'
              : 'active',
        lastOnlineAt:
          apartmentSeed.status === 'inactive'
            ? addDays(REFERENCE_NOW, -60)
            : addDays(REFERENCE_NOW, -(i + 1)),
      },
    );
  }

  const extraPremiumApartments = new Set([
    'apartment-02',
    'apartment-04',
    'apartment-11',
  ]);

  for (let i = 0; i < apartmentSeeds.length; i += 1) {
    const apartmentSeed = apartmentSeeds[i];
    const apartment = apartments[apartmentSeed.key];
    const livingRoom = rooms[`${apartmentSeed.key}:PK-01`];
    const masterBedroom = rooms[`${apartmentSeed.key}:PN-01`];
    const balcony = rooms[`${apartmentSeed.key}:BANCONG-01`];

    const deviceSeeds = [
      {
        serialNumber: `${SEED_NAMESPACE}-LOCK-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Khóa cửa ${apartmentSeed.apartmentNumber}`,
        deviceType: 'smart_lock',
        roomId: null,
        locationDescription: 'Cửa chính',
        isControllableByTenant: true,
        status: apartmentSeed.status === 'inactive' ? 'inactive' : 'active',
      },
      {
        serialNumber: `${SEED_NAMESPACE}-THERMO-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Điều khiển điều hòa ${apartmentSeed.apartmentNumber}`,
        deviceType: 'thermostat',
        roomId: livingRoom?.id ?? null,
        locationDescription: 'Phòng khách',
        isControllableByTenant: true,
        status:
          apartmentSeed.status === 'maintenance' ? 'maintenance' : 'active',
      },
      {
        serialNumber: `${SEED_NAMESPACE}-LIGHT-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Đèn phòng khách ${apartmentSeed.apartmentNumber}`,
        deviceType: 'light',
        roomId: livingRoom?.id ?? null,
        locationDescription: 'Trần phòng khách',
        isControllableByTenant: true,
        status: apartmentSeed.status === 'inactive' ? 'inactive' : 'active',
      },
      {
        serialNumber: `${SEED_NAMESPACE}-CAM-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Camera cửa ${apartmentSeed.apartmentNumber}`,
        deviceType: 'camera',
        roomId: null,
        locationDescription: 'Trước cửa căn hộ',
        isControllableByTenant: false,
        status: apartmentSeed.status === 'inactive' ? 'inactive' : 'active',
      },
    ];

    if (extraPremiumApartments.has(apartmentSeed.key)) {
      deviceSeeds.push({
        serialNumber: `${SEED_NAMESPACE}-DOORBELL-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Chuông hình ${apartmentSeed.apartmentNumber}`,
        deviceType: 'doorbell',
        roomId: null,
        locationDescription: 'Bảng gọi cửa',
        isControllableByTenant: true,
        status: 'active',
      });
      deviceSeeds.push({
        serialNumber: `${SEED_NAMESPACE}-SENSOR-${String(i + 1).padStart(3, '0')}`,
        deviceName: `Cảm biến cửa sổ ${apartmentSeed.apartmentNumber}`,
        deviceType: 'sensor',
        roomId: balcony?.id ?? masterBedroom?.id ?? null,
        locationDescription: 'Khu cửa sổ chính',
        isControllableByTenant: false,
        status: 'active',
      });
    }

    for (const [deviceIndex, deviceSeed] of deviceSeeds.entries()) {
      await ensureRecord(
        prisma.ioTDevice,
        { serialNumber: deviceSeed.serialNumber },
        {
          deviceName: deviceSeed.deviceName,
          deviceType: deviceSeed.deviceType,
          brand: deviceSeed.deviceType === 'smart_lock' ? 'Aqara' : 'HomeIQ',
          model: `SEED-${deviceSeed.deviceType.toUpperCase()}-${String(deviceIndex + 1).padStart(2, '0')}`,
          serialNumber: deviceSeed.serialNumber,
          macAddress: `AA:BB:CC:${String(i + 10).padStart(2, '0')}:${String(deviceIndex + 10).padStart(2, '0')}:01`,
          apartmentId: apartment.id,
          roomId: deviceSeed.roomId,
          locationDescription: deviceSeed.locationDescription,
          firmwareVersion: '1.4.2',
          status: deviceSeed.status,
          isControllableByTenant: deviceSeed.isControllableByTenant,
          lastOnlineAt:
            deviceSeed.status === 'inactive'
              ? addDays(REFERENCE_NOW, -90)
              : addDays(REFERENCE_NOW, -(deviceIndex + 1)),
          lastMaintenanceDate: addMonths(REFERENCE_NOW, -3),
          nextMaintenanceDate: addMonths(REFERENCE_NOW, 3),
          installationDate: addMonths(REFERENCE_NOW, -12),
          warrantyExpiryDate: addMonths(REFERENCE_NOW, 24),
          configuration: {
            boardId: iotBoards[apartmentSeed.key].id,
            apartmentNumber: apartmentSeed.apartmentNumber,
            autoReconnect: true,
          },
          accessLogsEnabled: true,
          notes: `Thiết bị mẫu phục vụ kiểm thử luồng IoT của ${apartmentSeed.apartmentNumber}.`,
        },
      );
    }
  }

  console.log('Tạo hợp tác partner và hợp đồng thuê...');

  const partnerCooperationSeeds = [
    [
      'PCC',
      'apartment-01',
      'partner-01',
      'operator-01',
      'active',
      '2025-12-01',
      '2026-12-31',
      10,
    ],
    [
      'PCC',
      'apartment-02',
      'partner-02',
      'operator-01',
      'active',
      '2026-01-01',
      '2027-01-31',
      10,
    ],
    [
      'PCC',
      'apartment-03',
      'partner-02',
      'operator-02',
      'active',
      '2026-02-01',
      '2027-02-28',
      10,
    ],
    [
      'PCC',
      'apartment-04',
      'partner-03',
      'operator-02',
      'pending',
      '2026-04-01',
      '2027-03-31',
      10,
    ],
    [
      'PCC',
      'apartment-05',
      'partner-04',
      'operator-03',
      'active',
      '2025-11-01',
      '2026-10-31',
      10,
    ],
    [
      'PCC',
      'apartment-06',
      'partner-05',
      'operator-01',
      'active',
      '2026-01-15',
      '2027-01-14',
      10,
    ],
    [
      'PCC',
      'apartment-07',
      'partner-05',
      'operator-04',
      'signed',
      '2026-04-01',
      '2027-03-31',
      10,
    ],
    [
      'PCC',
      'apartment-08',
      'partner-06',
      'operator-02',
      'active',
      '2026-01-10',
      '2027-01-09',
      10,
    ],
    [
      'PCC',
      'apartment-09',
      'partner-03',
      'operator-03',
      'expired',
      '2025-01-01',
      '2025-12-31',
      10,
    ],
    [
      'PCC',
      'apartment-10',
      'partner-04',
      'operator-01',
      'active',
      '2026-02-01',
      '2027-01-31',
      10,
    ],
    [
      'PCC',
      'apartment-11',
      'partner-06',
      'operator-04',
      'active',
      '2026-03-01',
      '2027-02-28',
      10,
    ],
    [
      'PCC',
      'apartment-12',
      'partner-01',
      'operator-03',
      'terminated',
      '2025-06-01',
      '2026-05-31',
      10,
    ],
  ] as const;

  for (let i = 0; i < partnerCooperationSeeds.length; i += 1) {
    const [
      ,
      apartmentKey,
      partnerKey,
      operatorKey,
      status,
      startDate,
      endDate,
      rate,
    ] = partnerCooperationSeeds[i];

    await ensureRecord(
      prisma.partnerCooperationContract,
      { contractNumber: `SEED-PCC-2026-${String(i + 1).padStart(4, '0')}` },
      {
        contractNumber: `SEED-PCC-2026-${String(i + 1).padStart(4, '0')}`,
        apartmentId: apartments[apartmentKey].id,
        partnerId: partners[partnerKey].id,
        approvedByOperatorId: operators[operatorKey].id,
        startDate: localDate(startDate),
        endDate: localDate(endDate),
        commissionRate: decimal(rate),
        status,
        signedAt: localDate(startDate),
        contractDocumentUrl: `/seed-documents/cooperation-${i + 1}.pdf`,
        terms:
          'HomeIQ quản lý khai thác, thu hộ tiền thuê và vận hành trải nghiệm cư dân theo thỏa thuận.',
        notes: `Hợp tác mẫu ${SEED_NAMESPACE} cho căn ${apartments[apartmentKey].apartmentNumber}.`,
      },
    );
  }

  const contractSeeds = [
    {
      key: 'contract-01',
      contractNumber: 'SEED-HD-2026-0001',
      apartmentKey: 'apartment-01',
      tenantKeys: [
        {
          key: 'tenant-01',
          memberType: 'primary',
          sharePercentage: 70,
          accessLevel: 'full',
          moveInDate: '2026-01-01',
          status: 'active',
        },
        {
          key: 'tenant-02',
          memberType: 'co_tenant',
          sharePercentage: 30,
          accessLevel: 'limited',
          moveInDate: '2026-01-01',
          status: 'active',
        },
      ],
      monthlyRent: 18_500_000,
      depositAmount: 37_000_000,
      startDate: '2026-01-01',
      endDate: '2026-12-31',
      paymentDueDay: 5,
      paymentMethod: 'bank_transfer',
      status: 'active',
      category: 'normal',
      signedDate: '2025-12-22',
      createdByStaffKey: 'staff-02',
    },
    {
      key: 'contract-02',
      contractNumber: 'SEED-HD-2026-0002',
      apartmentKey: 'apartment-02',
      tenantKeys: [
        {
          key: 'tenant-03',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2026-02-01',
          status: 'active',
        },
      ],
      monthlyRent: 32_000_000,
      depositAmount: 64_000_000,
      startDate: '2026-02-01',
      endDate: '2027-01-31',
      paymentDueDay: 3,
      paymentMethod: 'bank_transfer',
      status: 'active',
      category: 'normal',
      signedDate: '2026-01-20',
      createdByStaffKey: 'staff-06',
    },
    {
      key: 'contract-03',
      contractNumber: 'SEED-HD-2026-0003',
      apartmentKey: 'apartment-04',
      tenantKeys: [
        {
          key: 'tenant-04',
          memberType: 'primary',
          sharePercentage: 60,
          accessLevel: 'full',
          moveInDate: '2026-05-01',
          status: 'active',
        },
        {
          key: 'tenant-05',
          memberType: 'co_tenant',
          sharePercentage: 40,
          accessLevel: 'full',
          moveInDate: '2026-05-01',
          status: 'active',
        },
      ],
      monthlyRent: 26_000_000,
      depositAmount: 52_000_000,
      startDate: '2026-05-01',
      endDate: '2027-04-30',
      paymentDueDay: 10,
      paymentMethod: 'credit_card',
      status: 'pending',
      category: 'normal',
      signedDate: null,
      createdByStaffKey: 'staff-08',
    },
    {
      key: 'contract-04',
      contractNumber: 'SEED-HD-2025-0004',
      apartmentKey: 'apartment-06',
      tenantKeys: [
        {
          key: 'tenant-06',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2025-04-01',
          status: 'active',
        },
      ],
      monthlyRent: 26_500_000,
      depositAmount: 53_000_000,
      startDate: '2025-04-01',
      endDate: '2026-03-31',
      paymentDueDay: 5,
      paymentMethod: 'bank_transfer',
      status: 'renewed',
      category: 'normal',
      signedDate: '2025-03-25',
      createdByStaffKey: 'staff-02',
    },
    {
      key: 'contract-05',
      contractNumber: 'SEED-HD-2026-0005',
      apartmentKey: 'apartment-06',
      tenantKeys: [
        {
          key: 'tenant-06',
          memberType: 'primary',
          sharePercentage: 80,
          accessLevel: 'full',
          moveInDate: '2026-04-01',
          status: 'active',
        },
        {
          key: 'tenant-07',
          memberType: 'co_tenant',
          sharePercentage: 20,
          accessLevel: 'limited',
          moveInDate: '2026-04-01',
          status: 'active',
        },
      ],
      monthlyRent: 27_500_000,
      depositAmount: 55_000_000,
      startDate: '2026-04-01',
      endDate: '2027-03-31',
      paymentDueDay: 5,
      paymentMethod: 'auto_debit',
      status: 'active',
      category: 'renewal',
      renewedFromKey: 'contract-04',
      signedDate: '2026-03-20',
      createdByStaffKey: 'staff-02',
    },
    {
      key: 'contract-06',
      contractNumber: 'SEED-HD-2026-0006',
      apartmentKey: 'apartment-07',
      tenantKeys: [
        {
          key: 'tenant-08',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2026-05-10',
          status: 'active',
        },
      ],
      monthlyRent: 24_000_000,
      depositAmount: 48_000_000,
      startDate: '2026-05-10',
      endDate: '2027-05-09',
      paymentDueDay: 8,
      paymentMethod: 'bank_transfer',
      status: 'signed',
      category: 'normal',
      signedDate: '2026-04-18',
      createdByStaffKey: 'staff-08',
    },
    {
      key: 'contract-07',
      contractNumber: 'SEED-HD-2026-0007',
      apartmentKey: 'apartment-08',
      tenantKeys: [
        {
          key: 'tenant-09',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2026-01-15',
          status: 'active',
        },
        {
          key: 'tenant-10',
          memberType: 'guarantor',
          sharePercentage: 0,
          accessLevel: 'view_only',
          moveInDate: null,
          status: 'inactive',
        },
      ],
      monthlyRent: 23_500_000,
      depositAmount: 47_000_000,
      startDate: '2026-01-15',
      endDate: '2027-01-14',
      paymentDueDay: 7,
      paymentMethod: 'bank_transfer',
      status: 'active',
      category: 'normal',
      signedDate: '2026-01-10',
      createdByStaffKey: 'staff-06',
    },
    {
      key: 'contract-08',
      contractNumber: 'SEED-HD-2025-0008',
      apartmentKey: 'apartment-09',
      tenantKeys: [
        {
          key: 'tenant-11',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2025-01-01',
          status: 'moved_out',
        },
      ],
      monthlyRent: 16_500_000,
      depositAmount: 33_000_000,
      startDate: '2025-01-01',
      endDate: '2025-12-31',
      paymentDueDay: 1,
      paymentMethod: 'cash',
      status: 'expired',
      category: 'normal',
      signedDate: '2024-12-18',
      createdByStaffKey: 'staff-04',
    },
    {
      key: 'contract-09',
      contractNumber: 'SEED-HD-2026-0009',
      apartmentKey: 'apartment-10',
      tenantKeys: [
        {
          key: 'tenant-12',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2026-02-20',
          status: 'active',
        },
      ],
      monthlyRent: 20_500_000,
      depositAmount: 41_000_000,
      startDate: '2026-02-20',
      endDate: '2027-02-19',
      paymentDueDay: 12,
      paymentMethod: 'debit_card',
      status: 'active',
      category: 'normal',
      signedDate: '2026-02-10',
      createdByStaffKey: 'staff-02',
    },
    {
      key: 'contract-10',
      contractNumber: 'SEED-HD-2026-0010',
      apartmentKey: 'apartment-11',
      tenantKeys: [
        {
          key: 'tenant-13',
          memberType: 'primary',
          sharePercentage: 60,
          accessLevel: 'full',
          moveInDate: '2026-03-15',
          status: 'active',
        },
        {
          key: 'tenant-14',
          memberType: 'co_tenant',
          sharePercentage: 40,
          accessLevel: 'full',
          moveInDate: '2026-03-15',
          status: 'active',
        },
      ],
      monthlyRent: 35_000_000,
      depositAmount: 70_000_000,
      startDate: '2026-03-15',
      endDate: '2027-03-14',
      paymentDueDay: 10,
      paymentMethod: 'credit_card',
      status: 'active',
      category: 'normal',
      signedDate: '2026-03-08',
      createdByStaffKey: 'staff-08',
    },
    {
      key: 'contract-11',
      contractNumber: 'SEED-HD-2025-0011',
      apartmentKey: 'apartment-05',
      tenantKeys: [
        {
          key: 'tenant-15',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: '2025-05-01',
          status: 'moved_out',
        },
      ],
      monthlyRent: 18_500_000,
      depositAmount: 37_000_000,
      startDate: '2025-05-01',
      endDate: '2026-04-10',
      paymentDueDay: 5,
      paymentMethod: 'bank_transfer',
      status: 'terminated',
      category: 'normal',
      signedDate: '2025-04-20',
      createdByStaffKey: 'staff-03',
      terminationDate: '2026-04-10',
      terminationReason: 'Chấm dứt trước hạn để bảo trì toàn bộ hệ thống điện.',
      earlyTerminationFee: 5_000_000,
    },
    {
      key: 'contract-12',
      contractNumber: 'SEED-HD-2026-0012',
      apartmentKey: 'apartment-03',
      tenantKeys: [
        {
          key: 'tenant-16',
          memberType: 'primary',
          sharePercentage: 100,
          accessLevel: 'full',
          moveInDate: null,
          status: 'inactive',
        },
      ],
      monthlyRent: 21_000_000,
      depositAmount: 42_000_000,
      startDate: '2026-06-01',
      endDate: '2027-05-31',
      paymentDueDay: 5,
      paymentMethod: 'bank_transfer',
      status: 'draft',
      category: 'normal',
      signedDate: null,
      createdByStaffKey: 'staff-06',
    },
  ];

  for (const contractSeed of contractSeeds) {
    const apartmentSeed = apartmentSeeds.find(
      (candidate) => candidate.key === contractSeed.apartmentKey,
    )!;
    const owner = partners[apartmentSeed.ownerKey];
    const ownerIdentity = userIdentities[apartmentSeed.ownerKey];

    contracts[contractSeed.key] = await ensureRecord(
      prisma.rentalContract,
      { contractNumber: contractSeed.contractNumber },
      {
        contractNumber: contractSeed.contractNumber,
        apartmentId: apartments[contractSeed.apartmentKey].id,
        startDate: localDate(contractSeed.startDate),
        endDate: localDate(contractSeed.endDate),
        monthlyRent: decimal(contractSeed.monthlyRent),
        depositAmount: decimal(contractSeed.depositAmount),
        paymentDueDay: contractSeed.paymentDueDay,
        paymentMethod: contractSeed.paymentMethod,
        utilitiesIncluded: [{ code: 'phi-quan-ly', label: 'Phí quản lý' }],
        utilitiesCharges: [
          { code: 'dien', label: 'Điện', unit: 'kWh' },
          { code: 'nuoc', label: 'Nước', unit: 'm3' },
        ],
        contractTerms:
          'Bên thuê sử dụng căn hộ đúng mục đích, thanh toán đầy đủ và phối hợp với HomeIQ trong mọi hoạt động vận hành, bảo trì, bàn giao.',
        specialConditions:
          'Hợp đồng mẫu phục vụ kiểm thử đầy đủ các luồng thanh toán, bàn giao, bảo trì và notification.',
        landlordName: owner.fullName,
        landlordIdNumber: ownerIdentity?.nationalId ?? seedNationalId(999),
        landlordIdIssueDate: ownerIdentity?.issueDate ?? '01/01/2024',
        landlordIdIssuePlace:
          'Cục Cảnh sát quản lý hành chính về trật tự xã hội',
        landlordAddress: owner.address,
        landlordPhone: owner.phone,
        status: contractSeed.status,
        category: contractSeed.category,
        renewedFromContractId: contractSeed.renewedFromKey
          ? (contracts[contractSeed.renewedFromKey]?.id ?? null)
          : null,
        signedDate: contractSeed.signedDate
          ? localDate(contractSeed.signedDate)
          : null,
        contractDocumentUrl: `/seed-contracts/${contractSeed.contractNumber.toLowerCase()}.pdf`,
        terminationDate: contractSeed.terminationDate
          ? localDate(contractSeed.terminationDate)
          : null,
        terminationReason: contractSeed.terminationReason ?? null,
        earlyTerminationFee: contractSeed.earlyTerminationFee
          ? decimal(contractSeed.earlyTerminationFee)
          : null,
        createdByStaffId: staffMembers[contractSeed.createdByStaffKey].id,
      },
    );
  }

  for (const contractSeed of contractSeeds) {
    const contract = contracts[contractSeed.key];

    for (const memberSeed of contractSeed.tenantKeys) {
      await ensureRecord(
        prisma.userContractMember,
        {
          userId: tenants[memberSeed.key].id,
          rentalContractId: contract.id,
        },
        {
          userId: tenants[memberSeed.key].id,
          rentalContractId: contract.id,
          memberType: memberSeed.memberType,
          isPrimaryContact: memberSeed.memberType === 'primary',
          moveInDate: memberSeed.moveInDate
            ? localDate(memberSeed.moveInDate)
            : null,
          notificationEnabled: true,
          accessLevel: memberSeed.accessLevel,
          sharePercentage: decimal(memberSeed.sharePercentage),
          status: memberSeed.status,
        },
      );
    }
  }

  const userApartmentSeeds = [
    [
      'contract-01',
      'tenant-01',
      true,
      'active',
      '654321',
      'VG-1805',
      '180501',
      'MB-1805',
      'PARK-1805',
      'HOMEIQ-S1-1805',
      'S1.12@2026',
    ],
    [
      'contract-01',
      'tenant-02',
      false,
      'active',
      '654321',
      'VG-1805',
      '180502',
      'MB-1805',
      'PARK-1805B',
      'HOMEIQ-S1-1805',
      'S1.12@2026',
    ],
    [
      'contract-02',
      'tenant-03',
      true,
      'active',
      '743210',
      'LM-2208',
      '220801',
      'MB-2208',
      'PARK-2208',
      'HOMEIQ-LR-2208',
      'Lumiere@2208',
    ],
    [
      'contract-03',
      'tenant-04',
      true,
      'active',
      '862345',
      'EC-1002',
      '100201',
      'MB-1002',
      'PARK-1002',
      'HOMEIQ-EC-1002',
      'Empire@1002',
    ],
    [
      'contract-03',
      'tenant-05',
      false,
      'active',
      '862345',
      'EC-1002',
      '100202',
      'MB-1002',
      'PARK-1002B',
      'HOMEIQ-EC-1002',
      'Empire@1002',
    ],
    [
      'contract-05',
      'tenant-06',
      true,
      'active',
      '567890',
      'SC-1207',
      '120701',
      'MB-1207',
      'PARK-1207',
      'HOMEIQ-SC-1207',
      'Sunrise@1207',
    ],
    [
      'contract-05',
      'tenant-07',
      false,
      'active',
      '567890',
      'SC-1207',
      '120702',
      'MB-1207',
      'PARK-1207B',
      'HOMEIQ-SC-1207',
      'Sunrise@1207',
    ],
    [
      'contract-06',
      'tenant-08',
      true,
      'active',
      '456789',
      'FE-1906',
      '190601',
      'MB-1906',
      'PARK-1906',
      'HOMEIQ-FE-1906',
      'Feliz@1906',
    ],
    [
      'contract-07',
      'tenant-09',
      true,
      'active',
      '321456',
      'GW-1701',
      '170101',
      'MB-1701',
      'PARK-1701',
      'HOMEIQ-GW-1701',
      'Gateway@1701',
    ],
    [
      'contract-08',
      'tenant-11',
      true,
      'moved_out',
      '112233',
      'EH-1104',
      '110401',
      'MB-1104',
      'PARK-1104',
      'HOMEIQ-EH-1104',
      'Estella@1104',
    ],
    [
      'contract-09',
      'tenant-12',
      true,
      'active',
      '908172',
      'NC-0609',
      '060901',
      'MB-0609',
      'PARK-0609',
      'HOMEIQ-NC-0609',
      'NewCity@0609',
    ],
    [
      'contract-10',
      'tenant-13',
      true,
      'active',
      '250304',
      'TM-2010',
      '201001',
      'MB-2010',
      'PARK-2010',
      'HOMEIQ-TM-2010',
      'TheManor@2010',
    ],
    [
      'contract-10',
      'tenant-14',
      false,
      'active',
      '250304',
      'TM-2010',
      '201002',
      'MB-2010',
      'PARK-2010B',
      'HOMEIQ-TM-2010',
      'TheManor@2010',
    ],
    [
      'contract-11',
      'tenant-15',
      true,
      'inactive',
      '778899',
      'SP-0811',
      '081101',
      'MB-0811',
      'PARK-0811',
      'HOMEIQ-SP-0811',
      'SaigonPearl@0811',
    ],
  ] as const;

  for (const userApartmentSeed of userApartmentSeeds) {
    const [
      contractKey,
      tenantKey,
      isPrimaryTenant,
      status,
      apartmentDoorPassword,
      buildingGateCode,
      smartLockPin,
      mailboxCode,
      parkingAccessCode,
      wifiName,
      wifiPassword,
    ] = userApartmentSeed;

    const contract = contracts[contractKey];
    const apartmentKey = contractSeeds.find(
      (candidate) => candidate.key === contractKey,
    )!.apartmentKey;

    await ensureRecord(
      prisma.userApartment,
      {
        userId: tenants[tenantKey].id,
        apartmentId: apartments[apartmentKey].id,
        rentalContractId: contract.id,
      },
      {
        userId: tenants[tenantKey].id,
        apartmentId: apartments[apartmentKey].id,
        rentalContractId: contract.id,
        moveInDate: contract.startDate,
        moveOutDate:
          status === 'moved_out' || status === 'inactive'
            ? contract.endDate
            : null,
        isPrimaryTenant,
        status,
        apartmentDoorPassword,
        buildingGateCode,
        smartLockPin,
        mailboxCode,
        parkingAccessCode,
        wifiName,
        wifiPassword,
        emergencyContactName: tenants[tenantKey].emergencyContactName,
        emergencyContactPhone: tenants[tenantKey].emergencyContactPhone,
        notes: `Gói quyền truy cập mẫu cho ${tenants[tenantKey].fullName}.`,
      },
    );
  }

  console.log('Tạo đồng hồ tiện ích và chỉ số...');

  const meterSeeds = [
    [
      'meter-01',
      'apartment-01',
      'contract-01',
      'electricity',
      'SEED-MTR-E-001',
      1025,
      1138,
      3500,
    ],
    [
      'meter-02',
      'apartment-01',
      'contract-01',
      'water',
      'SEED-MTR-W-001',
      125,
      141,
      18000,
    ],
    [
      'meter-03',
      'apartment-02',
      'contract-02',
      'electricity',
      'SEED-MTR-E-002',
      820,
      968,
      3800,
    ],
    [
      'meter-04',
      'apartment-02',
      'contract-02',
      'water',
      'SEED-MTR-W-002',
      88,
      101,
      19000,
    ],
    [
      'meter-05',
      'apartment-04',
      'contract-03',
      'electricity',
      'SEED-MTR-E-003',
      240,
      271,
      3800,
    ],
    [
      'meter-06',
      'apartment-04',
      'contract-03',
      'water',
      'SEED-MTR-W-003',
      31,
      36,
      19000,
    ],
    [
      'meter-07',
      'apartment-06',
      'contract-05',
      'electricity',
      'SEED-MTR-E-004',
      1450,
      1588,
      3600,
    ],
    [
      'meter-08',
      'apartment-06',
      'contract-05',
      'water',
      'SEED-MTR-W-004',
      188,
      205,
      18000,
    ],
    [
      'meter-09',
      'apartment-07',
      'contract-06',
      'electricity',
      'SEED-MTR-E-005',
      320,
      351,
      3700,
    ],
    [
      'meter-10',
      'apartment-07',
      'contract-06',
      'water',
      'SEED-MTR-W-005',
      28,
      35,
      18500,
    ],
    [
      'meter-11',
      'apartment-08',
      'contract-07',
      'electricity',
      'SEED-MTR-E-006',
      980,
      1099,
      3600,
    ],
    [
      'meter-12',
      'apartment-08',
      'contract-07',
      'water',
      'SEED-MTR-W-006',
      112,
      126,
      17500,
    ],
    [
      'meter-13',
      'apartment-10',
      'contract-09',
      'electricity',
      'SEED-MTR-E-007',
      745,
      829,
      3550,
    ],
    [
      'meter-14',
      'apartment-10',
      'contract-09',
      'water',
      'SEED-MTR-W-007',
      74,
      82,
      18000,
    ],
    [
      'meter-15',
      'apartment-11',
      'contract-10',
      'electricity',
      'SEED-MTR-E-008',
      1260,
      1419,
      3900,
    ],
    [
      'meter-16',
      'apartment-11',
      'contract-10',
      'water',
      'SEED-MTR-W-008',
      146,
      163,
      19500,
    ],
    [
      'meter-17',
      'apartment-11',
      'contract-10',
      'internet',
      'SEED-MTR-I-001',
      1,
      1,
      320000,
    ],
    [
      'meter-18',
      'apartment-03',
      'contract-12',
      'electricity',
      'SEED-MTR-E-009',
      112,
      112,
      3700,
    ],
    [
      'meter-19',
      'apartment-05',
      'contract-11',
      'electricity',
      'SEED-MTR-E-010',
      650,
      650,
      3500,
    ],
    [
      'meter-20',
      'apartment-09',
      'contract-08',
      'water',
      'SEED-MTR-W-010',
      59,
      59,
      17500,
    ],
  ] as const;

  for (const meterSeed of meterSeeds) {
    const [
      key,
      apartmentKey,
      ,
      meterType,
      meterNumber,
      previousReading,
      currentReading,
      rate,
    ] = meterSeed;
    meters[key] = await ensureRecord(
      prisma.utilityMeter,
      { meterNumber },
      {
        apartmentId: apartments[apartmentKey].id,
        meterNumber,
        meterType,
        brand: meterType === 'internet' ? 'VNPT' : 'Schneider',
        model: `${meterType.toUpperCase()}-SEED`,
        installationDate: addMonths(REFERENCE_NOW, -14),
        lastInspectionDate: addMonths(REFERENCE_NOW, -2),
        nextInspectionDate: addMonths(REFERENCE_NOW, 10),
        unitOfMeasurement:
          meterType === 'water'
            ? 'm3'
            : meterType === 'internet'
              ? 'gói'
              : 'kWh',
        ratePerUnit: decimal(rate),
        currentReading: decimal(currentReading),
        previousReading: decimal(previousReading),
        readingDate: localDate('2026-04-20'),
        status: apartmentKey === 'apartment-05' ? 'faulty' : 'active',
        isDigital: meterType !== 'water',
        calibrationDate: addMonths(REFERENCE_NOW, -12),
        nextCalibrationDate: addMonths(REFERENCE_NOW, 12),
        notes: `Đồng hồ mẫu ${meterType} cho ${apartments[apartmentKey].apartmentNumber}.`,
      },
    );
  }

  const readingMonths = [
    localDate('2026-02-28'),
    localDate('2026-03-31'),
    localDate('2026-04-20'),
  ];

  for (let meterIndex = 0; meterIndex < meterSeeds.length; meterIndex += 1) {
    const [
      key,
      ,
      contractKey,
      meterType,
      meterNumber,
      previousReading,
      currentReading,
    ] = meterSeeds[meterIndex];
    const meter = meters[key];
    const contract = contracts[contractKey];
    const step =
      meterType === 'electricity'
        ? 42 + (meterIndex % 4) * 8
        : meterType === 'water'
          ? 5 + (meterIndex % 3)
          : 0;
    const startReading =
      meterType === 'internet' ? 1 : Math.max(previousReading - step, 0);

    for (
      let monthIndex = 0;
      monthIndex < readingMonths.length;
      monthIndex += 1
    ) {
      const previousValue =
        meterType === 'internet' ? 1 : startReading + step * monthIndex;
      const readingValue =
        meterType === 'internet'
          ? 1
          : monthIndex === readingMonths.length - 1
            ? currentReading
            : previousValue + step;

      await ensureRecord(
        prisma.utilityReading,
        {
          utilityMeterId: meter.id,
          readingDate: readingMonths[monthIndex],
          notes: `${SEED_NAMESPACE}-${meterNumber}-${monthIndex + 1}`,
        },
        {
          utilityMeterId: meter.id,
          rentalContractId: contract?.id ?? null,
          readingDate: readingMonths[monthIndex],
          readingValue: decimal(readingValue),
          previousReadingValue: decimal(previousValue),
          consumption: decimal(
            meterType === 'internet' ? 1 : readingValue - previousValue,
          ),
          readingType: monthIndex === 1 ? 'automatic' : 'manual',
          readByStaffId: staffMembers['staff-01'].id,
          images:
            meterType === 'internet'
              ? []
              : [`/seed-meters/${meterNumber}-${monthIndex + 1}.jpg`],
          notes: `${SEED_NAMESPACE}-${meterNumber}-${monthIndex + 1}`,
          isVerified: monthIndex !== 2,
          verifiedByStaffId:
            monthIndex !== 2 ? staffMembers['staff-03'].id : null,
          verifiedAt:
            monthIndex !== 2 ? addDays(readingMonths[monthIndex], 1) : null,
        },
      );
    }
  }

  console.log('Tạo contact request, booking, reservation và lịch hẹn...');

  const contactRequestSeeds = [
    [
      'contact-01',
      'guest-01',
      'apartment-03',
      'operator-01',
      'new',
      'website',
      '2026-04-20T09:00:00+07:00',
      'Cần căn 2 phòng ngủ gần Metro.',
      18_000_000,
      23_000_000,
      2,
    ],
    [
      'contact-02',
      'guest-02',
      'apartment-04',
      'operator-02',
      'contacted',
      'website',
      '2026-04-18T14:00:00+07:00',
      'Ưu tiên căn có bàn làm việc riêng.',
      24_000_000,
      30_000_000,
      2,
    ],
    [
      'contact-03',
      'guest-03',
      'apartment-07',
      'operator-04',
      'scheduled',
      'mobile_app',
      '2026-04-16T11:00:00+07:00',
      'Muốn nhận nhà trong tháng sau.',
      22_000_000,
      26_000_000,
      2,
    ],
    [
      'contact-04',
      'guest-04',
      'apartment-11',
      'operator-04',
      'converted',
      'referral',
      '2026-03-02T10:00:00+07:00',
      'Tìm căn 3 phòng ngủ cho nhóm chuyên gia.',
      32_000_000,
      38_000_000,
      3,
    ],
    [
      'contact-05',
      'guest-05',
      'apartment-01',
      'operator-01',
      'converted',
      'social_media',
      '2025-12-10T09:00:00+07:00',
      'Quan tâm căn hộ có trường học gần đó.',
      17_000_000,
      20_000_000,
      3,
    ],
    [
      'contact-06',
      'guest-06',
      'apartment-06',
      'operator-03',
      'converted',
      'website',
      '2026-03-10T15:00:00+07:00',
      'Cần căn gia đình ở lâu dài.',
      25_000_000,
      29_000_000,
      4,
    ],
    [
      'contact-07',
      'guest-07',
      'apartment-08',
      'operator-02',
      'converted',
      'walk_in',
      '2026-01-02T13:00:00+07:00',
      'Khách đến xem trực tiếp và muốn giữ căn.',
      22_000_000,
      24_000_000,
      2,
    ],
    [
      'contact-08',
      'guest-08',
      'apartment-10',
      'operator-01',
      'converted',
      'mobile_app',
      '2026-02-05T16:00:00+07:00',
      'Cần căn 2 phòng ngủ gần khu làm việc.',
      19_000_000,
      22_000_000,
      3,
    ],
    [
      'contact-09',
      'guest-09',
      'apartment-05',
      'operator-03',
      'lost',
      'website',
      '2026-04-01T10:30:00+07:00',
      'Khách đổi kế hoạch chuyển nhà.',
      18_000_000,
      22_000_000,
      2,
    ],
    [
      'contact-10',
      'guest-10',
      'apartment-09',
      'operator-02',
      'spam',
      'social_media',
      '2026-03-28T08:45:00+07:00',
      'Thông tin không hợp lệ, không thể liên hệ lại.',
      15_000_000,
      17_000_000,
      1,
    ],
    [
      'contact-11',
      'guest-11',
      'apartment-03',
      'operator-01',
      'scheduled',
      'website',
      '2026-04-19T13:15:00+07:00',
      'Muốn xem căn vào cuối tuần.',
      20_000_000,
      24_000_000,
      2,
    ],
    [
      'contact-12',
      'guest-12',
      'apartment-12',
      'operator-03',
      'contacted',
      'referral',
      '2026-04-17T17:10:00+07:00',
      'Quan tâm căn đang chuẩn bị nâng cấp.',
      25_000_000,
      28_000_000,
      2,
    ],
  ] as const;

  for (const contactSeed of contactRequestSeeds) {
    const [
      key,
      guestKey,
      apartmentKey,
      operatorKey,
      status,
      source,
      receivedAt,
      message,
      budgetMin,
      budgetMax,
      occupants,
    ] = contactSeed;

    contactRequests[key] = await ensureRecord(
      prisma.contactRequest,
      {
        email: guests[guestKey].email,
        phone: guests[guestKey].phone,
        receivedAt: localDateTime(receivedAt),
      },
      {
        guestId: guests[guestKey].id,
        apartmentId: apartments[apartmentKey].id,
        fullName: guests[guestKey].fullName,
        email: guests[guestKey].email,
        phone: guests[guestKey].phone,
        preferredMoveInDate: addDays(localDateTime(receivedAt), 20),
        message,
        budgetRangeMin: decimal(budgetMin),
        budgetRangeMax: decimal(budgetMax),
        numberOfOccupants: occupants,
        preferredContactMethod: occupants % 2 === 0 ? 'phone' : 'email',
        preferredContactTime: '18:00 - 21:00',
        source,
        utmSource: source,
        utmCampaign: `${SEED_NAMESPACE.toLowerCase()}-leads`,
        status,
        assignedToOperatorId: operators[operatorKey].id,
        receivedAt: localDateTime(receivedAt),
        firstContactedAt:
          status === 'new' || status === 'spam'
            ? null
            : addDays(localDateTime(receivedAt), 1),
        notes: `Lead mẫu ${SEED_NAMESPACE} cho ${apartments[apartmentKey].apartmentNumber}.`,
      },
    );
  }

  const bookingRequestSeeds = [
    [
      'booking-01',
      'guest-05',
      'apartment-01',
      'contact-05',
      'approved',
      '2026-01-01',
      '2026-12-31',
      3,
      222_000_000,
      37_000_000,
      'Gia đình 2 người lớn và 1 trẻ nhỏ.',
      'operator-01',
      '2025-12-20T10:00:00+07:00',
      'contract-01',
    ],
    [
      'booking-02',
      'guest-04',
      'apartment-11',
      'contact-04',
      'approved',
      '2026-03-15',
      '2027-03-14',
      3,
      420_000_000,
      70_000_000,
      'Cần hợp đồng song ngữ cho chuyên gia nước ngoài.',
      'operator-04',
      '2026-03-08T11:00:00+07:00',
      'contract-10',
    ],
    [
      'booking-03',
      'guest-06',
      'apartment-06',
      'contact-06',
      'approved',
      '2026-04-01',
      '2027-03-31',
      4,
      330_000_000,
      55_000_000,
      'Yêu cầu bổ sung bộ lọc nước tại bếp.',
      'operator-03',
      '2026-03-20T09:30:00+07:00',
      'contract-05',
    ],
    [
      'booking-04',
      'guest-07',
      'apartment-08',
      'contact-07',
      'approved',
      '2026-01-15',
      '2027-01-14',
      2,
      282_000_000,
      47_000_000,
      'Ưu tiên nhận nhà ngay sau thanh toán.',
      'operator-02',
      '2026-01-10T16:00:00+07:00',
      'contract-07',
    ],
    [
      'booking-05',
      'guest-08',
      'apartment-10',
      'contact-08',
      'approved',
      '2026-02-20',
      '2027-02-19',
      3,
      246_000_000,
      41_000_000,
      'Cần hỗ trợ đăng ký chỗ đậu ô tô.',
      'operator-01',
      '2026-02-10T10:00:00+07:00',
      'contract-09',
    ],
    [
      'booking-06',
      'guest-02',
      'apartment-04',
      'contact-02',
      'pending',
      '2026-05-01',
      '2027-04-30',
      2,
      312_000_000,
      52_000_000,
      'Khách đang chờ phê duyệt tài chính.',
      null,
      null,
      null,
    ],
    [
      'booking-07',
      'guest-03',
      'apartment-07',
      'contact-03',
      'approved',
      '2026-05-10',
      '2027-05-09',
      2,
      288_000_000,
      48_000_000,
      'Khách muốn thêm điều khoản nuôi thú cưng.',
      'operator-04',
      '2026-04-18T13:00:00+07:00',
      'contract-06',
    ],
    [
      'booking-08',
      'guest-01',
      'apartment-03',
      'contact-01',
      'rejected',
      '2026-05-05',
      '2027-05-04',
      2,
      252_000_000,
      42_000_000,
      'Hồ sơ tài chính chưa đạt yêu cầu tối thiểu.',
      'operator-01',
      '2026-04-21T17:30:00+07:00',
      null,
    ],
    [
      'booking-09',
      'guest-11',
      'apartment-03',
      'contact-11',
      'cancelled',
      '2026-05-15',
      '2027-05-14',
      2,
      252_000_000,
      42_000_000,
      'Khách đổi kế hoạch chuyển công tác.',
      'operator-01',
      '2026-04-20T12:00:00+07:00',
      null,
    ],
    [
      'booking-10',
      'guest-12',
      'apartment-12',
      'contact-12',
      'expired',
      '2026-06-01',
      '2027-05-31',
      2,
      318_000_000,
      53_000_000,
      'Căn đang chờ nâng cấp nên booking hết hạn tự động.',
      'operator-03',
      '2026-04-19T18:00:00+07:00',
      null,
    ],
  ] as const;

  for (let i = 0; i < bookingRequestSeeds.length; i += 1) {
    const [
      key,
      guestKey,
      apartmentKey,
      contactKey,
      status,
      desiredStartDate,
      desiredEndDate,
      numberOfOccupants,
      totalAmount,
      depositAmount,
      specialRequests,
      operatorKey,
      approvedAt,
      createdContractKey,
    ] = bookingRequestSeeds[i];

    bookingRequests[key] = await ensureRecord(
      prisma.bookingRequest,
      {
        apartmentId: apartments[apartmentKey].id,
        desiredStartDate: localDate(desiredStartDate),
        guestId: guests[guestKey].id,
      },
      {
        guestId: guests[guestKey].id,
        apartmentId: apartments[apartmentKey].id,
        contactRequestId: contactRequests[contactKey].id,
        desiredStartDate: localDate(desiredStartDate),
        desiredEndDate: localDate(desiredEndDate),
        numberOfOccupants,
        totalAmount: decimal(totalAmount),
        depositAmount: decimal(depositAmount),
        specialRequests,
        identificationDocuments: [
          { type: 'cccd', url: `/seed-bookings/cccd-${i + 1}.jpg` },
        ],
        employmentVerification: {
          company: `Công ty mẫu ${i + 1}`,
          position: 'Nhân viên văn phòng',
          monthlyIncome: 30_000_000 + i * 2_000_000,
        },
        status,
        rejectionReason:
          status === 'rejected'
            ? 'Thu nhập ròng chưa đáp ứng chính sách duyệt hồ sơ.'
            : null,
        approvedByOperatorId: operatorKey ? operators[operatorKey].id : null,
        approvedAt: approvedAt ? localDateTime(approvedAt) : null,
        createdRentalContractId: createdContractKey
          ? contracts[createdContractKey].id
          : null,
      },
    );
  }

  const reservationSeeds = [
    [
      'reservation-01',
      'tenant-01',
      'apartment-01',
      'contract-01',
      'confirmed',
      '2026-01-01',
      '2026-12-31',
      3,
      'Chuyển đổi từ lead gia đình.',
      '2025-12-28',
    ],
    [
      'reservation-02',
      'tenant-04',
      'apartment-04',
      'contract-03',
      'confirmed',
      '2026-05-01',
      '2027-04-30',
      2,
      'Đặt giữ chỗ sau khi xem nhà lần 2.',
      '2026-04-25',
    ],
    [
      'reservation-03',
      'tenant-08',
      'apartment-07',
      'contract-06',
      'confirmed',
      '2026-05-10',
      '2027-05-09',
      2,
      'Đặt chỗ cho căn có nuôi thú cưng.',
      '2026-04-18',
    ],
    [
      'reservation-04',
      'tenant-12',
      'apartment-10',
      'contract-09',
      'confirmed',
      '2026-02-20',
      '2027-02-19',
      3,
      'Đặt chỗ nhận nhà cuối tháng 2.',
      '2026-02-12',
    ],
    [
      'reservation-05',
      'tenant-16',
      'apartment-03',
      'contract-12',
      'pending',
      '2026-06-01',
      '2027-05-31',
      2,
      'Chờ hoàn thiện hồ sơ thanh toán đợt đầu.',
      '2026-04-30',
    ],
    [
      'reservation-06',
      'tenant-17',
      'apartment-09',
      null,
      'cancelled',
      '2026-05-01',
      '2027-04-30',
      1,
      'Khách đổi sang khu vực khác gần nơi làm việc.',
      '2026-04-21',
    ],
    [
      'reservation-07',
      'tenant-18',
      'apartment-03',
      null,
      'expired',
      '2026-05-20',
      '2027-05-19',
      2,
      'Hết hạn vì khách không xác nhận cọc đúng hạn.',
      '2026-04-20',
    ],
    [
      'reservation-08',
      'tenant-03',
      'apartment-02',
      null,
      'pending',
      '2027-02-01',
      '2028-01-31',
      2,
      'Dự phòng gia hạn thêm 1 năm sau khi hết hợp đồng hiện tại.',
      '2026-04-22',
    ],
  ] as const;

  for (const reservationSeed of reservationSeeds) {
    const [
      key,
      tenantKey,
      apartmentKey,
      createdContractKey,
      status,
      desiredStartDate,
      desiredEndDate,
      occupants,
      specialRequests,
      expiresAt,
    ] = reservationSeed;

    reservations[key] = await ensureRecord(
      prisma.reservation,
      {
        userId: tenants[tenantKey].id,
        apartmentId: apartments[apartmentKey].id,
        desiredStartDate: localDate(desiredStartDate),
      },
      {
        userId: tenants[tenantKey].id,
        apartmentId: apartments[apartmentKey].id,
        createdContractId: createdContractKey
          ? contracts[createdContractKey].id
          : null,
        desiredStartDate: localDate(desiredStartDate),
        desiredEndDate: localDate(desiredEndDate),
        numberOfOccupants: occupants,
        specialRequests,
        status,
        cancelReason:
          status === 'cancelled' ? 'Khách xác nhận không tiếp tục thuê.' : null,
        expiresAt: localDate(expiresAt),
      },
    );
  }

  const appointmentSeeds = [
    [
      'appointment-01',
      'guest-01',
      'apartment-03',
      'contact-01',
      'staff-02',
      '2026-04-26',
      '2026-04-26T09:00:00+07:00',
      'physical_viewing',
      'scheduled',
      null,
    ],
    [
      'appointment-02',
      'guest-02',
      'apartment-04',
      'contact-02',
      'staff-06',
      '2026-04-23',
      '2026-04-23T19:00:00+07:00',
      'virtual_tour',
      'confirmed',
      null,
    ],
    [
      'appointment-03',
      'guest-03',
      'apartment-07',
      'contact-03',
      'staff-08',
      '2026-04-18',
      '2026-04-18T10:00:00+07:00',
      'physical_viewing',
      'completed',
      'booked',
    ],
    [
      'appointment-04',
      'guest-04',
      'apartment-11',
      'contact-04',
      'staff-08',
      '2026-03-05',
      '2026-03-05T15:00:00+07:00',
      'physical_viewing',
      'completed',
      'booked',
    ],
    [
      'appointment-05',
      'guest-05',
      'apartment-01',
      'contact-05',
      'staff-02',
      '2025-12-14',
      '2025-12-14T10:30:00+07:00',
      'physical_viewing',
      'completed',
      'booked',
    ],
    [
      'appointment-06',
      'guest-06',
      'apartment-06',
      'contact-06',
      'staff-04',
      '2026-03-14',
      '2026-03-14T16:00:00+07:00',
      'physical_viewing',
      'completed',
      'booked',
    ],
    [
      'appointment-07',
      'guest-07',
      'apartment-08',
      'contact-07',
      'staff-02',
      '2026-01-05',
      '2026-01-05T18:30:00+07:00',
      'consultation',
      'completed',
      'interested',
    ],
    [
      'appointment-08',
      'guest-08',
      'apartment-10',
      'contact-08',
      'staff-06',
      '2026-02-08',
      '2026-02-08T11:00:00+07:00',
      'physical_viewing',
      'completed',
      'booked',
    ],
    [
      'appointment-09',
      'guest-09',
      'apartment-05',
      'contact-09',
      'staff-03',
      '2026-04-03',
      '2026-04-03T14:00:00+07:00',
      'physical_viewing',
      'cancelled',
      null,
    ],
    [
      'appointment-10',
      'guest-10',
      'apartment-09',
      'contact-10',
      'staff-04',
      '2026-03-29',
      '2026-03-29T09:30:00+07:00',
      'consultation',
      'no_show',
      null,
    ],
    [
      'appointment-11',
      'guest-11',
      'apartment-03',
      'contact-11',
      'staff-02',
      '2026-04-27',
      '2026-04-27T16:30:00+07:00',
      'physical_viewing',
      'scheduled',
      null,
    ],
    [
      'appointment-12',
      'guest-12',
      'apartment-12',
      'contact-12',
      'staff-03',
      '2026-04-24',
      '2026-04-24T14:30:00+07:00',
      'consultation',
      'confirmed',
      null,
    ],
  ] as const;

  for (const appointmentSeed of appointmentSeeds) {
    const [
      key,
      guestKey,
      apartmentKey,
      contactKey,
      staffKey,
      appointmentDate,
      appointmentTime,
      type,
      status,
      outcome,
    ] = appointmentSeed;

    appointments[key] = await ensureRecord(
      prisma.appointment,
      {
        apartmentId: apartments[apartmentKey].id,
        assignedStaffId: staffMembers[staffKey].id,
        appointmentTime: localDateTime(appointmentTime),
      },
      {
        guestId: guests[guestKey].id,
        apartmentId: apartments[apartmentKey].id,
        contactRequestId: contactRequests[contactKey].id,
        assignedStaffId: staffMembers[staffKey].id,
        appointmentDate: localDate(appointmentDate),
        appointmentTime: localDateTime(appointmentTime),
        durationMinutes: type === 'consultation' ? 30 : 45,
        meetingLocation:
          type === 'virtual_tour'
            ? 'Google Meet'
            : `Sảnh chính ${apartments[apartmentKey].buildingName}`,
        type,
        status,
        guestNotes:
          'Khách muốn được tư vấn kỹ về chi phí quản lý và tiện ích tòa nhà.',
        staffNotes: `Lịch hẹn mẫu ${SEED_NAMESPACE} cho căn ${apartments[apartmentKey].apartmentNumber}.`,
        outcome,
        followupRequired: status !== 'completed' || outcome === 'interested',
        reminderSentAt:
          status === 'scheduled' || status === 'confirmed'
            ? addDays(localDateTime(appointmentTime), -1)
            : null,
        cancelledAt:
          status === 'cancelled'
            ? addDays(localDateTime(appointmentTime), -1)
            : null,
        cancellationReason:
          status === 'cancelled' ? 'Khách xin dời lịch do bận công tác.' : null,
      },
    );
  }

  console.log('Tạo yêu cầu bảo trì và công việc vận hành...');

  const maintenanceSeeds = [
    [
      'maintenance-01',
      'tenant-01',
      'contract-01',
      'apartment-01',
      'PN-01',
      'hvac',
      'Điều hòa phòng ngủ chính làm lạnh yếu',
      'medium',
      '2026-04-24',
      '18:00-20:00',
      'submitted',
    ],
    [
      'maintenance-02',
      'tenant-03',
      'contract-02',
      'apartment-02',
      'PK-01',
      'electrical',
      'Đèn trần phòng khách chập chờn',
      'high',
      '2026-04-23',
      '09:00-11:00',
      'scheduled',
    ],
    [
      'maintenance-03',
      'tenant-06',
      'contract-05',
      'apartment-06',
      'BEP-01',
      'plumbing',
      'Bồn rửa bếp thoát nước chậm',
      'medium',
      '2026-04-22',
      '14:00-16:00',
      'acknowledged',
    ],
    [
      'maintenance-04',
      'tenant-08',
      'contract-06',
      'apartment-07',
      'PK-01',
      'appliance',
      'Máy giặt báo lỗi khi vắt',
      'low',
      '2026-04-26',
      '10:00-12:00',
      'submitted',
    ],
    [
      'maintenance-05',
      'tenant-09',
      'contract-07',
      'apartment-08',
      'PN-01',
      'electrical',
      'Khóa cửa thông minh báo pin yếu',
      'medium',
      '2026-04-21',
      '18:00-20:00',
      'completed',
    ],
    [
      'maintenance-06',
      'tenant-12',
      'contract-09',
      'apartment-10',
      'WC-01',
      'plumbing',
      'Vòi sen rò rỉ nước liên tục',
      'medium',
      '2026-04-25',
      '08:00-10:00',
      'in_progress',
    ],
    [
      'maintenance-07',
      'tenant-13',
      'contract-10',
      'apartment-11',
      'PK-01',
      'other',
      'Camera cửa không hiển thị trên ứng dụng',
      'high',
      '2026-04-22',
      '19:00-21:00',
      'submitted',
    ],
    [
      'maintenance-08',
      'tenant-14',
      'contract-10',
      'apartment-11',
      'BANCONG-01',
      'structural',
      'Cửa lùa ban công đóng không khít',
      'medium',
      '2026-04-27',
      '15:00-17:00',
      'scheduled',
    ],
    [
      'maintenance-09',
      'tenant-15',
      'contract-11',
      'apartment-05',
      'PK-01',
      'structural',
      'Kiểm tra tường bị thấm trước khi bàn giao bảo trì',
      'high',
      '2026-04-08',
      '09:00-11:00',
      'completed',
    ],
    [
      'maintenance-10',
      'tenant-07',
      'contract-05',
      'apartment-06',
      'WC-02',
      'plumbing',
      'Lavabo bị rò đường ống dưới chân',
      'low',
      '2026-04-29',
      '17:00-19:00',
      'submitted',
    ],
  ] as const;

  for (let i = 0; i < maintenanceSeeds.length; i += 1) {
    const [
      key,
      tenantKey,
      contractKey,
      apartmentKey,
      roomNumber,
      category,
      title,
      urgency,
      preferredDate,
      preferredTimeSlot,
      status,
    ] = maintenanceSeeds[i];

    maintenanceRequests[key] = await ensureRecord(
      prisma.maintenanceRequest,
      {
        userId: tenants[tenantKey].id,
        apartmentId: apartments[apartmentKey].id,
        title,
      },
      {
        userId: tenants[tenantKey].id,
        rentalContractId: contracts[contractKey].id,
        apartmentId: apartments[apartmentKey].id,
        roomId: rooms[`${apartmentKey}:${roomNumber}`]?.id ?? null,
        category,
        title,
        description: `${title}. Yêu cầu được tiếp nhận trong bộ dữ liệu mẫu ${SEED_NAMESPACE}.`,
        urgency,
        images: [`/seed-maintenance/${key}-01.jpg`],
        preferredDate: localDate(preferredDate),
        preferredTimeSlot,
        isTenantPresentRequired: i % 2 === 0,
        status,
        completionImages:
          status === 'completed' ? [`/seed-maintenance/${key}-done.jpg`] : [],
        completionNotes:
          status === 'completed'
            ? 'Đã xử lý xong và xác nhận vận hành ổn định.'
            : null,
        tenantRating: status === 'completed' ? 5 - (i % 2) : null,
        tenantFeedback:
          status === 'completed'
            ? 'Phản hồi nhanh, kỹ thuật viên lịch sự.'
            : null,
        costEstimate: decimal(250_000 + i * 80_000),
        actualCost:
          status === 'completed' ? decimal(220_000 + i * 75_000) : null,
        costCoveredBy:
          status === 'completed' ? (i % 3 === 0 ? 'tenant' : 'landlord') : null,
        completedAt:
          status === 'completed' ? addDays(localDate(preferredDate), 1) : null,
      },
    );
  }

  const generalTaskSeeds = [
    [
      'task-01',
      'Kiểm tra tình trạng căn chưa khai thác',
      'inspection',
      'high',
      'assigned',
      'staff-04',
      'operator-03',
      'apartment-12',
      '2026-04-24',
      '2026-04-24T09:00:00+07:00',
      'Kiểm tra tiến độ nâng cấp nội thất và cập nhật ngày mở bán lại.',
    ],
    [
      'task-02',
      'Gọi lại lead web cuối tuần',
      'followup',
      'medium',
      'pending',
      'staff-06',
      'operator-01',
      'apartment-03',
      '2026-04-23',
      '2026-04-23T18:00:00+07:00',
      'Nhắc khách xác nhận lịch xem căn Masteri Thảo Điền.',
    ],
    [
      'task-03',
      'Bàn giao bộ mã truy cập căn reserve',
      'delivery',
      'high',
      'assigned',
      'staff-08',
      'operator-04',
      'apartment-04',
      '2026-04-29',
      '2026-04-29T14:00:00+07:00',
      'Chuẩn bị thẻ, wifi, mã cửa và checklist bàn giao.',
    ],
    [
      'task-04',
      'Tổng kiểm tra thiết bị IoT quý 2',
      'maintenance',
      'medium',
      'in_progress',
      'staff-05',
      'operator-03',
      'apartment-11',
      '2026-04-22',
      '2026-04-22T13:30:00+07:00',
      'Kiểm tra camera, khóa cửa, chuông hình và cảm biến.',
    ],
    [
      'task-05',
      'Dọn dẹp căn trống để chụp hình lại',
      'cleaning',
      'low',
      'pending',
      'staff-07',
      'operator-02',
      'apartment-09',
      '2026-04-25',
      '2026-04-25T08:00:00+07:00',
      'Làm mới hình ảnh listing cho căn còn trống.',
    ],
    [
      'task-06',
      'Xác minh hồ sơ khách đặt thuê mới',
      'general',
      'urgent',
      'assigned',
      'staff-02',
      'operator-01',
      'apartment-03',
      '2026-04-22',
      '2026-04-22T17:00:00+07:00',
      'Kiểm tra hồ sơ thu nhập, CCCD và lịch sử thuê nhà.',
    ],
  ] as const;

  for (const taskSeed of generalTaskSeeds) {
    const [
      key,
      title,
      taskType,
      priority,
      status,
      staffKey,
      operatorKey,
      apartmentKey,
      scheduledDate,
      scheduledTime,
      description,
    ] = taskSeed;

    tasks[key] = await ensureRecord(
      prisma.task,
      {
        title,
        apartmentId: apartments[apartmentKey].id,
        scheduledDate: localDate(scheduledDate),
      },
      {
        title,
        description,
        taskType,
        priority,
        status,
        assignedToStaffId: staffMembers[staffKey].id,
        assignedByOperatorId: operators[operatorKey].id,
        apartmentId: apartments[apartmentKey].id,
        relatedEntityType: taskType === 'followup' ? 'contact_request' : null,
        relatedEntityId:
          taskType === 'followup' ? contactRequests['contact-11'].id : null,
        scheduledDate: localDate(scheduledDate),
        scheduledTime: localDateTime(scheduledTime),
        estimatedDurationMins: taskType === 'inspection' ? 60 : 45,
        requiresFollowup: taskType === 'followup',
        followupDate:
          taskType === 'followup' ? addDays(localDate(scheduledDate), 2) : null,
      },
    );
  }

  for (let i = 0; i < maintenanceSeeds.length; i += 1) {
    const maintenanceKey = maintenanceSeeds[i][0];
    const maintenance = maintenanceRequests[maintenanceKey];
    const apartmentKey = maintenanceSeeds[i][3];

    const taskTitle = `Xử lý bảo trì: ${maintenance.title}`;
    const task = await ensureRecord(
      prisma.task,
      {
        title: taskTitle,
        apartmentId: apartments[apartmentKey].id,
        scheduledDate: maintenance.preferredDate ?? localDate('2026-04-22'),
      },
      {
        title: taskTitle,
        description: `Task kỹ thuật cho yêu cầu ${maintenance.title}.`,
        taskType: 'maintenance',
        priority:
          maintenance.urgency === 'high'
            ? 'high'
            : maintenance.urgency === 'emergency'
              ? 'urgent'
              : 'medium',
        status:
          maintenance.status === 'completed'
            ? 'completed'
            : maintenance.status === 'in_progress'
              ? 'in_progress'
              : maintenance.status === 'scheduled'
                ? 'assigned'
                : 'pending',
        assignedToStaffId:
          i % 2 === 0
            ? staffMembers['staff-01'].id
            : staffMembers['staff-03'].id,
        assignedByOperatorId:
          i % 2 === 0
            ? operators['operator-01'].id
            : operators['operator-03'].id,
        apartmentId: apartments[apartmentKey].id,
        relatedEntityType: 'maintenance_request',
        relatedEntityId: maintenance.id,
        scheduledDate: maintenance.preferredDate,
        scheduledTime: maintenance.preferredDate,
        estimatedDurationMins: 90,
        actualStartTime:
          maintenance.status === 'completed' ||
          maintenance.status === 'in_progress'
            ? maintenance.preferredDate
            : null,
        actualEndTime:
          maintenance.status === 'completed'
            ? addDays(maintenance.preferredDate ?? REFERENCE_NOW, 0)
            : null,
        completionNotes:
          maintenance.status === 'completed'
            ? 'Đã hoàn tất theo checklist kỹ thuật.'
            : null,
        requiresFollowup: maintenance.status !== 'completed',
      },
    );

    tasks[`${maintenanceKey}-task`] = task;

    maintenanceRequests[maintenanceKey] = await ensureRecord(
      prisma.maintenanceRequest,
      {
        userId: maintenance.userId,
        apartmentId: maintenance.apartmentId,
        title: maintenance.title,
      },
      {
        userId: maintenance.userId,
        rentalContractId: maintenance.rentalContractId,
        apartmentId: maintenance.apartmentId,
        roomId: maintenance.roomId,
        category: maintenance.category,
        title: maintenance.title,
        description: maintenance.description,
        urgency: maintenance.urgency,
        images: maintenance.images,
        preferredDate: maintenance.preferredDate,
        preferredTimeSlot: maintenance.preferredTimeSlot,
        isTenantPresentRequired: maintenance.isTenantPresentRequired,
        status: maintenance.status,
        assignedTaskId: task.id,
        completionImages: maintenance.completionImages,
        completionNotes: maintenance.completionNotes,
        tenantRating: maintenance.tenantRating,
        tenantFeedback: maintenance.tenantFeedback,
        costEstimate: maintenance.costEstimate,
        actualCost: maintenance.actualCost,
        costCoveredBy: maintenance.costCoveredBy,
        completedAt: maintenance.completedAt,
      },
    );
  }

  console.log('Tạo hóa đơn, thanh toán và đối soát partner...');

  const invoiceSeeds = [
    [
      'invoice-01',
      'SEED-INV-DEP-202601-0001',
      'contract-01',
      'deposit',
      '2026-01',
      '2025-12-22',
      '2026-01-05',
      0,
      37_000_000,
      'paid',
      'bank_transfer',
      37_000_000,
      'Tiền đặt cọc ban đầu cho căn S1.12-1805',
    ],
    [
      'invoice-02',
      'SEED-INV-RENT-202603-0002',
      'contract-01',
      'rent',
      '2026-03',
      '2026-03-01',
      '2026-03-05',
      18_500_000,
      0,
      'paid',
      'bank_transfer',
      19_420_000,
      'Tiền thuê tháng 03/2026 kèm phí quản lý',
    ],
    [
      'invoice-03',
      'SEED-INV-UTILITY-202603-0003',
      'contract-01',
      'utility',
      '2026-03',
      '2026-03-25',
      '2026-03-30',
      0,
      0,
      'paid',
      'bank_transfer',
      683_000,
      'Tiền điện nước tháng 03/2026',
    ],
    [
      'invoice-04',
      'SEED-INV-RENT-202604-0004',
      'contract-01',
      'rent',
      '2026-04',
      '2026-04-01',
      '2026-04-05',
      18_500_000,
      0,
      'issued',
      'bank_transfer',
      19_420_000,
      'Tiền thuê tháng 04/2026',
    ],
    [
      'invoice-05',
      'SEED-INV-DEP-202602-0005',
      'contract-02',
      'deposit',
      '2026-02',
      '2026-01-20',
      '2026-02-03',
      0,
      64_000_000,
      'paid',
      'bank_transfer',
      64_000_000,
      'Tiền đặt cọc căn Lumiere Riverside',
    ],
    [
      'invoice-06',
      'SEED-INV-RENT-202604-0006',
      'contract-02',
      'rent',
      '2026-04',
      '2026-04-01',
      '2026-04-03',
      32_000_000,
      0,
      'partially_paid',
      'bank_transfer',
      33_250_000,
      'Tiền thuê tháng 04/2026',
    ],
    [
      'invoice-07',
      'SEED-INV-UTILITY-202604-0007',
      'contract-02',
      'utility',
      '2026-04',
      '2026-04-20',
      '2026-04-25',
      0,
      0,
      'sent',
      'bank_transfer',
      1_108_000,
      'Tiền điện nước tháng 04/2026',
    ],
    [
      'invoice-08',
      'SEED-INV-CDEP-202605-0008',
      'contract-03',
      'contractDeposit',
      '2026-05',
      '2026-04-18',
      '2026-04-28',
      0,
      52_000_000,
      'sent',
      'credit_card',
      52_000_000,
      'Đặt cọc giữ chỗ trước khi kích hoạt hợp đồng',
    ],
    [
      'invoice-09',
      'SEED-INV-RENT-202604-0009',
      'contract-05',
      'rent',
      '2026-04',
      '2026-04-01',
      '2026-04-05',
      27_500_000,
      0,
      'paid',
      'auto_debit',
      28_430_000,
      'Tiền thuê tháng đầu của hợp đồng gia hạn',
    ],
    [
      'invoice-10',
      'SEED-INV-UTILITY-202604-0010',
      'contract-05',
      'utility',
      '2026-04',
      '2026-04-20',
      '2026-04-25',
      0,
      0,
      'paid',
      'auto_debit',
      801_000,
      'Tiền điện nước tháng 04/2026',
    ],
    [
      'invoice-11',
      'SEED-INV-SERVICE-202604-0011',
      'contract-05',
      'service',
      '2026-04',
      '2026-04-12',
      '2026-04-18',
      0,
      0,
      'issued',
      'bank_transfer',
      450_000,
      'Phí làm thẻ xe bổ sung',
    ],
    [
      'invoice-12',
      'SEED-INV-CDEP-202605-0012',
      'contract-06',
      'contractDeposit',
      '2026-05',
      '2026-04-18',
      '2026-04-28',
      0,
      48_000_000,
      'sent',
      'bank_transfer',
      48_000_000,
      'Đặt cọc hợp đồng đã ký, chờ nhận nhà',
    ],
    [
      'invoice-13',
      'SEED-INV-DEP-202601-0013',
      'contract-07',
      'deposit',
      '2026-01',
      '2026-01-10',
      '2026-01-15',
      0,
      47_000_000,
      'paid',
      'bank_transfer',
      47_000_000,
      'Tiền đặt cọc căn Gateway Thảo Điền',
    ],
    [
      'invoice-14',
      'SEED-INV-RENT-202602-0014',
      'contract-07',
      'rent',
      '2026-02',
      '2026-02-01',
      '2026-02-07',
      23_500_000,
      0,
      'overdue',
      'bank_transfer',
      24_180_000,
      'Tiền thuê tháng 02/2026 quá hạn',
    ],
    [
      'invoice-15',
      'SEED-INV-PENALTY-202602-0015',
      'contract-07',
      'penalty',
      '2026-02',
      '2026-02-15',
      '2026-02-20',
      0,
      0,
      'issued',
      'bank_transfer',
      1_500_000,
      'Phí phạt chậm thanh toán',
    ],
    [
      'invoice-16',
      'SEED-INV-DEP-202602-0016',
      'contract-09',
      'deposit',
      '2026-02',
      '2026-02-10',
      '2026-02-20',
      0,
      41_000_000,
      'paid',
      'debit_card',
      41_000_000,
      'Tiền đặt cọc căn New City',
    ],
    [
      'invoice-17',
      'SEED-INV-RENT-202604-0017',
      'contract-09',
      'rent',
      '2026-04',
      '2026-04-01',
      '2026-04-12',
      20_500_000,
      0,
      'paid',
      'debit_card',
      21_260_000,
      'Tiền thuê tháng 04/2026',
    ],
    [
      'invoice-18',
      'SEED-INV-UTILITY-202604-0018',
      'contract-09',
      'utility',
      '2026-04',
      '2026-04-20',
      '2026-04-25',
      0,
      0,
      'paid',
      'debit_card',
      442_000,
      'Tiền điện nước tháng 04/2026',
    ],
    [
      'invoice-19',
      'SEED-INV-DEP-202603-0019',
      'contract-10',
      'deposit',
      '2026-03',
      '2026-03-08',
      '2026-03-15',
      0,
      70_000_000,
      'paid',
      'credit_card',
      70_000_000,
      'Tiền đặt cọc căn The Manor',
    ],
    [
      'invoice-20',
      'SEED-INV-RENT-202604-0020',
      'contract-10',
      'rent',
      '2026-04',
      '2026-04-01',
      '2026-04-10',
      35_000_000,
      0,
      'issued',
      'credit_card',
      36_480_000,
      'Tiền thuê tháng 04/2026',
    ],
    [
      'invoice-21',
      'SEED-INV-UTILITY-202604-0021',
      'contract-10',
      'utility',
      '2026-04',
      '2026-04-20',
      '2026-04-25',
      0,
      0,
      'sent',
      'credit_card',
      1_550_500,
      'Tiền điện nước và Internet tháng 04/2026',
    ],
    [
      'invoice-22',
      'SEED-INV-PENALTY-202604-0022',
      'contract-11',
      'penalty',
      '2026-04',
      '2026-04-10',
      '2026-04-15',
      0,
      0,
      'cancelled',
      'bank_transfer',
      5_000_000,
      'Phí chấm dứt sớm được miễn sau khi đối chiếu',
    ],
    [
      'invoice-23',
      'SEED-INV-OTHER-202606-0023',
      'contract-12',
      'other',
      '2026-06',
      '2026-04-20',
      '2026-05-05',
      0,
      0,
      'draft',
      'bank_transfer',
      2_000_000,
      'Phí giữ lịch bàn giao dự kiến',
    ],
    [
      'invoice-24',
      'SEED-INV-UTILITY-202604-0024',
      'contract-06',
      'utility',
      '2026-04',
      '2026-04-20',
      '2026-04-25',
      0,
      0,
      'draft',
      'bank_transfer',
      284_500,
      'Ước tính điện nước trước ngày nhận nhà',
    ],
    [
      'invoice-25',
      'SEED-INV-RENT-202604-0025',
      'contract-03',
      'rent',
      '2026-04',
      '2026-04-18',
      '2026-04-28',
      26_000_000,
      0,
      'draft',
      'credit_card',
      26_900_000,
      'Bản nháp tiền thuê sau khi booking chuyển đổi',
    ],
    [
      'invoice-26',
      'SEED-INV-SERVICE-202604-0026',
      'contract-02',
      'service',
      '2026-04',
      '2026-04-11',
      '2026-04-18',
      0,
      0,
      'paid',
      'cash',
      600_000,
      'Phí vệ sinh chuyên sâu trước bàn giao gói nội thất',
    ],
  ] as const;

  for (const invoiceSeed of invoiceSeeds) {
    const [
      key,
      invoiceNumber,
      contractKey,
      invoiceType,
      billingMonth,
      issueDate,
      dueDate,
      baseRent,
      depositAmount,
      status,
      paymentMethod,
      totalAmount,
      notes,
    ] = invoiceSeed;

    const issueDateValue = localDate(issueDate);

    invoices[key] = await ensureRecord(
      prisma.invoice,
      { invoiceNumber },
      {
        invoiceNumber,
        rentalContractId: contracts[contractKey].id,
        invoiceType,
        invoiceContent: {
          title: notes,
          namespace: SEED_NAMESPACE,
        },
        billingMonth,
        billingPeriodStart: monthStart(issueDateValue),
        billingPeriodEnd: monthEnd(issueDateValue),
        issueDate: issueDateValue,
        dueDate: localDate(dueDate),
        baseRent: decimal(baseRent),
        utilityCharges:
          invoiceType === 'utility'
            ? [
                { label: 'Điện', amount: Math.round(totalAmount * 0.7) },
                { label: 'Nước', amount: Math.round(totalAmount * 0.3) },
              ]
            : invoiceType === 'service'
              ? [{ label: 'Dịch vụ', amount: totalAmount }]
              : [],
        additionalCharges:
          invoiceType === 'rent'
            ? [
                {
                  label: 'Phí quản lý',
                  amount: Math.max(totalAmount - baseRent, 0),
                },
              ]
            : invoiceType === 'penalty'
              ? [{ label: 'Phạt vi phạm', amount: totalAmount }]
              : [],
        discounts:
          status === 'cancelled'
            ? [{ label: 'Miễn giảm', amount: totalAmount }]
            : [],
        taxAmount: decimal(0),
        totalAmount: decimal(totalAmount),
        currency: CURRENCY,
        status,
        paymentMethod,
        invoiceDocumentUrl: `/seed-invoices/${invoiceNumber.toLowerCase()}.pdf`,
        notes,
        sentAt: status === 'draft' ? null : addDays(issueDateValue, 1),
        paidAt:
          status === 'paid' || status === 'partially_paid'
            ? addDays(localDate(dueDate), -1)
            : null,
        cancelledAt:
          status === 'cancelled' ? addDays(localDate(dueDate), -2) : null,
        cancellationReason:
          status === 'cancelled'
            ? 'Đã miễn thu sau khi phê duyệt phương án hỗ trợ khách thuê.'
            : null,
      },
    );
  }

  const paymentSeeds = [
    [
      'payment-01',
      'invoice-01',
      'tenant-01',
      'partner-01',
      37_000_000,
      'bank_transfer',
      'completed',
      '2025-12-24T10:00:00+07:00',
      'PAYOS-SEED-0001',
      'Thanh toán cọc ban đầu',
    ],
    [
      'payment-02',
      'invoice-02',
      'tenant-01',
      'partner-01',
      19_420_000,
      'bank_transfer',
      'completed',
      '2026-03-03T10:00:00+07:00',
      'PAYOS-SEED-0002',
      'Thanh toán tiền thuê tháng 03',
    ],
    [
      'payment-03',
      'invoice-03',
      'tenant-01',
      'partner-01',
      683_000,
      'bank_transfer',
      'completed',
      '2026-03-28T09:30:00+07:00',
      'PAYOS-SEED-0003',
      'Thanh toán điện nước tháng 03',
    ],
    [
      'payment-04',
      'invoice-05',
      'tenant-03',
      'partner-02',
      64_000_000,
      'bank_transfer',
      'completed',
      '2026-02-02T11:20:00+07:00',
      'PAYOS-SEED-0004',
      'Thanh toán cọc Lumiere Riverside',
    ],
    [
      'payment-05',
      'invoice-06',
      'tenant-03',
      'partner-02',
      20_000_000,
      'bank_transfer',
      'processing',
      '2026-04-02T08:45:00+07:00',
      'PAYOS-SEED-0005',
      'Đợt thanh toán đầu tiên cho hóa đơn tháng 04',
    ],
    [
      'payment-06',
      'invoice-09',
      'tenant-06',
      'partner-05',
      28_430_000,
      'auto_debit',
      'completed',
      '2026-04-03T05:00:00+07:00',
      'AUTODEBIT-SEED-0006',
      'Thanh toán thuê tháng 04 hợp đồng gia hạn',
    ],
    [
      'payment-07',
      'invoice-10',
      'tenant-06',
      'partner-05',
      801_000,
      'auto_debit',
      'completed',
      '2026-04-24T05:00:00+07:00',
      'AUTODEBIT-SEED-0007',
      'Thanh toán điện nước tháng 04',
    ],
    [
      'payment-08',
      'invoice-13',
      'tenant-09',
      'partner-06',
      47_000_000,
      'bank_transfer',
      'completed',
      '2026-01-12T15:10:00+07:00',
      'PAYOS-SEED-0008',
      'Thanh toán cọc Gateway',
    ],
    [
      'payment-09',
      'invoice-14',
      'tenant-09',
      'partner-06',
      10_000_000,
      'bank_transfer',
      'failed',
      '2026-02-08T17:00:00+07:00',
      'PAYOS-SEED-0009',
      'Giao dịch không đủ số dư',
    ],
    [
      'payment-10',
      'invoice-16',
      'tenant-12',
      'partner-04',
      41_000_000,
      'debit_card',
      'completed',
      '2026-02-18T13:00:00+07:00',
      'PAYOS-SEED-0010',
      'Thanh toán cọc New City',
    ],
    [
      'payment-11',
      'invoice-17',
      'tenant-12',
      'partner-04',
      21_260_000,
      'debit_card',
      'completed',
      '2026-04-10T19:30:00+07:00',
      'PAYOS-SEED-0011',
      'Thanh toán thuê tháng 04',
    ],
    [
      'payment-12',
      'invoice-18',
      'tenant-12',
      'partner-04',
      442_000,
      'debit_card',
      'completed',
      '2026-04-23T20:00:00+07:00',
      'PAYOS-SEED-0012',
      'Thanh toán điện nước tháng 04',
    ],
    [
      'payment-13',
      'invoice-19',
      'tenant-13',
      'partner-06',
      70_000_000,
      'credit_card',
      'completed',
      '2026-03-10T09:10:00+07:00',
      'PAYOS-SEED-0013',
      'Thanh toán cọc The Manor',
    ],
    [
      'payment-14',
      'invoice-26',
      'tenant-03',
      'partner-02',
      600_000,
      'cash',
      'completed',
      '2026-04-12T10:00:00+07:00',
      'CASH-SEED-0014',
      'Thu tiền mặt phí vệ sinh',
    ],
    [
      'payment-15',
      'invoice-15',
      'tenant-09',
      'partner-06',
      1_500_000,
      'bank_transfer',
      'cancelled',
      '2026-02-19T14:00:00+07:00',
      'PAYOS-SEED-0015',
      'Khách khiếu nại và tạm hủy thanh toán',
    ],
    [
      'payment-16',
      'invoice-06',
      'tenant-03',
      'partner-02',
      13_250_000,
      'bank_transfer',
      'refunded',
      '2026-04-04T10:15:00+07:00',
      'PAYOS-SEED-0016',
      'Hoàn tiền phần thu sai sau đối soát',
    ],
  ] as const;

  for (const paymentSeed of paymentSeeds) {
    const [
      ,
      invoiceKey,
      tenantKey,
      partnerKey,
      amount,
      paymentMethod,
      status,
      paymentDate,
      transactionId,
      notes,
    ] = paymentSeed;

    await ensureRecord(
      prisma.payment,
      { paymentReference: transactionId },
      {
        paymentReference: transactionId,
        invoiceId: invoices[invoiceKey].id,
        userId: tenants[tenantKey].id,
        receiverUserId: partners[partnerKey].id,
        amount: decimal(amount),
        currency: CURRENCY,
        paymentMethod,
        paymentGateway:
          paymentMethod === 'cash'
            ? 'cashier'
            : paymentMethod === 'auto_debit'
              ? 'homeiq_auto_debit'
              : 'payos',
        transactionId,
        paymentDate: localDateTime(paymentDate),
        status,
        bankName:
          paymentMethod === 'bank_transfer'
            ? 'Vietcombank'
            : paymentMethod === 'debit_card'
              ? 'Techcombank'
              : paymentMethod === 'credit_card'
                ? 'Sacombank'
                : null,
        accountNumber: paymentMethod === 'cash' ? null : '******1234',
        notes,
        processedByStaffId:
          paymentMethod === 'cash' ? staffMembers['staff-06'].id : null,
        refundAmount: status === 'refunded' ? decimal(amount) : null,
        refundDate:
          status === 'refunded' ? addDays(localDateTime(paymentDate), 2) : null,
        refundReason:
          status === 'refunded'
            ? 'Điều chỉnh lại số tiền sau khi phát hiện thu trùng.'
            : null,
      },
    );
  }

  const payoutSeeds = [
    [
      'payout-01',
      'partner-01',
      '2026-03',
      37_920_000,
      3_223_200,
      34_696_800,
      8.5,
      'paid',
      '2026-04-08',
      'staff-02',
    ],
    [
      'payout-02',
      'partner-02',
      '2026-03',
      97_250_000,
      8_752_500,
      88_497_500,
      9,
      'pending',
      '2026-04-10',
      null,
    ],
    [
      'payout-03',
      'partner-04',
      '2026-03',
      21_702_000,
      2_061_690,
      19_640_310,
      9.5,
      'paid',
      '2026-04-08',
      'staff-04',
    ],
    [
      'payout-04',
      'partner-05',
      '2026-03',
      29_231_000,
      2_923_100,
      26_307_900,
      10,
      'pending',
      '2026-04-12',
      null,
    ],
    [
      'payout-05',
      'partner-06',
      '2026-03',
      71_500_000,
      6_256_250,
      65_243_750,
      8.75,
      'paid',
      '2026-04-09',
      'staff-06',
    ],
    [
      'payout-06',
      'partner-03',
      '2026-03',
      0,
      0,
      0,
      8,
      'cancelled',
      '2026-04-12',
      null,
    ],
  ] as const;

  for (const payoutSeed of payoutSeeds) {
    const [
      ,
      partnerKey,
      payoutMonth,
      grossRevenue,
      commissionAmount,
      payoutAmount,
      effectiveCommissionRate,
      status,
      dueDate,
      confirmedByStaffKey,
    ] = payoutSeed;

    await ensureRecord(
      prisma.partnerMonthlyPayout,
      {
        partnerId: partners[partnerKey].id,
        payoutMonth,
      },
      {
        partnerId: partners[partnerKey].id,
        payoutMonth,
        billingPeriodStart: localDate(`${payoutMonth}-01`),
        billingPeriodEnd: monthEnd(localDate(`${payoutMonth}-01`)),
        dueDate: localDate(dueDate),
        grossRevenue: decimal(grossRevenue),
        commissionAmount: decimal(commissionAmount),
        payoutAmount: decimal(payoutAmount),
        effectiveCommissionRate: decimal(effectiveCommissionRate),
        currency: CURRENCY,
        status,
        transferProofUrl:
          status === 'paid'
            ? `/seed-payouts/${partnerKey}-${payoutMonth}.jpg`
            : null,
        transferReference:
          status === 'paid'
            ? `SEED-TRANSFER-${partnerKey.toUpperCase()}-${payoutMonth.replace('-', '')}`
            : null,
        transferNote:
          status === 'cancelled'
            ? 'Không phát sinh doanh thu do căn chưa khai thác trong kỳ.'
            : 'Đối soát doanh thu mẫu của bộ dữ liệu HomeIQ.',
        confirmedAt: confirmedByStaffKey
          ? addDays(localDate(dueDate), -1)
          : null,
        confirmedByStaffId: confirmedByStaffKey
          ? staffMembers[confirmedByStaffKey].id
          : null,
      },
    );
  }

  const payoutTransferSeeds = payoutSeeds.filter((seed) => seed[7] === 'paid');

  for (const payoutTransferSeed of payoutTransferSeeds) {
    const [
      ,
      partnerKey,
      periodMonth,
      totalGrossAmount,
      totalSystemCommissionAmount,
      totalNetPayoutAmount,
      ,
      ,
      ,
      confirmedByStaffKey,
    ] = payoutTransferSeed;

    await ensureRecord(
      prisma.partnerPayoutTransfer,
      {
        partnerId: partners[partnerKey].id,
        periodMonth,
      },
      {
        partnerId: partners[partnerKey].id,
        periodMonth,
        periodStart: localDate(`${periodMonth}-01`),
        periodEnd: monthEnd(localDate(`${periodMonth}-01`)),
        totalGrossAmount: decimal(totalGrossAmount),
        totalSystemCommissionAmount: decimal(totalSystemCommissionAmount),
        totalNetPayoutAmount: decimal(totalNetPayoutAmount),
        transferProofImageUrl: `/seed-payouts/transfer-${partnerKey}-${periodMonth}.jpg`,
        transferNote: `Xác nhận chuyển khoản đối soát tháng ${periodMonth} cho partner.`,
        confirmedByStaffId: staffMembers[confirmedByStaffKey!].id,
        confirmedAt: addDays(localDate(`${periodMonth}-10`), 0),
      },
    );
  }

  console.log('Tạo đăng ký chờ duyệt, token và OTP...');

  for (let i = 0; i < 6; i += 1) {
    await ensureRecord(
      prisma.pendingGuestRegistration,
      { phone: seedPhone(260 + i) },
      {
        phone: seedPhone(260 + i),
        email: seedEmail('pending', i + 1),
        fullName: `Khách chờ duyệt ${i + 1}`,
        dateOfBirth: addMonths(localDate('1996-01-15'), i),
        nationalId: seedNationalId(300 + i),
        emergencyContactName: `Người thân khách chờ duyệt ${i + 1}`,
        emergencyContactPhone: seedPhone(280 + i),
        notes: 'Hồ sơ đã nhập từ quầy lễ tân và đang chờ OTP xác thực.',
        submittedByStaffId:
          i % 2 === 0
            ? staffMembers['staff-02'].id
            : staffMembers['staff-06'].id,
        status: [
          'pending',
          'otp_sent',
          'verified',
          'completed',
          'expired',
          'cancelled',
        ][i],
        expiresAt: addDays(REFERENCE_NOW, i + 1),
      },
    );
  }

  const tokenActors = [
    { actorType: 'admin', actorId: admins['admin-01'].id },
    { actorType: 'operator', actorId: operators['operator-01'].id },
    { actorType: 'operator', actorId: operators['operator-02'].id },
    { actorType: 'staff', actorId: staffMembers['staff-02'].id },
    { actorType: 'staff', actorId: staffMembers['staff-05'].id },
    { actorType: 'user', actorId: partners['partner-01'].id },
    { actorType: 'user', actorId: partners['partner-06'].id },
    { actorType: 'user', actorId: tenants['tenant-01'].id },
    { actorType: 'user', actorId: tenants['tenant-03'].id },
    { actorType: 'user', actorId: tenants['tenant-06'].id },
    { actorType: 'user', actorId: tenants['tenant-13'].id },
    { actorType: 'user', actorId: tenants['tenant-16'].id },
  ];

  for (let i = 0; i < tokenActors.length; i += 1) {
    const actor = tokenActors[i];

    await ensureRecord(
      prisma.fcmToken,
      { token: `${SEED_NAMESPACE}-FCM-${String(i + 1).padStart(3, '0')}` },
      {
        actorType: actor.actorType,
        actorId: actor.actorId,
        token: `${SEED_NAMESPACE}-FCM-${String(i + 1).padStart(3, '0')}`,
        device: i % 2 === 0 ? 'ios' : 'android',
      },
    );

    await ensureRecord(
      prisma.refreshToken,
      { token: `${SEED_NAMESPACE}-REFRESH-${String(i + 1).padStart(3, '0')}` },
      {
        token: `${SEED_NAMESPACE}-REFRESH-${String(i + 1).padStart(3, '0')}`,
        actorId: actor.actorId,
        actorType: actor.actorType,
        expiresAt: addMonths(REFERENCE_NOW, 1),
        revokedAt: i % 6 === 0 ? addDays(REFERENCE_NOW, -3) : null,
      },
    );
  }

  for (let i = 0; i < 8; i += 1) {
    await ensureRecord(
      prisma.passwordResetToken,
      { token: `${SEED_NAMESPACE}-RESET-${String(i + 1).padStart(3, '0')}` },
      {
        email:
          i < 3
            ? partners[`partner-0${i + 1}`].email
            : tenants[`tenant-${String(i - 2).padStart(2, '0')}`].email,
        token: `${SEED_NAMESPACE}-RESET-${String(i + 1).padStart(3, '0')}`,
        expiresAt: addDays(REFERENCE_NOW, 1),
        isUsed: i % 3 === 0,
        usedAt: i % 3 === 0 ? addDays(REFERENCE_NOW, -1) : null,
      },
    );
  }

  for (let i = 0; i < 10; i += 1) {
    await ensureRecord(
      prisma.otpVerification,
      {
        phone:
          i < 6
            ? seedPhone(260 + i)
            : tenants[`tenant-${String(i - 5).padStart(2, '0')}`].phone,
        code: `${String(135790 + i).slice(-6)}`,
        purpose:
          i % 3 === 0
            ? 'registration'
            : i % 3 === 1
              ? 'password_reset'
              : 'phone_verification',
      },
      {
        phone:
          i < 6
            ? seedPhone(260 + i)
            : tenants[`tenant-${String(i - 5).padStart(2, '0')}`].phone,
        code: `${String(135790 + i).slice(-6)}`,
        purpose:
          i % 3 === 0
            ? 'registration'
            : i % 3 === 1
              ? 'password_reset'
              : 'phone_verification',
        isUsed: i % 4 === 0,
        attempts: i % 3,
        expiresAt: addDays(REFERENCE_NOW, 1),
        usedAt: i % 4 === 0 ? addDays(REFERENCE_NOW, -1) : null,
      },
    );
  }

  console.log('Tạo chat, notification và activity log...');

  const chatConversationSeeds = [
    {
      key: 'chat-01',
      title: 'Tư vấn căn Masteri Thảo Điền',
      userId: null,
      guestSessionId: `${SEED_NAMESPACE}-GUEST-001`,
      guestName: guests['guest-01'].fullName,
      guestEmail: guests['guest-01'].email,
      status: 'active',
      messages: [
        {
          senderType: 'guest',
          senderName: guests['guest-01'].fullName,
          content: 'Cho mình hỏi căn này còn trống không?',
          createdAt: '2026-04-20T09:05:00+07:00',
        },
        {
          senderType: 'staff',
          senderId: staffMembers['staff-02'].id,
          senderName: staffMembers['staff-02'].fullName,
          content: 'Căn vẫn còn trống và có thể xem nhà cuối tuần này.',
          createdAt: '2026-04-20T09:07:00+07:00',
        },
        {
          senderType: 'guest',
          senderName: guests['guest-01'].fullName,
          content: 'Mình muốn đặt lịch xem vào chiều thứ bảy.',
          createdAt: '2026-04-20T09:09:00+07:00',
        },
      ],
    },
    {
      key: 'chat-02',
      title: 'Hỏi về hợp đồng gia hạn',
      userId: tenants['tenant-06'].id,
      guestSessionId: null,
      guestName: null,
      guestEmail: null,
      status: 'active',
      messages: [
        {
          senderType: 'user',
          senderId: tenants['tenant-06'].id,
          senderName: tenants['tenant-06'].fullName,
          content:
            'Tôi muốn hỏi điều khoản gia hạn năm sau có thay đổi gì không?',
          createdAt: '2026-04-15T19:15:00+07:00',
        },
        {
          senderType: 'operator',
          senderId: operators['operator-03'].id,
          senderName: operators['operator-03'].fullName,
          content:
            'Hiện tại chính sách gia hạn giữ nguyên mức phí quản lý trong 6 tháng đầu.',
          createdAt: '2026-04-15T19:17:00+07:00',
        },
        {
          senderType: 'user',
          senderId: tenants['tenant-06'].id,
          senderName: tenants['tenant-06'].fullName,
          content: 'Cảm ơn, tôi sẽ xác nhận trước cuối tháng.',
          createdAt: '2026-04-15T19:18:30+07:00',
        },
      ],
    },
    {
      key: 'chat-03',
      title: 'Yêu cầu hỗ trợ camera cửa',
      userId: tenants['tenant-13'].id,
      guestSessionId: null,
      guestName: null,
      guestEmail: null,
      status: 'active',
      messages: [
        {
          senderType: 'user',
          senderId: tenants['tenant-13'].id,
          senderName: tenants['tenant-13'].fullName,
          content: 'Camera cửa căn của tôi đang mất kết nối.',
          createdAt: '2026-04-22T18:03:00+07:00',
        },
        {
          senderType: 'staff',
          senderId: staffMembers['staff-05'].id,
          senderName: staffMembers['staff-05'].fullName,
          content:
            'Bên em đã tạo ticket kỹ thuật, dự kiến kiểm tra trong tối nay.',
          createdAt: '2026-04-22T18:05:00+07:00',
        },
        {
          senderType: 'system',
          senderName: 'HomeIQ Bot',
          content: 'Yêu cầu bảo trì đã được ghi nhận vào hệ thống.',
          createdAt: '2026-04-22T18:05:10+07:00',
        },
      ],
    },
    {
      key: 'chat-04',
      title: 'Tư vấn căn Empire City',
      userId: null,
      guestSessionId: `${SEED_NAMESPACE}-GUEST-004`,
      guestName: guests['guest-02'].fullName,
      guestEmail: guests['guest-02'].email,
      status: 'closed',
      messages: [
        {
          senderType: 'guest',
          senderName: guests['guest-02'].fullName,
          content: 'Tôi cần căn 1 phòng ngủ có thể dọn vào tháng 5.',
          createdAt: '2026-04-18T14:05:00+07:00',
        },
        {
          senderType: 'staff',
          senderId: staffMembers['staff-06'].id,
          senderName: staffMembers['staff-06'].fullName,
          content:
            'Empire City đang có căn phù hợp, tôi đã gửi brochure cho anh/chị.',
          createdAt: '2026-04-18T14:07:00+07:00',
        },
        {
          senderType: 'guest',
          senderName: guests['guest-02'].fullName,
          content: 'Cảm ơn, tôi sẽ xem và phản hồi trong hôm nay.',
          createdAt: '2026-04-18T14:12:00+07:00',
        },
      ],
    },
    {
      key: 'chat-05',
      title: 'Tư vấn chuyển hợp đồng cho đồng thuê',
      userId: tenants['tenant-14'].id,
      guestSessionId: null,
      guestName: null,
      guestEmail: null,
      status: 'archived',
      messages: [
        {
          senderType: 'user',
          senderId: tenants['tenant-14'].id,
          senderName: tenants['tenant-14'].fullName,
          content:
            'Nếu tôi tạm thời chuyển công tác thì đồng thuê có thể tiếp tục ở một mình không?',
          createdAt: '2026-04-01T08:10:00+07:00',
        },
        {
          senderType: 'operator',
          senderId: operators['operator-04'].id,
          senderName: operators['operator-04'].fullName,
          content:
            'Có thể, nhưng cần làm phụ lục điều chỉnh thành viên hợp đồng.',
          createdAt: '2026-04-01T08:13:00+07:00',
        },
        {
          senderType: 'user',
          senderId: tenants['tenant-14'].id,
          senderName: tenants['tenant-14'].fullName,
          content: 'Tôi đã rõ, cảm ơn HomeIQ.',
          createdAt: '2026-04-01T08:14:30+07:00',
        },
      ],
    },
    {
      key: 'chat-06',
      title: 'Tư vấn căn New City',
      userId: null,
      guestSessionId: `${SEED_NAMESPACE}-GUEST-006`,
      guestName: guests['guest-11'].fullName,
      guestEmail: guests['guest-11'].email,
      status: 'active',
      messages: [
        {
          senderType: 'guest',
          senderName: guests['guest-11'].fullName,
          content: 'Căn này có cho nuôi mèo không?',
          createdAt: '2026-04-19T13:16:00+07:00',
        },
        {
          senderType: 'staff',
          senderId: staffMembers['staff-02'].id,
          senderName: staffMembers['staff-02'].fullName,
          content:
            'Có, căn hộ này áp dụng chính sách thú cưng theo nội quy tòa nhà.',
          createdAt: '2026-04-19T13:18:00+07:00',
        },
        {
          senderType: 'guest',
          senderName: guests['guest-11'].fullName,
          content: 'Vậy tôi muốn xem căn vào chiều chủ nhật.',
          createdAt: '2026-04-19T13:20:00+07:00',
        },
      ],
    },
  ];

  for (const chatConversationSeed of chatConversationSeeds) {
    const lastMessage =
      chatConversationSeed.messages[chatConversationSeed.messages.length - 1];
    const conversationWhere = chatConversationSeed.guestSessionId
      ? { guestSessionId: chatConversationSeed.guestSessionId }
      : {
          userId: chatConversationSeed.userId,
          title: chatConversationSeed.title,
        };
    chatConversations[chatConversationSeed.key] = await ensureRecord(
      prisma.chatConversation,
      conversationWhere,
      {
        title: chatConversationSeed.title,
        userId: chatConversationSeed.userId,
        guestSessionId: chatConversationSeed.guestSessionId,
        guestName: chatConversationSeed.guestName,
        guestEmail: chatConversationSeed.guestEmail,
        status: chatConversationSeed.status,
        lastMessageAt: localDateTime(lastMessage.createdAt),
        lastMessageText: lastMessage.content,
        metadata: { namespace: SEED_NAMESPACE },
      },
    );

    for (const message of chatConversationSeed.messages) {
      await ensureRecord(
        prisma.chatMessage,
        {
          conversationId: chatConversations[chatConversationSeed.key].id,
          content: message.content,
          createdAt: localDateTime(message.createdAt),
        },
        {
          conversationId: chatConversations[chatConversationSeed.key].id,
          senderType: message.senderType,
          senderId: message.senderId ?? null,
          senderName: message.senderName ?? null,
          messageType: 'text',
          content: message.content,
          images: [],
          apartmentId: null,
          attachments: [],
          isRead: message.senderType !== 'guest',
          readAt:
            message.senderType !== 'guest'
              ? localDateTime(message.createdAt)
              : null,
          createdAt: localDateTime(message.createdAt),
        },
      );
    }
  }

  const notificationSeeds = [
    [
      'user',
      tenants['tenant-01'].id,
      'Hóa đơn tháng 04 đã phát hành',
      'Hóa đơn tiền thuê tháng 04/2026 của bạn đã được tạo. Vui lòng thanh toán trước ngày 05/04/2026.',
      'info',
      'push',
      'high',
      '2026-04-01T08:00:00+07:00',
    ],
    [
      'user',
      tenants['tenant-03'].id,
      'Thanh toán một phần đã được ghi nhận',
      'HomeIQ đã ghi nhận khoản thanh toán đầu tiên cho hóa đơn tháng 04/2026. Phần còn lại sẽ tiếp tục được nhắc trước hạn.',
      'reminder',
      'in_app',
      'medium',
      '2026-04-02T12:00:00+07:00',
    ],
    [
      'user',
      tenants['tenant-08'].id,
      'Thông tin căn hộ và mật khẩu cửa',
      'Hợp đồng đã sẵn sàng kích hoạt. Mật khẩu cửa hiện tại của căn là 456789. Vui lòng đổi ngay sau khi nhận nhà.',
      'success',
      'push',
      'high',
      '2026-04-18T18:30:00+07:00',
    ],
    [
      'user',
      tenants['tenant-13'].id,
      'Yêu cầu bảo trì đã tiếp nhận',
      'Kỹ thuật viên đã nhận yêu cầu kiểm tra camera cửa của bạn và sẽ hỗ trợ trong tối nay.',
      'success',
      'in_app',
      'high',
      '2026-04-22T18:10:00+07:00',
    ],
    [
      'user',
      tenants['tenant-14'].id,
      'Lịch bảo trì ban công đã xác nhận',
      'HomeIQ đã xếp lịch kiểm tra cửa lùa ban công vào ngày 27/04/2026.',
      'info',
      'push',
      'medium',
      '2026-04-22T09:00:00+07:00',
    ],
    [
      'staff',
      staffMembers['staff-01'].id,
      'Task kỹ thuật mới',
      'Bạn được phân công xử lý yêu cầu điều hòa phòng ngủ chính của căn S1.12-1805.',
      'info',
      'in_app',
      'high',
      '2026-04-22T08:30:00+07:00',
    ],
    [
      'staff',
      staffMembers['staff-05'].id,
      'Kiểm tra IoT quý 2',
      'Danh sách kiểm tra IoT quý 2 cho căn M3-2010 đã được cập nhật.',
      'warning',
      'push',
      'medium',
      '2026-04-22T09:15:00+07:00',
    ],
    [
      'operator',
      operators['operator-01'].id,
      'Lead mới từ website',
      'Có lead mới quan tâm căn Masteri Thảo Điền với ngân sách 18-23 triệu.',
      'info',
      'in_app',
      'medium',
      '2026-04-20T09:10:00+07:00',
    ],
    [
      'operator',
      operators['operator-04'].id,
      'Booking đã chuyển đổi thành hợp đồng',
      'Booking của khách thuê căn The Manor đã được chuyển thành hợp đồng thành công.',
      'success',
      'push',
      'medium',
      '2026-03-08T13:00:00+07:00',
    ],
    [
      'admin',
      admins['admin-02'].id,
      'Báo cáo seed dữ liệu mẫu',
      'Bộ dữ liệu mẫu tiếng Việt cho toàn hệ thống đã được cập nhật namespace riêng để phục vụ demo và QA.',
      'info',
      'email',
      'low',
      '2026-04-22T20:00:00+07:00',
    ],
    [
      'user',
      partners['partner-01'].id,
      'Đối soát doanh thu tháng 03',
      'Bảng đối soát doanh thu tháng 03/2026 đã sẵn sàng. Vui lòng kiểm tra khoản chuyển về dự kiến.',
      'success',
      'email',
      'medium',
      '2026-04-07T09:00:00+07:00',
    ],
    [
      'user',
      partners['partner-06'].id,
      'Xác nhận chuyển khoản đối soát',
      'Khoản thanh toán đối soát tháng 03/2026 đã được chuyển thành công vào tài khoản của bạn.',
      'success',
      'sms',
      'medium',
      '2026-04-09T15:30:00+07:00',
    ],
  ] as const;

  for (const notificationSeed of notificationSeeds) {
    const [
      recipientType,
      recipientId,
      title,
      message,
      notificationType,
      channel,
      priority,
      sentAt,
    ] = notificationSeed;

    await ensureRecord(
      prisma.notification,
      {
        recipientType,
        recipientId,
        title,
        sentAt: localDateTime(sentAt),
      },
      {
        recipientType,
        recipientId,
        notificationType,
        channel,
        title,
        message,
        actionUrl: '/dashboard',
        actionLabel: 'Xem chi tiết',
        priority,
        isRead: channel === 'email' || channel === 'sms',
        readAt:
          channel === 'email' || channel === 'sms'
            ? localDateTime(sentAt)
            : null,
        sentAt: localDateTime(sentAt),
        deliveryStatus: channel === 'email' ? 'sent' : 'delivered',
        metadata: { namespace: SEED_NAMESPACE },
      },
    );
  }

  const activitySeeds = [
    [
      'user',
      tenants['tenant-01'].id,
      'LOGIN',
      'Session',
      null,
      'Khách thuê đăng nhập thành công trên ứng dụng.',
      'success',
      'ACT-0001',
    ],
    [
      'user',
      tenants['tenant-03'].id,
      'PAY_INVOICE',
      'Invoice',
      invoices['invoice-06'].id,
      'Khách thuê tạo yêu cầu thanh toán một phần.',
      'success',
      'ACT-0002',
    ],
    [
      'user',
      tenants['tenant-13'].id,
      'CREATE_MAINTENANCE_REQUEST',
      'MaintenanceRequest',
      maintenanceRequests['maintenance-07'].id,
      'Tạo yêu cầu bảo trì camera cửa.',
      'success',
      'ACT-0003',
    ],
    [
      'staff',
      staffMembers['staff-02'].id,
      'CREATE_CONTRACT',
      'RentalContract',
      contracts['contract-01'].id,
      'Tạo hợp đồng thuê căn S1.12-1805.',
      'success',
      'ACT-0004',
    ],
    [
      'staff',
      staffMembers['staff-05'].id,
      'SYNC_IOT',
      'IoTDevice',
      null,
      'Đồng bộ board điều khiển và thiết bị căn M3-2010.',
      'success',
      'ACT-0005',
    ],
    [
      'operator',
      operators['operator-01'].id,
      'APPROVE_BOOKING',
      'BookingRequest',
      bookingRequests['booking-01'].id,
      'Phê duyệt booking căn Vinhomes Grand Park.',
      'success',
      'ACT-0006',
    ],
    [
      'operator',
      operators['operator-04'].id,
      'CONVERT_LEAD',
      'ContactRequest',
      contactRequests['contact-04'].id,
      'Chuyển lead The Manor thành booking thành công.',
      'success',
      'ACT-0007',
    ],
    [
      'admin',
      admins['admin-02'].id,
      'APPROVE_POLICY',
      'Policy',
      policies['security-policy'].id,
      'Phê duyệt phiên bản chính sách an ninh.',
      'success',
      'ACT-0008',
    ],
    [
      'user',
      partners['partner-01'].id,
      'VIEW_PAYOUT',
      'PartnerMonthlyPayout',
      null,
      'Partner xem báo cáo đối soát tháng 03.',
      'success',
      'ACT-0009',
    ],
    [
      'staff',
      staffMembers['staff-03'].id,
      'COMPLETE_TASK',
      'Task',
      tasks['maintenance-05-task']?.id ?? null,
      'Hoàn thành kiểm tra pin khóa cửa thông minh.',
      'success',
      'ACT-0010',
    ],
    [
      'user',
      tenants['tenant-09'].id,
      'PAYMENT_FAILED',
      'Payment',
      null,
      'Giao dịch thanh toán tiền thuê thất bại do thiếu số dư.',
      'failure',
      'ACT-0011',
    ],
    [
      'operator',
      operators['operator-03'].id,
      'MARK_APARTMENT_MAINTENANCE',
      'Apartment',
      apartments['apartment-05'].id,
      'Chuyển trạng thái căn sang bảo trì toàn diện.',
      'success',
      'ACT-0012',
    ],
  ] as const;

  for (const activitySeed of activitySeeds) {
    const [
      actorType,
      actorId,
      action,
      entityType,
      entityId,
      description,
      status,
      requestSuffix,
    ] = activitySeed;

    await ensureRecord(
      prisma.activityLog,
      { requestId: `${SEED_NAMESPACE}-${requestSuffix}` },
      {
        actorType,
        actorId,
        action,
        entityType,
        entityId,
        description,
        changes: { namespace: SEED_NAMESPACE },
        ipAddress: '118.70.123.10',
        userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)',
        requestId: `${SEED_NAMESPACE}-${requestSuffix}`,
        status,
        errorMessage:
          status === 'failure'
            ? 'Thanh toán bị từ chối từ cổng thanh toán.'
            : null,
        metadata: { source: 'seed' },
      },
    );
  }

  console.log('Tạo đánh giá căn hộ...');

  const ratingSeeds = [
    [
      'apartment-01',
      'tenant-01',
      'contract-01',
      5,
      'Quy trình bàn giao rõ ràng, ứng dụng hoạt động ổn định.',
    ],
    [
      'apartment-02',
      'tenant-03',
      'contract-02',
      4,
      'Căn rộng và đẹp, phí dịch vụ minh bạch.',
    ],
    [
      'apartment-06',
      'tenant-06',
      'contract-05',
      5,
      'Gia hạn hợp đồng nhanh, hỗ trợ kỹ thuật tốt.',
    ],
    [
      'apartment-08',
      'tenant-09',
      'contract-07',
      4,
      'Khóa cửa thông minh tiện lợi, vị trí thuận tiện.',
    ],
    [
      'apartment-10',
      'tenant-12',
      'contract-09',
      4,
      'Căn hộ sạch, cộng tác viên hỗ trợ nhận nhà chuyên nghiệp.',
    ],
    [
      'apartment-11',
      'tenant-13',
      'contract-10',
      5,
      'Không gian rộng, phù hợp làm việc tại nhà và tiếp khách.',
    ],
  ] as const;

  for (const ratingSeed of ratingSeeds) {
    const [apartmentKey, tenantKey, contractKey, rating, comment] = ratingSeed;
    await ensureRecord(
      prisma.apartmentRating,
      {
        apartmentId: apartments[apartmentKey].id,
        userId: tenants[tenantKey].id,
      },
      {
        apartmentId: apartments[apartmentKey].id,
        userId: tenants[tenantKey].id,
        rentalContractId: contracts[contractKey].id,
        rating,
        comment,
      },
    );
  }

  const summary = {
    admins: adminSeeds.length,
    operators: operatorSeeds.length,
    staff: staffBlueprints.length,
    partners: partnerBlueprints.length,
    tenants: tenantNames.length,
    guests: guestNames.length,
    userIdentities: allUserEntries.length,
    amenities: amenitySeeds.length,
    policies: policySeeds.length,
    apartments: apartmentSeeds.length,
    rooms: roomRecords.length,
    iotBoards: apartmentSeeds.length,
    contracts: contractSeeds.length,
    userApartments: userApartmentSeeds.length,
    utilityMeters: meterSeeds.length,
    utilityReadings: meterSeeds.length * readingMonths.length,
    contactRequests: contactRequestSeeds.length,
    bookingRequests: bookingRequestSeeds.length,
    reservations: reservationSeeds.length,
    appointments: appointmentSeeds.length,
    maintenanceRequests: maintenanceSeeds.length,
    tasks: generalTaskSeeds.length + maintenanceSeeds.length,
    invoices: invoiceSeeds.length,
    payments: paymentSeeds.length,
    partnerMonthlyPayouts: payoutSeeds.length,
    partnerPayoutTransfers: payoutTransferSeeds.length,
    pendingGuestRegistrations: 6,
    fcmTokens: tokenActors.length,
    refreshTokens: tokenActors.length,
    passwordResetTokens: 8,
    otpVerifications: 10,
    chatConversations: chatConversationSeeds.length,
    notifications: notificationSeeds.length,
    activityLogs: activitySeeds.length,
    apartmentRatings: ratingSeeds.length,
  };

  console.log('✅ Hoàn tất seed dữ liệu mẫu.');
  console.log('📊 Tóm tắt dữ liệu đã tạo/cập nhật:');

  for (const [label, value] of Object.entries(summary)) {
    console.log(`   - ${label}: ${value}`);
  }

  console.log('');
  console.log('🔑 Tài khoản mẫu:');
  console.log(`   - Admin: ${seedEmail('admin', 1)} / Admin@123`);
  console.log(`   - Operator: ${seedEmail('operator', 1)} / Operator@123`);
  console.log(`   - Staff: ${seedEmail('staff', 1)} / Staff@123`);
  console.log(`   - Partner: ${seedEmail('partner', 1)} / Partner@123`);
  console.log(`   - User: ${seedEmail('tenant', 1)} / User@123`);
}

main()
  .catch((error) => {
    console.error('❌ Seed thất bại:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
