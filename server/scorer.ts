import { Signal } from "./db";

// Tiered Location Lists
const STATES = [
  "Alabama", "Alaska", "Arizona", "Arkansas", "California", "Colorado", "Connecticut", "Delaware", 
  "Florida", "Georgia", "Hawaii", "Idaho", "Illinois", "Indiana", "Iowa", "Kansas", "Kentucky", 
  "Louisiana", "Maine", "Maryland", "Massachusetts", "Michigan", "Minnesota", "Mississippi", 
  "Missouri", "Montana", "Nebraska", "Nevada", "New Hampshire", "New Jersey", "New Mexico", 
  "New York", "North Carolina", "North Dakota", "Ohio", "Oklahoma", "Oregon", "Pennsylvania", 
  "Rhode Island", "South Carolina", "South Dakota", "Tennessee", "Texas", "Utah", "Vermont", 
  "Virginia", "Washington", "West Virginia", "Wisconsin", "Wyoming"
];

const TIER_1_CITIES = [
  "New York", "Los Angeles", "Chicago", "Houston", "Miami", 
  "Dallas", "Atlanta", "Washington DC", "Philadelphia", "Phoenix"
];

const TIER_2_CITIES = [
  "San Antonio", "San Diego", "San Jose", "Austin", "Jacksonville", "Fort Worth", "Columbus", 
  "Charlotte", "San Francisco", "Indianapolis", "Seattle", "Denver", "Boston", "El Paso", 
  "Nashville", "Detroit", "Oklahoma City", "Portland", "Las Vegas", "Memphis", "Louisville", 
  "Baltimore", "Milwaukee"
];

const TIER_3_CITIES = [
  "Albuquerque", "Tucson", "Fresno", "Sacramento", "Mesa", "Kansas City", "Omaha", "Colorado Springs", 
  "Raleigh", "Long Beach", "Virginia Beach", "Oakland", "Minneapolis", "Tulsa", "Bakersfield", 
  "Wichita", "Arlington", "Aurora", "Tampa", "New Orleans", "Cleveland", "Anaheim", "Honolulu", 
  "Henderson", "Stockton", "Riverside", "Lexington", "Corpus Christi", "St. Paul", "St. Louis", 
  "Cincinnati", "Pittsburgh", "Greensboro", "Anchorage", "Plano", "Lincoln", "Orlando", "Irvine", 
  "Newark", "Toledo", "Durham", "Chula Vista", "Fort Wayne", "Jersey City", "St. Petersburg", 
  "Laredo", "Madison", "Chandler", "Buffalo", "Lubbock", "Scottsdale", "Reno", "Glendale", "Norfolk", 
  "Chesapeake", "Fremont", "Garland", "Irving", "Hialeah", "Richmond", "Boise", "Spokane", "Baton Rouge", 
  "Tacoma"
];

// Incident Types
const INCIDENT_MAP = [
  { keywords: ["mass shooting", "school shooting", "shooting"], points: 25 },
  { keywords: ["school lockdown", "lockdown"], points: 22 },
  { keywords: ["explosion", "bomb"], points: 20 },
  { keywords: ["death", "killed", "murder"], points: 18 },
  { keywords: ["building fire", "fire"], points: 15 },
  { keywords: ["power outage", "blackout"], points: 12 },
  { keywords: ["earthquake", "tornado", "hurricane"], points: 10 },
  { keywords: ["recall", "settlement"], points: 8 },
  { keywords: ["layoff", "strike"], points: 5 }
];

// Top 200 Celebrities
const CELEBRITIES = [
  "Taylor Swift", "Elon Musk", "Joe Biden", "Donald Trump", "LeBron James", 
  "Cristiano Ronaldo", "Lionel Messi", "Beyonce", "Rihanna", "Drake", 
  "Kim Kardashian", "Kanye West", "Travis Scott", "Justin Bieber", "Selena Gomez", 
  "Ariana Grande", "Lady Gaga", "Brad Pitt", "Leonardo DiCaprio", "Tom Cruise", 
  "Johnny Depp", "Zendaya", "Tom Holland", "Dwayne Johnson", "Keanu Reeves", 
  "Will Smith", "Margot Robbie", "Ryan Gosling", "Scarlett Johansson", "Chris Hemsworth", 
  "Robert Downey Jr.", "Mark Zuckerberg", "Jeff Bezos", "Bill Gates", "Warren Buffett", 
  "Barack Obama", "Michelle Obama", "Hillary Clinton", "Kamala Harris", "Bernie Sanders", 
  "Rishi Sunak", "Emmanuel Macron", "Pope Francis", "Tiger Woods", "Michael Jordan", 
  "Stephen Curry", "Kevin Durant", "Patrick Mahomes", "Tom Brady", "Serena Williams", 
  "Novak Djokovic", "Rafael Nadal", "Roger Federer", "Lewis Hamilton", "Max Verstappen", 
  "Conor McGregor", "Eminem", "Jay Z", "Snoop Dogg", "Post Malone", 
  "The Weeknd", "Bruno Mars", "Ed Sheeran", "Billie Eilish", "Lorde", 
  "Dua Lipa", "Harry Styles", "Adele", "Shakira", "Jennifer Lopez", 
  "Britney Spears", "Dolly Parton", "Willie Nelson", "Elton John", "Paul McCartney", 
  "Mick Jagger", "Freddie Mercury", "David Beckham", "Kylie Jenner", "Kendall Jenner", 
  "Khloe Kardashian", "Kourtney Kardashian", "Kris Jenner", "Caitlyn Jenner", "Bella Hadid", 
  "Gigi Hadid", "Hailey Bieber", "Cardi B", "Nicki Minaj", "Megan Thee Stallion", 
  "Doja Cat", "SZA", "Lil Nas X", "Olivia Rodrigo", "Sabrina Carpenter", 
  "Jenna Ortega", "Timothee Chalamet", "Pedro Pascal", "Austin Butler", "Florence Pugh", 
  "Sydney Sweeney", "Jacob Elordi", "Paul Mescal", "Barry Keoghan", "Cillian Murphy", 
  "Robert Pattinson", "Kristen Stewart", "Emma Watson", "Daniel Radcliffe", "Tom Hiddleston", 
  "Benedict Cumberbatch", "Henry Cavill", "Hugh Jackman", "Ryan Reynolds", "Blake Lively", 
  "Jennifer Aniston", "Courteney Cox", "Lisa Kudrow", "Matt LeBlanc", "Matthew Perry", 
  "David Schwimmer", "George Clooney", "Julia Roberts", "Sandra Bullock", "Meryl Streep", 
  "Tom Hanks", "Morgan Freeman", "Denzel Washington", "Samuel L. Jackson", "Al Pacino", 
  "Robert De Niro", "Clint Eastwood", "Harrison Ford", "Arnold Schwarzenegger", "Sylvester Stallone", 
  "Bruce Willis", "Jackie Chan", "Liam Neeson", "Nicolas Cage", "John Travolta", 
  "Mel Gibson", "Richard Gere", "Pierce Brosnan", "Daniel Craig", "Jude Law", 
  "Colin Farrell", "Christian Bale", "Heath Ledger", "Joaquin Phoenix", "Jared Leto", 
  "Matthew McConaughey", "Woody Harrelson", "Angelina Jolie", "Jennifer Lawrence", "Emma Stone", 
  "Natalie Portman", "Anne Hathaway", "Keira Knightley", "Kate Winslet", "Cameron Diaz", 
  "Drew Barrymore", "Reese Witherspoon", "Halle Berry", "Charlize Theron", "Nicole Kidman", 
  "Cate Blanchett", "Penelope Cruz", "Salma Hayek", "Sofia Vergara", "Michael Jackson", 
  "Elvis Presley", "Marilyn Monroe", "Princess Diana", "Queen Elizabeth", "King Charles", 
  "Prince William", "Kate Middleton", "Prince Harry", "Meghan Markle", "Gwyneth Paltrow", 
  "Uma Thurman", "Sigourney Weaver", "Drew Brees", "Aaron Rodgers", "Travis Kelce", 
  "Shohei Ohtani", "Giannis Antetokounmpo", "Luka Doncic", "Shaquille O'Neal", "Charles Barkley", 
  "Sergey Brin", "Larry Page", "Steve Jobs", "Tim Cook", "Sam Altman", 
  "Vitalik Buterin", "Gordon Ramsay", "Anthony Bourdain", "Bobby Flay", "Jimmy Fallon", 
  "Jimmy Kimmel", "Conan O'Brien", "Stephen Colbert", "Trevor Noah", "John Oliver"
];

export interface SearchScoreResult {
  demandScore: number;
  verdict: "publish" | "monitor" | "skip";
  breakdown: {
    location: number;
    incident: number;
    velocity: number;
    sources: number;
    notoriety: number;
  };
}

/**
 * Escapes special characters for RegExp
 */
function escapeRegex(str: string): string {
  return str.replace(/[-\/\\^$*+?.()|[\]{}]/g, "\\$&");
}

/**
 * Checks if a name is present in the title with word boundaries
 */
function hasWordBoundaryMatch(title: string, word: string): boolean {
  const regex = new RegExp(`\\b${escapeRegex(word)}\\b`, "i");
  return regex.test(title);
}

/**
 * Calculates the Location Score (0-25)
 */
function calculateLocationScore(title: string): number {
  // Tier 1 Cities
  for (const city of TIER_1_CITIES) {
    if (hasWordBoundaryMatch(title, city)) {
      return 25;
    }
  }

  // Tier 2 States
  for (const state of STATES) {
    if (hasWordBoundaryMatch(title, state)) {
      return 15;
    }
  }

  // Tier 2 Cities
  for (const city of TIER_2_CITIES) {
    if (hasWordBoundaryMatch(title, city)) {
      return 15;
    }
  }

  // Tier 3 Cities
  for (const city of TIER_3_CITIES) {
    if (hasWordBoundaryMatch(title, city)) {
      return 8;
    }
  }

  return 3; // default for unclear / no location found
}

/**
 * Calculates the Incident Type Score (0-25)
 */
function calculateIncidentScore(title: string): number {
  let maxPoints = 0;
  for (const item of INCIDENT_MAP) {
    for (const kw of item.keywords) {
      if (hasWordBoundaryMatch(title, kw)) {
        if (item.points > maxPoints) {
          maxPoints = item.points;
        }
      }
    }
  }
  return maxPoints;
}

/**
 * Calculates the Velocity Score (0-20)
 */
function calculateVelocityScore(velocity: number): number {
  if (velocity > 200) return 20;
  if (velocity > 100) return 15;
  if (velocity > 50) return 10;
  if (velocity > 20) return 5;
  return 2;
}

/**
 * Calculates the Multi-Source Score (0-20)
 */
function calculateMultiSourceScore(signal: Signal, relatedSignals: Signal[]): number {
  const allSignals = [...relatedSignals];
  if (!allSignals.some(s => s.id === signal.id)) {
    allSignals.push(signal);
  }

  const uniqueSources = new Set(allSignals.map(s => s.source));
  const sourceCount = uniqueSources.size;

  if (sourceCount >= 4) return 20;
  if (sourceCount === 3) return 15;
  if (sourceCount === 2) return 10;
  if (sourceCount === 1) return 5;
  return 0;
}

/**
 * Calculates the Notoriety Score (0-10)
 */
function calculateNotorietyScore(title: string): number {
  // Check known celebrity names
  for (const name of CELEBRITIES) {
    if (hasWordBoundaryMatch(title, name)) {
      return 10;
    }
  }

  // School / university name
  const schoolRegex = /\b(school|university|college|academy|campus|elementary|high school|middle school)\b/i;
  if (schoolRegex.test(title)) {
    return 8;
  }

  // Hospital, mall, church, airport
  const facilityRegex = /\b(hospital|mall|church|airport|medical center|shopping mall|cathedral|chapel|plaza|terminal)\b/i;
  if (facilityRegex.test(title)) {
    return 7;
  }

  // Police, FBI, government
  const govtRegex = /\b(police|fbi|government|cia|sheriff|cop|officer|feds|dept|department|senate|congress|governor|mayor|white house)\b/i;
  if (govtRegex.test(title)) {
    return 6;
  }

  return 0;
}

/**
 * Score the search demand for a signal based on our 5-layered metrics
 */
export function scoreSearchDemand(signal: Signal, relatedSignals: Signal[]): SearchScoreResult {
  const location = calculateLocationScore(signal.title);
  const incident = calculateIncidentScore(signal.title);
  const velocity = calculateVelocityScore(signal.velocity);
  const sources = calculateMultiSourceScore(signal, relatedSignals);
  const notoriety = calculateNotorietyScore(signal.title);

  const demandScore = location + incident + velocity + sources + notoriety;

  let verdict: "publish" | "monitor" | "skip";
  if (demandScore >= 65) {
    verdict = "publish";
  } else if (demandScore >= 40) {
    verdict = "monitor";
  } else {
    verdict = "skip";
  }

  return {
    demandScore,
    verdict,
    breakdown: {
      location,
      incident,
      velocity,
      sources,
      notoriety
    }
  };
}
