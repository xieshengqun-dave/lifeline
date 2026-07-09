// Single shared PrismaClient instance — import this everywhere instead of
// constructing `new PrismaClient()` per-module.
import "./env.js";
import { PrismaClient } from "@prisma/client";

export const prisma = new PrismaClient();
