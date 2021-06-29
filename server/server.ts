import {Express, Request, Response} from "express";
import passport from "passport";
import {SharedData} from "../../../shared/module/moduleLoader";
import {Strategy as AzureAdOAuth2Strategy} from "passport-azure-ad-oauth2";
import jwt from "jsonwebtoken";
import {GetConfig} from "../../../shared/config/configStore";
import {MSAuthConfig} from "../config/MSAuthConfig";
import {getUsersCount, IUser} from "../../../server/database/models/user";
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

  let createdOwner = false;

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
        let flag = false;

        if(configs.updateEmail && foundUser.email !== req.user.upn) {
          foundUser.email = req.user.upn;
          flag = true;
        }

        if(configs.updateUsername && foundUser.username !== req.user.given_name) {
          foundUser.username = req.user.given_name;
          flag = true;
        }

        if(flag) {
          await foundUser.save();
        }

        req.session.user = <IUser>foundUser.toObject();
      } else {
        const count = await getUsersCount();
        if(count === 0) createdOwner = true;

        const user = new User({
          email: req.user.upn,
          username: req.user.given_name,
          permissions: (count === 0 ? ["owner", "admin"] : []),
          modules: {
            msauth: {
              oid: req.user.oid
            }
          }
        });

        await user.save();

        req.session.user = <IUser>user.toObject();
      }

      res.redirect(req.session.lastURL || "/");
      req.session.lastURL = null;
    });

  app.use(async (req, res, next) => {
    if(!createdOwner && await getUsersCount() === 0) {
      return res.redirect(configs.authURL);
    }

    createdOwner = true;
    next();
  });
};