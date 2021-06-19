import {RegisterConfig} from "../../../shared/config/configFilesManager";

export const registerConfigs = () => {
  RegisterConfig({name: "microsoft-auth.json", default: JSON.stringify(config, null, 4)});
};

const config = {
  clientID: "CLIENT ID",
  clientSecret: "CLIENT SECRET",
  __comment__URLS: "The below URLS refer to the path users will be redirected to to complete sign-in. The baseURL should be the part of the url with no path, and the callbackURL should be the path of the URL.",
  baseURL: "https://example.com",
  callbackLocation: "/callback",
  __comment__tenent: "The below field refers to the domain that accounts must be part of to sign in.",
  tenant: "example.com",
  __comment__authLocation: "The below field is the location that will redirect users to the login page.",
  authURL: "/login"
};