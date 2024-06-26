import { useEffect, useState, useRef } from "react";
import TempImg from "../assets/NTIPush.jpg";
import StudentPreferencesPopup from "./StudentPreferencesPopup";

const ShowClass = ({ triggerReload, setIndexView, setTriggerReload }) => {
  const [classData, setClassData] = useState([]);
  const [newStudentId, setNewStudentId] = useState(null);
  const [reloadAddStudentTable, setReloadAddStudentTable] = useState(false);
  if (!localStorage.getItem("class")) localStorage.setItem("class", "1TEK1");

  useEffect(() => {
    if (triggerReload) {
      setIndexView(1);
    }
    // Fetch class data from the backend when the component mounts or when a student is added
    fetch("http://localhost:3000/getClassInfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        className: localStorage.getItem("class").toUpperCase(),
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const sortedData = data.result.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setClassData(sortedData);
      })
      .catch((error) => console.error("Error fetching class data:", error));
    fetchClassData();
  }, [newStudentId, reloadAddStudentTable, triggerReload]);

  const fetchClassData = () => {
    fetch("http://localhost:3000/getClassInfo", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        className: localStorage.getItem("class").toUpperCase(),
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        const sortedData = data.result.sort((a, b) =>
          a.name.localeCompare(b.name)
        );
        setClassData(sortedData);
      })
      .catch((error) => console.error("Error fetching class data:", error));
  };

  const handleAddStudent = (studentId, studentName) => {
    fetch("http://localhost:3000/addStudentToClass", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        className: localStorage.getItem("class").toUpperCase(),
        studentId: studentId,
        studentName: studentName,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          if (response.status === 404) {
            console.error("Student not found in the students table");
          } else {
            throw new Error(`HTTP error! Status: ${response.status}`);
          }
        }
        setNewStudentId(studentId);
        setReloadAddStudentTable(true);
      })
      .catch((error) => console.error("Error adding student:", error));
    location.reload();
  };

  const handleRemoveStudent = (studentId) => {
    fetch("http://localhost:3000/removeStudentFromClass", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        studentId,
        className: localStorage.getItem("class").toUpperCase(),
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        setClassData(classData.filter((student) => student.id !== studentId));
        setReloadAddStudentTable((prev) => !prev); // Toggle the value
      })
      .catch((error) => console.error("Error removing student:", error));
    location.reload();
  };

  const [showPref, setShowPref] = useState(false);
  const [currentStudent, setCurrentStudent] = useState(null); // The student whose preferences are being edited
  const changePref = (studentID) => {
    if (showPref != false) {
      if (studentID === currentStudent) {
        setShowPref(false);
      } else {
        setShowPref(true);
      }
    } else {
      setShowPref(true);
    }
    setCurrentStudent(studentID);
  };
  const chunkSize = 9;
  const chunks = [];
  for (let i = 0; i < classData.length; i += chunkSize) {
    chunks.push(classData.slice(i, i + chunkSize));

    if (chunks[chunks.length - 1].length < chunkSize) {
      const remainingSlots = chunkSize - chunks[chunks.length - 1].length;
      console.log(remainingSlots);
      for (let j = 0; j < remainingSlots; j++) {
        chunks[chunks.length - 1].push({
          id: j,
          name: "",
          image_filepath: "empty",
        });
      }
    }
  }
  return (
    <>
      <div id="background"></div>
      <button
        id="backButton"
        onClick={() => {
          setIndexView(0);
        }}
      >
        Back
      </button>

      <div>
        <div id="classTitle">
          <h1>{localStorage.getItem("class").toUpperCase()}</h1>
        </div>
        <div id="table-container">
          {chunks.map((chunk, index) => (
            <table key={index}>
              <thead></thead>
              <tbody>
                {chunk.map((student) => (
                  <tr key={student.id} id="studentTable">
                    <td>
                      <div className="tdbox">
                        {student.image_filepath !== "empty" && (
                          <img
                            src={`http://localhost:3000${student.image_filepath}`}
                            /* alt={`Profile of ${student.name}`} */
                            onError={(event) => {
                              event.target.src = TempImg;
                            }}
                          />
                        )}
                      </div>
                    </td>
                    <td>
                      <div className="tdbox">
                        <button
                          onClick={() => {
                            if (student.name !== "empty") {
                              changePref(student.id);
                            }
                          }}
                          style={{
                            border: "none",
                            background: "none",
                            padding: "5px",
                            color: "white",
                          }}
                        >
                          <p>{student.name}</p>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ))}
        </div>

        {showPref && (
          <StudentPreferencesPopup
            currentStudent={currentStudent}
            setShowPref={setShowPref}
            setTriggerReload={setTriggerReload}
          />
        )}
      </div>
    </>
  );
};

export default ShowClass;
