// Test-only DB helpers. NEVER used against the seeded dev database — resetDb()
// refuses to run unless DATABASE_URL points at lifeline_test.
import bcrypt from "bcryptjs";
import { prisma } from "../../src/lib/prisma.js";

export const TEST_PICKUP = { name: "Test Pickup", lat: 3.1, lng: 101.6 };
export const TEST_DESTINATION = { name: "Test Destination", lat: 3.1, lng: 101.7 };
export const FIXTURE_PASSWORD = "fixture123";

export async function resetDb() {
  if (!process.env.DATABASE_URL?.includes("lifeline_test")) {
    throw new Error("resetDb() refused: DATABASE_URL does not point at lifeline_test");
  }
  await prisma.trackingEvent.deleteMany();
  await prisma.rating.deleteMany();
  await prisma.bookingOffer.deleteMany();
  await prisma.booking.deleteMany();
  await prisma.crew.deleteMany();
  await prisma.ambulance.deleteMany();
  await prisma.operator.deleteMany();
  await prisma.user.deleteMany();
  await prisma.platformSettings.deleteMany();
}

// Four operators at controlled, increasing distances from TEST_PICKUP so
// ranking/radius assertions don't depend on real-world geometry: A closest,
// then B, then C (all within the 10km serviceRadiusKm), then D deliberately
// far enough out to be excluded.
const FIXTURES = [
  { key: "A", lngOffset: 0.01, baseFare: 100 },
  { key: "B", lngOffset: 0.03, baseFare: 110 },
  { key: "C", lngOffset: 0.06, baseFare: 120 },
  { key: "D", lngOffset: 0.15, baseFare: 130 }, // ~16km away — out of the 10km radius
];

export async function seedFixtureOperators() {
  const passwordHash = await bcrypt.hash(FIXTURE_PASSWORD, 10);
  const created = {};
  for (const spec of FIXTURES) {
    created[spec.key] = await prisma.operator.create({
      data: {
        name: `Fixture Operator ${spec.key}`,
        email: `fixture-${spec.key.toLowerCase()}@test.example`,
        passwordHash,
        baseLat: TEST_PICKUP.lat,
        baseLng: TEST_PICKUP.lng + spec.lngOffset,
        serviceRadiusKm: 10,
        baseFare: spec.baseFare,
        perKmRate: 5,
        vettingStatus: "approved",
        online: true,
      },
    });
  }
  return created;
}
