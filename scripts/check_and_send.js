const fs = require('fs');
const path = require('path');

const schedulePath = path.join(__dirname, '..', 'schedule.json');
if (!fs.existsSync(schedulePath)) {
  console.error("schedule.json not found!");
  process.exit(1);
}

const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));
const webhookUrl = process.env.DISCORD_WEBHOOK_URL || schedule.discordWebhookUrl;

if (!webhookUrl || !webhookUrl.startsWith('http')) {
  console.error("Invalid or missing Discord Webhook URL!");
  process.exit(1);
}

const now = new Date();
let scheduleChanged = false;

async function sendWebhook(mission, teamName) {
  const repoPath = process.env.GITHUB_REPOSITORY || "";
  const pat = process.env.GITHUB_TOKEN || "";
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  const webAppUrl = schedule.webAppUrl || "http://localhost:3002";
  
  const callbackUrl = `${webAppUrl}/submit.html?repo=${encodeURIComponent(repoPath)}&pat=${encodeURIComponent(pat)}&team=${teamName === '1조' ? 'team1' : 'team2'}&session=${mission.sessionIndex}&gemini=${encodeURIComponent(geminiApiKey)}`;

  const payload = {
    username: `[${teamName}] 시크릿 커맨더`,
    avatar_url: teamName.includes("1조") 
      ? "https://raw.githubusercontent.com/run-llama/llama_index/main/docs/_static/favicon.ico"
      : "https://i.imgur.com/83p1jep.png",
    embeds: [{
      title: `🚨 [기습 미션 발령] ${teamName === '1조' ? '2조는 들으라!' : '1조는 들으라!'} 🚨`,
      description: `**${teamName} 시크릿 커맨더**로부터 기습 미션 카드가 투척되었습니다.\n제한 시간 내에 완수하고 아래 링크로 사진을 인증해 주세요!\n\n📷 **[여기서 미션 사진 인증 제출하기](${callbackUrl})**`,
      color: mission.colorHex || 16724870,
      fields: [
        { name: "🎯 미션명", value: `**${mission.title}**`, inline: false },
        { name: "📋 미션 상세 내용", value: `>>> ${mission.content}`, inline: false },
        { name: "📍 발동 시간대", value: `${mission.sessionName} (${mission.timeRange})`, inline: true },
        { name: "⏱️ 제한 시간", value: `⏳ **${mission.duration} 이내 인증**`, inline: true },
        { name: "💡 수행 팁", value: `*${mission.tip}*`, inline: false }
      ],
      footer: {
        text: "워크숍 미션전쟁 • 자동 스케줄러 시스템",
        icon_url: "https://i.imgur.com/83p1jep.png"
      },
      timestamp: new Date().toISOString()
    }]
  };

  console.log(`Sending webhook for mission: ${mission.title} (${teamName})...`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log(`Successfully sent mission: ${mission.title}`);
      return true;
    } else {
      console.error(`Failed to send webhook: HTTP ${response.status}`);
      return false;
    }
  } catch (err) {
    console.error(`Error sending webhook: ${err.message}`);
    return false;
  }
}

async function sendIndividualWebhook(ind, teamName, teamKey) {
  const repoPath = process.env.GITHUB_REPOSITORY || "";
  const pat = process.env.GITHUB_TOKEN || "";
  const geminiApiKey = process.env.GEMINI_API_KEY || "";
  const webAppUrl = schedule.webAppUrl || "http://localhost:3002";
  
  const callbackUrl = `${webAppUrl}/submit.html?repo=${encodeURIComponent(repoPath)}&pat=${encodeURIComponent(pat)}&team=${teamKey}&type=individual&participant=${encodeURIComponent(ind.participant)}&title=${encodeURIComponent(ind.title)}&content=${encodeURIComponent(ind.content)}&gemini=${encodeURIComponent(geminiApiKey)}&webhook=${encodeURIComponent(webhookUrl)}`;

  const payload = {
    username: "[개인 지령] 시크릿 지휘소",
    avatar_url: "https://i.imgur.com/83p1jep.png",
    embeds: [{
      title: "👤 🚨 [개인 기습 지령 발령] 🚨",
      description: `**${teamName}**의 **${ind.participant}** 요원은 즉각 본 기습 지령을 수행하십시오!\n제한 시간 내에 완수하고 아래 링크로 사진을 인증해 주세요!\n\n📷 **[여기서 개인 미션 사진 인증 제출하기](${callbackUrl})**`,
      color: ind.colorHex || 3394815,
      fields: [
        { name: "👤 대상 요원", value: `**${ind.participant} 요원**`, inline: true },
        { name: "🎯 개인 미션", value: `**${ind.title}**`, inline: true },
        { name: "⏳ 제한 시간", value: `⏳ **${ind.duration} 이내 인증**`, inline: true },
        { name: "📋 미션 상세 내용", value: `>>> ${ind.content}`, inline: false },
        { name: "💡 수행 팁", value: `*${ind.tip}*`, inline: false }
      ],
      footer: {
        text: "워크숍 미션전쟁 • 개인 지령 제어 장치",
        icon_url: "https://i.imgur.com/83p1jep.png"
      },
      timestamp: new Date().toISOString()
    }]
  };

  console.log(`Sending individual webhook for ${ind.participant}...\n`);
  
  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (response.ok) {
      console.log(`Successfully sent individual mission for ${ind.participant}`);
      return true;
    } else {
      console.error(`Failed to send individual webhook: HTTP ${response.status}`);
      return false;
    }
  } catch (err) {
    console.error(`Error sending individual webhook: ${err.message}`);
    return false;
  }
}

async function run() {
  if (process.env.DISCORD_WEBHOOK_URL) {
    schedule.discordWebhookUrl = process.env.DISCORD_WEBHOOK_URL;
    scheduleChanged = true;
  }
  const teams = ['team1', 'team2'];
  for (const teamKey of teams) {
    const teamData = schedule[teamKey];
    if (!teamData) continue;
    const teamName = teamKey === 'team1' ? '1조' : '2조';
    
    // 1. Process Team Scheduled Missions
    if (teamData.missions) {
      for (const mission of teamData.missions) {
        if (mission.sent) continue;
        const scheduledDate = new Date(mission.scheduledTime);
        if (now >= scheduledDate) {
          const success = await sendWebhook(mission, teamName);
          if (success) {
            mission.sent = true;
            mission.sentAt = now.toISOString();
            scheduleChanged = true;
          }
        }
      }
    }
    
    // 2. Process Individual Scheduled Missions
    if (teamData.individualMissions) {
      for (const ind of teamData.individualMissions) {
        if (ind.sent) continue;
        const scheduledDate = new Date(ind.scheduledTime);
        if (now >= scheduledDate) {
          const success = await sendIndividualWebhook(ind, teamName, teamKey);
          if (success) {
            ind.sent = true;
            ind.sentAt = now.toISOString();
            scheduleChanged = true;
          }
        }
      }
    }
  }
  if (scheduleChanged) {
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), 'utf8');
    console.log("schedule.json updated.");
  } else {
    console.log("No pending scheduled missions.");
  }
}
run();
