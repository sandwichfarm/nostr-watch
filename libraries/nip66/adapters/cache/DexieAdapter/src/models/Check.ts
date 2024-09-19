export interface ICheckBase {
  nid: string;
  relay: string;
  monitorPubkey: string;
  operatorPubkey?: string | null;
}

export interface ICheckMeta {
  createdAt: number;

  network?: string | null;
  rtt?: number | null;

  geohash?: string[] | null;
  geocode?: string[] | null;

  supportedNips?: number[] | null;
  software?: string | null;
  version?: string | null;

  paymentRequired?: number | null;
  authRequired?: number | null;

  isp?: string | null;

  ipv4?: string[] | null;
  ipv6?: string[] | null;

  sslValidTo?: number | null;
  sslIssuer?: string | null;
}

export interface ICheck extends ICheckBase, ICheckMeta {}