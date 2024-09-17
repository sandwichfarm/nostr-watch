export interface ICheckBase {
  a: string;

  relay: string;
  monitorPubkey: string;
  operatorPubkey?: string | null;
}

export interface ICheckMeta {
  geohashId?: string[] | null;
  geocodeId?: string[] | null;

  network?: string | null;
  open?: number | null;

  supportedNips?: number[] | null;
  software?: string | null;
  version?: string | null;

  paymentRequired?: number | null;
  authRequired?: number | null;
  createdAt: number;

  isp?: string | null;

  ipv4Id?: string[] | null;
  ipv6Id?: string[] | null;

  sslValidTo?: number | null;
  sslIssuer?: string | null;
}

export interface ICheck extends ICheckBase, ICheckMeta { 

}