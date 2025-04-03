declare module '@nostrwatch/db' {
  export const db: {
    cachetime: {
      set(key: string, value: number): Promise<void>;
      get(key: string): Promise<number | null>;
    };
    relay: {
      get: {
        all(): Promise<{ url: string; [key: string]: any }[]>;
      };
    };
  };
} 