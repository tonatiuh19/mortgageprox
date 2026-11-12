export const logger = {
  info(message: string, detail?: unknown) {
    console.info(`[mortgageprox] ${message}`, detail ?? "");
  },
  error(message: string, detail?: unknown) {
    console.error(`[mortgageprox] ${message}`, detail ?? "");
  },
};
