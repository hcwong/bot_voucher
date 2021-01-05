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
  // If bot message or not start with the command prefix
  if (
    message.author.bot ||
    !message.content.startsWith(COMMAND_PREFIX) ||
    !isLegitAuthor(message)
  ) {
    return;
  }

  if (message.content === "/h") {
    sendMessageThenDelete(
      message,
      "Format of command is /send @<username_here>"
    );
    return;
  }

  const mentions = Array.from(message.mentions.users.keys());
  const channel = message.channel.name;

  if (mentions.length == 0) {
    sendMessageThenDelete(message, "Must mention some user");
    return;
  }

  // Just send one at a time oh well
  const [userId, ...rest] = mentions;
  const username = message.mentions.users.get(userId).username;

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
    console.log(`Sent voucher to ${username} successfully.`);
    sendMessageThenDelete(
      message,
      `Successful allocation to ${username}. Vouchers left: ${availableCount}`
    );
  } catch (error) {
    if (error.message === "404") {
      sendMessageThenDelete(message, `No more available vouchers in database`);
    } else if (error.message === "403") {
      sendMessageThenDelete(
        message,
        `User ${username} has already been allocated a voucher in this channel`
      );
    } else if (error.message === "401") {
      sendMessageThenDelete(message, `This channel has run out of vouchers`);
    } else if (error.message === "406") {
      sendMessageThenDelete(
        message,
        `User ${username} has already been allocated 2 vouchers (the max) across all channels`
      );
    } else {
      console.log(`Failed to send to ${username} with 500 Error`);
      sendMessageThenDelete(
        message,
        "Oops, you shouldn't be seeing this...., please do let an organizer know this happened"
      );
    }
  }
});

client.login(process.env.BOT_TOKEN);

// random helper funtions
const sendMessage = async (voucher, userId) => {
  try {
    const user = await client.users.fetch(userId);
    user.send(`Your voucher code is ${voucher}`);
  } catch (err) {
    console.log(`Error sending message to ${userId}`);
  }
};

const sendMessageThenDelete = (message, text) => {
  message.channel
    .send(text)
    .then((msgResult) => msgResult.delete({ timeout: 5000 }));
  message.delete({ timeout: 5000 });
};

const isLegitAuthor = (message) => {
  const sponsorsRole = message.guild.roles.cache.find(
    (role) => role.name === "sponsors"
  );
  const organizersRole = message.guild.roles.cache.find(
    (role) => role.name === "organizers"
  );

  return (
    message.member.roles.cache.has(sponsorsRole.id) ||
    message.member.roles.cache.has(organizersRole.id)
  );
};
