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
const dbInformation = require("./dbInformation");
const showClass = require("./showClass");

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

// Handle image uploads
app.post("/uploadImage", upload.single("image"), (req, res) => {
  const imageFilepath = `/profile_imgs/${req.file.filename}`;
  const studentId = req.body.studentId;

  db.prepare("UPDATE students SET image_filepath = ? WHERE id = ?").run(
    imageFilepath,
    studentId
  );

  res.json({ message: "Image uploaded successfully!" });
});

// RANDOMIZE FUNCTION
app.post("/randomize", (req, res) => {
  const className = req.body.className;
  const groupCount = req.body.groupCount || 6;
  const createGroupNames = req.body.createGroupNames || false;
  const addGroupLeader = req.body.addGroupLeader || false;

  if (!className && className != "") {
    return res.status(400).json({
      error: "Class name is required in the request body",
      requestBody: req.body,
    });
  }

  randomizeGroups(className, groupCount, createGroupNames, addGroupLeader);
  res.json({ message: "Groups randomized successfully!" });
});

// GET CLASS LIST
app.post("/getClassInfo", (req, res) => {
  const className = req.body.className;

  if (!className && className !== "") {
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
  const groupedStudentsArray = dbInformation.getGroups(db)(className);

  res.json(
    JSON.stringify({ result: groupedStudentsArray, className: className })
  );
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

// SET STUDENT PREF
app.post("/getStudentPreference", (req, res) => {
  const studentID = req.body.studentID;

  if (!studentID) {
    return res.status(400).json({
      error: "Student ID is required in the request body",
      requestBody: req.body,
    });
  }
  const studentPreference = dbInformation.getStudentPreference(db)(studentID);

  res.json(JSON.stringify({ result: studentPreference }));
});

//USED FOR TESTING SINCE FRONTEND IS NOT FINISHED
/*
const studentID = 1;
const preferenceArray = {
  mustSitWith: JSON.stringify([2, 3]), // Example student IDs that the student must sit with
  cannotSitWith: JSON.stringify([4, 5]), // Example student IDs that the student cannot sit with
};
console.log("Setting student preference");
dbInformation.setStudentPreference(db)(studentID, preferenceArray);*/

// ACTIVATE SERVER
app.listen(port, () => {
  console.log(`Example app listening on port ${port}`);
});
