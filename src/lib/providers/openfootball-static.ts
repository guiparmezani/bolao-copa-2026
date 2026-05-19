import { readFile } from "node:fs/promises";
import path from "node:path";

import type { MatchPhase } from "@prisma/client";

import type { NormalizedMatch, NormalizedTeam, StaticTournamentData, TournamentDataProvider } from "./types";

const providerSource = "openfootball-2026";

const source = {
  name: "OpenFootball World Cup 2026",
  url: "https://github.com/openfootball/worldcup/tree/master/2026--usa",
  license: "CC0/public domain per OpenFootball project metadata",
};

const venueByCity: Record<string, [string, string]> = {
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

const teamMeta: Record<string, [string, string, string]> = {
  Mexico: ["México", "🇲🇽", "MX"],
  "South Africa": ["África do Sul", "🇿🇦", "ZA"],
  "South Korea": ["Coreia do Sul", "🇰🇷", "KR"],
  "Czech Republic": ["Tchéquia", "🇨🇿", "CZ"],
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
  Netherlands: ["Países Baixos", "🇳🇱", "NL"],
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

const monthIndex: Record<string, number> = {
  Jun: 5,
  June: 5,
  Jul: 6,
  July: 6,
};

function slug(value: string) {
  return value
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/&/g, "and")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

function kickoffAt(monthName: string, day: string, time: string, offset: string) {
  const [hour, minute] = time.split(":").map(Number);
  return new Date(
    Date.UTC(2026, monthIndex[monthName], Number(day), hour - Number(offset), minute),
  );
}

export function parseOpenFootballStaticData(cupText: string, finalsText: string): StaticTournamentData {
  const teams = parseGroupTeams(cupText);
  const matches = [...parseGroupMatches(cupText), ...parseKnockoutMatches(finalsText)];

  if (teams.length !== 48 || matches.length !== 104) {
    throw new Error(`Expected 48 teams and 104 matches; got ${teams.length}/${matches.length}.`);
  }

  return { teams, matches };
}

function parseGroupTeams(cupText: string): NormalizedTeam[] {
  const teamNames = Object.keys(teamMeta).sort((a, b) => b.length - a.length);
  const teams: NormalizedTeam[] = [];

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
        providerSource,
        providerId: slug(nameEn),
        fifaCode: iso2Code,
        iso2Code,
        nameEn,
        namePt,
        flagEmoji,
        groupName,
        raw: { ...source, rawLine: line.trim() },
      });
      remaining = remaining.slice(nameEn.length).trim();
    }
  }

  return teams;
}

function parseGroupMatches(cupText: string): NormalizedMatch[] {
  const matches: NormalizedMatch[] = [];
  let currentGroup: string | null = null;
  let currentDate: { month: string; day: string } | null = null;
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
      providerSource,
      providerId: `M${matchNumber}`,
      matchNumber,
      phase: "group",
      groupName: currentGroup,
      kickoffAt: kickoffAt(currentDate.month, currentDate.day, time, offset),
      venueName: venue[0],
      venueCity: venue[1],
      homeTeamProviderId: slug(homeTeam.trim()),
      awayTeamProviderId: slug(awayTeam.trim()),
      homePlaceholder: null,
      awayPlaceholder: null,
      status: "scheduled",
      raw: { ...source, rawLine: line.trim() },
    });
    matchNumber += 1;
  }

  return matches;
}

function parseKnockoutMatches(finalsText: string): NormalizedMatch[] {
  const phaseMap: Record<string, MatchPhase> = {
    "Round of 32": "round_of_32",
    "Round of 16": "round_of_16",
    "Quarter-final": "quarter_final",
    "Semi-final": "semi_final",
    "Match for third place": "third_place",
    Final: "final",
  };
  const matches: NormalizedMatch[] = [];
  let currentPhase: MatchPhase | null = null;
  let currentDate: { month: string; day: string } | null = null;

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
      providerSource,
      providerId: `M${matchNumber}`,
      matchNumber,
      phase: currentPhase,
      groupName: null,
      kickoffAt: kickoffAt(currentDate.month, currentDate.day, time, offset),
      venueName: venue[0],
      venueCity: venue[1],
      homeTeamProviderId: null,
      awayTeamProviderId: null,
      homePlaceholder: homePlaceholder.trim(),
      awayPlaceholder: awayPlaceholder.trim(),
      status: "scheduled",
      raw: { ...source, rawLine: line.trim() },
    });
  }

  return matches.sort((a, b) => a.matchNumber - b.matchNumber);
}

export class OpenFootballStaticProvider implements TournamentDataProvider {
  source = providerSource;

  constructor(private readonly seedRoot = path.join(process.cwd(), "prisma/seed-data/openfootball-2026")) {}

  async fetchStaticTournamentData() {
    const [cupText, finalsText] = await Promise.all([
      readFile(path.join(this.seedRoot, "cup.txt"), "utf8"),
      readFile(path.join(this.seedRoot, "cup_finals.txt"), "utf8"),
    ]);

    return parseOpenFootballStaticData(cupText, finalsText);
  }

  async fetchLiveMatches() {
    return [];
  }

  async fetchOfficialStandings() {
    return [];
  }
}
