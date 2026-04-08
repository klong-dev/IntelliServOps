import {
  ContractStatus,
  MemberStatus,
  MemberType,
  PrismaClient,
  UserApartmentStatus,
} from '@prisma/client';

const prisma = new PrismaClient();

function generateSixDigitPassword(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  console.log('Starting user_apartments backfill...');
  console.log(`Mode: ${dryRun ? 'DRY RUN' : 'APPLY'}`);

  const activeContracts = await prisma.rentalContract.findMany({
    where: {
      status: ContractStatus.active,
    },
    select: {
      id: true,
      apartmentId: true,
      startDate: true,
      members: {
        where: {
          status: MemberStatus.active,
        },
        select: {
          userId: true,
          memberType: true,
          isPrimaryContact: true,
        },
      },
    },
  });

  let contractsTouched = 0;
  let missingAssignments = 0;
  let createdAssignments = 0;

  for (const contract of activeContracts) {
    if (!contract.members.length) {
      continue;
    }

    const existingAssignments = await prisma.userApartment.findMany({
      where: {
        rentalContractId: contract.id,
      },
      select: {
        userId: true,
        apartmentId: true,
      },
    });

    const existingKeys = new Set(
      existingAssignments.map((item) => `${item.userId}:${item.apartmentId}`),
    );

    const apartmentDoorPassword = generateSixDigitPassword();
    const rowsToCreate = contract.members
      .filter(
        (member) =>
          !existingKeys.has(`${member.userId}:${contract.apartmentId}`),
      )
      .map((member) => ({
        userId: member.userId,
        apartmentId: contract.apartmentId,
        rentalContractId: contract.id,
        moveInDate: contract.startDate,
        isPrimaryTenant:
          member.memberType === MemberType.primary || member.isPrimaryContact,
        status: UserApartmentStatus.active,
        apartmentDoorPassword,
      }));

    if (!rowsToCreate.length) {
      continue;
    }

    contractsTouched += 1;
    missingAssignments += rowsToCreate.length;

    if (dryRun) {
      continue;
    }

    const result = await prisma.userApartment.createMany({
      data: rowsToCreate,
      skipDuplicates: true,
    });

    createdAssignments += result.count;
  }

  console.log('Backfill completed.');
  console.log(`Active contracts scanned: ${activeContracts.length}`);
  console.log(`Contracts with missing assignments: ${contractsTouched}`);
  console.log(`Missing assignments found: ${missingAssignments}`);
  console.log(
    dryRun
      ? `Rows to create (dry run): ${missingAssignments}`
      : `Rows created: ${createdAssignments}`,
  );
}

main()
  .catch((error) => {
    console.error('Backfill failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
