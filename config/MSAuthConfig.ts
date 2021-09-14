import {Config} from "../../../shared/config/types/config";

export interface MSAuthConfig extends Config {
  clientID: string;
  clientSecret: string;
  baseURL: string;
  callbackLocation: string;
  tenant: string;
  authURL: string;
  updateEmail: boolean;
  updateUsername: boolean;
  logoutURL: string;
}