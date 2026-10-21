import { LEGAL, type LegalDocument } from "../legal";

const { controller, email, minAge } = LEGAL;

export const privacy: LegalDocument = {
  title: "Privacy policy",
  sections: [
    {
      heading: "Who is responsible",
      body: [
        `The controller of your data in Trivia Ajolote is ${controller}. For any privacy question you can write to ${email}.`,
      ],
    },
    {
      heading: "What data we process",
      body: [
        [
          "Sign-in data: when you sign in with Google or Discord, that service sends us your identifier, your email and, if you have them, your name, handle and profile picture. We only use the handle to suggest a username.",
          "Profile: username, avatar, language and the date you accepted these documents.",
          "Game activity: matches, answers, scores, duels and the questions you have already seen.",
          "Friends: requests sent and received, and your friends list.",
          "Connection: when you last used the app and whether you are in a match, so your friends can see if you are online and challenge you live. Only your friends see it, and you can hide it in your profile.",
          "Guests: the name and avatar of the players you add to a local match on your device.",
          "Question reports you send.",
          "Notifications: in-app notifications (deleted after 24 hours) and, only if you turn on push notifications, your browser's subscription to send them.",
          "Technical data: usage counters to prevent abuse, error reports (what failed, on which screen and with which browser and system) and our providers' technical logs, which may include your IP address.",
        ],
      ],
    },
    {
      heading: "Why and on what legal basis",
      body: [
        [
          "To provide the service (your account, matches, friends, duels and their notifications): this is necessary to perform the terms you accept when you sign up.",
          "To keep the game safe and fair (usage limits, username moderation, reports): our legitimate interest in preventing abuse.",
          "To find and fix errors (error reports) and to know whether people enjoy the game (we count, without identifying anyone, how many players come back to play days after signing up, using the game activity we already store): our legitimate interest in improving the game.",
          "Push notifications: only if you turn them on. You can turn them off in your profile at any time.",
        ],
        "We do not sell your data, we do not show ads and we do not use analytics tools. If we ever add them, we will ask for your permission first.",
      ],
    },
    {
      heading: "Who else can see it",
      body: [
        "Other players see your username, avatar and level (when they search for you, in their friends list and in duels), and the result of the duels you play together.",
        "To run the game we use providers that process data on our behalf: Supabase (database and sign-in), Vercel (web hosting), Sentry (error reports, on EU servers) and your browser's notification services (Google, Apple or Mozilla). Google and Discord process your sign-in data under their own policies.",
        "If a provider processes data outside the European Economic Area, it does so with the safeguards required by law, such as the European Commission's standard contractual clauses or the EU-U.S. Data Privacy Framework.",
      ],
    },
    {
      heading: "How long we keep it",
      body: [
        "For as long as you have an account. When you delete it from your profile, your profile and all your game data are erased immediately. In other players' finished duels, your place is left empty. Backups are deleted after 30 days at most.",
      ],
    },
    {
      heading: "Your rights",
      body: [
        `You can change your name, avatar and language in your profile and delete your account there too. You can also ask us for a copy of your data, to correct it, to restrict or object to its processing, or to take it to another service, by writing to ${email}. We will reply within one month at most.`,
        "If you think we have not handled your data properly, you can complain to the Spanish Data Protection Agency (aepd.es) or to the authority in your country.",
      ],
    },
    {
      heading: "Minimum age",
      body: [
        `You must be at least ${minAge} years old (or the minimum age required by the law of your country, if higher) to create an account. If we learn that someone younger has an account, we will delete it.`,
      ],
    },
    {
      heading: "Cookies and storage on your device",
      body: [
        "We only use what the game needs to work, so we do not ask for your permission:",
        [
          "Session cookies: keep you signed in.",
          "Language (NEXT_LOCALE) and text size (TEXT_SIZE) cookies: remember your preferences.",
          "Local storage: remembers whether you have turned off sounds or vibration.",
        ],
      ],
    },
    {
      heading: "Changes to this policy",
      body: [
        "If we change it, we will update the date on this page. If the change is important, we will let you know in the game and, when needed, ask you to accept it again.",
      ],
    },
  ],
};

export const terms: LegalDocument = {
  title: "Terms of use",
  sections: [
    {
      heading: "What Trivia Ajolote is",
      body: [
        `Trivia Ajolote is a free quiz game offered by ${controller} (${email}). By creating your account you accept these terms and confirm that you have read the privacy policy.`,
        "The game is in testing: it may have bugs, change or be temporarily unavailable.",
      ],
    },
    {
      heading: "Your account",
      body: [
        `You must be at least ${minAge} years old (or the minimum age required by the law of your country, if higher). You are responsible for what is done with your account. Guests you add to a local match play under your account.`,
      ],
    },
    {
      heading: "Fair play rules",
      body: [
        [
          "Choose a username that is not offensive and does not impersonate anyone.",
          "Do not cheat or use programs to play or query the game automatically.",
          "Do not try to overload, attack or access parts of the service that are not meant for you.",
          "Report questions in good faith.",
        ],
        "If you break these rules, we may change your username, suspend your account or delete it.",
      ],
    },
    {
      heading: "The questions",
      body: [
        "Questions are created with the help of artificial intelligence and reviewed, but they may contain mistakes. If you find one, report it from the question itself.",
      ],
    },
    {
      heading: "Intellectual property",
      body: [
        "The game, its mascot, its design and its questions belong to us. We allow you to use them personally and non-commercially while you have an account.",
      ],
    },
    {
      heading: "Liability",
      body: [
        "We offer the game as it is and do our best to keep it working well, but we cannot guarantee that it will always be available or free of errors. Nothing here limits your statutory rights as a consumer.",
      ],
    },
    {
      heading: "Ending the service",
      body: [
        "You can delete your account at any time from your profile. If we ever close the game, we will give you reasonable notice.",
      ],
    },
    {
      heading: "Changes and governing law",
      body: [
        "If we change these terms, we will update the date on this page and, if the change is important, ask you to accept them again.",
        "These terms are governed by Spanish law. If you are a consumer, you may go to the courts where you live.",
      ],
    },
  ],
};
