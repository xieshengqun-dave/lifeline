// Thin entrypoint: wraps app.js in an http.Server, attaches Socket.IO,
// recovers any offers still pending from before a restart, starts the
// expired-offer sweep, then starts listening.
import http from "http";
import app from "./app.js";
import { config } from "./lib/env.js";
import { initSocket } from "./lib/socket.js";
import { recoverPendingOffers, startOfferSweep } from "./services/offerEngine.js";

const httpServer = http.createServer(app);
initSocket(httpServer);

await recoverPendingOffers();
startOfferSweep();

httpServer.listen(config.port, () => console.log(`Lifeline API on :${config.port}`));
