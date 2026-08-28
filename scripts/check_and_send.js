const fs = require('fs');
const path = require('path');

// ─── Load schedule.json ───
const schedulePath = path.join(__dirname, '..', 'schedule.json');
if (!fs.existsSync(schedulePath)) {
  console.error("❌ schedule.json not found!");
  process.exit(1);
}

const schedule = JSON.parse(fs.readFileSync(schedulePath, 'utf8'));

// ─── Discord Webhook URL Resolution ───
// We ONLY use the environment variable process.env.DISCORD_WEBHOOK_URL to keep it 100% secret!
const webhookUrl = process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
  console.error("❌ Invalid or missing DISCORD_WEBHOOK_URL environment variable!");
  process.exit(1);
}

// ─── GitHub Pages base URL (for submit callback links) ───
const GITHUB_PAGES_URL = "https://mhsssshin.github.io/missionwar_t";

// ─── Current time (KST) ───
const now = new Date();
console.log(`\n🕐 Current Time (KST): ${now.toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' })}`);
console.log(`   ISO: ${now.toISOString()}\n`);

let scheduleChanged = false;

// ─── Rate limit helper (Discord allows ~30 requests per minute) ───
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}



// ─── Send Discord Webhook for Team Session Mission ───
async function sendTeamMissionWebhook(mission, teamKey) {
  const teamName = teamKey === 'team1' ? '1조' : '2조';
  const oppositeTeam = teamKey === 'team1' ? '2조' : '1조';

  const submitUrl = `${GITHUB_PAGES_URL}/submit.html?team=${teamKey}&session=${mission.sessionIndex}&webhook=${encodeURIComponent(webhookUrl)}`;

  const payload = {
    username: `🎖️ [${teamName}] 시크릿 커맨더`,
    avatar_url: teamKey === 'team1'
      ? "https://cdn-icons-png.flaticon.com/512/4436/4436481.png"
      : "https://cdn-icons-png.flaticon.com/512/4436/4436452.png",
    content: `@everyone 🚨 **[${teamName}] 기습 미션이 발령되었습니다!** 🚨`,
    embeds: [{
      title: `🔥 기습 미션 #${mission.sessionIndex} 발령!`,
      description: [
        `**${oppositeTeam}는 들으라!** ${teamName} 시크릿 커맨더로부터 기습 미션이 투척되었습니다.`,
        ``,
        `제한 시간 내에 미션을 완수하고 아래 링크로 인증하세요!`,
        ``,
        `📷 **[👉 여기를 클릭하여 미션 사진 인증하기](${submitUrl})**`
      ].join('\n'),
      color: mission.colorHex || 16724870,
      fields: [
        { name: "🎯 미션명", value: `**${mission.emoji || '🎯'} ${mission.title}**`, inline: false },
        { name: "📋 미션 상세", value: `>>> ${mission.content}`, inline: false },
        { name: "📍 세션", value: `${mission.sessionName}`, inline: true },
        { name: "⏱️ 제한 시간", value: `⏳ **${mission.duration} 이내**`, inline: true },
        { name: "💡 수행 팁", value: `*${mission.tip || '미션 지령대로 행동해 주세요.'}*`, inline: false }
      ],
      footer: {
        text: `워크숍 미션전쟁 • ${teamName} 자동 스케줄러`,
        icon_url: "https://cdn-icons-png.flaticon.com/512/3176/3176371.png"
      },
      timestamp: new Date().toISOString()
    }]
  };

  return await postToDiscord(payload, `[${teamName}] 세션미션 #${mission.sessionIndex}: ${mission.title}`);
}

// ─── Send Discord Webhook for Individual Personal Mission ───
async function sendIndividualMissionWebhook(indMission, teamKey) {
  const teamName = teamKey === 'team1' ? '1조' : '2조';

  const submitUrl = `${GITHUB_PAGES_URL}/submit.html?team=${teamKey}&type=individual&participant=${encodeURIComponent(indMission.participant)}&title=${encodeURIComponent(indMission.title)}&content=${encodeURIComponent(indMission.content)}&webhook=${encodeURIComponent(webhookUrl)}`;

  const payload = {
    username: `📩 [${teamName}] 개인 지령관`,
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2910/2910765.png",
    embeds: [{
      title: `📩 개인 시크릿 미션 발령!`,
      description: [
        `**${indMission.participant}** 요원에게 극비 개인 미션이 배정되었습니다!`,
        ``,
        `다른 조원 몰래 단독으로 수행하고 사진 인증하세요.`,
        ``,
        `📷 **[👉 여기를 클릭하여 개인 미션 사진 인증하기](${submitUrl})**`
      ].join('\n'),
      color: indMission.colorHex || 65535,
      fields: [
        { name: "👤 대상 요원", value: `**${indMission.participant}**`, inline: true },
        { name: "⏱️ 제한 시간", value: `⏳ **${indMission.duration} 이내**`, inline: true },
        { name: `${indMission.emoji || '🎯'} 미션명`, value: `**${indMission.title}**`, inline: false },
        { name: "📋 미션 상세", value: `>>> ${indMission.content}`, inline: false },
        { name: "💡 수행 팁", value: `*${indMission.tip || '미션 지령대로 행동해 주세요.'}*`, inline: false }
      ],
      footer: {
        text: `워크숍 미션전쟁 • ${teamName} 개인 지령 시스템`,
        icon_url: "https://cdn-icons-png.flaticon.com/512/3176/3176371.png"
      },
      timestamp: new Date().toISOString()
    }]
  };

  return await postToDiscord(payload, `[${teamName}] 개인미션 → ${indMission.participant}: ${indMission.title}`);
}

// ─── Common Discord POST helper ───
async function postToDiscord(payload, logLabel) {
  console.log(`  📤 Sending: ${logLabel}...`);

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      console.log(`  ✅ SUCCESS: ${logLabel}`);
      return true;
    } else if (response.status === 429) {
      const retryAfter = parseInt(response.headers.get('retry-after') || '5', 10);
      console.warn(`  ⚠️ Rate limited. Retrying after ${retryAfter}s...`);
      await delay(retryAfter * 1000);
      const retryResponse = await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (retryResponse.ok) {
        console.log(`  ✅ SUCCESS (retry): ${logLabel}`);
        return true;
      }
      console.error(`  ❌ FAILED after retry: HTTP ${retryResponse.status}`);
      return false;
    } else {
      const body = await response.text();
      console.error(`  ❌ FAILED: HTTP ${response.status} - ${body}`);
      return false;
    }
  } catch (err) {
    console.error(`  ❌ ERROR: ${err.message}`);
    return false;
  }
}

// ─── Check if a scheduled time has arrived ───
function isTimeToSend(scheduledTimeStr) {
  if (!scheduledTimeStr) return false;
  const scheduled = new Date(scheduledTimeStr);
  const diffMs = now.getTime() - scheduled.getTime();
  // Send if current time is at or past the scheduled time
  // But don't send if more than 30 minutes past (stale guard)
  return diffMs >= 0 && diffMs <= 30 * 60 * 1000;
}

// ─── Dispatcher logic based on GITHUB ACTIONS inputs ───
const sendMode = process.env.SEND_MODE || 'scheduled';
const targetTeam = process.env.TARGET_TEAM; // 'team1' or 'team2'
const targetSession = process.env.TARGET_SESSION; // e.g. "1" to "5"
const targetParticipant = process.env.TARGET_PARTICIPANT; // e.g. "권남훈"

async function run() {
  console.log(`🚀 Run mode: ${sendMode}`);

  if (sendMode === 'instant_session') {
    if (!targetTeam || !targetSession) {
      console.error("❌ Missing TARGET_TEAM or TARGET_SESSION for instant_session mode!");
      process.exit(1);
    }
    const teamData = schedule[targetTeam];
    const mission = teamData.missions.find(m => String(m.sessionIndex) === String(targetSession));
    if (!mission) {
      console.error(`❌ Mission not found for team ${targetTeam}, session ${targetSession}`);
      process.exit(1);
    }
    console.log(`🔥 Instant session mission trigger: ${mission.title} (${targetTeam})`);
    const success = await sendTeamMissionWebhook(mission, targetTeam);
    if (success) {
      mission.sent = true;
      mission.sentAt = now.toISOString();
      scheduleChanged = true;
    }
  } else if (sendMode === 'instant_individual') {
    if (!targetTeam || !targetParticipant) {
      console.error("❌ Missing TARGET_TEAM or TARGET_PARTICIPANT for instant_individual mode!");
      process.exit(1);
    }
    const teamData = schedule[targetTeam];
    const indMission = teamData.individualMissions.find(m => m.participant === targetParticipant);
    if (!indMission) {
      console.error(`❌ Individual mission not found for participant ${targetParticipant} (${targetTeam})`);
      process.exit(1);
    }
    console.log(`🔥 Instant individual mission trigger for ${targetParticipant} (${targetTeam})`);
    const success = await sendIndividualMissionWebhook(indMission, targetTeam);
    if (success) {
      indMission.sent = true;
      indMission.sentAt = now.toISOString();
      scheduleChanged = true;
    }
  } else {
    // Scheduled mode: run the original loop
    const teams = ['team1', 'team2'];
    let totalSent = 0;
    let totalSkipped = 0;
    let totalPending = 0;

    for (const teamKey of teams) {
      const teamData = schedule[teamKey];
      if (!teamData) continue;

      const teamName = teamKey === 'team1' ? '1조' : '2조';
      console.log(`\nProcessing ${teamName} (${teamKey})`);

      // ── 1. Team Session Missions ──
      if (teamData.missions) {
        for (const mission of teamData.missions) {
          if (mission.sent === true) {
            totalSkipped++;
            continue;
          }
          if (isTimeToSend(mission.scheduledTime)) {
            const success = await sendTeamMissionWebhook(mission, teamKey);
            if (success) {
              mission.sent = true;
              mission.sentAt = now.toISOString();
              scheduleChanged = true;
              totalSent++;
            }
            await delay(1500);
          } else {
            const scheduled = new Date(mission.scheduledTime);
            if (scheduled.getTime() > now.getTime()) {
              totalPending++;
            } else {
              totalSkipped++;
            }
          }
        }
      }

      // ── 2. Individual Personal Missions ──
      if (teamData.individualMissions) {
        for (const indMission of teamData.individualMissions) {
          if (indMission.sent === true) {
            totalSkipped++;
            continue;
          }
          if (isTimeToSend(indMission.scheduledTime)) {
            const success = await sendIndividualMissionWebhook(indMission, teamKey);
            if (success) {
              indMission.sent = true;
              indMission.sentAt = now.toISOString();
              scheduleChanged = true;
              totalSent++;
            }
            await delay(1500);
          } else {
            const scheduled = new Date(indMission.scheduledTime);
            if (scheduled.getTime() > now.getTime()) {
              totalPending++;
            } else {
              totalSkipped++;
            }
          }
        }
      }
    }
    console.log(`\n📊 Scheduled mode summary: Sent: ${totalSent}, Skipped: ${totalSkipped}, Pending: ${totalPending}`);
  }

  if (scheduleChanged) {
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), 'utf8');
    console.log(`\n💾 schedule.json updated successfully.`);
  } else {
    console.log(`\nℹ️ No changes to schedule.json.`);
  }
}

run().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
