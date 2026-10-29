export type HubMode = 'scratch' | 'arduino' | 'games';
export interface HubState { mode: HubMode; score: number; total: number; status: string; actionLabel: string; busy: boolean; }
export interface HubWorld { setMode(mode: HubMode): HubState; action(): HubState; reset(): HubState; setMotion(enabled: boolean): HubState; setView(view: 'perspective' | 'top' | 'front'): void; dispose(): void; getState(): HubState; }
export function createHubWorld(options: {canvas: HTMLCanvasElement; onProgress?: (state: HubState)=>void; onReady?: (result: {available: boolean; message?: string})=>void;}): HubWorld;
