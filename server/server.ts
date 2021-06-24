import {Express, Request, Response} from "express";
import passport from "passport";
import {SharedData} from "../../../shared/module/moduleLoader";
import {Strategy as AzureAdOAuth2Strategy} from "passport-azure-ad-oauth2";
import jwt from "jsonwebtoken";
import {GetConfig} from "../../../shared/config/configStore";
import {MSAuthConfig} from "../config/MSAuthConfig";
import {IUser} from "../../../server/database/models/user";
import User from "../../../server/database/models/user";
import {registerAuthReq} from "../../../server/util/auth";

declare module "express-session" {
  export interface SessionData {
    user?: IUser;
    lastURL?: string;
  }
}

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface User {
      given_name: string;
      upn: string;
      oid: string;
    }
  }
}

export const registerServer = (app: Express) => {
  const configs = GetConfig<MSAuthConfig>("server/microsoft-auth.json");

  registerAuthReq((req: Request, res: Response) => {
    if(!req.session.user) {
      res.redirect(configs.authURL);
      return true;
    }

    return false;
  });

  if(!SharedData["passport"]) {
    app.use(passport.initialize());

    SharedData["passport"] = true;
  }

  passport.use(
    new AzureAdOAuth2Strategy(
      {
        clientID: configs.clientID,
        clientSecret: configs.clientSecret,
        callbackURL: configs.baseURL + configs.callbackLocation,
        tenant: configs.tenant,
        authorizationURL: "https://login.microsoftonline.com/" + configs.tenant + "/oauth2/authorize" + "?prompt=select_account"
      },
      function (accessToken, refresh_token, params, profile, done) {
        // currently we can't find a way to exchange access token by user info (see userProfile implementation), so
        // you will need a jwt-package like https://github.com/auth0/node-jsonwebtoken to decode id_token and get waad profile
        const waadProfile = jwt.decode(params.id_token);

        done(null, waadProfile);
      }
    )
  );

  app.get(configs.authURL, passport.authenticate("azure_ad_oauth2"));

  app.get(
    configs.callbackLocation,
    passport.authenticate("azure_ad_oauth2", {
      session: false,
      failureRedirect: "/error"
    }),
    async (req: Request, res: Response) => {
      if(req.session.user) return res.redirect("/");

      const foundUser = await User.findOne({"modules.msauth.oid": req.user.oid});

      if(foundUser) {
        req.session.user = foundUser;
      } else {
        const count = await getUsersCount();

        const user = new User({
          username: req.user.given_name,
          permissions: (count === 0 ? ["owner", "admin"] : []),
          modules: {
            msauth: {
              oid: req.user.oid,
              email: req.user.upn
            }
          }
        });

        await user.save();

        req.session.user = <IUser>user.toObject();
      }

      res.redirect(req.session.lastURL || "/");
      req.session.lastURL = null;
    });
};

const getUsersCount = () : Promise<number> => {
  return new Promise<number>((resolve, reject) => {
    User.count((err, count) => {
      if(err) return reject(err);

      resolve(count);
    });
  });
};