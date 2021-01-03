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

  throw new Error(response.status);
}

client.once("ready", () => {
  console.log("Ready!");
});

client.on("message", async (message) => {
  if (message.author.bot) {
    return;
  }

  if (!message.content.startsWith(COMMAND_PREFIX) || message.content === "/h") {
    message.channel.send("Format of command is /send @<username_here>");
    return;
  }

  const mentions = Array.from(message.mentions.users.keys());
  const channel = message.channel.name;

  if (mentions.length == 0) {
    message.channel.send("Must mention some user");
    return;
  }

  console.log(mentions);
  const [userId, ...rest] = mentions;

  try {
    const { voucher, availableCount } = await fetch(`${BACKEND}/voucher`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        userId,
        channel,
      }),
    })
      .then(fetchStatusHandler)
      .then((res) => res.json());

    await sendMessage(voucher, userId);
    message.channel.send(
      `Successful allocation. Vouchers left: ${availableCount}`
    );
  } catch (error) {
    if (error.message === "404") {
      message.channel.send(`No More Available Vouchers`);
    } else if (error.message === "403") {
      message.channel.send(`User has already been allocated a voucher`);
    } else if (error.message === "406") {
      message.channel.send(`This channel has run out of vouchers`);
    } else if (error.message === "401") {
      message.channel.send(
        `User has already been allocated 2 vouchers across all channels`
      );
    } else {
      message.channel.send(
        "Oops, you shouldn't be seeing this...., please do let an organizer know this happened"
      );
    }
  }
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
