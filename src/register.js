import fetch from "node-fetch";
import { commands } from "./commands";

const token = process.argv[2];
const applicationId = process.argv[3];

if (!token || !applicationId) {
    console.error("Usage: node register.js <YOUR_BOT_TOKEN> <YOUR_APP_ID>");
    process.exit(1);
}

const url = `https://discord.com/api/v10/applications/${applicationId}/commands`;

console.log("Registering commands:", JSON.stringify(commands, null, 2));

const response = await fetch(url, {
    headers: {
        "Content-Type": "application/json",
        Authorization: `Bot ${token}`
    },
    method: "PUT",
    body: JSON.stringify(commands)
});

if (response.ok) {
    console.log("Registered commands successfully!");
    const data = await response.json();
    console.log(JSON.stringify(data, null, 2));
} else {
    console.error("Error registering commands:");
    let errorText = await response.text();
    try {
        console.error(JSON.stringify(JSON.parse(errorText), null, 2));
    } catch {
        console.error(errorText);
    }
    console.error(`Status: ${response.status}`);
}
