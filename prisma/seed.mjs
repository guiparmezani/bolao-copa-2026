import argon2 from "argon2";
import { PrismaClient } from "@prisma/client";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

const prisma = new PrismaClient();
const seedDir = path.dirname(fileURLToPath(import.meta.url));
const providerSource = "openfootball-2026";

const defaultScoringRules = [
  ["group", 1, 2, 3, 5],
  ["round_of_32", 1.5, 3, 4.5, 7.5],
  ["round_of_16", 1.5, 3, 4.5, 7.5],
  ["quarter_final", 1.5, 3, 4.5, 7.5],
  ["semi_final", 2, 4, 6, 10],
  ["third_place", 3, 6, 9, 15],
  ["final", 3, 6, 9, 15],
];

const defaultPlacementBonuses = {
  champion: 75,
  runner_up: 50,
  third_place: 25,
};

const venueByCity = {
  "Mexico City": ["Estadio Azteca", "Mexico City"],
  "Guadalajara (Zapopan)": ["Estadio Akron", "Guadalajara (Zapopan)"],
  "Monterrey (Guadalupe)": ["Estadio BBVA", "Monterrey (Guadalupe)"],
  Atlanta: ["Mercedes-Benz Stadium", "Atlanta"],
  "Boston (Foxborough)": ["Gillette Stadium", "Boston (Foxborough)"],
  "Dallas (Arlington)": ["AT&T Stadium", "Dallas (Arlington)"],
  Houston: ["NRG Stadium", "Houston"],
  "Kansas City": ["Arrowhead Stadium", "Kansas City"],
  "Los Angeles (Inglewood)": ["SoFi Stadium", "Los Angeles (Inglewood)"],
  "Miami (Miami Gardens)": ["Hard Rock Stadium", "Miami (Miami Gardens)"],
  "New York/New Jersey (East Rutherford)": [
    "MetLife Stadium",
    "New York/New Jersey (East Rutherford)",
  ],
  Philadelphia: ["Lincoln Financial Field", "Philadelphia"],
  "San Francisco Bay Area (Santa Clara)": [
    "Levi's Stadium",
    "San Francisco Bay Area (Santa Clara)",
  ],
  Seattle: ["Lumen Field", "Seattle"],
  Toronto: ["BMO Field", "Toronto"],
  Vancouver: ["BC Place", "Vancouver"],
};

const teamMeta = {
  Mexico: ["México", "🇲🇽", "MX"],
  "South Africa": ["África do Sul", "🇿🇦", "ZA"],
  "South Korea": ["Coreia do Sul", "🇰🇷", "KR"],
  "Czech Republic": ["Rep. Tcheca", "🇨🇿", "CZ"],
  Canada: ["Canadá", "🇨🇦", "CA"],
  "Bosnia & Herzegovina": ["Bósnia e Herzegovina", "🇧🇦", "BA"],
  Qatar: ["Catar", "🇶🇦", "QA"],
  Switzerland: ["Suíça", "🇨🇭", "CH"],
  Brazil: ["Brasil", "🇧🇷", "BR"],
  Morocco: ["Marrocos", "🇲🇦", "MA"],
  Haiti: ["Haiti", "🇭🇹", "HT"],
  Scotland: ["Escócia", "🏴", "GB-SCT"],
  USA: ["Estados Unidos", "🇺🇸", "US"],
  Paraguay: ["Paraguai", "🇵🇾", "PY"],
  Australia: ["Austrália", "🇦🇺", "AU"],
  Turkey: ["Turquia", "🇹🇷", "TR"],
  Germany: ["Alemanha", "🇩🇪", "DE"],
  Curaçao: ["Curaçao", "🇨🇼", "CW"],
  "Ivory Coast": ["Costa do Marfim", "🇨🇮", "CI"],
  Ecuador: ["Equador", "🇪🇨", "EC"],
  Netherlands: ["Holanda", "🇳🇱", "NL"],
  Japan: ["Japão", "🇯🇵", "JP"],
  Sweden: ["Suécia", "🇸🇪", "SE"],
  Tunisia: ["Tunísia", "🇹🇳", "TN"],
  Belgium: ["Bélgica", "🇧🇪", "BE"],
  Egypt: ["Egito", "🇪🇬", "EG"],
  Iran: ["Irã", "🇮🇷", "IR"],
  "New Zealand": ["Nova Zelândia", "🇳🇿", "NZ"],
  Spain: ["Espanha", "🇪🇸", "ES"],
  "Cape Verde": ["Cabo Verde", "🇨🇻", "CV"],
  "Saudi Arabia": ["Arábia Saudita", "🇸🇦", "SA"],
  Uruguay: ["Uruguai", "🇺🇾", "UY"],
  France: ["França", "🇫🇷", "FR"],
  Senegal: ["Senegal", "🇸🇳", "SN"],
  Iraq: ["Iraque", "🇮🇶", "IQ"],
  Norway: ["Noruega", "🇳🇴", "NO"],
  Argentina: ["Argentina", "🇦🇷", "AR"],
  Algeria: ["Argélia", "🇩🇿", "DZ"],
  Austria: ["Áustria", "🇦🇹", "AT"],
  Jordan: ["Jordânia", "🇯🇴", "JO"],
  Portugal: ["Portugal", "🇵🇹", "PT"],
  "DR Congo": ["RD Congo", "🇨🇩", "CD"],
  Uzbekistan: ["Uzbequistão", "🇺🇿", "UZ"],
  Colombia: ["Colômbia", "🇨🇴", "CO"],
  England: ["Inglaterra", "🏴", "GB-ENG"],
  Croatia: ["Croácia", "🇭🇷", "HR"],
  Ghana: ["Gana", "🇬🇭", "GH"],
  Panama: ["Panamá", "🇵🇦", "PA"],
};

const monthIndex = {
  Jun: 5,
  June: 5,
  Jul: 6,
  July: 6,
};

function normalizeEmail(email) {
  return email.trim().toLowerCase();
}

function fallbackAdminEmail(username) {
  if (!username) {
    return null;
  }

  return username.includes("@") ? username : `${username}@local.test`;
}

function slug(value) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function kickoffAt(monthName, day, time, offset) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Date.UTC(2026, monthIndex[monthName], Number(day), hour - Number(offset), minute),
  );
}

function parseGroupTeams(cupText) {
  const teamNames = Object.keys(teamMeta).sort((a, b) => b.length - a.length);
  const teams = [];

  for (const line of cupText.split(/\r?\n/)) {
    const match = line.match(/^Group ([A-L]) \|\s+(.+)$/);

    if (!match) {
      continue;
    }

    let remaining = match[2].trim();
    const groupName = `Grupo ${match[1]}`;

    for (let index = 0; index < 4; index += 1) {
      const nameEn = teamNames.find(
        (teamName) => remaining === teamName || remaining.startsWith(`${teamName}  `),
      );

      if (!nameEn) {
        throw new Error(`Could not parse group team from: ${remaining}`);
      }

      const [namePt, flagEmoji, iso2Code] = teamMeta[nameEn];
      teams.push({
        providerId: slug(nameEn),
        nameEn,
        namePt,
        flagEmoji,
        iso2Code,
        groupName,
      });
      remaining = remaining.slice(nameEn.length).trim();
    }
  }

  return teams;
}

function parseGroupMatches(cupText) {
  const matches = [];
  let currentGroup = null;
  let currentDate = null;
  let matchNumber = 1;

  for (const line of cupText.split(/\r?\n/)) {
    const groupMatch = line.match(/^▪ Group ([A-L])/);
    const dateMatch = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (June|Jun) (\d{1,2})$/);
    const fixtureMatch = line.match(
      /^\s+(\d{1,2}:\d{2}) UTC([+-]\d+)\s+(.+?)\s+v\s+(.+?)\s+@\s+(.+?)\s*$/,
    );

    if (groupMatch) {
      currentGroup = `Grupo ${groupMatch[1]}`;
      continue;
    }

    if (dateMatch) {
      currentDate = { month: dateMatch[1], day: dateMatch[2] };
      continue;
    }

    if (!fixtureMatch || !currentGroup || !currentDate) {
      continue;
    }

    const [, time, offset, homeTeam, awayTeam, city] = fixtureMatch;
    const venue = venueByCity[city.trim()];

    if (!venue) {
      throw new Error(`Unknown venue city: ${city}`);
    }

    matches.push({
      matchNumber,
      providerId: `M${matchNumber}`,
      phase: "group",
      groupName: currentGroup,
      kickoffAt: kickoffAt(currentDate.month, currentDate.day, time, offset),
      venueName: venue[0],
      venueCity: venue[1],
      homeTeamProviderId: slug(homeTeam.trim()),
      awayTeamProviderId: slug(awayTeam.trim()),
      homePlaceholder: null,
      awayPlaceholder: null,
      rawLine: line.trim(),
    });
    matchNumber += 1;
  }

  return matches;
}

function parseKnockoutMatches(finalsText) {
  const phaseMap = {
    "Round of 32": "round_of_32",
    "Round of 16": "round_of_16",
    "Quarter-final": "quarter_final",
    "Semi-final": "semi_final",
    "Match for third place": "third_place",
    Final: "final",
  };
  const matches = [];
  let currentPhase = null;
  let currentDate = null;

  for (const line of finalsText.split(/\r?\n/)) {
    const phaseMatch = line.match(
      /^▪ (Round of 32|Round of 16|Quarter-final|Semi-final|Match for third place|Final)/,
    );
    const dateMatch = line.match(/^(?:Mon|Tue|Wed|Thu|Fri|Sat|Sun) (Jun|Jul) (\d{1,2})/);
    const fixtureMatch = line.match(
      /^\s*(?:\((\d+)\)\s*)?(\d{1,2}:\d{2}) UTC([+-]\d+)\s+(.+?)\s+v\s+(.+?)\s+@\s+(.+?)\s*$/,
    );

    if (phaseMatch) {
      currentPhase = phaseMap[phaseMatch[1]];
      continue;
    }

    if (dateMatch) {
      currentDate = { month: dateMatch[1], day: dateMatch[2] };
      continue;
    }

    if (!fixtureMatch || !currentPhase || !currentDate) {
      continue;
    }

    const [, explicitMatchNumber, time, offset, homePlaceholder, awayPlaceholder, city] =
      fixtureMatch;
    const venue = venueByCity[city.trim()];

    if (!venue) {
      throw new Error(`Unknown venue city: ${city}`);
    }

    const matchNumber =
      explicitMatchNumber === undefined
        ? currentPhase === "third_place"
          ? 103
          : 104
        : Number(explicitMatchNumber);

    matches.push({
      matchNumber,
      providerId: `M${matchNumber}`,
      phase: currentPhase,
      groupName: null,
      kickoffAt: kickoffAt(currentDate.month, currentDate.day, time, offset),
      venueName: venue[0],
      venueCity: venue[1],
      homeTeamProviderId: null,
      awayTeamProviderId: null,
      homePlaceholder: homePlaceholder.trim(),
      awayPlaceholder: awayPlaceholder.trim(),
      rawLine: line.trim(),
    });
  }

  return matches.sort((a, b) => a.matchNumber - b.matchNumber);
}

async function seedTournamentData() {
  const [cupText, finalsText] = await Promise.all([
    readFile(path.join(seedDir, "seed-data/openfootball-2026/cup.txt"), "utf8"),
    readFile(path.join(seedDir, "seed-data/openfootball-2026/cup_finals.txt"), "utf8"),
  ]);
  const teams = parseGroupTeams(cupText);
  const matches = [...parseGroupMatches(cupText), ...parseKnockoutMatches(finalsText)];
  const source = {
    name: "OpenFootball World Cup 2026",
    url: "https://github.com/openfootball/worldcup/tree/master/2026--usa",
    license: "CC0/public domain per OpenFootball project metadata",
  };

  if (teams.length !== 48 || matches.length !== 104) {
    throw new Error(`Expected 48 teams and 104 matches; got ${teams.length}/${matches.length}.`);
  }

  const teamByProviderId = new Map();

  for (const team of teams) {
    const savedTeam = await prisma.team.upsert({
      where: {
        providerSource_providerId: {
          providerSource,
          providerId: team.providerId,
        },
      },
      update: {
        fifaCode: team.iso2Code,
        iso2Code: team.iso2Code,
        nameEn: team.nameEn,
        namePt: team.namePt,
        flagEmoji: team.flagEmoji,
        groupName: team.groupName,
      },
      create: {
        providerSource,
        providerId: team.providerId,
        fifaCode: team.iso2Code,
        iso2Code: team.iso2Code,
        nameEn: team.nameEn,
        namePt: team.namePt,
        flagEmoji: team.flagEmoji,
        groupName: team.groupName,
      },
    });
    teamByProviderId.set(team.providerId, savedTeam.id);

    await prisma.groupStanding.upsert({
      where: {
        groupName_teamId: {
          groupName: team.groupName,
          teamId: savedTeam.id,
        },
      },
      update: {
        providerSource,
        providerId: `${team.groupName}-${team.providerId}`,
      },
      create: {
        providerSource,
        providerId: `${team.groupName}-${team.providerId}`,
        groupName: team.groupName,
        teamId: savedTeam.id,
        rank: teams.filter((candidate) => candidate.groupName === team.groupName).findIndex(
          (candidate) => candidate.providerId === team.providerId,
        ) + 1,
      },
    });
  }

  const publishedAt = new Date("2026-05-19T00:00:00.000Z");

  for (const match of matches) {
    const savedMatch = await prisma.match.upsert({
      where: { matchNumber: match.matchNumber },
      update: {
        providerSource,
        providerId: match.providerId,
        phase: match.phase,
        groupName: match.groupName,
        kickoffAt: match.kickoffAt,
        venueName: match.venueName,
        venueCity: match.venueCity,
        homeTeamId: match.homeTeamProviderId
          ? teamByProviderId.get(match.homeTeamProviderId)
          : null,
        awayTeamId: match.awayTeamProviderId
          ? teamByProviderId.get(match.awayTeamProviderId)
          : null,
        homePlaceholder: match.homePlaceholder,
        awayPlaceholder: match.awayPlaceholder,
        status: "scheduled",
        publicationStatus: "published",
        publishedAt,
        rawProviderPayload: { ...source, rawLine: match.rawLine },
        lastSyncedAt: publishedAt,
      },
      create: {
        providerSource,
        providerId: match.providerId,
        matchNumber: match.matchNumber,
        phase: match.phase,
        groupName: match.groupName,
        kickoffAt: match.kickoffAt,
        venueName: match.venueName,
        venueCity: match.venueCity,
        homeTeamId: match.homeTeamProviderId
          ? teamByProviderId.get(match.homeTeamProviderId)
          : null,
        awayTeamId: match.awayTeamProviderId
          ? teamByProviderId.get(match.awayTeamProviderId)
          : null,
        homePlaceholder: match.homePlaceholder,
        awayPlaceholder: match.awayPlaceholder,
        status: "scheduled",
        publicationStatus: "published",
        publishedAt,
        rawProviderPayload: { ...source, rawLine: match.rawLine },
        lastSyncedAt: publishedAt,
      },
    });

    if (match.homePlaceholder && match.awayPlaceholder) {
      await Promise.all(
        [
          ["home", match.homePlaceholder],
          ["away", match.awayPlaceholder],
        ].map(([side, slotLabel]) =>
          prisma.knockoutSlot.upsert({
            where: {
              matchId_side: {
                matchId: savedMatch.id,
                side,
              },
            },
            update: {
              slotLabel,
              source: providerSource,
              rawProviderPayload: { ...source, matchNumber: match.matchNumber },
            },
            create: {
              matchId: savedMatch.id,
              side,
              slotLabel,
              source: providerSource,
              rawProviderPayload: { ...source, matchNumber: match.matchNumber },
            },
          }),
        ),
      );
    }
  }

  console.log(`Tournament seed ready: ${teams.length} teams, ${matches.length} matches.`);
}

async function seedAdminUser() {
  const adminEmail = process.env.ADMIN_EMAIL ?? fallbackAdminEmail(process.env.ADMIN_USERNAME);
  const legacyUsername = process.env.ADMIN_USERNAME
    ? normalizeEmail(process.env.ADMIN_USERNAME)
    : null;
  const password = process.env.ADMIN_PASSWORD;
  const displayName = process.env.ADMIN_DISPLAY_NAME ?? "Admin";

  if (!adminEmail || !password) {
    console.log(
      "Admin seed skipped. Set ADMIN_EMAIL and ADMIN_PASSWORD to create or update an admin user.",
    );
    return;
  }

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(adminEmail)) {
    throw new Error("ADMIN_EMAIL must be a valid email address.");
  }

  if (password.length < 10) {
    throw new Error("ADMIN_PASSWORD must have at least 10 characters.");
  }

  const emailNormalized = normalizeEmail(adminEmail);
  const passwordHash = await argon2.hash(password, {
    type: argon2.argon2id,
    memoryCost: 19456,
    timeCost: 2,
    parallelism: 1,
  });
  const existingAdmin = await prisma.user.findFirst({
    where: {
      OR: [
        { emailNormalized },
        { usernameNormalized: emailNormalized },
        ...(legacyUsername ? [{ usernameNormalized: legacyUsername }] : []),
      ],
    },
  });

  if (existingAdmin) {
    await prisma.user.update({
      where: { id: existingAdmin.id },
      data: {
        username: emailNormalized,
        usernameNormalized: emailNormalized,
        email: emailNormalized,
        emailNormalized,
        emailVerifiedAt: existingAdmin.emailVerifiedAt ?? new Date(),
        displayName,
        passwordHash,
        role: "admin",
        status: "active",
        deletedAt: null,
      },
    });
  } else {
    await prisma.user.create({
      data: {
        username: emailNormalized,
        usernameNormalized: emailNormalized,
        email: emailNormalized,
        emailNormalized,
        emailVerifiedAt: new Date(),
        displayName,
        passwordHash,
        role: "admin",
      },
    });
  }

  console.log(`Admin user ready: ${emailNormalized}`);
}

async function seedScoringDefaults() {
  const activeFrom = new Date("2026-05-19T00:00:00.000Z");

  for (const [phase, oneTeamGoalsPoints, outcomePoints, scorelinePoints, exactCapPoints] of
    defaultScoringRules) {
    const existingRule = await prisma.scoringRule.findFirst({
      where: {
        phase,
        activeTo: null,
      },
      orderBy: {
        activeFrom: "desc",
      },
    });

    const data = {
      oneTeamGoalsPoints,
      outcomePoints,
      scorelinePoints,
      exactCapPoints,
    };

    if (existingRule) {
      await prisma.scoringRule.update({
        where: { id: existingRule.id },
        data,
      });
    } else {
      await prisma.scoringRule.create({
        data: {
          phase,
          ...data,
          activeFrom,
        },
      });
    }
  }

  await prisma.appSetting.upsert({
    where: { key: "placement_bonus_points" },
    update: {
      value: defaultPlacementBonuses,
    },
    create: {
      key: "placement_bonus_points",
      value: defaultPlacementBonuses,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "placement_predictions_enabled" },
    update: {
      value: true,
    },
    create: {
      key: "placement_predictions_enabled",
      value: true,
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "group_submission_deadline" },
    update: {
      value: "2026-06-12T02:59:00.000Z",
    },
    create: {
      key: "group_submission_deadline",
      value: "2026-06-12T02:59:00.000Z",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "knockout_submission_deadline" },
    update: {
      value: "2026-06-28T02:59:00.000Z",
    },
    create: {
      key: "knockout_submission_deadline",
      value: "2026-06-28T02:59:00.000Z",
    },
  });

  await prisma.appSetting.upsert({
    where: { key: "placement_submission_deadline" },
    update: {
      value: "2026-06-12T02:59:00.000Z",
    },
    create: {
      key: "placement_submission_deadline",
      value: "2026-06-12T02:59:00.000Z",
    },
  });

  console.log("Scoring defaults ready.");
}

async function main() {
  await seedTournamentData();
  await seedScoringDefaults();
  await seedAdminUser();
}

try {
  await main();
} catch (error) {
  console.error(error);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
