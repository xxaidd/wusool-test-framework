import axios, { AxiosError } from "axios";

export interface HealthResult {
  ok: boolean;
  status: number;
}

export async function checkHealth(baseUrl: string): Promise<HealthResult> {
  try {
    const res = await axios.get(`${baseUrl.replace(/\/$/, "")}/`, {
      timeout: 10000,
    });
    return { ok: res.status >= 200 && res.status < 300, status: res.status };
  } catch (err) {
    if (err instanceof AxiosError && err.response) {
      return { ok: false, status: err.response.status };
    }
    return { ok: false, status: 0 };
  }
}
