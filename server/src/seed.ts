import "./config/env.js";
import mongoose from "mongoose";
import bcrypt from "bcrypt";
import { Team } from "./models/Team.js";
import { User, type IUser } from "./models/User.js";
import { Meeting, type IMeeting } from "./models/Meeting.js";
import { Task } from "./models/Task.js";
import { Notification } from "./models/Notification.js";
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
  taskCount: number;
  notificationCount: number;
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
        await Task.deleteMany({ teamId: existingTeam._id });
        await Notification.deleteMany({ teamId: existingTeam._id });
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

    // 3. Clean up legacy or unmanaged meetings for Brightwell team to ensure exact 8 meetings on repeated seed runs
    // Only DEMOROOM01 through DEMOROOM07 and DEMOROOM03 are allowed
    const validRoomCodes = [
      "DEMOROOM01", // Team standup (SCHEDULED)
      "DEMOROOM03", // Sprint planning (SCHEDULED)
      "DEMOROOM14", // Sprint 14 planning (ENDED)
      "DEMOROOM02", // Checkout bug triage (ENDED)
      "DEMOROOM04", // Customer call debrief: Alder & Co (ENDED)
      "DEMOROOM05", // Design review: onboarding flow (ENDED)
      "DEMOROOM06", // Q4 roadmap sync (ENDED)
      "DEMOROOM07", // Retro: October release (ENDED)
    ];

    const extraneousMeetings = await Meeting.find({
      teamId: team._id,
      roomCode: { $nin: validRoomCodes },
    });
    for (const em of extraneousMeetings) {
      await TranscriptSegment.deleteMany({ meetingId: em._id });
      await ChatMessage.deleteMany({ meetingId: em._id });
      await Meeting.deleteOne({ _id: em._id });
    }

    const now = Date.now();

    // Scheduled Meeting 1: "Team standup"
    let meetingStandup = await Meeting.findOne({ roomCode: "DEMOROOM01" });
    const standupData = {
      teamId: team._id,
      title: "Team standup",
      hostId: maya._id,
      roomCode: "DEMOROOM01",
      colorIndex: 1,
      status: "SCHEDULED" as const,
      scheduledAt: new Date(now + 4 * 60 * 60 * 1000), // in 4 hours
      ai: {
        status: "NONE" as const,
        keyPoints: [],
        decisions: [],
        actionItems: [],
        attempts: 0,
      },
    };
    if (!meetingStandup) {
      meetingStandup = await Meeting.create(standupData);
    } else {
      Object.assign(meetingStandup, standupData);
      await meetingStandup.save();
    }

    // Scheduled Meeting 2: "Sprint planning" (tomorrow 10:00)
    const tomorrow10am = new Date(now);
    tomorrow10am.setDate(tomorrow10am.getDate() + 1);
    tomorrow10am.setHours(10, 0, 0, 0);

    let meetingSprintPlan = await Meeting.findOne({ roomCode: "DEMOROOM03" });
    const sprintPlanData = {
      teamId: team._id,
      title: "Sprint planning",
      hostId: maya._id,
      roomCode: "DEMOROOM03",
      colorIndex: 0,
      status: "SCHEDULED" as const,
      scheduledAt: tomorrow10am,
      ai: {
        status: "NONE" as const,
        keyPoints: [],
        decisions: [],
        actionItems: [],
        attempts: 0,
      },
    };
    if (!meetingSprintPlan) {
      meetingSprintPlan = await Meeting.create(sprintPlanData);
    } else {
      Object.assign(meetingSprintPlan, sprintPlanData);
      await meetingSprintPlan.save();
    }

    // 4. Six Finished ENDED Meetings
    // Time offsets roughly 40, 33, 26, 19, 12, and 5 days ago
    const dayMs = 24 * 60 * 60 * 1000;

    // Pre-create persistent ObjectIds for action items so tasks can reference them deterministically
    interface SeedActionItemDef {
      id: mongoose.Types.ObjectId;
      title: string;
      assigneeName: string;
      assigneeId: mongoose.Types.ObjectId;
      dueDate?: Date;
    }

    // --- Ended Meeting 1: Sprint 14 planning (host Maya, ~40d ago, 45m = 2700s, colorIndex 4) ---
    const m1Start = new Date(now - 40 * dayMs);
    const m1Duration = 45 * 60; // 2700s
    const m1End = new Date(m1Start.getTime() + m1Duration * 1000);
    const m1Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Finalize high-fidelity onboarding wireframes",
        assigneeName: sofia.name,
        assigneeId: sofia._id,
        dueDate: new Date(now - 32 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Benchmark Redis token bucket rate limiter",
        assigneeName: omar.name,
        assigneeId: omar._id,
        dueDate: new Date(now - 30 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Audit dependencies for Node 22 upgrade",
        assigneeName: dev.name,
        assigneeId: dev._id,
      },
    ];

    // --- Ended Meeting 2: Checkout bug triage (host Dev, ~33d ago, 35m = 2100s, colorIndex 3) ---
    const m2Start = new Date(now - 33 * dayMs);
    const m2Duration = 35 * 60; // 2100s
    const m2End = new Date(m2Start.getTime() + m2Duration * 1000);
    const m2Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Deploy Redis connection pool timeout hotfix",
        assigneeName: omar.name,
        assigneeId: omar._id,
        dueDate: new Date(now - 32 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Disable checkout submit button on first click",
        assigneeName: dev.name,
        assigneeId: dev._id,
        dueDate: new Date(now - 32 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Send incident apology email to affected customers",
        assigneeName: lena.name,
        assigneeId: lena._id,
        dueDate: new Date(now - 32 * dayMs),
      },
    ];

    // --- Ended Meeting 3: Customer call debrief: Alder & Co (host Lena, ~26d ago, 25m = 1500s, colorIndex 1) ---
    const m3Start = new Date(now - 26 * dayMs);
    const m3Duration = 25 * 60; // 1500s
    const m3End = new Date(m3Start.getTime() + m3Duration * 1000);
    const m3Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Draft SAML 2.0 architecture specification",
        assigneeName: dev.name,
        assigneeId: dev._id,
        dueDate: new Date(now - 15 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Send enterprise addendum and pricing sheet to Alder & Co",
        assigneeName: lena.name,
        assigneeId: lena._id,
        dueDate: new Date(now - 20 * dayMs),
      },
    ];

    // --- Ended Meeting 4: Design review: onboarding flow (host Sofia, ~19d ago, 40m = 2400s, colorIndex 2) ---
    const m4Start = new Date(now - 19 * dayMs);
    const m4Duration = 40 * 60; // 2400s
    const m4End = new Date(m4Start.getTime() + m4Duration * 1000);
    const m4Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Implement 3-step onboarding stepper component",
        assigneeName: dev.name,
        assigneeId: dev._id,
        dueDate: new Date(now - 5 * dayMs), // Overdue!
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Add Cypress tests for signup invite flow",
        assigneeName: omar.name,
        assigneeId: omar._id,
        dueDate: new Date(now + 1 * dayMs), // Upcoming!
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Create empty state illustrations for first meeting",
        assigneeName: sofia.name,
        assigneeId: sofia._id,
      },
    ];

    // --- Ended Meeting 5: Q4 roadmap sync (host Maya, ~12d ago, 50m = 3000s, colorIndex 5) ---
    const m5Start = new Date(now - 12 * dayMs);
    const m5Duration = 50 * 60; // 3000s
    const m5End = new Date(m5Start.getTime() + m5Duration * 1000);
    const m5Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Build analytics aggregation pipeline and test suite",
        assigneeName: dev.name,
        assigneeId: dev._id,
        dueDate: new Date(now - 2 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Design notification bell dropdown component",
        assigneeName: sofia.name,
        assigneeId: sofia._id,
        dueDate: new Date(now - 7 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Write load test script for socket presence events",
        assigneeName: omar.name,
        assigneeId: omar._id,
      },
    ];

    // --- Ended Meeting 6: Retro: October release (host Omar, ~5d ago, 30m = 1800s, colorIndex 0) ---
    const m6Start = new Date(now - 5 * dayMs);
    const m6Duration = 30 * 60; // 1800s
    const m6End = new Date(m6Start.getTime() + m6Duration * 1000);
    const m6Items: SeedActionItemDef[] = [
      {
        id: new mongoose.Types.ObjectId(),
        title: "Fix responsive drawer jitter on mobile screens",
        assigneeName: dev.name,
        assigneeId: dev._id,
        dueDate: new Date(now + 2 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Document WebRTC connection lifecycle in team wiki",
        assigneeName: omar.name,
        assigneeId: omar._id,
        dueDate: new Date(now + 3 * dayMs),
      },
      {
        id: new mongoose.Types.ObjectId(),
        title: "Compile customer quotes for monthly product newsletter",
        assigneeName: lena.name,
        assigneeId: lena._id,
      },
    ];

    const endedMeetingsConfig = [
      {
        roomCode: "DEMOROOM14",
        title: "Sprint 14 planning",
        host: maya,
        colorIndex: 4,
        startedAt: m1Start,
        endedAt: m1End,
        durationSeconds: m1Duration,
        participants: [
          { userId: maya._id, name: maya.name, joinedAt: m1Start, leftAt: m1End, captionsOn: true },
          { userId: dev._id, name: dev.name, joinedAt: new Date(m1Start.getTime() + 15 * 1000), leftAt: m1End, captionsOn: false },
          { userId: lena._id, name: lena.name, joinedAt: new Date(m1Start.getTime() + 30 * 1000), leftAt: m1End, captionsOn: false },
          { userId: omar._id, name: omar.name, joinedAt: new Date(m1Start.getTime() + 45 * 1000), leftAt: m1End, captionsOn: false },
          { userId: sofia._id, name: sofia.name, joinedAt: new Date(m1Start.getTime() + 60 * 1000), leftAt: m1End, captionsOn: false },
        ],
        actionItemsDefs: m1Items,
        summary:
          "Sprint 14 planning aligned team velocity and defined critical deliverables across frontend and backend services. The team prioritized the self-serve onboarding flow and agreed on an SLA for the Redis-backed rate limiter. Sofia presented the onboarding wireframes, while Omar agreed to benchmark throughput before merging. Export to PDF was deferred to Sprint 15.",
        keyPoints: [
          "Target velocity committed to 42 story points based on last three sprints.",
          "Self-serve onboarding flow designated as the primary design deliverable.",
          "Rate limiter implementation moved to priority P0 to stabilize public APIs.",
        ],
        decisions: [
          "Scope Sprint 14 to onboarding improvements and rate limiting.",
          "Defer export-to-PDF work to Sprint 15.",
        ],
        transcripts: [
          { speaker: maya, text: "Welcome everyone to Sprint 14 planning. Let's review our velocity and agree on our top commitments." },
          { speaker: dev, text: "Looking at the last three sprints, our rolling average is right around 42 story points." },
          { speaker: sofia, text: "I have the new onboarding wireframes ready for review. That will take about 13 points of frontend work." },
          { speaker: omar, text: "On the backend side, the Redis token bucket rate limiter is the top technical debt item." },
          { speaker: lena, text: "Customer success agrees; several trial teams asked if we can smooth out public API burst limits." },
          { speaker: maya, text: "Great. Let's make onboarding and the rate limiter our core commitments for this cycle." },
          { speaker: dev, text: "What about the export to PDF request from Alder & Co?" },
          { speaker: maya, text: "We decided to defer export to PDF to Sprint 15 so we don't overcommit." },
          { speaker: sofia, text: "I'll finalize the high-fidelity onboarding wireframes by the end of the week." },
          { speaker: omar, text: "I will benchmark the Redis token bucket rate limiter under simulated load before we merge." },
          { speaker: dev, text: "I'll also run an audit on our dependencies before the Node 22 upgrade next month." },
          { speaker: maya, text: "Excellent plan. Let's break the stories into tasks and kick off the sprint." },
        ],
        chats: [
          { sender: maya, text: "Sprint board link: https://brightwell.internal/sprints/14" },
          { sender: sofia, text: "Figma wireframe deck shared in the design channel." },
          { sender: omar, text: "Redis rate limiter spec updated with token bucket parameters." },
          { sender: dev, text: "Will review the PRs as soon as drafts open." },
        ],
      },
      {
        roomCode: "DEMOROOM02",
        title: "Checkout bug triage",
        host: dev,
        colorIndex: 3,
        startedAt: m2Start,
        endedAt: m2End,
        durationSeconds: m2Duration,
        participants: [
          { userId: dev._id, name: dev.name, joinedAt: m2Start, leftAt: m2End, captionsOn: false },
          { userId: maya._id, name: maya.name, joinedAt: new Date(m2Start.getTime() + 30 * 1000), leftAt: m2End, captionsOn: true },
          { userId: lena._id, name: lena.name, joinedAt: new Date(m2Start.getTime() + 45 * 1000), leftAt: m2End, captionsOn: false },
          { userId: omar._id, name: omar.name, joinedAt: new Date(m2Start.getTime() + 60 * 1000), leftAt: m2End, captionsOn: false },
        ],
        actionItemsDefs: m2Items,
        summary:
          "Emergency triage on payment timeout spike affecting card checkouts. The team identified Redis connection pool exhaustion on the fraud scoring cache worker as the root cause. Dev and Omar agreed to deploy a fast-fail configuration (400ms timeout with async fallback) and disable double-submission in the checkout UI. Lena prepared support macros and scheduled customer communication.",
        keyPoints: [
          "Conversion dropped 14% over three hours due to 10-second hanging requests.",
          "Stripe processing was healthy; failure isolated to internal fraud verification hook.",
          "Fast-fail fallback will prevent user-visible timeouts during cache contention.",
        ],
        decisions: [
          "Bypass Redis fraud cache on timeout and fall back to standard verification.",
          "Disable checkout submit button immediately on first click to avoid double charges.",
        ],
        transcripts: [
          { speaker: dev, text: "Thanks for jumping on quickly everyone. Over the last three hours, we have seen a 14% drop in checkout conversions due to intermittent card payment timeouts." },
          { speaker: maya, text: "I noticed the alerts on the payments channel. Dev, are these timeouts hitting the Stripe gateway or our internal authorization middleware?" },
          { speaker: dev, text: "The Stripe gateway is returning 200s in under 200 milliseconds, but our transaction verification hook is hanging until the 10-second gateway timeout fires." },
          { speaker: omar, text: "I pulled the datadog traces from the payment worker. It looks like the fraud check call is waiting on Redis connection pool retries after the node restart." },
          { speaker: lena, text: "That matches what I saw in customer support. Customers click Pay, the button spins, and then they get an unexpected session expired screen." },
          { speaker: dev, text: "The root cause is clear: our Redis connection pool timeout was set to 15 seconds instead of failing fast after 500 milliseconds on the fraud scoring cache." },
          { speaker: maya, text: "Decision: we will bypass the secondary Redis fraud cache on timeout and fall back immediately to standard asynchronous verification." },
          { speaker: omar, text: "I'll take the backend hotfix. I will push a patch to reduce the connection timeout to 400 milliseconds and enable the fallback by 3:00 PM today." },
          { speaker: lena, text: "I'll monitor the customer support tickets and alert customers whose cards were charged twice during the retry loop." },
          { speaker: maya, text: "Decision: we will temporarily disable the retry button on the checkout UI until Omar's patch is confirmed in staging." },
          { speaker: dev, text: "I will update the checkout client code right now to disable double-submission and prevent repeated charges." },
          { speaker: lena, text: "Will we need to notify affected customers today, or should we wait until the evening reconciliation?" },
          { speaker: maya, text: "Lena, please send the incident apology email by 5:00 PM today once Dev confirms the hotfix deployment." },
          { speaker: dev, text: "Sounds good. Omar and I will deploy the patch within the hour and verify checkout latency returns to normal." },
        ],
        chats: [
          { sender: dev, text: "Dashboard link for the payment failure spike: https://metrics.internal/checkout-latency" },
          { sender: omar, text: "Confirmed Redis pool exhaustion on worker pod 3." },
          { sender: maya, text: "Let's make sure we have a clear fallback path before touching production." },
          { sender: dev, text: "Staging reproduces the 10s hang when Redis is throttled." },
          { sender: omar, text: "Hotfix branch ready: fix/redis-pool-fast-fail" },
          { sender: lena, text: "Support macro created for impacted checkout sessions." },
        ],
      },
      {
        roomCode: "DEMOROOM04",
        title: "Customer call debrief: Alder & Co",
        host: lena,
        colorIndex: 1,
        startedAt: m3Start,
        endedAt: m3End,
        durationSeconds: m3Duration,
        participants: [
          { userId: lena._id, name: lena.name, joinedAt: m3Start, leftAt: m3End, captionsOn: true },
          { userId: maya._id, name: maya.name, joinedAt: new Date(m3Start.getTime() + 20 * 1000), leftAt: m3End, captionsOn: false },
          { userId: dev._id, name: dev.name, joinedAt: new Date(m3Start.getTime() + 40 * 1000), leftAt: m3End, captionsOn: false },
        ],
        actionItemsDefs: m3Items,
        summary:
          "Debrief with Alder & Co's VP of Operations. The client praised the automated meeting summaries and action item conversions, but noted enterprise security requires 90-day audit log retention and SAML 2.0 SSO before their full team rollout in December. Lena will draft an enterprise contract addendum, and Dev will review SAML configuration requirements.",
        keyPoints: [
          "Alder & Co is expanding from 15 trial users to a 200-seat enterprise plan.",
          "SAML 2.0 SSO is a mandatory procurement blocker.",
          "Audit logs require 90-day retention and CSV export capability.",
        ],
        decisions: [
          "Prioritize SAML 2.0 integration in Q4 enterprise roadmap.",
          "Provide Alder & Co with temporary manual audit log dumps during procurement.",
        ],
        transcripts: [
          { speaker: lena, text: "Thanks for joining the debrief. I just finished our hour-long check-in with Alder & Co's VP of Operations." },
          { speaker: maya, text: "How did it go? Are they still planning on moving forward with the 200-seat rollout?" },
          { speaker: lena, text: "Overall very positive. Their product leads love the AI summary write-ups and instant task conversion." },
          { speaker: dev, text: "Did they bring up any security or identity management requirements?" },
          { speaker: lena, text: "Yes, exactly that. SAML 2.0 single sign-on is a strict procurement requirement before December." },
          { speaker: dev, text: "Our auth infrastructure can support SAML via Passport, but we need about two weeks of engineering." },
          { speaker: maya, text: "Decision: we will prioritize SAML 2.0 integration in our Q4 enterprise milestones." },
          { speaker: lena, text: "They also asked for 90-day audit log retention with CSV exports for their compliance team." },
          { speaker: maya, text: "Decision: we will provide them manual audit log dumps during procurement while building the self-serve export." },
          { speaker: dev, text: "I'll draft the SAML 2.0 architecture specification and outline the necessary schema changes." },
          { speaker: lena, text: "I will prepare the enterprise contract addendum and revised pricing sheet by Friday." },
        ],
        chats: [
          { sender: lena, text: "Call recording notes uploaded to customer drive." },
          { sender: maya, text: "A 200-seat expansion will double our enterprise ARR." },
          { sender: dev, text: "Looking into Okta and Azure AD compatibility." },
          { sender: lena, text: "Next sync with their IT director is set for next Tuesday." },
        ],
      },
      {
        roomCode: "DEMOROOM05",
        title: "Design review: onboarding flow",
        host: sofia,
        colorIndex: 2,
        startedAt: m4Start,
        endedAt: m4End,
        durationSeconds: m4Duration,
        participants: [
          { userId: sofia._id, name: sofia.name, joinedAt: m4Start, leftAt: m4End, captionsOn: true },
          { userId: maya._id, name: maya.name, joinedAt: new Date(m4Start.getTime() + 15 * 1000), leftAt: m4End, captionsOn: false },
          { userId: dev._id, name: dev.name, joinedAt: new Date(m4Start.getTime() + 30 * 1000), leftAt: m4End, captionsOn: false },
          { userId: omar._id, name: omar.name, joinedAt: new Date(m4Start.getTime() + 45 * 1000), leftAt: m4End, captionsOn: false },
        ],
        actionItemsDefs: m4Items,
        summary:
          "Review of the redesigned 3-step onboarding flow. Sofia presented mockups replacing the monolithic signup form with progressive team setup and role selection. Dev raised accessibility concerns regarding focus trapping on the invite modal, which Sofia resolved with standard keyboard navigation. The team approved the visual direction for implementation.",
        keyPoints: [
          "3-step stepper simplifies team creation and invite code entry.",
          "Focus ring contrast confirmed to exceed WCAG AA requirements (4.5:1).",
          "Empty states for newly created teams will include prompt cards for first meeting.",
        ],
        decisions: [
          "Approve onboarding prototype for frontend implementation.",
          "Standardize all modal dialogs on 8px radius and stone palette tokens.",
        ],
        transcripts: [
          { speaker: sofia, text: "Today I'm walking through the interactive prototypes for our revised 3-step onboarding flow." },
          { speaker: maya, text: "The primary objective is reducing drop-off between email verification and the first team meeting." },
          { speaker: sofia, text: "Step 1 captures workspace name, Step 2 handles teammate invites, and Step 3 configures audio-video preferences." },
          { speaker: dev, text: "I like the stepped approach. How are we handling keyboard navigation on the teammate invite input?" },
          { speaker: sofia, text: "Users can tab between email chips, press delete to remove, and enter to add another teammate." },
          { speaker: omar, text: "Is the invite code displayed prominently for teammates who prefer direct joining?" },
          { speaker: sofia, text: "Yes, it shows a clean copy-code button right below the email field with polite screen reader feedback." },
          { speaker: maya, text: "Decision: we approve this prototype for frontend implementation." },
          { speaker: dev, text: "I'll take the lead on implementing the 3-step onboarding stepper component." },
          { speaker: omar, text: "I can write the Cypress end-to-end tests for the signup and invite flow once the components are ready." },
          { speaker: sofia, text: "I'll create the empty state illustrations for first-time workspaces." },
          { speaker: maya, text: "Decision: let's standardize all dialogs on 8px radius and the graphite/stone tokens." },
          { speaker: dev, text: "Sounds great. I'll get started on the PR this afternoon." },
        ],
        chats: [
          { sender: sofia, text: "Figma prototype link: https://figma.com/file/onboarding-v2" },
          { sender: dev, text: "Stepper component will use headless state machine." },
          { sender: omar, text: "Test scenarios mapped in Cypress suite." },
          { sender: maya, text: "Looks clean, minimal and on-brand." },
          { sender: sofia, text: "Token adjustments committed to styles repository." },
        ],
      },
      {
        roomCode: "DEMOROOM06",
        title: "Q4 roadmap sync",
        host: maya,
        colorIndex: 5,
        startedAt: m5Start,
        endedAt: m5End,
        durationSeconds: m5Duration,
        participants: [
          { userId: maya._id, name: maya.name, joinedAt: m5Start, leftAt: m5End, captionsOn: true },
          { userId: dev._id, name: dev.name, joinedAt: new Date(m5Start.getTime() + 20 * 1000), leftAt: m5End, captionsOn: false },
          { userId: lena._id, name: lena.name, joinedAt: new Date(m5Start.getTime() + 35 * 1000), leftAt: m5End, captionsOn: false },
          { userId: omar._id, name: omar.name, joinedAt: new Date(m5Start.getTime() + 50 * 1000), leftAt: m5End, captionsOn: false },
          { userId: sofia._id, name: sofia.name, joinedAt: new Date(m5Start.getTime() + 65 * 1000), leftAt: m5End, captionsOn: false },
        ],
        actionItemsDefs: m5Items,
        summary:
          "Alignment on Q4 product roadmap and delivery milestones. The team confirmed delivery dates for the analytics dashboard, interactive task board, and WCAG AA accessibility audit. Maya emphasized zero-downtime database migrations for new schema fields.",
        keyPoints: [
          "Analytics dashboard targeted for completion by mid-November.",
          "Real-time task board requires optimistic UI updates with socket broadcast.",
          "Accessibility compliance (WCAG AA) is non-negotiable for public launch.",
        ],
        decisions: [
          "Commit to delivering the analytics and notifications milestones in Phase P7.",
          "Allocate 2 days for end-to-end regression testing and performance profiling.",
        ],
        transcripts: [
          { speaker: maya, text: "Welcome to our Q4 roadmap sync. We need to lock in our delivery milestones for November." },
          { speaker: dev, text: "On the engineering side, the task board and analytics aggregation endpoints are the largest remaining blocks." },
          { speaker: lena, text: "Customers are asking for high-level metrics: meetings held, duration, and action item follow-through." },
          { speaker: omar, text: "The aggregation pipeline will run directly on MongoDB without pulling all documents into memory." },
          { speaker: sofia, text: "I've drafted the notification bell dropdown with unread indicators and optimistic mark-read." },
          { speaker: maya, text: "Decision: we will commit to delivering analytics and in-app notifications in Phase P7." },
          { speaker: dev, text: "I'll build the analytics aggregation pipeline and comprehensive test suite." },
          { speaker: sofia, text: "I will design the notification bell dropdown component and verify contrast." },
          { speaker: omar, text: "I'll write a load test script for socket presence events to confirm memory stability under load." },
          { speaker: maya, text: "Decision: we will allocate two full days for hardening and accessibility testing before launch." },
          { speaker: lena, text: "That schedule gives sales the confidence to demo live to Alder & Co." },
          { speaker: dev, text: "Let's review the analytics query schema with Zod to prevent any injection risks." },
          { speaker: maya, text: "Agreed. Thanks everyone for the focus and execution." },
          { speaker: omar, text: "Will share the load testing results on Slack tomorrow." },
          { speaker: sofia, text: "Mockups are ready for Dev whenever he starts the frontend." },
        ],
        chats: [
          { sender: maya, text: "Roadmap doc: https://brightwell.internal/docs/q4-milestones" },
          { sender: dev, text: "Zod schemas will be strictly validated." },
          { sender: omar, text: "Socket cluster benchmarks look healthy up to 500 connections." },
          { sender: lena, text: "Alder & Co demo scheduled for Nov 14." },
          { sender: sofia, text: "Recharts theme tokens match Stone palette." },
          { sender: maya, text: "Keep PRs small and focused on main." },
          { sender: dev, text: "Will enforce 100% test pass on CI." },
        ],
      },
      {
        roomCode: "DEMOROOM07",
        title: "Retro: October release",
        host: omar,
        colorIndex: 0,
        startedAt: m6Start,
        endedAt: m6End,
        durationSeconds: m6Duration,
        participants: [
          { userId: omar._id, name: omar.name, joinedAt: m6Start, leftAt: m6End, captionsOn: false },
          { userId: maya._id, name: maya.name, joinedAt: new Date(m6Start.getTime() + 10 * 1000), leftAt: m6End, captionsOn: true },
          { userId: dev._id, name: dev.name, joinedAt: new Date(m6Start.getTime() + 25 * 1000), leftAt: m6End, captionsOn: false },
          { userId: lena._id, name: lena.name, joinedAt: new Date(m6Start.getTime() + 40 * 1000), leftAt: m6End, captionsOn: false },
          { userId: sofia._id, name: sofia.name, joinedAt: new Date(m6Start.getTime() + 55 * 1000), leftAt: m6End, captionsOn: false },
        ],
        actionItemsDefs: m6Items,
        summary:
          "Retrospective covering October release. The team celebrated successful rollout of continuous live captions and zero-latency chat. Key areas for improvement included clearer rate limit feedback on public endpoints and smoother responsive drawer animations on mobile devices.",
        keyPoints: [
          "Live captions had high user satisfaction in customer feedback sessions.",
          "Mesh WebRTC connections remained stable up to 4 participants.",
          "Mobile layout needs a dedicated QA pass on screens under 400px width.",
        ],
        decisions: [
          "Adopt strict conventional commits policy across team repositories.",
          "Add 360px viewport tests to continuous integration suite.",
        ],
        transcripts: [
          { speaker: omar, text: "Welcome to the October release retro. Let's start with what went well over the last month." },
          { speaker: maya, text: "The WebRTC mesh stabilization was a huge win. We had zero dropped connections in our internal trials." },
          { speaker: lena, text: "Customers specifically praised the live captioning accuracy and non-intrusive styling." },
          { speaker: dev, text: "What felt bumpy was the mobile drawer transition; on narrow iOS screens it had slight layout jitter." },
          { speaker: sofia, text: "I noticed that too. We can fix it by using transform translates instead of animating width." },
          { speaker: omar, text: "We also noticed our rate limit response didn't specify the retry-after window clearly." },
          { speaker: maya, text: "Decision: we will adopt strict conventional commits across all repositories to keep git history clean." },
          { speaker: omar, text: "Decision: we will add explicit 360px viewport tests in our responsive QA suite." },
          { speaker: dev, text: "I will fix the responsive drawer jitter on mobile screens." },
          { speaker: omar, text: "I'll document the WebRTC connection lifecycle in our team wiki for new onboarders." },
          { speaker: lena, text: "I will compile customer quotes for our monthly product newsletter." },
          { speaker: sofia, text: "And I'll review mobile touch targets to make sure they remain at least 40px." },
        ],
        chats: [
          { sender: omar, text: "Retro board open: https://brightwell.internal/retro/october" },
          { sender: maya, text: "Kudos to Dev and Omar for the WebRTC mesh polish!" },
          { sender: dev, text: "Team effort, thanks everyone." },
          { sender: lena, text: "Feedback from Alder & Co has been super encouraging." },
          { sender: sofia, text: "Tokens made responsive fixes very clean." },
        ],
      },
    ];

    // Map to hold seeded meeting documents by roomCode
    const seededMeetings = new Map<string, IMeeting>();

    let totalTranscriptCount = 0;
    let totalChatCount = 0;

    for (const conf of endedMeetingsConfig) {
      let meeting = await Meeting.findOne({ roomCode: conf.roomCode });

      const aiData = {
        status: "READY" as const,
        provider: "seed",
        model: "hand-written",
        generatedAt: new Date(conf.endedAt.getTime() + 30 * 1000), // just after endedAt
        attempts: 1,
        summary: conf.summary,
        keyPoints: conf.keyPoints,
        decisions: conf.decisions,
        actionItems: conf.actionItemsDefs.map((def) => ({
          _id: def.id,
          title: def.title,
          assigneeName: def.assigneeName,
          assigneeId: def.assigneeId,
          dueDate: def.dueDate,
        })),
      };

      const meetingDocData = {
        teamId: team._id,
        title: conf.title,
        hostId: conf.host._id,
        roomCode: conf.roomCode,
        colorIndex: conf.colorIndex,
        status: "ENDED" as const,
        startedAt: conf.startedAt,
        endedAt: conf.endedAt,
        durationSeconds: conf.durationSeconds,
        participants: conf.participants,
        ai: aiData,
      };

      if (!meeting) {
        meeting = await Meeting.create(meetingDocData);
      } else {
        Object.assign(meeting, meetingDocData);
        await meeting.save();
      }
      seededMeetings.set(conf.roomCode, meeting);

      // Seed Transcript Segments
      await TranscriptSegment.deleteMany({ meetingId: meeting._id });
      const segmentDocs = conf.transcripts.map((t, idx) => ({
        meetingId: meeting!._id,
        teamId: team!._id,
        speakerId: t.speaker._id,
        speakerName: t.speaker.name,
        text: t.text,
        ts: new Date(conf.startedAt.getTime() + (idx * 2 + 1) * 60 * 1000),
      }));
      await TranscriptSegment.insertMany(segmentDocs);
      totalTranscriptCount += segmentDocs.length;

      // Seed Chat Messages
      await ChatMessage.deleteMany({ meetingId: meeting._id });
      const chatDocs = conf.chats.map((c, idx) => ({
        meetingId: meeting!._id,
        teamId: team!._id,
        senderId: c.sender._id,
        senderName: c.sender.name,
        text: c.text,
        createdAt: new Date(conf.startedAt.getTime() + (idx * 3 + 2) * 60 * 1000),
      }));
      await ChatMessage.insertMany(chatDocs);
      totalChatCount += chatDocs.length;
    }

    // 5. Twelve Tasks Across To-do, IN_PROGRESS, and DONE
    // Exactly 7 come from action items above; 5 standalone.
    // Done tasks have completedAt values spread across the last 4 weeks.
    // Orders are contiguous per column.
    await Task.deleteMany({ teamId: team._id });

    const m1Doc = seededMeetings.get("DEMOROOM14")!;
    const m2Doc = seededMeetings.get("DEMOROOM02")!;
    const m3Doc = seededMeetings.get("DEMOROOM04")!;
    const m4Doc = seededMeetings.get("DEMOROOM05")!;

    interface SeedTaskInput {
      title: string;
      description?: string;
      status: "TODO" | "IN_PROGRESS" | "DONE";
      order: number;
      assigneeId?: mongoose.Types.ObjectId;
      createdBy: mongoose.Types.ObjectId;
      dueDate?: Date;
      sourceMeetingId?: mongoose.Types.ObjectId;
      sourceActionItemId?: mongoose.Types.ObjectId;
      completedAt?: Date;
    }

    const tasksToSeed: SeedTaskInput[] = [
      // --- To-do status (4 tasks, orders 0..3) ---
      {
        // Converted from Meeting 4 Item 4.2
        title: "Add Cypress tests for signup invite flow",
        description: "Cover 3-step stepper, token validation, and copy-code interactions.",
        status: "TODO",
        order: 0,
        assigneeId: omar._id,
        createdBy: sofia._id,
        dueDate: new Date(now + 1 * dayMs), // Upcoming!
        sourceMeetingId: m4Doc._id,
        sourceActionItemId: m4Items[1]!.id,
      },
      {
        // Standalone task
        title: "Update team documentation with seed account guide",
        description: "Add details on demo personas and bcrypt login parameters.",
        status: "TODO",
        order: 1,
        assigneeId: maya._id,
        createdBy: dev._id,
        dueDate: new Date(now + 2 * dayMs), // Upcoming!
      },
      {
        // Standalone task
        title: "Review customer support escalation tickets",
        description: "Audit unresolved payment timeout queries from last month.",
        status: "TODO",
        order: 2,
        assigneeId: lena._id,
        createdBy: maya._id,
        dueDate: new Date(now - 2 * dayMs), // Overdue!
      },
      {
        // Standalone task (Unassigned)
        title: "Investigate Safari audio track latency",
        description: "Check if WebRTC audio constraints cause playback delay on iOS.",
        status: "TODO",
        order: 3,
        assigneeId: undefined,
        createdBy: dev._id,
      },

      // --- IN_PROGRESS (3 tasks, orders 0..2) ---
      {
        // Converted from Meeting 4 Item 4.1
        title: "Implement 3-step onboarding stepper component",
        description: "Build accessible step controller using design tokens.",
        status: "IN_PROGRESS",
        order: 0,
        assigneeId: dev._id,
        createdBy: sofia._id,
        dueDate: new Date(now - 5 * dayMs), // Overdue!
        sourceMeetingId: m4Doc._id,
        sourceActionItemId: m4Items[0]!.id,
      },
      {
        // Standalone task
        title: "Refactor room controls for high-contrast mode",
        description: "Ensure focus outline satisfies 2px ink with 2px offset.",
        status: "IN_PROGRESS",
        order: 1,
        assigneeId: sofia._id,
        createdBy: maya._id,
        dueDate: new Date(now + 4 * dayMs), // Upcoming!
      },
      {
        // Standalone task
        title: "Implement audio level visualizer meter",
        description: "Show real-time mic volume level indicator in room lobby.",
        status: "IN_PROGRESS",
        order: 2,
        assigneeId: lena._id,
        createdBy: dev._id,
      },

      // --- DONE (5 tasks, orders 0..4, completedAt spread across last 4 weeks) ---
      {
        // Converted from Meeting 1 Item 1.1
        title: "Finalize high-fidelity onboarding wireframes",
        description: "Deliver responsive Figma artboards for team setup flow.",
        status: "DONE",
        order: 0,
        assigneeId: sofia._id,
        createdBy: maya._id,
        dueDate: new Date(now - 32 * dayMs),
        completedAt: new Date(now - 28 * dayMs),
        sourceMeetingId: m1Doc._id,
        sourceActionItemId: m1Items[0]!.id,
      },
      {
        // Converted from Meeting 1 Item 1.2
        title: "Benchmark Redis token bucket rate limiter",
        description: "Simulate 1,000 req/sec burst to verify memory consumption.",
        status: "DONE",
        order: 1,
        assigneeId: omar._id,
        createdBy: maya._id,
        dueDate: new Date(now - 30 * dayMs),
        completedAt: new Date(now - 25 * dayMs),
        sourceMeetingId: m1Doc._id,
        sourceActionItemId: m1Items[1]!.id,
      },
      {
        // Converted from Meeting 2 Item 2.1
        title: "Deploy Redis connection pool timeout hotfix",
        description: "Fast-fail pool timeout set to 400ms with graceful bypass.",
        status: "DONE",
        order: 2,
        assigneeId: omar._id,
        createdBy: dev._id,
        dueDate: new Date(now - 32 * dayMs),
        completedAt: new Date(now - 21 * dayMs),
        sourceMeetingId: m2Doc._id,
        sourceActionItemId: m2Items[0]!.id,
      },
      {
        // Converted from Meeting 2 Item 2.2
        title: "Disable checkout submit button on first click",
        description: "Prevent accidental double-clicks and repeated transactions.",
        status: "DONE",
        order: 3,
        assigneeId: dev._id,
        createdBy: dev._id,
        dueDate: new Date(now - 32 * dayMs),
        completedAt: new Date(now - 14 * dayMs),
        sourceMeetingId: m2Doc._id,
        sourceActionItemId: m2Items[1]!.id,
      },
      {
        // Converted from Meeting 3 Item 3.1
        title: "Draft SAML 2.0 architecture specification",
        description: "Outline Okta and Azure AD SSO integration requirements.",
        status: "DONE",
        order: 4,
        assigneeId: dev._id,
        createdBy: lena._id,
        dueDate: new Date(now - 15 * dayMs),
        completedAt: new Date(now - 7 * dayMs),
        sourceMeetingId: m3Doc._id,
        sourceActionItemId: m3Items[0]!.id,
      },
    ];

    const seededTasks = await Task.insertMany(
      tasksToSeed.map((t) => ({
        ...t,
        teamId: team!._id,
      })),
    );

    // Link the 7 converted action items in their respective meetings to point back to the created task
    for (const taskDoc of seededTasks) {
      if (taskDoc.sourceMeetingId && taskDoc.sourceActionItemId) {
        await Meeting.updateOne(
          {
            _id: taskDoc.sourceMeetingId,
            "ai.actionItems._id": taskDoc.sourceActionItemId,
          },
          {
            $set: {
              "ai.actionItems.$.taskId": taskDoc._id,
            },
          },
        );
      }
    }

    // 6. Notifications for Maya (3 notifications, 1 unread)
    await Notification.deleteMany({ teamId: team._id });

    const taskDocumentation = seededTasks.find(
      (t) => t.title === "Update team documentation with seed account guide",
    )!;
    const m5Doc = seededMeetings.get("DEMOROOM06")!;

    await Notification.insertMany([
      {
        userId: maya._id,
        teamId: team._id,
        type: "TASK_ASSIGNED",
        message: 'Dev Patel assigned you "Update team documentation with seed account guide"',
        link: `/tasks?highlight=${taskDocumentation._id.toString()}`,
        read: false, // 1 unread notification
        createdAt: new Date(now - 1 * dayMs),
      },
      {
        userId: maya._id,
        teamId: team._id,
        type: "MEETING_SUMMARY_READY",
        message: 'Summary ready for "Q4 roadmap sync"',
        link: `/meetings/${m5Doc._id.toString()}`,
        read: true,
        createdAt: new Date(now - 12 * dayMs),
      },
      {
        userId: maya._id,
        teamId: team._id,
        type: "MEETING_SUMMARY_READY",
        message: 'Summary ready for "Sprint 14 planning"',
        link: `/meetings/${m1Doc._id.toString()}`,
        read: true,
        createdAt: new Date(now - 40 * dayMs),
      },
    ]);

    const result: SeedResult = {
      teamCount: 1,
      userCount: usersConfig.length,
      meetingCount: 8, // 6 ENDED + 2 SCHEDULED
      taskCount: seededTasks.length, // 12
      notificationCount: 3,
      transcriptCount: totalTranscriptCount,
      chatCount: totalChatCount,
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
      console.log(`Tasks: ${result.taskCount}`);
      console.log(`Notifications: ${result.notificationCount}`);
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
