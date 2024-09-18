declare module 'get-ssl-cert' {
  const getSslCert: (hostname: string, options?: any) => Promise<any>;
  export default getSslCert;
}