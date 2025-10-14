import { createClient } from "@libsql/client";

const url  = process.env.LIBSQL_URL!;
const auth = process.env.LIBSQL_AUTH_TOKEN!;

export const db = createClient({ url, authToken: auth });
