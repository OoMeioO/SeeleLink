type Handler = (...args: unknown[]) => void;
export class EventBus {
  private events = new Map<string, Set<Handler>>();
  on(event: string, handler: Handler): () => void {
    if (!this.events.has(event)) this.events.set(event, new Set());
    this.events.get(event)!.add(handler);
    return () => this.off(event, handler);
  }
  off(event: string, handler: Handler) { this.events.get(event)?.delete(handler); }
  emit(event: string, ...args: unknown[]) {
    this.events.get(event)?.forEach(h => { try { h(...args); } catch (e) { console.error(e); } });
  }
  once(event: string, handler: Handler) {
    const wrapper: Handler = (...args) => { this.off(event, wrapper); handler(...args); };
    this.on(event, wrapper);
  }
}
export const eventBus = new EventBus();
