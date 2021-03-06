import {ServerSide} from "../../../shared/module/moduleServer";
import {registerServer} from "./server";

const output: ServerSide = {
  register: registerServer,
  priority: 1256,
  identifier: "microsoft-auth"
};

export default output;