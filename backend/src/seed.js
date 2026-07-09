// Seed the 5 demo Klang Valley operators (+ ambulances + crew) so the
// marketplace has matchable data. Idempotent: upserts by email/plate.
// Run: npm run seed
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { operators, DEFAULT_OPERATOR_PASSWORD } from "./seedData.js";

const prisma = new PrismaClient();
const passwordHash = await bcrypt.hash(DEFAULT_OPERATOR_PASSWORD, 10);

for (const op of operators) {
  const { ambulances, crew, ...operatorFields } = op;
  operatorFields.passwordHash = passwordHash;

  const operator = await prisma.operator.upsert({
    where: { email: operatorFields.email },
    update: operatorFields,
    create: operatorFields,
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
