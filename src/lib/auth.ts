import { betterAuth } from "better-auth";
import Database from "better-sqlite3";

import { admin } from "better-auth/plugins";

export const auth = betterAuth({
    database: new Database("./database.sqlite"),
    emailAndPassword: {
        enabled: true,
    },
    user: {
        additionalFields: {
            role: {
                type: "string",
                defaultValue: "user",
            },
            banned: {
                type: "boolean",
                defaultValue: false,
            }
        }
    },
    plugins: [
        admin(),
    ],
});
