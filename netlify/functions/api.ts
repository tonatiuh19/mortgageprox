import serverless from "serverless-http";

import { createServer } from "../../api/index";

export const handler = serverless(createServer());
