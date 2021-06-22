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
const PEOPLE_DB = process.env.PEOPLE_DB_ID;
const PROJECT_TRACKER_DB = process.env.PROJECT_TRACKER_DB_ID;

// Array of all studios. Can be used to assign a "Studio" property based on user email address.
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

// Get all people from the Operating Manuals table
async function getOperatingManualEntries() {
  const response = await notion.databases.query({
    database_id: PEOPLE_DB,
  });

  return response;
}

// Create a new child page for an individual user.
async function createUserPage(user, studio) {
  let results = await getUserMentionPages(CLIENTS_DB, user);

  const userProjectCount = results.length;

  const response = await notion.pages.create({
    parent: {
      database_id: MASTER_DB,
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

  return response;
}

// Update availability and projects of all users
async function updateAvailablity() {
  let projectEndDates = [];
  let estAvailableDate;

  // Get all entries from the IC table
  // TODO: Swap this out with PEOPLE_DB (our Operating Manual table)
  const entries = await notion.databases.query({
    database_id: MASTER_DB,
  });

  entries.results.forEach(async (entry) => {
    const people = entry.properties.People.people; // Get the person property values

    people.forEach(async (person) => {
      // Get all the projects mentioning a user from the project tracker
      const projects = await getUserMentionPages(
        PROJECT_TRACKER_DB,
        person
      );

      // If they have any projects assigned...
      if (projects.length > 0) {
        projects.forEach(async (project) => {
          // Get the end date from the est. project timeline
          let endDate = new Date(
            project.properties["Est Timeline"].date.end
          );

          // Calculate the latest end date of a person's projects
          if (endDate) {
            projectEndDates.push(endDate);
            estAvailableDate = new Date(Math.max(...projectEndDates));
          }
        });

        await notion.pages.update({
          page_id: entry.id,
          properties: {
            // Update the client project count
            "Projects": {
              "relation": [...projects],
            },
            // Update their next est. availability date
            "Est Available Date": {
              "date": {
                "start": estAvailableDate.toISOString().substr(0, 10),
              },
            },
          },
        });
      }
    });
  });
}

// Runs the entire script at runtime.
(async () => {
  // const response = await notion.users.list();
  // response.results.forEach((user) => {
  //   if (user.type === "person") {
  //     updateAvailablity(user);
  //   }
  // });

  // getOperatingManualEntries()

  await updateAvailablity();
})();
