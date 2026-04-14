import { prisma } from "@/lib/prisma";

type ActionPlanItem = {
  task: string;
  responsible: string;
  deadline: string;
  priority: "alta" | "media" | "baixa";
};

type ActionPlan = {
  items: ActionPlanItem[];
  nextMeetingTopics: string[];
  followUpDate: string;
};

async function slackPost(endpoint: string, body: Record<string, unknown>) {
  const res = await fetch(`https://slack.com/api/${endpoint}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.SLACK_BOT_TOKEN}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) throw new Error(`Slack API error: ${res.status}`);
  const data = await res.json();
  if (!data.ok) throw new Error(`Slack error: ${data.error}`);
  return data;
}

// Format action plan as Slack blocks
function formatActionPlanBlocks(
  clientName: string,
  sessionTitle: string,
  sessionDate: string,
  summary: string,
  actionPlan: ActionPlan,
  actionItems: string[]
) {
  const priorityEmoji: Record<string, string> = {
    alta: ":red_circle:",
    media: ":large_yellow_circle:",
    baixa: ":large_green_circle:",
  };

  const blocks: Record<string, unknown>[] = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `Plano de Acao - ${clientName}`,
      },
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*Sessao:* ${sessionTitle}\n*Data:* ${sessionDate}\n\n${summary}`,
      },
    },
    { type: "divider" },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: "*:clipboard: Plano de Acao:*",
      },
    },
  ];

  // Add each action item
  for (const item of actionPlan.items) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${priorityEmoji[item.priority] ?? ":white_circle:"} *${item.task}*\n> Responsavel: ${item.responsible} | Prazo: ${item.deadline}`,
      },
    });
  }

  // Next meeting topics
  if (actionPlan.nextMeetingTopics.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*:calendar: Topicos proxima reuniao:*\n${actionPlan.nextMeetingTopics.map((t) => `• ${t}`).join("\n")}`,
        },
      }
    );
  }

  // Follow-up date
  if (actionPlan.followUpDate) {
    blocks.push({
      type: "context",
      elements: [
        {
          type: "mrkdwn",
          text: `:date: Follow-up sugerido: *${actionPlan.followUpDate}*`,
        },
      ],
    });
  }

  // Simple action items list
  if (actionItems.length > 0) {
    blocks.push(
      { type: "divider" },
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*:rocket: Proximos Passos:*\n${actionItems.map((item, i) => `${i + 1}. ${item}`).join("\n")}`,
        },
      }
    );
  }

  blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: "_Gerado automaticamente pela Boom Platform_",
      },
    ],
  });

  return blocks;
}

// Send action plan to a Slack channel
export async function sendActionPlanToSlack(sessionId: string): Promise<void> {
  const session = await prisma.session.findUniqueOrThrow({
    where: { id: sessionId },
    include: { client: true },
  });

  if (!session.actionPlan) {
    throw new Error("Sessao sem plano de acao. Analise a reuniao primeiro.");
  }

  const channelId = session.slackChannelId || session.client.slackChannelId;
  if (!channelId) {
    throw new Error("Cliente sem canal Slack configurado.");
  }

  const actionPlan = session.actionPlan as unknown as ActionPlan;
  const actionItems = (session.actionItems as string[]) ?? [];
  const summary = session.firefliesSummary ?? "";

  const blocks = formatActionPlanBlocks(
    session.client.name,
    session.title,
    session.date?.toLocaleDateString("pt-PT") ?? "N/A",
    summary,
    actionPlan,
    actionItems
  );

  await slackPost("chat.postMessage", {
    channel: channelId,
    text: `Plano de Acao - ${session.client.name} - ${session.title}`,
    blocks,
  });

  // Mark as sent
  await prisma.session.update({
    where: { id: sessionId },
    data: { actionPlanSentAt: new Date() },
  });
}

// List Slack channels (for configuration)
export async function listSlackChannels(): Promise<
  { id: string; name: string }[]
> {
  const data = await slackPost("conversations.list", {
    types: "public_channel,private_channel",
    limit: 200,
  });

  return (data.channels ?? []).map(
    (ch: { id: string; name: string }) => ({
      id: ch.id,
      name: ch.name,
    })
  );
}
