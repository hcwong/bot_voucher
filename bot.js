require("dotenv").config();
const Discord = require("discord.js");
const fetch = require("node-fetch");
const client = new Discord.Client();

const COMMAND_PREFIX = "/";
const BACKEND = process.env.BACKEND;

function fetchStatusHandler(response) {
  if (response.status === 200) {
    return response;
  }
  throw new Error(response);
}

client.once("ready", () => {
  console.log("Ready!");
});

client.on("message", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.content.startsWith(COMMAND_PREFIX) || message.content == "/h") {
    message.channel.send("Format of command is /send @<username_here>");
    return;
  }

  const mentions = Array.from(message.mentions.users.keys());
  const channel = message.channel.name;

  if (mentions.length == 0) {
    message.channel.send("Must mention some user");
    return;
  }

  const [userId, ...rest] = mentions;

  try {
    const { code, remaining_vouchers } = await fetch(`${BACKEND}/vouchers`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        channel,
      }),
    });
  } catch (error) {
    if (error.status == 400) {
      message.channel.send(`User has already been allocated a voucher`);
    } else {
      message.channel.send(
        "Oops, you shouldn't be seeing this...., please do let an organizer know this happened"
      );
    }

    return;
  }

  console.log(`Remaining: ${remaining_vouchers}`);
  await sendMessage(code, userId);
  message.channel.send("Successfully allocated Voucher.");
});

client.login(process.env.BOT_TOKEN);

const sendMessage = async (voucher, userId) => {
  try {
    const user = await client.users.fetch(userId);
    user.send(`Your voucher code is ${voucher}`);
  } catch (err) {
    console.log(`Error sending message to ${userId}`);
  }
};
