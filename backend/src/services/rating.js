import { prisma } from "../lib/prisma.js";
import { HttpError } from "../middleware/errorHandler.js";
import { BOOKING_STATUS } from "../lib/constants.js";

// Ratings are rare writes (once per completed trip); operator rows are read
// on every quote/admin-list request — so the aggregate is recomputed and
// stored on Operator here, not computed live on read.
export async function submitRating(bookingId, userId, { stars, comment }) {
  const booking = await prisma.booking.findUnique({ where: { id: bookingId } });
  if (!booking) throw new HttpError(404, "not_found", "Booking not found");
  if (booking.userId !== userId) throw new HttpError(403, "forbidden", "Not your booking");
  if (booking.status !== BOOKING_STATUS.COMPLETED) {
    throw new HttpError(409, "not_completed", "Booking is not yet completed");
  }
  if (!booking.operatorId) throw new HttpError(409, "no_operator", "Booking has no assigned operator");

  let rating;
  try {
    rating = await prisma.rating.create({
      data: { bookingId, operatorId: booking.operatorId, userId, stars, comment },
    });
  } catch (err) {
    if (err.code === "P2002") throw new HttpError(409, "already_rated", "This booking has already been rated");
    throw err;
  }

  const agg = await prisma.rating.aggregate({
    where: { operatorId: booking.operatorId },
    _avg: { stars: true },
    _count: true,
  });
  const operator = await prisma.operator.update({
    where: { id: booking.operatorId },
    data: { ratingAvg: agg._avg.stars, ratingCount: agg._count },
    select: { id: true, name: true, ratingAvg: true, ratingCount: true },
  });

  return { rating, operator };
}

// Batched to avoid an N+1 query when rendering a list of operators (quote
// results, admin operators table).
export async function getCompletedTripCounts(operatorIds) {
  if (!operatorIds.length) return {};
  const rows = await prisma.booking.groupBy({
    by: ["operatorId"],
    where: { operatorId: { in: operatorIds }, status: BOOKING_STATUS.COMPLETED },
    _count: true,
  });
  const counts = {};
  for (const id of operatorIds) counts[id] = 0;
  for (const row of rows) counts[row.operatorId] = row._count;
  return counts;
}
