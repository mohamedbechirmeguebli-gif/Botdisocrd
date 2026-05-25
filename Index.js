client.on("ready", () => {
  console.log(`✅ Connecté en tant que ${client.user.tag}`);
});

client.on("error", console.error);

process.on("unhandledRejection", console.error);

client.login(process.env.TOKEN);
