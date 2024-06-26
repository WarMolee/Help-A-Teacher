const express = require("express");
const app = express();
const db = require("better-sqlite3")("database.db");
const cors = require("cors");
const multer = require("multer");
const crypto = require("crypto");
const path = require("path");
app.use(express.json());
app.use(cors());
app.use(
  "/Profile_Imgs",
  cors(),
  (req, res, next) => {
    next();
  },
  express.static("Profile_Imgs")
);
const port = 3000;

// IMPORTS
const randomizeGroups = require("./randomize_alg")(db);
const archiveFunction = require("./archiveFunction")(db);
const dbInformation = require("./dbInformation");
const showClass = require("./showClass");

// Initialize
db.prepare(
  ` CREATE TABLE IF NOT EXISTS students (
      id INTEGER PRIMARY KEY,
      name TEXT,
      image_filepath TEXT,
      class_id INTEGER,
      group_id INTEGER,
      mustSitWith TEXT,  
      cannotSitWith TEXT, 
      FOREIGN KEY (class_id) REFERENCES classes(id)
  )`
).run();
db.prepare(
  ` CREATE TABLE IF NOT EXISTS classes (
      id INTEGER PRIMARY KEY,
      name TEXT,
      year INTEGER,
      focus TEXT,
      groups INTEGER,
      mentorName TEXT,
      date_created DATE
  )`
).run();
db.prepare(
  `CREATE TABLE IF NOT EXISTS groups (
      id INTEGER PRIMARY KEY,
      class_id INTEGER,
      group_index INTEGER,
      group_name TEXT,
      group_leader INTEGER,
      FOREIGN KEY (class_id) REFERENCES classes(id)
  )`
).run();

// Archive tables
db.prepare(`SELECT name FROM classes`)
  .all()
  .forEach((e) => {
    db.prepare(
      ` CREATE TABLE IF NOT EXISTS ARCHIVE_CLASSDATA_${e.name} (
        id INTEGER PRIMARY KEY,
        date_created DATETIME,
        class_name TEXT,
        student_data JSON,
        group_leader TEXT
    )`
    ).run();
  });

// Set up Multer for handling file uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, "./profile_imgs/"); // Set the destination folder
  },
  filename: function (req, file, cb) {
    cb(null, `${crypto.randomUUID()}.${file.originalname.split(".")[1]}`);
  },
});
const upload = multer({ storage: storage });

// IMAGE UPLOADS
app.post("/uploadImage", upload.single("image"), (req, res) => {
  const imageFilepath = `/profile_imgs/${req.file.filename}`;
  const studentId = req.body.studentId;

  db.prepare("UPDATE students SET image_filepath = ? WHERE id = ?").run(
    imageFilepath,
    studentId
  );

  res.json({ message: "Image uploaded successfully!" });
});

// GET ALL STUDENTS
app.get("/getAllStudents", (req, res) => {
  const query = `
    SELECT students.*, classes.name AS className
    FROM students
    LEFT JOIN classes ON students.class_id = classes.id
    ORDER BY class_id ASC NULLS FIRST;`;

  const allStudents = db.prepare(query).all();
  res.json({ result: allStudents });
});

// GET CLASS STUDENTS
app.post("/getClassStudents", (req, res) => {
  const className = req.body.className;

  if (!className && className != "") {
    return res.status(400).json({
      error: "Class name is required in the request body",
      requestBody: req.body,
    });
  }

  const query = `
    SELECT students.*, classes.name AS className
    FROM students
    LEFT JOIN classes ON students.class_id = classes.id
    WHERE classes.name = ?
    ORDER BY class_id ASC NULLS FIRST;`;

  const classStudents = db.prepare(query).all(className);
  res.json({ result: classStudents });
});

// ARCHIVE ADD
app.post("/archiveAdd", (req, res) => {
  const className = req.body.className;
  archiveFunction(className);

  res.json({ message: "Archived successfully!" });
});

// ADD STUDENT TO CLASS
app.post("/addStudentToClass", (req, res) => {
  const { className, studentsNames } = req.body;

  // Retrieve the class_id from the classes table using the className
  const classRow = db
    .prepare("SELECT id FROM classes WHERE name = ?")
    .get(className);
  const classId = classRow ? classRow.id : null;

  if (classId === null) {
    res.json({ message: "Class not found!" });
    return;
  }

  // Split the studentsNames string into an array of names
  const names = studentsNames.split("\n").filter((name) => name.trim() !== "");

  // Prepare the SQL statement outside the loop for efficiency
  const stmt = db.prepare(
    "INSERT INTO students (name, class_id) VALUES (?, ?)"
  );

  // Loop over the names array and add each student to the database
  names.forEach((studentName) => {
    stmt.run(studentName, classId);
  });

  res.json({ message: "Students added successfully!" });
});

// REMOVE STUDENT
app.post("/removeStudentFromClass", (req, res) => {
  const studentId = req.body.studentId;
  const className = req.body.className;
  if (!studentId || !className) {
    return res.status(400).json({
      error: "Student ID and class name are required in the request body",
      requestBody: req.body,
    });
  }
  const classId = db
    .prepare("SELECT id FROM classes WHERE name = ?")
    .get(className).id;

  db.prepare(
    "UPDATE students SET class_id = NULL, group_id = NULL, mustSitWith = NULL, cannotSitWith = NULL WHERE id = ? AND class_id = ?"
  ).run(studentId, classId);
  res.json({ message: "Student removed from the class successfully!" });
});

let tempGroupData = {}; // Temporary in-memory storage for groups
let lastGroupData = {}; // For storing the last randomized group data
let isSaved = false; // For checking if the last randomized group data is saved

// RANDOMIZE FUNCTION
app.post("/randomize", (req, res) => {
  const className = req.body.className;
  let groupCount = req.body.groupCount;
  const studentCount = req.body.studentCount;
  const createGroupNames = req.body.createGroupNames || false;
  const addGroupLeader = req.body.addGroupLeader || false;

  if (!className && className != "") {
    return res.status(400).json({
      error: "Class name is required in the request body",
      requestBody: req.body,
    });
  } else if (!(groupCount ? !studentCount : studentCount)) {
    return res.status(400).json({
      error:
        "Either groupCount or studentCount should be provided, but not both",
      requestBody: req.body,
    });
  }

  //If studentCount is provided, get the number of students in the class from the database
  //and divide by studentCount to get groupCount
  if (studentCount && studentCount > 0) {
    const classId = db
      .prepare("SELECT id FROM classes WHERE name = ?")
      .get(className).id;
    const students = db
      .prepare("SELECT * FROM students WHERE class_id = ?")
      .all(classId);
    groupCount = Math.ceil(students.length / studentCount);
  }

  const groups = randomizeGroups(className, groupCount);
  const enhancedGroups = groups.map((group, index) => {
    let groupName = `${index + 1}`;
    let groupLeader = null;
    if (createGroupNames) {
      const randomAdjective =
        adjectives[Math.floor(Math.random() * adjectives.length)];
      const randomNoun = nouns[Math.floor(Math.random() * nouns.length)];

      groupName = randomAdjective + " " + randomNoun;
    }
    if (addGroupLeader) {
      //Get random student from group
      const randomStudentID = group[Math.floor(Math.random() * group.length)];
      groupLeader = randomStudentID;
    }

    // Enhance student data with group leader role
    let studentsWithLeader = group.map((studentId) => {
      let studentData = db
        .prepare("SELECT * FROM students WHERE id = ?")
        .get(studentId); // Fetch student details
      if (studentId === groupLeader) {
        studentData.role = "GroupLeader"; // Mark the group leader
      }
      return studentData;
    });

    return {
      groupId: index + 1,
      groupName,
      students: studentsWithLeader,
    };
  });

  if (!tempGroupData[className]) {
    tempGroupData[className] = enhancedGroups; // Store temporarily
    tempGroupData[className].isTemp = true; // Mark as temporary
    //dbInformation.getGroupsFromStudentIds(db)(groups); // Store temporarily
  }
  lastGroupData[className] = enhancedGroups; // Update lastGroupData on randomization
  isSaved = false; // Mark as not saved
  res.json({ message: "Groups randomized successfully!" });
});

// SAVE CLASS
app.post("/saveGroups", (req, res) => {
  if (isSaved) res.json({ message: "Groups already saved!" });
  const className = req.body.className;
  const groupsExist = lastGroupData[className]
    ? lastGroupData[className]
    : null;
  const groupCount = 6;
  const classId = db
    .prepare("SELECT id FROM classes WHERE name = ?")
    .get(className).id;
  console.log("Class ID in saveGroups: ", classId);
  if (groupsExist) {
    tempGroupData[className] = groupsExist; // Update tempGroupData on save
    const groups = dbInformation.getGroupsFromStudentIds(db)(
      lastGroupData[className]
    );

    const updateClassesQuery = db.prepare(
      ` UPDATE classes SET groups = ? WHERE id = ?`
    );
    updateClassesQuery.run(groupCount, classId);

    db.prepare(`DELETE FROM groups WHERE class_id = ?`).run(classId);

    let index = 0;
    for (let group of groups.groups) {
      const groupIndex = index + 1;
      let groupName = group.groupName;
      let groupLeader = null;
      group.students.forEach((student) => {
        if (student.role === "GroupLeader") {
          groupLeader = student.id;
        }
      });

      db.prepare(
        ` INSERT INTO groups (class_id, group_index, group_name, group_leader) VALUES (?, ?, ?, ?) `
      ).run(classId, groupIndex, groupName, groupLeader);

      // Logic to save groups to the database
      db.transaction((groups, classId) => {
        for (let group of groups.groups) {
          const groupId = db
            .prepare("SELECT id FROM groups WHERE group_name = ?")
            .get(group.groupName)?.id;

          for (let student of group.students) {
            const studentId = student.id;
            db.prepare(
              "UPDATE students SET group_id = ? WHERE id = ? AND class_id = ?"
            ).run(groupId, studentId, classId);
          }
        }
      })(groups, classId);

      index++;
    }
    delete lastGroupData[className]; // Clear temporary data after saving
    isSaved = true; // Mark as saved
    res.json({ message: "Groups saved successfully!" });
  }
});

// GET CLASS LIST
app.post("/getClassInfo", (req, res) => {
  const className = req.body.className;

  if (!className) {
    return res.status(400).json({
      error: "Class name is required in the request body",
      requestBody: req.body,
    });
  }
  const classInfo = showClass.getClassInfo(db, className);

  res.json({ result: classInfo, className: className });
});

//Retrieve groups by class
app.post("/getGroups", (req, res) => {
  const className = req.body.className;

  if (!className && className != "") {
    return res.status(400).json({
      error: "className is required in the request body",
      requestBody: req.body,
    });
  }
  if (lastGroupData[className] && lastGroupData[className].length > 0) {
    console.log("Using lastgroupData");
    const groupedStudentsArray = dbInformation.getGroupsFromStudentIds(db)(
      lastGroupData[className]
    );
    res.json(
      JSON.stringify({
        result: groupedStudentsArray,
        className: className,
        isTemp: true,
      })
    );
  } else {
    //Retrieve info from database
    const groupedStudentsArray = dbInformation.getGroups(db)(className);
    console.log("Using info from database");

    res.json(
      JSON.stringify({
        result: groupedStudentsArray,
        className: className,
        isTemp: false,
      })
    );
  }
});

//Retrieve groups by class
app.post("/discardChanges", (req, res) => {
  const className = req.body.className;

  if (!className && className != "") {
    return res.status(400).json({
      error: "className is required in the request body",
      requestBody: req.body,
    });
  }
  lastGroupData[className] = tempGroupData[className];
  delete tempGroupData[className];
  delete lastGroupData[className];

  res.json(JSON.stringify({ result: "Changes discarded" }));
});

// SET STUDENT PREF
app.post("/setStudentPreference", (req, res) => {
  const studentID = req.body.studentID;
  const preferenceArray = req.body.preferenceArray;

  if (!preferenceArray) {
    return res.status(400).json({
      error: "Preference Array is required in the request body",
      requestBody: req.body,
    });
  } else if (!studentID) {
    return res.status(400).json({
      error: "Student ID is required in the request body",
      requestBody: req.body,
    });
  }
  dbInformation.setStudentPreference(db)(studentID, preferenceArray);
});

// GET STUDENT PREF
app.post("/getStudentPreference", (req, res) => {
  const studentID = req.body.studentID;

  if (!studentID) {
    return res.status(400).json({
      error: "Student ID is required in the request body",
      requestBody: req.body,
    });
  }
  const studentPreference = dbInformation.getStudentPreference(db)(studentID);
  res.json({ result: studentPreference });
});

// ACTIVATE SERVER
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
const adjectives = [
  "Mighty",
  "Brave",
  "Soaring",
  "Fierce",
  "Bold",
  "Glorious",
  "Swift",
  "Innovative",
  "Fearless",
  "Dynamic",
  "Valiant",
  "Noble",
  "Daring",
  "Victorious",
  "Resilient",
  "Majestic",
  "Radiant",
  "Indomitable",
  "Supreme",
  "Astonishing",

  //Fantasy
  "Enchanting",
  "Mystical",
  "Radiant",
  "Whimsical",
  "Ethereal",
  "Nebulous",
  "Celestial",
  "Phantasmal",
  "Aetherial",
  "Draconic",
  "Arcane",
  "Elusive",

  //Cyberpunk
  "Neon-lit",
  "Dystopian",
  "Augmented",
  "Holographic",
  "Cybernetic",
  "Megacorporate",
  "Data-driven",
  "Virtual",
  "Synthetic",
];
const nouns = [
  "Eagles",
  "Lions",
  "Dragons",
  "Wolves",
  "Tigers",
  "Sharks",
  "Bears",
  "Falcons",
  "Hawks",
  "Panthers",
  "Leopards",
  "Ravens",
  "Dolphins",
  "Griffins",
  "Pirates",
  "Knights",
  "Warriors",
  "Titans",
  "Gladiators",

  //Fantasy
  "Witches",
  "Sorcerers",
  "Dragons",
  "Wizards",
  "Elfs",
  "Mermaids",
  "Goblins",
  "Phoenixes",
  "Druids",
  "Bards",

  //Cyberpunk
  "Cyborgs",
  "Hackers",
  "Mercenaries",
  "Synths",
  "Techies",
  "Runners",
  "Agents",
  "Nanobots",
  "Fixers",
];
