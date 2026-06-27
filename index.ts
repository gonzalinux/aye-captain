import { Client, GatewayIntentBits, Events, type Message } from 'discord.js';
import { investigate } from './src/investigator';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
});

client.once(Events.ClientReady, (c) => {
  console.log(`Aye aye! Logged in as ${c.user.tag}`);
});

client.on(Events.MessageCreate, async (message: Message) => {
  if (message.author.bot) return;
  if (!client.user || !message.mentions.has(client.user)) return;

  if (!message.channel.isThread()) {
    await message.reply(
      'Start a thread on the alert message and tag me there — I need the alert context from the thread.'
    );
    return;
  }

  const thread = message.channel;
  console.log(`[aye-captain] Triggered by ${message.author.tag} in thread "${thread.name}"`);
  await message.react('🔍');

  try {
    const starterMessage = await thread.fetchStarterMessage();

    const fetched = await thread.messages.fetch({ limit: 20 });
    const threadHistory = [...fetched.values()]
      .reverse()
      .filter((m) => m.id !== message.id)
      .map((m) => `[${m.author.username}]: ${m.content}`)
      .join('\n');

    const alertContent = extractAlertContent(starterMessage);

    const result = await investigate({
      alert: alertContent,
      threadHistory,
      userMessage: message.content,
    });

    for (const chunk of splitMessage(result)) {
      await thread.send(chunk);
    }

    await message.reactions.cache.get('🔍')?.remove();
    await message.react('✅');
  } catch (err) {
    console.error('Investigation failed:', err);
    await message.reactions.cache.get('🔍')?.remove();
    await message.react('❌');
    await message.reply('Investigation failed — check the server logs.');
  }
});

function extractAlertContent(message: Message | null): string {
  if (!message) return 'No alert message found.';
  const parts: string[] = [];
  if (message.content) parts.push(message.content);
  for (const embed of message.embeds) {
    if (embed.title) parts.push(`**${embed.title}**`);
    if (embed.description) parts.push(embed.description);
    for (const field of embed.fields) {
      parts.push(`${field.name}: ${field.value}`);
    }
  }
  return parts.join('\n') || 'Empty alert message.';
}

function splitMessage(text: string, maxLength = 1900): string[] {
  if (text.length <= maxLength) return [text];
  const chunks: string[] = [];
  let current = '';
  for (const line of text.split('\n')) {
    if (current.length + line.length + 1 > maxLength) {
      chunks.push(current.trim());
      current = '';
    }
    current += line + '\n';
  }
  if (current.trim()) chunks.push(current.trim());
  return chunks;
}

client.login(process.env.DISCORD_TOKEN);
