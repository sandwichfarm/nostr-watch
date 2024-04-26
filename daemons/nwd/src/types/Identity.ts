export type IdentityConfig = {
  slug?: string,
  profile?: IdentityProfile,
  keys: IndentityKeys
}

export type IndentityKeys = {
  public: string,
  private: string,
}

export type IdentityProfile ={
  name?: string,
  image?: string,
  picture: string,
  about?: string,
  nip05?: string,
  lud06?: string,
}
