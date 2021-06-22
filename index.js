const { Client } = require("@notionhq/client");
const dotenv = require("dotenv");

dotenv.config();

// Initializing a client
const notion = new Client({
  auth: process.env.NOTION_TOKEN,
});

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

// TODO: Turn into env variables, fine for now
var databases = {
  clients: {
    id: "5e0c70f7e9e34658a9ea779d24a3f591",
  },
  sideQuests: {
    id: "ca95ae82ccc3478399a7d2723ee9e1a5",
  },
  latticeLens: {
    id: "d6aa465c43414bafb724d35d3525f024",
  },
};

// Filter a DB and return the pages a user is mentioned in.
async function getUserMentionPages(database, user) {
  const response = await notion.databases.query({
    database_id: database.id,
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
    database_id: database.id,
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
    databases.clients,
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
  const isUserAdded = await getUserMentionCount(
    databases.latticeLens,
    user
  );

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
    const pages = await getUserMentionPages(
      databases.latticeLens,
      user
    );

    const clientsCount = await getUserMentionCount(
      databases.clients,
      user
    );

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
