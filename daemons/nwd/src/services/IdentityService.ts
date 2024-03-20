export class IdentityService {
  private _pubkey: string;

  constructor(){}

  set pubkey(pubkey: string){
    this._pubkey = pubkey
  }

  get pubkey(): string {
    return this._pubkey
  }
}