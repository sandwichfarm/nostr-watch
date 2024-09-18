export interface ICheckBase {
  nid: string;
  relay: string;
  monitorPubkey: string;
}

export interface ICheckMeta {
  created_at: number;

  network?: string | null;
  rtt?: number | null;

  operatorPubkey?: string | null;
  supportedNips?: number[] | null;
  software?: string | null;
  version?: string | null;
  paymentRequired?: number | null;
  authRequired?: number | null;

  geohash?: string[] | null;
  geocode?: string[] | null;

  isp?: string | null;
  as?: string | null;
  asname?: string | null;

  ipv4?: string[] | null;
  ipv6?: string[] | null;

  sslValidTo?: number | null;
  sslIssuer?: string | null;
}

export interface ICheck extends ICheckBase, ICheckMeta {}