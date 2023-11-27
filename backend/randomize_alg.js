const express = require("express");
const app = express();
const db = require("better-sqlite3")("database.db");
app.use(express.text());
const port = 3000;

app.post("/randomize", (req, res) => {
  const groupCount = 5;

  const groups = randomizeGroups(students, groupCount);
  res.json({ groups });
});

function randomizeGroups(students, groupCount) {
  //Create empty group arrays
  let groups = Array.from({ length: groupCount }, () => []);
  //Shuffle students depending if they have a preference or not
  students.sort((a, b) => {
    //!!(a.mustSitWith || a.cannotSitWith) converts the presence of preferences into a boolean (true or false) and then into 1 or 0 for sorting purposes.
    const aHasPreferences = !!(a.mustSitWith || a.cannotSitWith);
    const bHasPreferences = !!(b.mustSitWith || b.cannotSitWith);
    //bHasPreferences - aHasPreferences effectively sorts students with preferences (1) before those without (0)
    return bHasPreferences - aHasPreferences;
  });
  // Find the index of the last student with preferences in the original array.
  let lastIndexWithPreference = students.findIndex(
    (student) => !student.mustSitWith && !student.cannotSitWith
  );
  lastIndexWithPreference =
    lastIndexWithPreference === -1 ? students.length : lastIndexWithPreference;

  // Function to find a suitable group for a student
  function findSuitableGroup(student, groups) {
    return groups.find((group) => {
      // Check if the group already contains someone the student cannot sit with
      const hasConflictingStudent =
        student.cannotSitWith &&
        student.cannotSitWith.some((name) => group.includes(name));
      // Check if the group is missing someone the student must sit with
      const isMissingMustSitWith =
        student.mustSitWith &&
        !student.mustSitWith.every((name) => group.includes(name));
      return !hasConflictingStudent && !isMissingMustSitWith;
    });
  }
  //Add students with preferences into groups
  for (let i = 0; i < lastIndexWithPreference; i++) {
    const student = students[i];
    let group = findSuitableGroup(student, groups);

    if (!group) {
      // If no suitable group is found, place the student in the least filled group
      group = groups.reduce((prev, current) =>
        prev.length < current.length ? prev : current
      );
    }

    if (!group.includes(student.name)) {
      // Add the student to the group if they are not already in it
      group.push(student.name);
    }

    // Handle "mustSitWith" preferences
    if (student.mustSitWith) {
      // Iterate over each 'mustSitWith' partner
      student.mustSitWith.forEach((partnerName) => {
        // Add the partner to the same group if they aren't already there
        if (!group.includes(partnerName)) {
          group.push(partnerName);
        }
      });
    }
  }

  //Get all the students that are neutral
  // Extract neutral students from the sorted array
  let neutralStudents = students.slice(lastIndexWithPreference + 1);

  // Log or use the neutral students
  console.log("Neutral students: ");
  console.log(neutralStudents);
  console.log("-----------------");
  //Add neutral students into groups while ensuring group count is applied

  // Iterate over neutral students
  neutralStudents.forEach((student) => {
    // Find a group that does not contain any students they 'cannot sit with'
    let suitableGroup = groups.find(
      (group) =>
        !group.some(
          (member) =>
            student.cannotSitWith && student.cannotSitWith.includes(member)
        )
    );

    // If no suitable group is found, use the least filled group, but ensure it doesn't violate any 'cannot sit with' constraints
    if (!suitableGroup) {
      suitableGroup = groups.reduce((prev, current) =>
        prev.length < current.length &&
        !current.some(
          (member) =>
            student.cannotSitWith && student.cannotSitWith.includes(member)
        )
          ? prev
          : current
      );
    }

    suitableGroup.push(student.name);
  });

  return groups;
}

//This is just a temporary list generated with ChatGPT, wont be used in production (student count is 15)
const students = [
  { name: "Emma" },
  { name: "Liam" },
  { name: "Olivia" },
  { name: "Noah" },
  {
    name: "Ava",
    mustSitWith: ["Olivia", "Sophia"],
  },
  { name: "Isabella" },
  { name: "Sophia" },
  { name: "Mia" },
  {
    name: "Charlotte",
    cannotSitWith: ["Amelia", "Harper"],
  },
  {
    name: "Amelia",
    mustSitWith: ["Evelyn", "Abigail"],
  },
  { name: "Harper" },
  {
    name: "Evelyn",
    cannotSitWith: ["Liam", "Noah"],
  },
  { name: "Abigail" },
  { name: "Ethan" },
  {
    name: "Logan",
    mustSitWith: ["Lucas", "Mason"],
  },
];
