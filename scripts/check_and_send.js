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
// Priority: schedule.json > environment variable
const webhookUrl = schedule.discordWebhookUrl || process.env.DISCORD_WEBHOOK_URL;

if (!webhookUrl || !webhookUrl.startsWith('https://discord.com/api/webhooks/')) {
  console.error("❌ Invalid or missing Discord Webhook URL!");
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

  const submitUrl = `${GITHUB_PAGES_URL}/submit.html?team=${teamKey}&session=${mission.sessionIndex}`;

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

  const payload = {
    username: `📩 [${teamName}] 개인 지령관`,
    avatar_url: "https://cdn-icons-png.flaticon.com/512/2910/2910765.png",
    embeds: [{
      title: `📩 개인 시크릿 미션 발령!`,
      description: [
        `**${indMission.participant}** 요원에게 극비 개인 미션이 배정되었습니다!`,
        ``,
        `다른 조원 몰래 단독으로 수행하고 사진 인증하세요.`
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

// ─── Main Execution ───
async function run() {
  const teams = ['team1', 'team2'];
  let totalSent = 0;
  let totalSkipped = 0;
  let totalPending = 0;

  for (const teamKey of teams) {
    const teamData = schedule[teamKey];
    if (!teamData) {
      console.log(`⚠️ No data for ${teamKey}, skipping.`);
      continue;
    }

    const teamName = teamKey === 'team1' ? '1조' : '2조';
    console.log(`\n${'═'.repeat(50)}`);
    console.log(`  📋 Processing ${teamName} (${teamKey})`);
    console.log(`${'═'.repeat(50)}`);

    // ── 1. Team Session Missions ──
    if (teamData.missions && teamData.missions.length > 0) {
      console.log(`\n  🎯 Team Session Missions (${teamData.missions.length} total):`);

      for (const mission of teamData.missions) {
        if (mission.sent === true) {
          console.log(`    ⏭️ [Session #${mission.sessionIndex}] "${mission.title}" - Already sent at ${mission.sentAt}`);
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
          const diffMin = Math.round((scheduled.getTime() - now.getTime()) / 60000);
          if (diffMin > 0) {
            console.log(`    ⏳ [Session #${mission.sessionIndex}] "${mission.title}" - Due in ${diffMin}min`);
            totalPending++;
          } else {
            console.log(`    ⏩ [Session #${mission.sessionIndex}] "${mission.title}" - Stale (${Math.abs(diffMin)}min ago)`);
            totalSkipped++;
          }
        }
      }
    }

    // ── 2. Individual Personal Missions ──
    if (teamData.individualMissions && teamData.individualMissions.length > 0) {
      console.log(`\n  👤 Individual Missions (${teamData.individualMissions.length} total):`);

      for (const indMission of teamData.individualMissions) {
        if (indMission.sent === true) {
          console.log(`    ⏭️ [${indMission.participant}] "${indMission.title}" - Already sent at ${indMission.sentAt}`);
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
          const diffMin = Math.round((scheduled.getTime() - now.getTime()) / 60000);
          if (diffMin > 0) {
            console.log(`    ⏳ [${indMission.participant}] "${indMission.title}" - Due in ${diffMin}min`);
            totalPending++;
          } else {
            console.log(`    ⏩ [${indMission.participant}] "${indMission.title}" - Stale (${Math.abs(diffMin)}min ago)`);
            totalSkipped++;
          }
        }
      }
    }
  }

  // ── Summary ──
  console.log(`\n${'═'.repeat(50)}`);
  console.log(`  📊 EXECUTION SUMMARY`);
  console.log(`${'═'.repeat(50)}`);
  console.log(`  ✅ Sent:    ${totalSent}`);
  console.log(`  ⏭️ Skipped: ${totalSkipped}`);
  console.log(`  ⏳ Pending: ${totalPending}`);
  console.log(`  📝 Schedule updated: ${scheduleChanged ? 'YES' : 'NO'}`);

  if (scheduleChanged) {
    fs.writeFileSync(schedulePath, JSON.stringify(schedule, null, 2), 'utf8');
    console.log(`\n  💾 schedule.json saved with ${totalSent} mission(s) marked as sent.`);
  } else {
    console.log(`\n  ℹ️ No changes to schedule.json.`);
  }
}

run().catch(err => {
  console.error("❌ Fatal error:", err);
  process.exit(1);
});
