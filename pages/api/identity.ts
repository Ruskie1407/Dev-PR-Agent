import type { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  res.status(200).json({
    agent: process.env.AGENT_NAME || 'default-agent',
    vercelEnv: process.env.VERCEL_ENV || 'unknown',
    vercelUrl: process.env.VERCEL_URL || 'unknown',
  });
}
