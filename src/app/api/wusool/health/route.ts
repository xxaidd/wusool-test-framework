import { z } from "zod";
import { resolveEnvironment } from "@/infrastructure/server/environmentResolver";
import { serverProbe } from "@/infrastructure/server/wusoolServerClient";
import { fail, ok } from "../helpers";
import { envInputSchema } from "../schemas";

const bodySchema = z.object({ env: envInputSchema });

export async function POST(request: Request): Promise<Response> {
  try {
    const body = bodySchema.parse(await request.json());
    const env = await resolveEnvironment(body.env);
    const result = await serverProbe(env.baseUrl);
    return ok(result);
  } catch (err) {
    return fail(err);
  }
}
