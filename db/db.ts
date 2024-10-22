class KVStore {
  private store;

  async init() {
    this.store = await Deno.openKv();
  }

  set(key: string, value: any): void {
  }

  get(key: string): any | undefined {
  }

  delete(key: string): boolean {
  }
}

export default KVStore;
