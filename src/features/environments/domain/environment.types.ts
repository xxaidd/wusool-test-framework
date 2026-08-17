export enum BackendEnvId {
  Local = "local",
  Development = "development",
  Staging = "staging",
  Custom = "custom",
}

export interface BackendEnvironment {
  id: BackendEnvId;
  label: string;
  baseUrl: string;
  /** true when it is a user-entered custom URL */
  custom?: boolean;
}
