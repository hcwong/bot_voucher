require("dotenv").config();
const Discord = require("discord.js");
const client = new Discord.Client();

const COMMAND_PREFIX = "/";

client.once("ready", () => {
  console.log("Ready!");
});

client.on("message", (message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.content.startsWith(COMMAND_PREFIX)) {
    message.channel.send("Format of command is /send <username_here>");
    return;
  }

  const args = message.content.split(" ");
  const channel = message.channel.name;
  return;
});

client.login(process.env.BOT_TOKEN);
