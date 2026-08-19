import { createServer } from "node:net";

const MIN_PORT = 1024;
const MAX_PORT = 65535;

function findFreePort() {
  return new Promise((resolvePort, rejectPort) => {
    const server = createServer();
    server.unref();
    server.once("error", rejectPort);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address();
      server.close(() => resolvePort(port));
    });
  });
}

try {
  const port = await findFreePort();
  if (Number.isInteger(port) && port >= MIN_PORT && port <= MAX_PORT) {
    process.stdout.write(String(port));
  }
} catch {
  // No stdout output here is the contract: the TUI leaves the field's
  // current value untouched when a command produces no value.
}
