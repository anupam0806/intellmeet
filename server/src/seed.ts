import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Team } from "./models/Team.js";
import { User, IUser } from "./models/User.js";
import { Meeting } from "./models/Meeting.js";
import { TranscriptSegment } from "./models/TranscriptSegment.js";
import { ChatMessage } from "./models/ChatMessage.js";

export interface SeedOptions {
  reset?: boolean;
  uri?: string;
  silent?: boolean;
}

export interface SeedResult {
  teamCount: number;
  userCount: number;
  meetingCount: number;
  transcriptCount: number;
  chatCount: number;
  emails: string[];
}

const BCRYPT_ROUNDS = 12;
const DEMO_PASSWORD = "Demo@12345";
const TEAM_NAME = "Brightwell Design Co.";
const INVITE_CODE = "BRIGHT24";

export async function runSeed(options: SeedOptions = {}): Promise<SeedResult> {
  const wasAlreadyConnected = mongoose.connection.readyState === 1;
  if (!wasAlreadyConnected) {
    const uri = options.uri || process.env.MONGODB_URI;
    if (!uri || uri.trim() === "") {
      throw new Error("MONGODB_URI is required to run the seed script.");
    }
    await mongoose.connect(uri);
  }

  try {
    // If --reset is specified, delete ONLY the Brightwell team's data
    if (options.reset) {
      const existingTeam = await Team.findOne({ name: TEAM_NAME });
      if (existingTeam) {
        await ChatMessage.deleteMany({ teamId: existingTeam._id });
        await TranscriptSegment.deleteMany({ teamId: existingTeam._id });
        await Meeting.deleteMany({ teamId: existingTeam._id });
        await User.deleteMany({ teamId: existingTeam._id });
        await Team.deleteOne({ _id: existingTeam._id });
      }
    }

    // Hash password with bcrypt cost 12
    const passwordHash = await bcrypt.hash(DEMO_PASSWORD, BCRYPT_ROUNDS);

    // 1. Upsert Team
    const dummyOwnerId = new mongoose.Types.ObjectId();
    let team = await Team.findOne({ name: TEAM_NAME });
    if (!team) {
      team = await Team.create({
        name: TEAM_NAME,
        inviteCode: INVITE_CODE,
        ownerId: dummyOwnerId,
      });
    } else {
      team.inviteCode = INVITE_CODE;
      await team.save();
    }

    // 2. Upsert Users
    const usersConfig = [
      { name: "Maya Chen", email: "maya@brightwell.test", role: "ADMIN" as const },
      { name: "Dev Patel", email: "dev@brightwell.test", role: "MEMBER" as const },
      { name: "Lena Fischer", email: "lena@brightwell.test", role: "MEMBER" as const },
      { name: "Omar Haddad", email: "omar@brightwell.test", role: "MEMBER" as const },
      { name: "Sofia Rossi", email: "sofia@brightwell.test", role: "MEMBER" as const },
    ];

    const userMap = new Map<string, IUser>();
    for (const u of usersConfig) {
      let user = await User.findOne({ email: u.email });
      if (!user) {
        user = await User.create({
          name: u.name,
          email: u.email,
          role: u.role,
          teamId: team._id,
          passwordHash,
        });
      } else {
        user.name = u.name;
        user.role = u.role;
        user.teamId = team._id;
        user.passwordHash = passwordHash;
        await user.save();
      }
      userMap.set(u.email, user);
    }

    // Update team owner to Maya
    const maya = userMap.get("maya@brightwell.test")!;
    const dev = userMap.get("dev@brightwell.test")!;
    const lena = userMap.get("lena@brightwell.test")!;
    const omar = userMap.get("omar@brightwell.test")!;
    const sofia = userMap.get("sofia@brightwell.test")!;

    team.ownerId = maya._id;
    await team.save();

    // 3. Upsert Meetings
    // Meeting 1: "Team standup", hosted by Maya, status SCHEDULED, roomCode DEMOROOM01, colorIndex 1
    let meeting1 = await Meeting.findOne({ roomCode: "DEMOROOM01" });
    if (!meeting1) {
      meeting1 = await Meeting.create({
        teamId: team._id,
        title: "Team standup",
        hostId: maya._id,
        roomCode: "DEMOROOM01",
        colorIndex: 1,
        status: "SCHEDULED",
        ai: {
          status: "NONE",
          keyPoints: [],
          decisions: [],
          actionItems: [],
          attempts: 0,
        },
      });
    } else {
      meeting1.teamId = team._id;
      meeting1.title = "Team standup";
      meeting1.hostId = maya._id;
      meeting1.colorIndex = 1;
      meeting1.status = "SCHEDULED";
      await meeting1.save();
    }

    // Meeting 2: "Checkout bug triage", hosted by Dev, status ENDED, started 2h ago, duration 35m, colorIndex 3
    const triageStartedAt = new Date(Date.now() - 2 * 60 * 60 * 1000);
    const triageDurationSeconds = 35 * 60;
    const triageEndedAt = new Date(triageStartedAt.getTime() + triageDurationSeconds * 1000);

    let meeting2 = await Meeting.findOne({ roomCode: "DEMOROOM02" });
    const meeting2Data = {
      teamId: team._id,
      title: "Checkout bug triage",
      hostId: dev._id,
      roomCode: "DEMOROOM02",
      colorIndex: 3,
      status: "ENDED" as const,
      startedAt: triageStartedAt,
      endedAt: triageEndedAt,
      durationSeconds: triageDurationSeconds,
      participants: [
        {
          userId: dev._id,
          name: dev.name,
          joinedAt: triageStartedAt,
          leftAt: triageEndedAt,
          captionsOn: false,
        },
        {
          userId: maya._id,
          name: maya.name,
          joinedAt: new Date(triageStartedAt.getTime() + 30 * 1000),
          leftAt: triageEndedAt,
          captionsOn: true,
        },
        {
          userId: lena._id,
          name: lena.name,
          joinedAt: new Date(triageStartedAt.getTime() + 45 * 1000),
          leftAt: triageEndedAt,
          captionsOn: false,
        },
        {
          userId: omar._id,
          name: omar.name,
          joinedAt: new Date(triageStartedAt.getTime() + 60 * 1000),
          leftAt: triageEndedAt,
          captionsOn: false,
        },
      ],
      ai: {
        status: "NONE" as const,
        keyPoints: [],
        decisions: [],
        actionItems: [],
        attempts: 0,
      },
    };

    if (!meeting2) {
      meeting2 = await Meeting.create(meeting2Data);
    } else {
      Object.assign(meeting2, meeting2Data);
      await meeting2.save();
    }

    // Meeting 3: "Sprint planning", hosted by Maya, status SCHEDULED, scheduled for tomorrow at 10:00, colorIndex 0
    const tomorrow10am = new Date();
    tomorrow10am.setDate(tomorrow10am.getDate() + 1);
    tomorrow10am.setHours(10, 0, 0, 0);

    let meeting3 = await Meeting.findOne({ roomCode: "DEMOROOM03" });
    if (!meeting3) {
      meeting3 = await Meeting.create({
        teamId: team._id,
        title: "Sprint planning",
        hostId: maya._id,
        roomCode: "DEMOROOM03",
        colorIndex: 0,
        status: "SCHEDULED",
        scheduledAt: tomorrow10am,
        ai: {
          status: "NONE",
          keyPoints: [],
          decisions: [],
          actionItems: [],
          attempts: 0,
        },
      });
    } else {
      meeting3.teamId = team._id;
      meeting3.title = "Sprint planning";
      meeting3.hostId = maya._id;
      meeting3.colorIndex = 0;
      meeting3.status = "SCHEDULED";
      meeting3.scheduledAt = tomorrow10am;
      await meeting3.save();
    }

    // 4. Upsert Transcript Segments and Chat Messages for Meeting 2
    // Clear previous segments and chat for this meeting to ensure idempotency
    await TranscriptSegment.deleteMany({ meetingId: meeting2._id });
    await ChatMessage.deleteMany({ meetingId: meeting2._id });

    const transcriptItems = [
      {
        speakerId: dev._id,
        speakerName: dev.name,
        text: "Thanks for jumping on quickly everyone. Over the last three hours, we have seen a 14% drop in checkout conversions due to intermittent card payment timeouts.",
        ts: new Date(triageStartedAt.getTime() + 1 * 60 * 1000),
      },
      {
        speakerId: maya._id,
        speakerName: maya.name,
        text: "I noticed the alerts on the payments channel. Dev, are these timeouts hitting the Stripe gateway or our internal authorization middleware?",
        ts: new Date(triageStartedAt.getTime() + 3 * 60 * 1000),
      },
      {
        speakerId: dev._id,
        speakerName: dev.name,
        text: "The Stripe gateway is returning 200s in under 200 milliseconds, but our transaction verification hook is hanging until the 10-second gateway timeout fires.",
        ts: new Date(triageStartedAt.getTime() + 6 * 60 * 1000),
      },
      {
        speakerId: omar._id,
        speakerName: omar.name,
        text: "I pulled the datadog traces from the payment worker. It looks like the fraud check call is waiting on Redis connection pool retries after the node restart.",
        ts: new Date(triageStartedAt.getTime() + 9 * 60 * 1000),
      },
      {
        speakerId: lena._id,
        speakerName: lena.name,
        text: "That matches what I saw in customer support. Customers click Pay, the button spins, and then they get an unexpected session expired screen.",
        ts: new Date(triageStartedAt.getTime() + 12 * 60 * 1000),
      },
      {
        speakerId: dev._id,
        speakerName: dev.name,
        text: "The root cause is clear: our Redis connection pool timeout was set to 15 seconds instead of failing fast after 500 milliseconds on the fraud scoring cache.",
        ts: new Date(triageStartedAt.getTime() + 15 * 60 * 1000),
      },
      {
        speakerId: maya._id,
        speakerName: maya.name,
        text: "Decision: we will bypass the secondary Redis fraud cache on timeout and fall back immediately to standard asynchronous verification.",
        ts: new Date(triageStartedAt.getTime() + 18 * 60 * 1000),
      },
      {
        speakerId: omar._id,
        speakerName: omar.name,
        text: "I'll take the backend hotfix. I will push a patch to reduce the connection timeout to 400 milliseconds and enable the fallback by 3:00 PM today.",
        ts: new Date(triageStartedAt.getTime() + 21 * 60 * 1000),
      },
      {
        speakerId: lena._id,
        speakerName: lena.name,
        text: "I'll monitor the customer support tickets and alert customers whose cards were charged twice during the retry loop.",
        ts: new Date(triageStartedAt.getTime() + 24 * 60 * 1000),
      },
      {
        speakerId: maya._id,
        speakerName: maya.name,
        text: "Decision: we will temporarily disable the retry button on the checkout UI until Omar's patch is confirmed in staging.",
        ts: new Date(triageStartedAt.getTime() + 26 * 60 * 1000),
      },
      {
        speakerId: dev._id,
        speakerName: dev.name,
        text: "I will update the checkout client code right now to disable double-submission and prevent repeated charges.",
        ts: new Date(triageStartedAt.getTime() + 28 * 60 * 1000),
      },
      {
        speakerId: lena._id,
        speakerName: lena.name,
        text: "Will we need to notify affected customers today, or should we wait until the evening reconciliation?",
        ts: new Date(triageStartedAt.getTime() + 30 * 1000),
      },
      {
        speakerId: maya._id,
        speakerName: maya.name,
        text: "Lena, please send the incident apology email by 5:00 PM today once Dev confirms the hotfix deployment.",
        ts: new Date(triageStartedAt.getTime() + 32 * 60 * 1000),
      },
      {
        speakerId: dev._id,
        speakerName: dev.name,
        text: "Sounds good. Omar and I will deploy the patch within the hour and verify checkout latency returns to normal.",
        ts: new Date(triageStartedAt.getTime() + 34 * 60 * 1000),
      },
    ];

    await TranscriptSegment.insertMany(
      transcriptItems.map((item) => ({
        ...item,
        meetingId: meeting2._id,
        teamId: team._id,
      })),
    );

    const chatItems = [
      {
        senderId: dev._id,
        senderName: dev.name,
        text: "Dashboard link for the payment failure spike: https://metrics.internal/checkout-latency",
        createdAt: new Date(triageStartedAt.getTime() + 2 * 60 * 1000),
      },
      {
        senderId: omar._id,
        senderName: omar.name,
        text: "Confirmed Redis pool exhaustion on worker pod 3.",
        createdAt: new Date(triageStartedAt.getTime() + 8 * 60 * 1000),
      },
      {
        senderId: maya._id,
        senderName: maya.name,
        text: "Let's make sure we have a clear fallback path before touching production.",
        createdAt: new Date(triageStartedAt.getTime() + 17 * 60 * 1000),
      },
      {
        senderId: dev._id,
        senderName: dev.name,
        text: "Staging reproduces the 10s hang when Redis is throttled.",
        createdAt: new Date(triageStartedAt.getTime() + 22 * 60 * 1000),
      },
      {
        senderId: omar._id,
        senderName: omar.name,
        text: "Hotfix branch ready: fix/redis-pool-fast-fail",
        createdAt: new Date(triageStartedAt.getTime() + 27 * 60 * 1000),
      },
      {
        senderId: lena._id,
        senderName: lena.name,
        text: "Support macro created for impacted checkout sessions.",
        createdAt: new Date(triageStartedAt.getTime() + 33 * 60 * 1000),
      },
    ];

    await ChatMessage.insertMany(
      chatItems.map((item) => ({
        ...item,
        meetingId: meeting2._id,
        teamId: team._id,
      })),
    );

    const result: SeedResult = {
      teamCount: 1,
      userCount: usersConfig.length,
      meetingCount: 3,
      transcriptCount: transcriptItems.length,
      chatCount: chatItems.length,
      emails: [
        `${maya.email} (ADMIN)`,
        `${dev.email} (MEMBER)`,
        `${lena.email} (MEMBER)`,
        `${omar.email} (MEMBER)`,
        `${sofia.email} (MEMBER)`,
      ],
    };

    if (!options.silent) {
      console.log("========================================");
      console.log("Brightwell Design Co. Demo Seed Complete");
      console.log("========================================");
      console.log(`Teams: ${result.teamCount}`);
      console.log(`Users: ${result.userCount}`);
      console.log(`Meetings: ${result.meetingCount}`);
      console.log(`Transcript segments: ${result.transcriptCount}`);
      console.log(`Chat messages: ${result.chatCount}`);
      console.log("Demo accounts:");
      for (const email of result.emails) {
        console.log(`  - ${email}`);
      }
      console.log("========================================");
    }

    return result;
  } finally {
    if (!wasAlreadyConnected) {
      await mongoose.disconnect();
    }
  }
}

// Direct execution check
const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("seed.ts") || process.argv[1].endsWith("seed.js"));

if (isMain) {
  const reset = process.argv.includes("--reset");
  runSeed({ reset })
    .then(() => {
      process.exit(0);
    })
    .catch((err) => {
      console.error("Seed execution failed:", err.message);
      process.exit(1);
    });
}
