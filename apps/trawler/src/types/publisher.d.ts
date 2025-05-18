declare module '@nostrwatch/publisher' {
  export default class Publish {
    static Kind30166: {
      new (): {
        one(relay: { url: string; [key: string]: any }): Promise<void>;
        many(relays: { url: string; [key: string]: any }[]): Promise<void>;
      };
    };
  }
} 