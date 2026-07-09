// Demo fixture data for Phase 1 — 5 Klang Valley operators with real-ish
// coordinates, distinct rates, and fleets. Shared by seed.js (dev DB) and
// used as a reference shape by test fixtures (which use their own smaller,
// distance-controlled set — see test/helpers/testDb.js).
//
// All seeded operators share one dev-only login password (plain text here,
// hashed at seed time by seed.js) — see DEFAULT_OPERATOR_PASSWORD below.

export const DEFAULT_OPERATOR_PASSWORD = "operator123";

export const operators = [
  {
    name: "PJ Rapid Response",
    email: "ops@pjrapid.example",
    phone: "+60312345001",
    baseLat: 3.1073,
    baseLng: 101.6067,
    serviceRadiusKm: 8,
    baseFare: 150,
    perKmRate: 7.0,
    fleetSummary: "2 ALS, 1 BLS",
    vettingStatus: "approved",
    online: true,
    ambulances: [
      { plate: "PJA 1001", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
      { plate: "PJA 1002", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
      { plate: "PJB 2001", type: "BLS", equipment: ["Oxygen", "Defibrillator"] },
    ],
    crew: [
      { name: "Ahmad Firdaus", role: "DRIVER", phone: "+60123450001" },
      { name: "Nurul Aina", role: "PARAMEDIC", phone: "+60123450002" },
    ],
  },
  {
    name: "Subang MedEvac",
    email: "ops@subangmedevac.example",
    phone: "+60312345002",
    baseLat: 3.0567,
    baseLng: 101.5851,
    serviceRadiusKm: 7,
    baseFare: 130,
    perKmRate: 6.0,
    fleetSummary: "1 ALS, 2 BLS",
    vettingStatus: "approved",
    online: true,
    ambulances: [
      { plate: "SME 1001", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
      { plate: "SME 2001", type: "BLS", equipment: ["Oxygen", "Defibrillator"] },
      { plate: "SME 2002", type: "BLS", equipment: ["Oxygen", "Defibrillator"] },
    ],
    crew: [
      { name: "Suresh Kumar", role: "DRIVER", phone: "+60123450003" },
      { name: "Priya Devi", role: "PARAMEDIC", phone: "+60123450004" },
    ],
  },
  {
    name: "Shah Alam Emergency Services",
    email: "ops@shahalames.example",
    phone: "+60312345003",
    baseLat: 3.0738,
    baseLng: 101.5183,
    serviceRadiusKm: 10,
    baseFare: 160,
    perKmRate: 8.0,
    fleetSummary: "1 ALS, 1 BLS, 1 Neonatal",
    vettingStatus: "approved",
    online: true,
    ambulances: [
      { plate: "SAE 1001", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
      { plate: "SAE 2001", type: "BLS", equipment: ["Oxygen", "Defibrillator"] },
      { plate: "SAE 3001", type: "NEONATAL", equipment: ["Incubator", "Ventilator"] },
    ],
    crew: [
      { name: "Lim Wei Jian", role: "DRIVER", phone: "+60123450005" },
      { name: "Farah Hanani", role: "PARAMEDIC", phone: "+60123450006" },
    ],
  },
  {
    name: "KL City Ambulance",
    email: "ops@klcityambulance.example",
    phone: "+60312345004",
    baseLat: 3.1516,
    baseLng: 101.7093,
    serviceRadiusKm: 6,
    baseFare: 180,
    perKmRate: 9.0,
    fleetSummary: "2 ALS",
    vettingStatus: "approved",
    online: true,
    ambulances: [
      { plate: "KLC 1001", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
      { plate: "KLC 1002", type: "ALS", equipment: ["Ventilator", "Monitor", "Oxygen"] },
    ],
    crew: [
      { name: "Muhammad Danial", role: "DRIVER", phone: "+60123450007" },
      { name: "Chong Mei Ling", role: "PARAMEDIC", phone: "+60123450008" },
    ],
  },
  {
    name: "Cheras Care Ambulance",
    email: "ops@cherascare.example",
    phone: "+60312345005",
    baseLat: 3.0730,
    baseLng: 101.7420,
    serviceRadiusKm: 9,
    baseFare: 120,
    perKmRate: 6.5,
    fleetSummary: "1 BLS, 1 Neonatal",
    vettingStatus: "approved",
    online: true,
    ambulances: [
      { plate: "CCA 2001", type: "BLS", equipment: ["Oxygen", "Defibrillator"] },
      { plate: "CCA 3001", type: "NEONATAL", equipment: ["Incubator", "Ventilator"] },
    ],
    crew: [
      { name: "Ravi Chandran", role: "DRIVER", phone: "+60123450009" },
      { name: "Siti Nurhaliza", role: "PARAMEDIC", phone: "+60123450010" },
    ],
  },
];
