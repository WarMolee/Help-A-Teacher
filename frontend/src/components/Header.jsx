import NTILoga from "../assets/NTILoga.png";
import ClassSelect from "./ClassSelect.jsx";
import RandomizeGroups from "./RandomizeGroups.jsx";
import { useState, useEffect } from "react";

const Header = ({ setTriggerReload, setIndexView }) => {
  const [showRandomizeGroups, setShowRandomizeGroups] = useState(false);

  const handleEditClassClick = () => {
    setIndexView(1);

    //localStorage.setItem("indexView", 1);
    //location.reload();
  };

  const handleNewGroupsClick = () => {
    setIndexView(0);
    //setTriggerReload((prevState) => !prevState);
    setShowRandomizeGroups(!showRandomizeGroups); // Toggle the state
  };
  useEffect(() => {
    // This is run when the component is first rendered
    // Discard changes when the page is loaded
    fetch("/discardChanges", {
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
      .then((json) => console.log(json))
      .then(() => {
        console.log("Discard");
        //setTriggerReload((prevState) => !prevState);
      })
      .catch((error) => console.error("Error during fetch:", error));
  }, []); // Empty array means this runs once on initial render

  return (
    <>
      <div id="header">
        <img src={NTILoga} alt="NTI Logo" />
        <div id="TopHeader">
          <h3 onClick={handleEditClassClick}>Edit Class</h3>
          <h3 onClick={handleNewGroupsClick}>New Groups</h3>
        </div>
        <div id="BottomHeader">
          <ClassSelect
            setIndexView={setIndexView}
            shouldReload={setTriggerReload}
          />
        </div>
        {showRandomizeGroups && (
          <RandomizeGroups setTriggerReload={setTriggerReload} />
        )}
      </div>
    </>
  );
};
export default Header;
