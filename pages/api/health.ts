import type { NextApiRequest, NextApiResponse } from "next";
export default function handler(_req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({ ok: true, agent: process.env.AGENT_NAME || "new-agent" });
}
