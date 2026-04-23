require('dotenv/config');

const bcrypt = require('bcrypt');
const { randomUUID } = require('crypto');
const { PrismaPg } = require('@prisma/adapter-pg');
const {
  PrismaClient,
  Prisma,
  AccessLevel,
  ApartmentStatus,
  ContractStatus,
  DepositDisposition,
  FurnishingStatus,
  InvoiceStatus,
  InvoiceType,
  IoTStatus,
  MemberStatus,
  MemberType,
  MeterStatus,
  MeterType,
  PartnerCooperationContractStatus,
  PaymentMethodType,
  PaymentStatus,
  ReadingType,
  RentalContractCategory,
  UserApartmentStatus,
} = require('@prisma/client');
const { Pool } = require('pg');

const databaseUrl =
  process.env.DATABASE_URL ||
  'postgresql://postgres:postgres@localhost:5432/intelliservops?schema=public';

const pool = new Pool({ connectionString: databaseUrl });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });
let invoiceColumnSetPromise;
const DEMO_APARTMENT_ID = 'f278637d-445e-4c07-a6c6-945d584b502f';
const LEGACY_DEMO_BOARD_ID = 'ESP_A101';
const LEGACY_DEMO_COOP_CONTRACT_NUMBER = 'PCC-DEMO-A101-2026';

const DEMO_USER = {
  email: 'userdemo@gmail.com',
  password: 'User@123',
  fullName: 'User Demo',
  phone: '0909000101',
  nationalId: 'DEMO2604240001',
};

const DEMO_CONTRACT = {
  contractNumber: 'CTR-DEMO-A101-202602',
  startDate: localDate('2026-02-01'),
  endDate: localDate('2027-01-31'),
  signedDate: localDate('2026-01-25'),
  monthlyRent: 8500000,
  depositAmount: 17000000,
  paymentDueDay: 5,
};

const DEMO_METERS = {
  electricity: {
    meterNumber: 'DEMO-MTR-E-A101',
    meterType: MeterType.electricity,
    previousReading: 1417,
    currentReading: 1535,
    ratePerUnit: 3800,
    unitOfMeasurement: 'kWh',
  },
  water: {
    meterNumber: 'DEMO-MTR-W-A101',
    meterType: MeterType.water,
    previousReading: 65,
    currentReading: 73,
    ratePerUnit: 18000,
    unitOfMeasurement: 'm3',
  },
};

const DEMO_READING_ROWS = [
  {
    meterKey: 'electricity',
    readingDate: localDate('2026-02-28'),
    previousReadingValue: 1200,
    readingValue: 1305,
    consumption: 105,
    amount: 399000,
  },
  {
    meterKey: 'electricity',
    readingDate: localDate('2026-03-31'),
    previousReadingValue: 1305,
    readingValue: 1417,
    consumption: 112,
    amount: 425600,
  },
  {
    meterKey: 'electricity',
    readingDate: localDate('2026-04-20'),
    previousReadingValue: 1417,
    readingValue: 1535,
    consumption: 118,
    amount: 448400,
  },
  {
    meterKey: 'water',
    readingDate: localDate('2026-02-28'),
    previousReadingValue: 50,
    readingValue: 58,
    consumption: 8,
    amount: 144000,
  },
  {
    meterKey: 'water',
    readingDate: localDate('2026-03-31'),
    previousReadingValue: 58,
    readingValue: 65,
    consumption: 7,
    amount: 126000,
  },
  {
    meterKey: 'water',
    readingDate: localDate('2026-04-20'),
    previousReadingValue: 65,
    readingValue: 73,
    consumption: 8,
    amount: 144000,
  },
];

const DEMO_INVOICES = [
  {
    invoiceNumber: 'INV-DEMO-DEP-A101',
    invoiceType: InvoiceType.contractDeposit,
    billingMonth: '2026-01',
    billingPeriodStart: localDate('2026-01-01'),
    billingPeriodEnd: localDateTime('2026-01-31T23:59:59+07:00'),
    issueDate: localDate('2026-01-25'),
    dueDate: localDate('2026-01-31'),
    baseRent: 0,
    totalAmount: 17000000,
    status: InvoiceStatus.paid,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: localDateTime('2026-01-27T10:15:00+07:00'),
    depositDisposition: DepositDisposition.held,
    invoiceContent: {
      title: 'Contract deposit for demo apartment A101',
      source: 'demo-seed',
    },
    utilityCharges: {},
    additionalCharges: {},
    notes: 'Demo contract deposit invoice.',
  },
  {
    invoiceNumber: 'INV-DEMO-202602-RENT',
    invoiceType: InvoiceType.rent,
    billingMonth: '2026-02',
    billingPeriodStart: localDate('2026-02-01'),
    billingPeriodEnd: localDateTime('2026-02-28T23:59:59+07:00'),
    issueDate: localDate('2026-01-28'),
    dueDate: localDate('2026-02-05'),
    baseRent: 8500000,
    totalAmount: 8500000,
    status: InvoiceStatus.paid,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: localDateTime('2026-02-03T09:00:00+07:00'),
    depositDisposition: null,
    invoiceContent: {
      title: 'Monthly rent February 2026',
      source: 'demo-seed',
    },
    utilityCharges: {},
    additionalCharges: {},
    notes: 'Paid rent invoice for February 2026.',
  },
  {
    invoiceNumber: 'INV-DEMO-202602-UTIL',
    invoiceType: InvoiceType.utility,
    billingMonth: '2026-02',
    billingPeriodStart: localDate('2026-02-01'),
    billingPeriodEnd: localDateTime('2026-02-28T23:59:59+07:00'),
    issueDate: localDate('2026-03-01'),
    dueDate: localDate('2026-03-05'),
    baseRent: 0,
    totalAmount: 543000,
    status: InvoiceStatus.paid,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: localDateTime('2026-03-04T16:10:00+07:00'),
    depositDisposition: null,
    invoiceContent: {
      title: 'Utilities February 2026',
      source: 'demo-seed',
    },
    utilityCharges: buildUtilityCharges({
      electricity: {
        previousReading: 1200,
        currentReading: 1305,
        consumption: 105,
        unit: 'kWh',
        ratePerUnit: 3800,
        amount: 399000,
      },
      water: {
        previousReading: 50,
        currentReading: 58,
        consumption: 8,
        unit: 'm3',
        ratePerUnit: 18000,
        amount: 144000,
      },
    }),
    additionalCharges: {},
    notes: 'Paid utility invoice for February 2026.',
  },
  {
    invoiceNumber: 'INV-DEMO-202603-RENT',
    invoiceType: InvoiceType.rent,
    billingMonth: '2026-03',
    billingPeriodStart: localDate('2026-03-01'),
    billingPeriodEnd: localDateTime('2026-03-31T23:59:59+07:00'),
    issueDate: localDate('2026-02-28'),
    dueDate: localDate('2026-03-05'),
    baseRent: 8500000,
    totalAmount: 8500000,
    status: InvoiceStatus.paid,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: localDateTime('2026-03-03T09:15:00+07:00'),
    depositDisposition: null,
    invoiceContent: {
      title: 'Monthly rent March 2026',
      source: 'demo-seed',
    },
    utilityCharges: {},
    additionalCharges: {},
    notes: 'Paid rent invoice for March 2026.',
  },
  {
    invoiceNumber: 'INV-DEMO-202603-UTIL',
    invoiceType: InvoiceType.utility,
    billingMonth: '2026-03',
    billingPeriodStart: localDate('2026-03-01'),
    billingPeriodEnd: localDateTime('2026-03-31T23:59:59+07:00'),
    issueDate: localDate('2026-04-01'),
    dueDate: localDate('2026-04-05'),
    baseRent: 0,
    totalAmount: 551600,
    status: InvoiceStatus.paid,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: localDateTime('2026-04-04T10:05:00+07:00'),
    depositDisposition: null,
    invoiceContent: {
      title: 'Utilities March 2026',
      source: 'demo-seed',
    },
    utilityCharges: buildUtilityCharges({
      electricity: {
        previousReading: 1305,
        currentReading: 1417,
        consumption: 112,
        unit: 'kWh',
        ratePerUnit: 3800,
        amount: 425600,
      },
      water: {
        previousReading: 58,
        currentReading: 65,
        consumption: 7,
        unit: 'm3',
        ratePerUnit: 18000,
        amount: 126000,
      },
    }),
    additionalCharges: {},
    notes: 'Paid utility invoice for March 2026.',
  },
  {
    invoiceNumber: 'INV-DEMO-202604-RENT',
    invoiceType: InvoiceType.rent,
    billingMonth: '2026-04',
    billingPeriodStart: localDate('2026-04-01'),
    billingPeriodEnd: localDateTime('2026-04-30T23:59:59+07:00'),
    issueDate: localDate('2026-03-28'),
    dueDate: localDate('2026-04-05'),
    baseRent: 8500000,
    totalAmount: 8500000,
    status: InvoiceStatus.overdue,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: null,
    depositDisposition: null,
    invoiceContent: {
      title: 'Monthly rent April 2026',
      source: 'demo-seed',
    },
    utilityCharges: {},
    additionalCharges: {},
    notes: 'Current month rent is still unpaid.',
  },
  {
    invoiceNumber: 'INV-DEMO-202604-UTIL',
    invoiceType: InvoiceType.utility,
    billingMonth: '2026-04',
    billingPeriodStart: localDate('2026-04-01'),
    billingPeriodEnd: localDateTime('2026-04-30T23:59:59+07:00'),
    issueDate: localDate('2026-04-21'),
    dueDate: localDate('2026-04-28'),
    baseRent: 0,
    totalAmount: 592400,
    status: InvoiceStatus.issued,
    paymentMethod: PaymentMethodType.bank_transfer,
    paidAt: null,
    depositDisposition: null,
    invoiceContent: {
      title: 'Utilities April 2026',
      source: 'demo-seed',
    },
    utilityCharges: buildUtilityCharges({
      electricity: {
        previousReading: 1417,
        currentReading: 1535,
        consumption: 118,
        unit: 'kWh',
        ratePerUnit: 3800,
        amount: 448400,
      },
      water: {
        previousReading: 65,
        currentReading: 73,
        consumption: 8,
        unit: 'm3',
        ratePerUnit: 18000,
        amount: 144000,
      },
    }),
    additionalCharges: {},
    notes: 'Current month utility invoice is issued but unpaid.',
  },
];

const DEMO_PAYMENTS = [
  {
    paymentReference: 'PAY-DEMO-DEP-A101',
    invoiceNumber: 'INV-DEMO-DEP-A101',
    amount: 17000000,
    paymentDate: localDateTime('2026-01-27T10:15:00+07:00'),
    transactionId: 'DEMO-TXN-DEP-A101',
    notes: 'Paid contract deposit for demo setup.',
  },
  {
    paymentReference: 'PAY-DEMO-202602-RENT',
    invoiceNumber: 'INV-DEMO-202602-RENT',
    amount: 8500000,
    paymentDate: localDateTime('2026-02-03T09:00:00+07:00'),
    transactionId: 'DEMO-TXN-202602-RENT',
    notes: 'Paid rent for February 2026.',
  },
  {
    paymentReference: 'PAY-DEMO-202602-UTIL',
    invoiceNumber: 'INV-DEMO-202602-UTIL',
    amount: 543000,
    paymentDate: localDateTime('2026-03-04T16:10:00+07:00'),
    transactionId: 'DEMO-TXN-202602-UTIL',
    notes: 'Paid utilities for February 2026.',
  },
  {
    paymentReference: 'PAY-DEMO-202603-RENT',
    invoiceNumber: 'INV-DEMO-202603-RENT',
    amount: 8500000,
    paymentDate: localDateTime('2026-03-03T09:15:00+07:00'),
    transactionId: 'DEMO-TXN-202603-RENT',
    notes: 'Paid rent for March 2026.',
  },
  {
    paymentReference: 'PAY-DEMO-202603-UTIL',
    invoiceNumber: 'INV-DEMO-202603-UTIL',
    amount: 551600,
    paymentDate: localDateTime('2026-04-04T10:05:00+07:00'),
    transactionId: 'DEMO-TXN-202603-UTIL',
    notes: 'Paid utilities for March 2026.',
  },
];

function decimal(value) {
  return new Prisma.Decimal(value);
}

function localDate(value) {
  return new Date(`${value}T00:00:00+07:00`);
}

function localDateTime(value) {
  return new Date(value);
}

function buildUtilityCharges(payload) {
  const electricityAmount = payload.electricity?.amount ?? 0;
  const waterAmount = payload.water?.amount ?? 0;

  return {
    electricity: payload.electricity,
    water: payload.water,
    totalUtilityAmount: electricityAmount + waterAmount,
  };
}

function sanitizeToken(value) {
  const normalized = String(value ?? '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toUpperCase();

  return normalized || 'DEMO';
}

async function upsertUtilityReading(input) {
  const existing = await prisma.utilityReading.findFirst({
    where: {
      utilityMeterId: input.utilityMeterId,
      readingDate: input.readingDate,
    },
    select: { id: true },
  });

  const data = {
    utilityMeterId: input.utilityMeterId,
    rentalContractId: input.rentalContractId,
    readingDate: input.readingDate,
    readingValue: decimal(input.readingValue),
    previousReadingValue: decimal(input.previousReadingValue),
    consumption: decimal(input.consumption),
    readingType: ReadingType.manual,
    readByStaffId: input.readByStaffId,
    images: [],
    notes: input.notes,
    isVerified: !!input.verifiedByStaffId,
    verifiedByStaffId: input.verifiedByStaffId,
    verifiedAt: input.verifiedByStaffId ? input.readingDate : null,
  };

  if (existing) {
    return prisma.utilityReading.update({
      where: { id: existing.id },
      data,
    });
  }

  return prisma.utilityReading.create({ data });
}

async function getInvoiceColumnSet() {
  if (!invoiceColumnSetPromise) {
    invoiceColumnSetPromise = pool
      .query(
        `
          SELECT column_name
          FROM information_schema.columns
          WHERE table_schema = 'public'
            AND table_name = 'invoices'
        `,
      )
      .then((result) => new Set(result.rows.map((row) => row.column_name)));
  }

  return invoiceColumnSetPromise;
}

async function upsertInvoiceRecord(rentalContractId, invoiceSeed) {
  const invoiceColumnSet = await getInvoiceColumnSet();
  const columns = [];
  const placeholders = [];
  const updateAssignments = [];
  const params = [];

  const pushValue = (column, value, cast = '') => {
    columns.push(`"${column}"`);
    params.push(value);
    placeholders.push(`$${params.length}${cast}`);
    updateAssignments.push(`"${column}" = EXCLUDED."${column}"`);
  };

  pushValue('id', randomUUID());
  pushValue('invoiceNumber', invoiceSeed.invoiceNumber);
  pushValue('rentalContractId', rentalContractId);
  pushValue('invoiceType', invoiceSeed.invoiceType, '::"InvoiceType"');
  pushValue(
    'invoiceContent',
    JSON.stringify(invoiceSeed.invoiceContent ?? {}),
    '::jsonb',
  );
  pushValue('billingPeriodStart', invoiceSeed.billingPeriodStart);
  pushValue('billingPeriodEnd', invoiceSeed.billingPeriodEnd);
  pushValue('issueDate', invoiceSeed.issueDate);
  pushValue('dueDate', invoiceSeed.dueDate);
  pushValue('baseRent', invoiceSeed.baseRent, '::numeric');
  pushValue(
    'utilityCharges',
    JSON.stringify(invoiceSeed.utilityCharges ?? {}),
    '::jsonb',
  );
  pushValue(
    'additionalCharges',
    JSON.stringify(invoiceSeed.additionalCharges ?? {}),
    '::jsonb',
  );
  pushValue('discounts', JSON.stringify({}), '::jsonb');
  pushValue('taxAmount', 0, '::numeric');
  pushValue('totalAmount', invoiceSeed.totalAmount, '::numeric');
  pushValue('currency', 'VND');
  pushValue('status', invoiceSeed.status, '::"InvoiceStatus"');
  pushValue(
    'paymentMethod',
    invoiceSeed.paymentMethod,
    '::"PaymentMethodType"',
  );
  pushValue('invoiceDocumentUrl', null);
  pushValue('notes', invoiceSeed.notes);
  pushValue(
    'sentAt',
    invoiceSeed.status === InvoiceStatus.draft ? null : invoiceSeed.issueDate,
  );
  pushValue('paidAt', invoiceSeed.paidAt);
  pushValue('cancelledAt', null);
  pushValue('cancellationReason', null);
  pushValue('billingMonth', invoiceSeed.billingMonth);

  if (invoiceColumnSet.has('depositDisposition')) {
    pushValue(
      'depositDisposition',
      invoiceSeed.depositDisposition ?? null,
      '::"DepositDisposition"',
    );
  }

  if (invoiceColumnSet.has('depositDispositionAt')) {
    pushValue(
      'depositDispositionAt',
      invoiceSeed.depositDisposition ? invoiceSeed.paidAt : null,
    );
  }

  if (invoiceColumnSet.has('depositDispositionReason')) {
    pushValue(
      'depositDispositionReason',
      invoiceSeed.depositDisposition
        ? 'Deposit is held for active demo contract.'
        : null,
    );
  }

  columns.push('"createdAt"');
  placeholders.push('NOW()');
  columns.push('"updatedAt"');
  placeholders.push('NOW()');
  updateAssignments.push('"updatedAt" = NOW()');

  const result = await pool.query(
    `
      INSERT INTO "invoices" (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT ("invoiceNumber") DO UPDATE
      SET ${updateAssignments.join(', ')}
      RETURNING "id"
    `,
    params,
  );

  return result.rows[0];
}

async function upsertPaymentRecord({
  invoiceId,
  userId,
  receiverUserId,
  seed,
}) {
  const result = await pool.query(
    `
      INSERT INTO "payments" (
        "id",
        "paymentReference",
        "invoiceId",
        "userId",
        "receiverUserId",
        "amount",
        "currency",
        "paymentMethod",
        "paymentGateway",
        "transactionId",
        "paymentDate",
        "status",
        "paymentProofUrl",
        "bankName",
        "accountNumber",
        "notes",
        "processedByStaffId",
        "refundAmount",
        "refundDate",
        "refundReason",
        "createdAt",
        "updatedAt"
      )
      VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6::numeric,
        $7,
        $8::"PaymentMethodType",
        $9,
        $10,
        $11,
        $12::"PaymentStatus",
        $13,
        $14,
        $15,
        $16,
        $17,
        $18,
        $19,
        $20,
        NOW(),
        NOW()
      )
      ON CONFLICT ("paymentReference") DO UPDATE
      SET
        "invoiceId" = EXCLUDED."invoiceId",
        "userId" = EXCLUDED."userId",
        "receiverUserId" = EXCLUDED."receiverUserId",
        "amount" = EXCLUDED."amount",
        "currency" = EXCLUDED."currency",
        "paymentMethod" = EXCLUDED."paymentMethod",
        "paymentGateway" = EXCLUDED."paymentGateway",
        "transactionId" = EXCLUDED."transactionId",
        "paymentDate" = EXCLUDED."paymentDate",
        "status" = EXCLUDED."status",
        "paymentProofUrl" = EXCLUDED."paymentProofUrl",
        "bankName" = EXCLUDED."bankName",
        "accountNumber" = EXCLUDED."accountNumber",
        "notes" = EXCLUDED."notes",
        "processedByStaffId" = EXCLUDED."processedByStaffId",
        "refundAmount" = EXCLUDED."refundAmount",
        "refundDate" = EXCLUDED."refundDate",
        "refundReason" = EXCLUDED."refundReason",
        "updatedAt" = NOW()
      RETURNING "id"
    `,
    [
      randomUUID(),
      seed.paymentReference,
      invoiceId,
      userId,
      receiverUserId,
      seed.amount,
      'VND',
      PaymentMethodType.bank_transfer,
      'manual_demo',
      seed.transactionId,
      seed.paymentDate,
      PaymentStatus.completed,
      null,
      null,
      null,
      seed.notes,
      null,
      null,
      null,
      null,
    ],
  );

  return result.rows[0];
}

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_USER.password, 12);

  const [apartmentRecord, fallbackOwner, staff] = await Promise.all([
    prisma.apartment.findUnique({
      where: { id: DEMO_APARTMENT_ID },
      select: {
        id: true,
        slug: true,
        apartmentNumber: true,
        buildingName: true,
        streetAddress: true,
        status: true,
        ownerId: true,
        baseRentPrice: true,
        depositAmount: true,
      },
    }),
    prisma.user.findFirst({
      where: { isPartner: true },
      orderBy: { createdAt: 'asc' },
      select: {
        id: true,
        fullName: true,
        phone: true,
        address: true,
        commissionRate: true,
      },
    }),
    prisma.staff.findFirst({
      orderBy: { createdAt: 'asc' },
      select: { id: true, fullName: true },
    }),
  ]);

  if (!apartmentRecord) {
    throw new Error(`Apartment ${DEMO_APARTMENT_ID} was not found`);
  }

  const owner = apartmentRecord.ownerId
    ? await prisma.user.findUnique({
        where: { id: apartmentRecord.ownerId },
        select: {
          id: true,
          fullName: true,
          phone: true,
          address: true,
          commissionRate: true,
        },
      })
    : fallbackOwner;

  const apartmentToken = sanitizeToken(apartmentRecord.apartmentNumber);

  const user = await prisma.user.upsert({
    where: { email: DEMO_USER.email },
    update: {
      fullName: DEMO_USER.fullName,
      phone: DEMO_USER.phone,
      passwordHash,
      isActive: true,
      isVerified: true,
      emergencyContactName: 'Tran Thi Demo',
      emergencyContactPhone: '0909000102',
      address: 'TP HCM',
      dateOfBirth: localDate('2000-06-18'),
    },
    create: {
      email: DEMO_USER.email,
      fullName: DEMO_USER.fullName,
      phone: DEMO_USER.phone,
      passwordHash,
      isActive: true,
      isVerified: true,
      emergencyContactName: 'Tran Thi Demo',
      emergencyContactPhone: '0909000102',
      address: 'TP HCM',
      dateOfBirth: localDate('2000-06-18'),
    },
  });

  await prisma.userIdentity.upsert({
    where: { userId: user.id },
    update: {
      nationalId: DEMO_USER.nationalId,
      name: DEMO_USER.fullName,
      dob: '18/06/2000',
      sex: 'Nu',
      nationality: 'Viet Nam',
      address: 'TP HCM',
      issueDate: '18/06/2024',
      doe: '18/06/2034',
      isVerified: true,
      verifiedAt: new Date(),
    },
    create: {
      userId: user.id,
      nationalId: DEMO_USER.nationalId,
      name: DEMO_USER.fullName,
      dob: '18/06/2000',
      sex: 'Nu',
      nationality: 'Viet Nam',
      address: 'TP HCM',
      issueDate: '18/06/2024',
      doe: '18/06/2034',
      isVerified: true,
      verifiedAt: new Date(),
    },
  });

  const apartment = await prisma.apartment.update({
    where: { id: apartmentRecord.id },
    data: {
      status: ApartmentStatus.occupied,
    },
    select: {
      id: true,
      slug: true,
      apartmentNumber: true,
      buildingName: true,
      streetAddress: true,
      ownerId: true,
      baseRentPrice: true,
      depositAmount: true,
      status: true,
    },
  });

  await prisma.partnerCooperationContract.deleteMany({
    where: {
      contractNumber: LEGACY_DEMO_COOP_CONTRACT_NUMBER,
    },
  });

  await prisma.ioTBoard.deleteMany({
    where: {
      id: LEGACY_DEMO_BOARD_ID,
    },
  });

  const contract = await prisma.rentalContract.upsert({
    where: { contractNumber: DEMO_CONTRACT.contractNumber },
    update: {
      apartmentId: apartment.id,
      startDate: DEMO_CONTRACT.startDate,
      endDate: DEMO_CONTRACT.endDate,
      monthlyRent:
        apartment.baseRentPrice ?? decimal(DEMO_CONTRACT.monthlyRent),
      depositAmount:
        apartment.depositAmount ?? decimal(DEMO_CONTRACT.depositAmount),
      paymentDueDay: DEMO_CONTRACT.paymentDueDay,
      paymentMethod: PaymentMethodType.bank_transfer,
      utilitiesIncluded: {
        internet: true,
        electricity: false,
        water: false,
      },
      utilitiesCharges: {
        electricity: 3800,
        water: 18000,
      },
      contractTerms:
        'Tenant rents demo apartment for internal product walkthrough and invoice verification.',
      specialConditions:
        'This contract is demo data. Current month rent and utility invoices remain unpaid.',
      landlordName: owner?.fullName ?? 'IntelliRentOps Demo Partner',
      landlordIdNumber: 'DEMO-LANDLORD-001',
      landlordIdIssueDate: '01/01/2024',
      landlordIdIssuePlace: 'TP HCM',
      landlordAddress: owner?.address ?? 'TP HCM',
      landlordPhone: owner?.phone ?? '0909000999',
      status: ContractStatus.active,
      category: RentalContractCategory.normal,
      signedDate: DEMO_CONTRACT.signedDate,
      contractDocumentUrl: null,
      terminationDate: null,
      terminationReason: null,
      earlyTerminationFee: null,
      createdByStaffId: staff?.id ?? null,
    },
    create: {
      contractNumber: DEMO_CONTRACT.contractNumber,
      apartmentId: apartment.id,
      startDate: DEMO_CONTRACT.startDate,
      endDate: DEMO_CONTRACT.endDate,
      monthlyRent:
        apartment.baseRentPrice ?? decimal(DEMO_CONTRACT.monthlyRent),
      depositAmount:
        apartment.depositAmount ?? decimal(DEMO_CONTRACT.depositAmount),
      paymentDueDay: DEMO_CONTRACT.paymentDueDay,
      paymentMethod: PaymentMethodType.bank_transfer,
      utilitiesIncluded: {
        internet: true,
        electricity: false,
        water: false,
      },
      utilitiesCharges: {
        electricity: 3800,
        water: 18000,
      },
      contractTerms:
        'Tenant rents demo apartment for internal product walkthrough and invoice verification.',
      specialConditions:
        'This contract is demo data. Current month rent and utility invoices remain unpaid.',
      landlordName: owner?.fullName ?? 'IntelliRentOps Demo Partner',
      landlordIdNumber: 'DEMO-LANDLORD-001',
      landlordIdIssueDate: '01/01/2024',
      landlordIdIssuePlace: 'TP HCM',
      landlordAddress: owner?.address ?? 'TP HCM',
      landlordPhone: owner?.phone ?? '0909000999',
      status: ContractStatus.active,
      category: RentalContractCategory.normal,
      signedDate: DEMO_CONTRACT.signedDate,
      contractDocumentUrl: null,
      createdByStaffId: staff?.id ?? null,
    },
  });

  await prisma.userApartment.deleteMany({
    where: {
      rentalContractId: contract.id,
      apartmentId: {
        not: apartment.id,
      },
    },
  });

  await prisma.userContractMember.upsert({
    where: {
      userId_rentalContractId: {
        userId: user.id,
        rentalContractId: contract.id,
      },
    },
    update: {
      memberType: MemberType.primary,
      isPrimaryContact: true,
      moveInDate: DEMO_CONTRACT.startDate,
      moveOutDate: DEMO_CONTRACT.endDate,
      notificationEnabled: true,
      accessLevel: AccessLevel.full,
      sharePercentage: decimal(100),
      status: MemberStatus.active,
    },
    create: {
      userId: user.id,
      rentalContractId: contract.id,
      memberType: MemberType.primary,
      isPrimaryContact: true,
      moveInDate: DEMO_CONTRACT.startDate,
      moveOutDate: DEMO_CONTRACT.endDate,
      notificationEnabled: true,
      accessLevel: AccessLevel.full,
      sharePercentage: decimal(100),
      status: MemberStatus.active,
    },
  });

  await prisma.userApartment.upsert({
    where: {
      userId_apartmentId_rentalContractId: {
        userId: user.id,
        apartmentId: apartment.id,
        rentalContractId: contract.id,
      },
    },
    update: {
      moveInDate: DEMO_CONTRACT.startDate,
      moveOutDate: DEMO_CONTRACT.endDate,
      isPrimaryTenant: true,
      status: UserApartmentStatus.active,
      apartmentDoorPassword: `${apartmentToken}2468`,
      buildingGateCode: `GATE-${apartmentToken}`,
      smartLockPin: '246810',
      mailboxCode: `MB-${apartmentToken}`,
      parkingAccessCode: `PARK-${apartmentToken}`,
      wifiName: `${apartmentToken}-Tenant`,
      wifiPassword: `Demo@${apartmentToken}`,
      emergencyContactName: 'Tran Thi Demo',
      emergencyContactPhone: '0909000102',
      notes: 'Seeded for tenant demo flow.',
    },
    create: {
      userId: user.id,
      apartmentId: apartment.id,
      rentalContractId: contract.id,
      moveInDate: DEMO_CONTRACT.startDate,
      moveOutDate: DEMO_CONTRACT.endDate,
      isPrimaryTenant: true,
      status: UserApartmentStatus.active,
      apartmentDoorPassword: `${apartmentToken}2468`,
      buildingGateCode: `GATE-${apartmentToken}`,
      smartLockPin: '246810',
      mailboxCode: `MB-${apartmentToken}`,
      parkingAccessCode: `PARK-${apartmentToken}`,
      wifiName: `${apartmentToken}-Tenant`,
      wifiPassword: `Demo@${apartmentToken}`,
      emergencyContactName: 'Tran Thi Demo',
      emergencyContactPhone: '0909000102',
      notes: 'Seeded for tenant demo flow.',
    },
  });

  const meterEntries = {};
  for (const [key, meterConfig] of Object.entries(DEMO_METERS)) {
    meterEntries[key] = await prisma.utilityMeter.upsert({
      where: { meterNumber: meterConfig.meterNumber },
      update: {
        apartmentId: apartment.id,
        meterType: meterConfig.meterType,
        brand:
          meterConfig.meterType === MeterType.water ? 'Sensus' : 'Schneider',
        model:
          meterConfig.meterType === MeterType.water
            ? 'WATER-DEMO'
            : 'ELEC-DEMO',
        installationDate: localDate('2025-12-15'),
        lastInspectionDate: localDate('2026-01-15'),
        nextInspectionDate: localDate('2027-01-15'),
        unitOfMeasurement: meterConfig.unitOfMeasurement,
        ratePerUnit: decimal(meterConfig.ratePerUnit),
        currentReading: decimal(meterConfig.currentReading),
        previousReading: decimal(meterConfig.previousReading),
        readingDate: localDate('2026-04-20'),
        status: MeterStatus.active,
        isDigital: meterConfig.meterType === MeterType.electricity,
        calibrationDate: localDate('2026-01-15'),
        nextCalibrationDate: localDate('2027-01-15'),
        notes: 'Seeded for demo tenant apartment.',
      },
      create: {
        apartmentId: apartment.id,
        meterNumber: meterConfig.meterNumber,
        meterType: meterConfig.meterType,
        brand:
          meterConfig.meterType === MeterType.water ? 'Sensus' : 'Schneider',
        model:
          meterConfig.meterType === MeterType.water
            ? 'WATER-DEMO'
            : 'ELEC-DEMO',
        installationDate: localDate('2025-12-15'),
        lastInspectionDate: localDate('2026-01-15'),
        nextInspectionDate: localDate('2027-01-15'),
        unitOfMeasurement: meterConfig.unitOfMeasurement,
        ratePerUnit: decimal(meterConfig.ratePerUnit),
        currentReading: decimal(meterConfig.currentReading),
        previousReading: decimal(meterConfig.previousReading),
        readingDate: localDate('2026-04-20'),
        status: MeterStatus.active,
        isDigital: meterConfig.meterType === MeterType.electricity,
        calibrationDate: localDate('2026-01-15'),
        nextCalibrationDate: localDate('2027-01-15'),
        notes: 'Seeded for demo tenant apartment.',
      },
    });
  }

  for (const row of DEMO_READING_ROWS) {
    await upsertUtilityReading({
      utilityMeterId: meterEntries[row.meterKey].id,
      rentalContractId: contract.id,
      readingDate: row.readingDate,
      readingValue: row.readingValue,
      previousReadingValue: row.previousReadingValue,
      consumption: row.consumption,
      readByStaffId: staff?.id ?? null,
      verifiedByStaffId: staff?.id ?? null,
      notes: `seed-demo-${row.meterKey}-${row.readingDate.toISOString()}`,
    });
  }

  const invoiceIdsByNumber = {};
  for (const invoiceSeed of DEMO_INVOICES) {
    const invoice = await upsertInvoiceRecord(contract.id, invoiceSeed);

    invoiceIdsByNumber[invoiceSeed.invoiceNumber] = invoice.id;
  }

  for (const paymentSeed of DEMO_PAYMENTS) {
    await upsertPaymentRecord({
      invoiceId: invoiceIdsByNumber[paymentSeed.invoiceNumber],
      userId: user.id,
      receiverUserId: owner?.id ?? null,
      seed: paymentSeed,
    });
  }

  const verificationResult = await pool.query(
    `
      SELECT
        "invoiceType"::text AS "invoiceType",
        "status"::text AS "status",
        COUNT(*)::int AS "count"
      FROM "invoices"
      WHERE "invoiceNumber" LIKE 'INV-DEMO-%'
      GROUP BY "invoiceType", "status"
      ORDER BY "invoiceType", "status"
    `,
  );

  const verification = verificationResult.rows.map((row) => ({
    invoiceType: row.invoiceType,
    status: row.status,
    count: Number(row.count),
  }));

  console.log(
    JSON.stringify(
      {
        user: {
          id: user.id,
          email: user.email,
          fullName: user.fullName,
        },
        apartment: {
          id: apartment.id,
          slug: apartment.slug,
          apartmentNumber: apartment.apartmentNumber,
        },
        contract: {
          id: contract.id,
          contractNumber: contract.contractNumber,
          status: contract.status,
        },
        boardEnabled: false,
        ownerId: owner?.id ?? null,
        verification,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
