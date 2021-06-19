import {Module} from "../../shared/module/module";
import {registerConfigs} from "./config/configs";
import {registerServer} from "./server/server";

const output: Module = {
  configs: {
    register: registerConfigs
  },
  server: {
    register: registerServer
  },
  priority: 1178
};

export default output;