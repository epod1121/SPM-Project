
const API_URL = "http://localhost:3000/api/projects";

let currentPage = 1;
let projects = [];
let teamMembers = [];
let risks = [];
let requirements = [];
let nextRequirementId = 1;

// Get an HTML element by its ID
function getElement(id) {
    return document.getElementById(id);
}

// Display feedback messages
function showFeedback(message, isError = false) {
    const banner = getElement("global-feedback-banner");
    const messageElement = getElement("feedback-message");

    messageElement.textContent = message;
    banner.hidden = false;

    banner.style.backgroundColor = isError ? "#f8d7da" : "#d4edda";
    banner.style.color = isError ? "#721c24" : "#155724";
}

// Load saved projects from SQL Server
async function loadProjects() {
    try {
        const response = await fetch(API_URL);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to load projects.");
        }

        // Load complete details for each dashboard card.
        projects = await Promise.all(
            data.projects.map(async project => {
                const detailResponse = await fetch(
                    `${API_URL}/${project.ProjectID}`
                );

                const detailData = await detailResponse.json();

                if (!detailResponse.ok || !detailData.success) {
                    throw new Error(
                        detailData.error || "Failed to load project details."
                    );
                }

                return detailData.project;
            })
        );

        renderProjectCards();

    } catch (error) {
        console.error("Error loading projects:", error);
        showFeedback("Could not load projects from SQL Server.", true);
    }
}

// Display saved projects on dashboard
function renderProjectCards() {
    const grid = getElement("projects-grid");
    const emptyState = getElement("empty-projects-state");
    const template = getElement("project-card-template");

    grid.innerHTML = "";
    emptyState.hidden = projects.length > 0;

    projects.forEach(project => {
        const card = template.content.firstElementChild.cloneNode(true);

        card.dataset.projectId = project.ProjectID;

        card.querySelector(".card-project-title").textContent =
            project.ProjectName;

        card.querySelector(".owner-name-text").textContent =
            project.ProjectOwner;

        card.querySelector(".card-project-description").textContent =
            project.ProjectDescription;

        const members = project.teamMembers || [];
        const projectRisks = project.risks || [];
        const projectRequirements = project.requirements || [];

        let totalHours = 0;

        projectRequirements.forEach(requirement => {
            (requirement.effortLogs || []).forEach(log => {
                Object.values(log.hours || {}).forEach(hours => {
                    totalHours += Number(hours) || 0;
                });
            });
        });

        card.querySelector(".team-count").textContent =
            members.length;

        card.querySelector(".risks-count").textContent =
            projectRisks.length;

        card.querySelector(".reqs-count").textContent =
            projectRequirements.length;

        card.querySelector(".hours-count").textContent =
            formatHours(totalHours);

        card.querySelector(".btn-card-open").addEventListener(
            "click",
            () => openExistingProject(project.ProjectID)
        );

        card.querySelector(".btn-card-delete").addEventListener(
            "click",
            () => deleteProject(project.ProjectID)
        );

        grid.appendChild(card);
    });
}

// Open popup for creating a project
function openNewProject() {
    const modal = getElement("project-modal-backdrop");
    const form = getElement("project-system-form");

    form.reset();

    teamMembers = [];
    risks = [];
    requirements = [];
    nextRequirementId = 1;
    nextEffortLogId = 1;

    renderTeamMembers();
    renderRisks();
    renderRequirements();
    renderEffortTracking();
    
    getElement("active-project-id").value = "";

    currentPage = 1;
    showModalPage(currentPage);

    getElement("modal-action-feedback").hidden = true;

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
}

// Open an existing project
async function openExistingProject(projectId) {
    try {
        const response = await fetch(`${API_URL}/${projectId}`);
        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(data.error || "Failed to open project.");
        }

        const project = data.project;

        openNewProject();

        getElement("active-project-id").value = project.ProjectID;
        getElement("project-name-input").value = project.ProjectName;
        getElement("project-description-input").value =
            project.ProjectDescription;
        getElement("project-owner-input").value = project.ProjectOwner;

        teamMembers = (project.teamMembers || []).map(member => ({
            name: member.name,
            role: member.role
        }));

        risks = (project.risks || []).map(risk => ({
            description: risk.description,
            likelihood: risk.likelihood,
            impact: risk.impact,
            status: risk.status
        }));

        requirements = (project.requirements || []).map(
            (requirement, index) => ({
                id: index + 1,
                code: requirement.code || "",
                type: requirement.type,
                description: requirement.description,
                effortLogs: (requirement.effortLogs || []).map(
                    log => ({
                        id: nextEffortLogId++,
                        interval: log.interval,
                        workDate: log.workDate,
                        hours: { ...log.hours }
                    })
                )
            })
        );

        nextRequirementId = requirements.length + 1;

        renderTeamMembers();
        renderRisks();
        renderRequirements();
        renderEffortTracking();

        showFeedback("Project loaded successfully!");

    } catch (error) {
        console.error("Error opening project:", error);
        showFeedback("Could not open the selected project.", true);
    }
}

// Close project popup
function closeProjectModal() {
    const modal = getElement("project-modal-backdrop");

    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
}

// Display selected modal page
function showModalPage(pageNumber) {
    currentPage = Math.max(1, Math.min(3, pageNumber));

    for (let page = 1; page <= 3; page++) {
        const section = getElement(`modal-page-${page}`);

        section.hidden = page !== currentPage;
        section.classList.toggle(
            "active-page",
            page === currentPage
        );
    }

    const headings = [
        "A. General Project Information",
        "B. Project Requirements",
        "C. Project Effort Monitoring and Tracking"
    ];

    getElement("modal-step-heading").textContent =
        headings[currentPage - 1];

    getElement("modal-page-indicator").textContent =
        `${currentPage}/3`;

    getElement("modal-prev-btn").hidden = currentPage === 1;
    getElement("modal-next-btn").hidden = currentPage === 3;

    document.querySelectorAll(".step-dot").forEach(dot => {
        const page = Number(dot.dataset.targetPage);

        dot.classList.toggle("active", page === currentPage);
    });
}

// Display feedback inside popup
function showModalFeedback(message) {
    const feedback = getElement("modal-action-feedback");

    feedback.textContent = message;
    feedback.hidden = false;
}

// Save basic project information
async function saveProject(event) {
    event.preventDefault();

    const projectId = getElement("active-project-id").value;

    const projectName =
        getElement("project-name-input").value.trim();

    const projectDescription =
        getElement("project-description-input").value.trim();

    const projectOwner =
        getElement("project-owner-input").value.trim();

    if (!projectName || !projectDescription || !projectOwner) {
        showModalPage(1);
        showModalFeedback(
            "Please enter the project name, description, and owner."
        );
        return;
    }

    if (projectName.length > 150 || projectOwner.length > 150) {
        showModalPage(1);
        showModalFeedback(
            "Project name and owner must be 150 characters or fewer."
        );
        return;
    }

    const projectData = {
        projectName,
        projectDescription,
        projectOwner,
        teamMembers,
        risks,
        requirements: requirements.map(requirement => ({
            code: requirement.code,
            type: requirement.type,
            description: requirement.description,
            effortLogs: requirement.effortLogs.map(log => ({
                interval: log.interval,
                workDate: log.workDate,
                hours: log.hours
            }))
        }))
    };

    const isEditing = Boolean(projectId);

    const url = isEditing
        ? `${API_URL}/${projectId}`
        : API_URL;

    const method = isEditing ? "PUT" : "POST";

    const saveButton = getElement("modal-save-project-btn");

    try {
        saveButton.disabled = true;
        saveButton.textContent = "Saving...";

        const response = await fetch(url, {
            method,
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(projectData)
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || "Failed to save project."
            );
        }

        closeProjectModal();

        await loadProjects();

        showFeedback(
            isEditing
                ? "Project updated successfully!"
                : "Project saved successfully!"
        );

    } catch (error) {
        console.error("Error saving project:", error);
        showModalFeedback(error.message);

    } finally {
        saveButton.disabled = false;
        saveButton.textContent = "Save & Close Project";
    }
}

function renderTeamMembers() {
    const list = getElement("team-members-list");
    const template = getElement("team-member-item-template");

    list.innerHTML = "";

    if (teamMembers.length === 0) {
        const message = document.createElement("li");
        message.className = "empty-list-placeholder";
        message.textContent = "No team members added yet.";
        list.appendChild(message);
        return;
    }

    teamMembers.forEach((member, index) => {
        const item = template.content.firstElementChild.cloneNode(true);

        item.dataset.memberId = index;

        item.querySelector(".member-name-display").textContent =
            member.name;

        item.querySelector(".member-role-display").textContent =
            member.role;

        item.querySelector(".btn-remove-member").addEventListener(
            "click",
            () => {
                teamMembers.splice(index, 1);
                renderTeamMembers();
            }
        );

        list.appendChild(item);
    });
}

function addTeamMember() {
    const nameInput = getElement("team-member-name-input");
    const roleInput = getElement("team-member-role-input");

    const name = nameInput.value.trim();
    const role = roleInput.value.trim();

    if (!name) {
        showModalFeedback("Please enter a team member name.");
        return;
    }

    teamMembers.push({
        name,
        role: role || "Unassigned"
    });

    nameInput.value = "";
    roleInput.value = "";

    renderTeamMembers();
}

function renderRisks() {
    const tbody = getElement("project-risks-tbody");
    const template = getElement("risk-row-template");

    tbody.innerHTML = "";

    if (risks.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 5;
        cell.textContent = "No project risks recorded yet.";

        row.appendChild(cell);
        tbody.appendChild(row);
        return;
    }

    risks.forEach((risk, index) => {
        const row = template.content.firstElementChild.cloneNode(true);

        row.dataset.riskId = index;

        row.querySelector(".risk-desc-cell").textContent =
            risk.description;

        row.querySelector(".risk-likelihood-cell").textContent =
            risk.likelihood;

        row.querySelector(".risk-impact-cell").textContent =
            risk.impact;

        const statusSelect = row.querySelector(".risk-status-updater");
        statusSelect.value = risk.status;

        statusSelect.addEventListener("change", () => {
            risks[index].status = statusSelect.value;
        });

        row.querySelector(".btn-remove-risk").addEventListener(
            "click",
            () => {
                risks.splice(index, 1);
                renderRisks();
            }
        );

        tbody.appendChild(row);
    });
}

function addRisk() {
    const descriptionInput = getElement("risk-description-input");

    const description = descriptionInput.value.trim();

    if (!description) {
        showModalFeedback("Please enter a risk description.");
        return;
    }

    risks.push({
        description,
        likelihood: getElement("risk-likelihood-select").value,
        impact: getElement("risk-impact-select").value,
        status: getElement("risk-status-select").value
    });

    descriptionInput.value = "";

    renderRisks();
}

function renderRequirements() {
    const functionalList = getElement("functional-requirements-list");
    const nonFunctionalList = getElement("non-functional-requirements-list");
    const template = getElement("requirement-item-template");

    functionalList.innerHTML = "";
    nonFunctionalList.innerHTML = "";

    requirements.forEach(requirement => {
        const item = template.content.firstElementChild.cloneNode(true);

        item.dataset.requirementId = requirement.id;
        item.dataset.requirementType = requirement.type;

        item.querySelector(".requirement-code-badge").textContent =
            requirement.code || "No ID";

        item.querySelector(".requirement-type-tag").textContent =
            requirement.type;

        item.querySelector(".requirement-text-display").textContent =
            requirement.description;

        item.querySelector(".btn-edit-requirement").addEventListener(
            "click",
            () => editRequirement(requirement.id)
        );

        item.querySelector(".btn-remove-requirement").addEventListener(
            "click",
            () => removeRequirement(requirement.id)
        );

        if (requirement.type === "Functional") {
            functionalList.appendChild(item);
        } else {
            nonFunctionalList.appendChild(item);
        }
    });

    if (!functionalList.children.length) {
        const item = document.createElement("li");
        item.className = "empty-list-placeholder";
        item.textContent = "No functional requirements entered yet.";
        functionalList.appendChild(item);
    }

    if (!nonFunctionalList.children.length) {
        const item = document.createElement("li");
        item.className = "empty-list-placeholder";
        item.textContent = "No non-functional requirements entered yet.";
        nonFunctionalList.appendChild(item);
    }

    updateEffortRequirementSelect();
    renderEffortTracking();
}

function addRequirement() {
    const codeInput = getElement("requirement-code-input");
    const typeSelect = getElement("requirement-type-select");
    const descriptionInput = getElement("requirement-description-input");

    const code = codeInput.value.trim();
    const type = typeSelect.value;
    const description = descriptionInput.value.trim();

    if (!description) {
        showModalFeedback("Please enter a requirement description.");
        return;
    }

    if (code.length > 50) {
        showModalFeedback("Requirement ID must be 50 characters or fewer.");
        return;
    }

    requirements.push({
        id: nextRequirementId++,
        code,
        type,
        description,
        effortLogs: []
    });

    codeInput.value = "";
    typeSelect.value = "Functional";
    descriptionInput.value = "";

    renderRequirements();
}

function editRequirement(requirementId) {
    const requirement = requirements.find(
        item => item.id === requirementId
    );

    if (!requirement) return;

    const newCode = prompt(
        "Edit requirement ID / label:",
        requirement.code
    );

    if (newCode === null) return;

    const newDescription = prompt(
        "Edit requirement description:",
        requirement.description
    );

    if (newDescription === null) return;

    if (!newDescription.trim()) {
        showModalFeedback("Requirement description cannot be empty.");
        return;
    }

    if (newCode.trim().length > 50) {
        showModalFeedback("Requirement ID must be 50 characters or fewer.");
        return;
    }

    requirement.code = newCode.trim();
    requirement.description = newDescription.trim();

    renderRequirements();
}

function removeRequirement(requirementId) {
    requirements = requirements.filter(
        requirement => requirement.id !== requirementId
    );

    renderRequirements();
}

function updateEffortRequirementSelect() {
    const select = getElement("effort-requirement-select");
    const previousValue = select.value;

    select.innerHTML = "";

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "-- Select an entered requirement --";
    placeholder.disabled = true;
    select.appendChild(placeholder);

    requirements.forEach(requirement => {
        const option = document.createElement("option");

        option.value = requirement.id;
        option.textContent =
            `${requirement.code || "Requirement " + requirement.id}: ` +
            requirement.description;

        select.appendChild(option);
    });

    if (requirements.some(r => String(r.id) === previousValue)) {
        select.value = previousValue;
    } else {
        select.value = "";
    }
}

const effortPhases = [
    {
        name: "Requirements Analysis",
        input: "hours-req-analysis-input",
        summary: ".summary-hrs-analysis",
        history: ".log-analysis-cell",
        grandTotal: "grand-total-req-analysis"
    },
    {
        name: "Designing",
        input: "hours-designing-input",
        summary: ".summary-hrs-design",
        history: ".log-design-cell",
        grandTotal: "grand-total-designing"
    },
    {
        name: "Coding",
        input: "hours-coding-input",
        summary: ".summary-hrs-coding",
        history: ".log-coding-cell",
        grandTotal: "grand-total-coding"
    },
    {
        name: "Testing",
        input: "hours-testing-input",
        summary: ".summary-hrs-testing",
        history: ".log-testing-cell",
        grandTotal: "grand-total-testing"
    },
    {
        name: "Project Management",
        input: "hours-pm-input",
        summary: ".summary-hrs-pm",
        history: ".log-pm-cell",
        grandTotal: "grand-total-pm"
    }
];

let nextEffortLogId = 1;

function formatHours(value) {
    return Number(value.toFixed(2)).toString();
}

function recordEffort() {
    const requirementId = Number(
        getElement("effort-requirement-select").value
    );

    const requirement = requirements.find(
        item => item.id === requirementId
    );

    if (!requirement) {
        showModalFeedback("Please select a requirement.");
        return;
    }

    const interval = getElement("effort-period-type-select").value;
    const workDate = getElement("effort-date-input").value;

    if (!workDate) {
        showModalFeedback("Please select a date or week starting date.");
        return;
    }

    const hours = {};

    for (const phase of effortPhases) {
        const input = getElement(phase.input);
        const value = Number(input.value);

        if (
            input.value.trim() === "" ||
            !Number.isFinite(value) ||
            value < 0 ||
            value > 99999999.99 ||
            Math.round(value * 100) !== value * 100
        ) {
            showModalFeedback(
                `Please enter valid hours for ${phase.name}.`
            );
            return;
        }

        hours[phase.name] = value;
    }

    const totalHours = Object.values(hours).reduce(
        (sum, value) => sum + value,
        0
    );

    if (totalHours === 0) {
        showModalFeedback(
            "Enter at least some effort hours before recording."
        );
        return;
    }

    requirement.effortLogs.push({
        id: nextEffortLogId++,
        interval,
        workDate,
        hours
    });

    for (const phase of effortPhases) {
        getElement(phase.input).value = "0";
    }

    renderEffortTracking();

    const feedback = getElement("modal-action-feedback");
    feedback.textContent = "Effort hours recorded successfully.";
    feedback.hidden = false;
}

function renderEffortTracking() {
    const totalsBody = getElement("effort-totals-tbody");
    const historyBody = getElement("effort-history-tbody");

    const summaryTemplate = getElement("effort-summary-row-template");
    const historyTemplate = getElement("effort-log-row-template");

    totalsBody.innerHTML = "";
    historyBody.innerHTML = "";

    const grandTotals = Object.fromEntries(
        effortPhases.map(phase => [phase.name, 0])
    );

    let overallHours = 0;
    let historyCount = 0;

    requirements.forEach(requirement => {
        const requirementTotals = Object.fromEntries(
            effortPhases.map(phase => [phase.name, 0])
        );

        for (const log of requirement.effortLogs) {
            for (const phase of effortPhases) {
                requirementTotals[phase.name] +=
                    Number(log.hours[phase.name] || 0);
            }

            const historyRow =
                historyTemplate.content.firstElementChild.cloneNode(true);

            historyRow.dataset.logId = log.id;
            historyRow.dataset.requirementId = requirement.id;

            historyRow.querySelector(".log-date-cell").textContent =
                log.workDate;

            historyRow.querySelector(".log-interval-cell").textContent =
                log.interval;

            historyRow.querySelector(".log-req-cell").textContent =
                requirement.code || requirement.description;

            for (const phase of effortPhases) {
                historyRow.querySelector(phase.history).textContent =
                    formatHours(Number(log.hours[phase.name] || 0));
            }

            historyRow.querySelector(
                ".btn-delete-effort-log"
            ).addEventListener("click", () => {
                requirement.effortLogs =
                    requirement.effortLogs.filter(
                        item => item.id !== log.id
                    );

                renderEffortTracking();
            });

            historyBody.appendChild(historyRow);
            historyCount++;
        }

        const summaryRow =
            summaryTemplate.content.firstElementChild.cloneNode(true);

        summaryRow.dataset.requirementId = requirement.id;

        summaryRow.querySelector(".summary-req-title").textContent =
            requirement.code || requirement.description;

        summaryRow.querySelector(".summary-req-type").textContent =
            requirement.type;

        let requirementTotalHours = 0;

        for (const phase of effortPhases) {
            const value = requirementTotals[phase.name];

            summaryRow.querySelector(phase.summary).textContent =
                formatHours(value);

            grandTotals[phase.name] += value;
            requirementTotalHours += value;
        }

        summaryRow.querySelector(".summary-hrs-total").textContent =
            formatHours(requirementTotalHours);

        overallHours += requirementTotalHours;

        totalsBody.appendChild(summaryRow);
    });

    if (requirements.length === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 8;
        cell.textContent =
            "No requirements or effort hours recorded yet.";

        row.appendChild(cell);
        totalsBody.appendChild(row);
    }

    if (historyCount === 0) {
        const row = document.createElement("tr");
        const cell = document.createElement("td");

        cell.colSpan = 9;
        cell.textContent =
            "No individual effort logs recorded yet.";

        row.appendChild(cell);
        historyBody.appendChild(row);
    }

    for (const phase of effortPhases) {
        getElement(phase.grandTotal).textContent =
            formatHours(grandTotals[phase.name]);
    }

    getElement("grand-total-all-phases").textContent =
        formatHours(overallHours);
}

async function deleteProject(projectId) {
    const project = projects.find(
        item => item.ProjectID === projectId
    );

    if (!project) return;

    const confirmed = confirm(
        `Are you sure you want to delete "${project.ProjectName}"?\n\n` +
        "This will permanently delete the project, team members, " +
        "risks, requirements, and effort logs."
    );

    if (!confirmed) return;

    try {
        const response = await fetch(
            `${API_URL}/${projectId}`,
            { method: "DELETE" }
        );

        const result = await response.json();

        if (!response.ok || !result.success) {
            throw new Error(
                result.error || "Failed to delete project."
            );
        }

        await loadProjects();

        showFeedback("Project deleted successfully!");

    } catch (error) {
        console.error("Error deleting project:", error);
        showFeedback(error.message, true);
    }
}

// Set up buttons when page loads
document.addEventListener("DOMContentLoaded", () => {

    getElement("add-project-fab").addEventListener(
        "click",
        openNewProject
    );

    getElement("close-modal-btn").addEventListener(
        "click",
        closeProjectModal
    );

    getElement("modal-prev-btn").addEventListener("click", () => {
        showModalPage(currentPage - 1);
    });

    getElement("modal-next-btn").addEventListener("click", () => {
        showModalPage(currentPage + 1);
    });

    document.querySelectorAll(".step-dot").forEach(dot => {
        dot.addEventListener("click", () => {
            showModalPage(Number(dot.dataset.targetPage));
        });
    });

    getElement("project-system-form").addEventListener(
        "submit",
        saveProject
    );

    getElement("add-team-member-btn").addEventListener(
        "click",
        addTeamMember
    );

    getElement("add-risk-btn").addEventListener(
        "click",
        addRisk
    );

    getElement("add-requirement-btn").addEventListener(
    "click",
    addRequirement
    );

    getElement("log-effort-entry-btn").addEventListener(
    "click",
    recordEffort
    );

    loadProjects();
});