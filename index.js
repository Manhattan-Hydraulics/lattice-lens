const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");

dotenv.config();

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

const MASTER_DB = process.env.MASTER_DB_ID;
const SIDE_QUESTS_DB = process.env.SIDE_QUESTS_DB_ID;
const CLIENTS_DB = process.env.CLIENTS_DB_ID;

// Array of all studios.
// The `name` key is mapped to a property value in Notion. Do not change.
// The `domain` key is used to figure out which studio a user is in.
// TODO: Figure out how to tell if a user is in Hydro without a hydro email.
var studios = [
  { name: "Sanctuary", domain: "sanctuary.computer" },
  { name: "Hydraulics", domain: "hydraulics.nyc" },
  { name: "XXIX", domain: "xxix.co" },
  { name: "Index", domain: "index-space.org" },
];

// Filter a DB and return the pages a user is mentioned in.
async function getUserMentionPages(database, user) {
  const response = await notion.databases.query({
    database_id: database,
    filter: {
      "property": "People",
      "people": {
        "contains": user.id,
      },
    },
  });

  return response.results;
}

// TODO Rip this out and just use getUserMentionPages.length (it's async)
// Returns the number of times a user is mentioned in a database property.
async function getUserMentionCount(database, user) {
  const response = await notion.databases.query({
    database_id: database,
    filter: {
      "property": "People",
      "people": {
        "contains": user.id,
      },
    },
  });

  return response.results.length;
}

// Create a new child page for an individual user.
async function createUserPage(user, studio) {
  const userProjectCount = await getUserMentionCount(
    CLIENTS_DB,
    user
  );

  const response = await notion.pages.create({
    parent: {
      database_id: process.env.DATABASE_ID,
    },
    properties: {
      "People": {
        "people": [user],
      },
      "Studios": {
        "select": { "name": studio.name },
      },
      "Client Projects": {
        "number": userProjectCount,
      },
    },
  });
}

// Update the availability of a user on their child page.
// TODO: Refactor this and rename to something more accurate
async function updateAvailablity(user) {
  const isUserAdded = await getUserMentionCount(MASTER_DB, user);

  if (!isUserAdded) {
    // User has no child page
    studios.some((studio) => {
      // Figure out what studio they are in
      user.person.email.includes(studio.domain) &&
        // Create them a new page
        createUserPage(user, studio);
    });
  } else {
    // User already has a child page
    // Get the user's child pages
    const pages = await getUserMentionPages(MASTER_DB, user);

    const clientsCount = await getUserMentionCount(CLIENTS_DB, user);

    // Loop through the child pages
    pages.forEach(async (page) => {
      await notion.pages.update({
        page_id: page.id,
        properties: {
          // Update the client project count
          "Client Projects": {
            "number": clientsCount,
          },
        },
      });
    });
  }
}

// Runs the entire script at runtime.
(async () => {
  const response = await notion.users.list();
  response.results.forEach((user) => {
    if (user.type === "person") {
      updateAvailablity(user);
    }
  });
})();
