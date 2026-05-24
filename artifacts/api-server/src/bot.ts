import {
  Client,
  GatewayIntentBits,
  PermissionFlagsBits,
  ChannelType,
  EmbedBuilder,
  Collection,
  type TextChannel,
  type GuildMember,
} from "discord.js";
import { logger } from "./lib/logger";

const STAFF_ROLE_ID = "1507070149767860415";
const PREFIX = "+";

const afkUsers = new Collection<string, { reason: string; since: number }>();

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.DirectMessages,
  ],
});

client.once("clientReady", () => {
  logger.info({ tag: client.user?.tag }, "Bot Discord connecté");
});

client.on("messageCreate", async (message) => {
  if (message.author.bot) return;
  if (!message.guild) return;

  const member = message.member as GuildMember;

  if (afkUsers.has(message.author.id)) {
    afkUsers.delete(message.author.id);
    const embed = new EmbedBuilder()
      .setColor(0x57f287)
      .setDescription(`✅ Bienvenue de retour **${message.author.username}** ! Ton statut AFK a été retiré.`);
    message.reply({ embeds: [embed] }).catch(() => {});
  }

  const mentioned = message.mentions.users;
  for (const [userId] of mentioned) {
    if (afkUsers.has(userId)) {
      const afkData = afkUsers.get(userId)!;
      const since = Math.floor((Date.now() - afkData.since) / 60000);
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setDescription(`💤 **${message.guild.members.cache.get(userId)?.user.username ?? "Ce membre"}** est AFK depuis ${since} min — *${afkData.reason}*`);
      message.reply({ embeds: [embed] }).catch(() => {});
    }
  }

  if (!message.content.startsWith(PREFIX)) return;

  const args = message.content.slice(PREFIX.length).trim().split(/ +/);
  const command = args.shift()?.toLowerCase();

  if (!command) return;

  switch (command) {

    case "clear": {
      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return void message.reply("❌ Tu n'as pas la permission `Gérer les messages`.");
      }
      const amount = parseInt(args[0] ?? "");
      if (isNaN(amount) || amount < 1 || amount > 100) {
        return void message.reply("❌ Donne un nombre entre 1 et 100. Ex: `+clear 10`");
      }
      const channel = message.channel as TextChannel;
      await message.delete().catch(() => {});
      const deleted = await channel.bulkDelete(amount, true).catch(() => null);
      const count = deleted?.size ?? 0;
      const confirm = await channel.send({
        embeds: [
          new EmbedBuilder()
            .setColor(0x5865f2)
            .setDescription(`🗑️ **${count}** message(s) supprimé(s).`)
        ]
      });
      setTimeout(() => confirm.delete().catch(() => {}), 3000);
      break;
    }

    case "afk": {
      const reason = args.join(" ") || "Pas de raison";
      afkUsers.set(message.author.id, { reason, since: Date.now() });
      const embed = new EmbedBuilder()
        .setColor(0xfee75c)
        .setDescription(`💤 **${message.author.username}** est maintenant AFK — *${reason}*`);
      await message.reply({ embeds: [embed] }).catch(() => {});
      break;
    }

    case "dm": {
      if (!member.permissions.has(PermissionFlagsBits.ManageMessages)) {
        return void message.reply("❌ Tu n'as pas la permission `Gérer les messages`.");
      }
      const target = message.mentions.members?.first();
      if (!target) {
        return void message.reply("❌ Mentionne un membre. Ex: `+dm @Membre bonjour`");
      }
      const dmContent = args.slice(1).join(" ");
      if (!dmContent) {
        return void message.reply("❌ Écris un message. Ex: `+dm @Membre bonjour`");
      }
      const dmEmbed = new EmbedBuilder()
        .setColor(0x5865f2)
        .setTitle(`📩 Message de ${message.guild.name}`)
        .setDescription(dmContent)
        .setFooter({ text: `Envoyé par ${message.author.tag}` });
      try {
        await target.send({ embeds: [dmEmbed] });
        await message.reply({
          embeds: [
            new EmbedBuilder()
              .setColor(0x57f287)
              .setDescription(`✅ DM envoyé à **${target.user.username}**.`)
          ]
        });
      } catch {
        await message.reply("❌ Impossible d'envoyer un DM à ce membre (DMs fermés).");
      }
      break;
    }

    case "lockdown": {
      if (!member.permissions.has(PermissionFlagsBits.ManageChannels)) {
        return void message.reply("❌ Tu n'as pas la permission `Gérer les salons`.");
      }

      const isOff = args[0]?.toLowerCase() === "off";
      const guild = message.guild;
      const everyoneRole = guild.roles.everyone;

      const textChannels = guild.channels.cache.filter(
        (ch) =>
          ch.type === ChannelType.GuildText ||
          ch.type === ChannelType.GuildAnnouncement
      );

      let success = 0;
      const promises = textChannels.map(async (ch) => {
        const channel = ch as TextChannel;
        try {
          if (isOff) {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: null,
            });
          } else {
            await channel.permissionOverwrites.edit(everyoneRole, {
              SendMessages: false,
            });
            await channel.permissionOverwrites.edit(STAFF_ROLE_ID, {
              SendMessages: true,
            });
          }
          success++;
        } catch {
        }
      });

      await Promise.all(promises);

      const embed = new EmbedBuilder()
        .setColor(isOff ? 0x57f287 : 0xed4245)
        .setTitle(isOff ? "🔓 Serveur déverrouillé" : "🔒 Serveur en lockdown")
        .setDescription(
          isOff
            ? `Tous les salons ont été déverrouillés. (${success} salons)`
            : `Tous les salons sont verrouillés. Seul le staff peut parler. (${success} salons)`
        )
        .setTimestamp();

      await message.reply({ embeds: [embed] });
      break;
    }

    default:
      break;
  }
});

export function startBot(): void {
  const token = process.env["DISCORD_TOKEN"];
  if (!token) {
    logger.error("DISCORD_TOKEN manquant — bot non démarré");
    return;
  }
  client.login(token).catch((err) => {
    logger.error({ err }, "Échec de connexion du bot Discord");
  });
}
