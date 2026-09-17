// Seed the 6 demo Klang Valley operators (+ ambulances + crew) so the
// marketplace has matchable data. Idempotent: upserts by email/plate.
// Run: npm run seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { operators, DEFAULT_OPERATOR_PASSWORD, LEGACY_OPERATOR_EMAILS } from "./seedData.js";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(DEFAULT_OPERATOR_PASSWORD, 10);

for (const op of operators) {
  const { ambulances, crew, ...operatorFields } = op;
  operatorFields.passwordHash = passwordHash;

  // Rename a row still on its legacy email in place, so the upsert below
  // updates it rather than creating a duplicate operator.
  const legacyEmail = LEGACY_OPERATOR_EMAILS[operatorFields.email];
  if (legacyEmail) {
    const current = await prisma.operator.findUnique({ where: { email: operatorFields.email } });
    if (!current) {
      await prisma.operator.updateMany({
        where: { email: legacyEmail },
        data: { email: operatorFields.email },
      });
    }
  }

  const operator = await prisma.operator.upsert({
    where: { email: operatorFields.email },
    update: operatorFields, // never touches walletBalance — reseeds must not reset money
    create: { ...operatorFields, walletBalance: 200 }, // starter float for brand-new seeds
  });

  for (const a of ambulances) {
    await prisma.ambulance.upsert({
      where: { plate: a.plate },
      update: { ...a, operatorId: operator.id },
      create: { ...a, operatorId: operator.id },
    });
  }

  for (const c of crew) {
    const existing = await prisma.crew.findFirst({
      where: { operatorId: operator.id, name: c.name },
    });
    if (existing) {
      await prisma.crew.update({ where: { id: existing.id }, data: c });
    } else {
      await prisma.crew.create({ data: { ...c, operatorId: operator.id } });
    }
  }
}

console.log(`Seeded ${operators.length} operators`);
process.exit(0);
