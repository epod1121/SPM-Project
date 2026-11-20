/*
 * Section B: Project Requirements
 * Group 8 - Software Project Management System
 *
 * Allows users to enter and view functional and
 * non-functional requirements for a project.
 */

// The current project should be supplied by Section A.
// This is a sample project object for testing.
const currentProject = {
    id: "PROJECT-001",
    name: "Sample Software Project",
    requirements: []
};

// Generate the next requirement ID.
function generateRequirementID(type, project) {

    const prefix = type === "Functional" ? "FR" : "NFR";

    // Count existing requirements of the same type.
    const count = project.requirements.filter(
        requirement => requirement.type === type
    ).length + 1;

    return `${prefix}-${String(count).padStart(3, "0")}`;
}


// Add a new requirement to the project.
function addRequirement(project, type, description) {

    // Validate the input.
    if (!project || !Array.isArray(project.requirements)) {
        throw new Error("A valid project is required.");
    }

    if (type !== "Functional" && type !== "Non-Functional") {
        throw new Error("Please select a valid requirement type.");
    }

    if (!description || description.trim() === "") {
        throw new Error("Requirement description cannot be empty.");
    }

    // Create the requirement object.
    const requirement = {
        id: generateRequirementID(type, project),
        type: type,
        description: description.trim(),
        createdAt: new Date().toISOString()
    };

    // Store it in the project's requirements list.
    project.requirements.push(requirement);

    return requirement;
}


// Retrieve all requirements.
function getRequirements(project) {
    return project.requirements;
}


// Retrieve only functional requirements.
function getFunctionalRequirements(project) {
    return project.requirements.filter(
        requirement => requirement.type === "Functional"
    );
}


// Retrieve only non-functional requirements.
function getNonFunctionalRequirements(project) {
    return project.requirements.filter(
        requirement => requirement.type === "Non-Functional"
    );
}


// Display requirements on the webpage.
function displayRequirements(project) {

    const functionalList =
        document.getElementById("functionalList");

    const nonFunctionalList =
        document.getElementById("nonFunctionalList");

    // Clear existing displayed requirements.
    functionalList.replaceChildren();
    nonFunctionalList.replaceChildren();

    // Display each requirement in its appropriate category.
    project.requirements.forEach(requirement => {

        const item = document.createElement("li");

        // Use textContent to safely display user input.
        item.textContent =
            `${requirement.id}: ${requirement.description}`;

        if (requirement.type === "Functional") {
            functionalList.appendChild(item);
        } else {
            nonFunctionalList.appendChild(item);
        }
    });
}


// Connect the form to the requirements' functionality.
document.addEventListener("DOMContentLoaded", function () {

    const form = document.getElementById("requirementForm");

    form.addEventListener("submit", function (event) {

        event.preventDefault();

        const type =
            document.getElementById("requirementType").value;

        const description =
            document.getElementById("requirementDescription").value;

        try {

            // Add the requirement to the project.
            const newRequirement = addRequirement(
                currentProject,
                type,
                description
            );

            // Refresh the displayed requirements.
            displayRequirements(currentProject);

            // Clear the description field.
            document.getElementById(
                "requirementDescription"
            ).value = "";

            alert(`Requirement ${newRequirement.id} added successfully!`);

        } catch (error) {

            alert(error.message);

        }
    });

});