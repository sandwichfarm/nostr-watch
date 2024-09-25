declare module 'get-ssl-cert' {
  function get(hostname: string, timeout: number): Promise<Record<string, any>>;
  export default get;
}