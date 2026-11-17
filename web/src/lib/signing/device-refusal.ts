// The device's own signer refused the bytes it was handed (the signer's
// `rejectedByDevice` result: a seal or act that failed this device's checks).
// It is an answer, not a lost connection, so a surface reads it as the
// not-through line (seam 355, jakob 2026-11-17: "a refusal the device's own
// signer made"). Carried as an Outcome's `failed` cause where a data layer
// folds a batch into one outcome, so the reason survives to the surface.

export class DeviceRefusalError extends Error {
  constructor(readonly reason: string) {
    super(reason);
    this.name = "DeviceRefusalError";
  }
}
