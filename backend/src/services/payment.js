// TODO(human): integrate a real payment provider (Stripe / iPay88 / Billplz)
// with real keys and human sign-off before charging real money. Never store
// raw card PAN/CVV — only provider tokens/reference IDs.
//
// Nothing in Phase 1 calls this — bookings only record the patient's chosen
// paymentMethod with paymentStatus "pending". This stub exists so the shape
// of the eventual integration is visible, and so nobody accidentally wires a
// fake charge into the booking flow.
export async function chargeBooking() {
  throw new Error(
    "chargeBooking() is not implemented — no payment provider is integrated yet. " +
      "This needs a human decision (provider choice + real keys) before it can be built."
  );
}
