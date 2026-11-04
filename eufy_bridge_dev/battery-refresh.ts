/** Cloud inventory only: never starts video or connects to a camera. */
export class BatteryRefresh {
  private next = 0;
  private busy = false;
  constructor(private readonly intervalMs = 30 * 60_000) {}
  async run<T extends { id: string; kind: string; battery: number | null }>(
    now: number, idle: boolean, devices: Map<string, T>,
    fetch: () => Promise<{ devices: T[] }>, changed: () => void,
  ): Promise<void> {
    if (!idle || this.busy || now < this.next) return;
    this.busy = true;
    // Back off after failure too; never hammer Eufy during an outage.
    this.next = now + this.intervalMs;
    try {
      const inventory = await fetch();
      let updated = false;
      for (const incoming of inventory.devices) {
        const current = devices.get(incoming.id);
        if (!current || current.kind !== 'camera' || incoming.battery === null ||
            !Number.isFinite(incoming.battery) || incoming.battery < 0 || incoming.battery > 100) continue;
        if (current.battery !== incoming.battery) {
          devices.set(incoming.id, { ...current, battery: incoming.battery });
          updated = true;
        }
      }
      if (updated) changed();
    } finally { this.busy = false; }
  }
}
