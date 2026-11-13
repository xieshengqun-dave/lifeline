import { z } from "zod";
import { AMBULANCE_TYPE, CREW_ROLE } from "./constants.js";

// Request schemas shared by the operator and admin fleet routes.
const plate = z.string().trim().min(2).max(15).regex(/^[A-Za-z0-9 ]+$/, "Plate can only contain letters, numbers and spaces");
const ambulanceType = z.enum(Object.values(AMBULANCE_TYPE));
const equipment = z.array(z.string().trim().min(1).max(40)).max(20);
const crewRole = z.enum(Object.values(CREW_ROLE));
const personName = z.string().trim().min(2).max(80);
// Optional phone: blank clears it. Digits, spaces, + and - only.
const phone = z
  .string()
  .trim()
  .max(20)
  .regex(/^[0-9+\- ]*$/, "Phone can only contain digits, spaces, + and -")
  .nullable()
  .optional()
  .transform((v) => (v ? v : null));

const atLeastOneField = (b) => Object.values(b).some((v) => v !== undefined);

export const createAmbulanceSchema = z.object({ plate, type: ambulanceType, equipment: equipment.optional() });
export const updateAmbulanceSchema = z
  .object({ plate: plate.optional(), type: ambulanceType.optional(), equipment: equipment.optional(), active: z.boolean().optional() })
  .refine(atLeastOneField, "Nothing to update");

export const createCrewSchema = z.object({ name: personName, role: crewRole, phone });
export const updateCrewSchema = z
  .object({
    name: personName.optional(),
    role: crewRole.optional(),
    phone: z.string().trim().max(20).regex(/^[0-9+\- ]*$/, "Phone can only contain digits, spaces, + and -").nullable().optional(),
    active: z.boolean().optional(),
  })
  .refine(atLeastOneField, "Nothing to update");
