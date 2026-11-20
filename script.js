const effortRequirementSelect =
    document.getElementById("effort-requirement-select");

const effortPeriodTypeSelect =
    document.getElementById("effort-period-type-select");

const effortDateInput =
    document.getElementById("effort-date-input");

const hoursReqAnalysis =
    document.getElementById("hours-req-analysis-input");

const hoursDesigning =
    document.getElementById("hours-designing-input");

const hoursCoding =
    document.getElementById("hours-coding-input");

const hoursTesting =
    document.getElementById("hours-testing-input");

const hoursPM =
    document.getElementById("hours-pm-input");

const logEffortBtn =
    document.getElementById("log-effort-entry-btn");

const effortTotalsTable =
    document.getElementById("effort-totals-by-requirement-table");

let effortEntries =
    JSON.parse(localStorage.getItem("effortEntries")) || [];

function addTestRequirements() {
    if (effortRequirementSelect.options.length <= 1) {
        const testRequirements = [
            {
                id: "FR-001",
                type: "Functional",
                description: "Create a project"
            },
            {
                id: "FR-002",
                type: "Functional",
                description: "Add project team members"
            },
            {
                id: "NFR-001",
                type: "Non-Functional",
                description: "System usability"
            }
        ];

        testRequirements.forEach(function (requirement) {
            const option = document.createElement("option");

            option.value = requirement.id;
            option.textContent =
                requirement.id + " - " + requirement.description;

            option.dataset.type = requirement.type;

            effortRequirementSelect.appendChild(option);
        });
    }
}

function recordEffort() {
    const selectedOption =
        effortRequirementSelect.options[
            effortRequirementSelect.selectedIndex
        ];

    if (!effortRequirementSelect.value) {
        alert("Please select a requirement.");
        return;
    }

    const effortDate = effortDateInput.value;

    if (!effortDate) {
        alert("Please select a date or week starting date.");
        return;
    }

    const requirementId =
        effortRequirementSelect.value;

    const requirementType =
        selectedOption.dataset.type || "Functional";

    const analysis =
        Number(hoursReqAnalysis.value) || 0;

    const designing =
        Number(hoursDesigning.value) || 0;

    const coding =
        Number(hoursCoding.value) || 0;

    const testing =
        Number(hoursTesting.value) || 0;

    const projectManagement =
        Number(hoursPM.value) || 0;

    const total =
        analysis +
        designing +
        coding +
        testing +
        projectManagement;

    if (total <= 0) {
        alert(
            "Please enter effort hours for at least one development phase."
        );
        return;
    }

    const entry = {
        id: Date.now(),
        requirementId: requirementId,
        requirementType: requirementType,
        periodType: effortPeriodTypeSelect.value,
        date: effortDate,
        analysis: analysis,
        designing: designing,
        coding: coding,
        testing: testing,
        projectManagement: projectManagement
    };

    effortEntries.push(entry);

    localStorage.setItem(
        "effortEntries",
        JSON.stringify(effortEntries)
    );

    updateEffortTotals();
    clearEffortInputs();

    alert("Effort hours recorded successfully!");
}

function calculateRequirementTotals() {
    const totals = {};

    effortEntries.forEach(function (entry) {
        if (!totals[entry.requirementId]) {
            totals[entry.requirementId] = {
                requirementId: entry.requirementId,
                requirementType: entry.requirementType,
                analysis: 0,
                designing: 0,
                coding: 0,
                testing: 0,
                projectManagement: 0
            };
        }

        totals[entry.requirementId].analysis +=
            entry.analysis;

        totals[entry.requirementId].designing +=
            entry.designing;

        totals[entry.requirementId].coding +=
            entry.coding;

        totals[entry.requirementId].testing +=
            entry.testing;

        totals[entry.requirementId].projectManagement +=
            entry.projectManagement;
    });

    return totals;
}

function updateEffortTotals() {
    const tableBody =
        effortTotalsTable.querySelector("tbody");

    if (!tableBody) {
        console.error(
            "Could not find the effort totals table body."
        );
        return;
    }

    tableBody.innerHTML = "";

    const totals =
        calculateRequirementTotals();

    const requirementIds =
        Object.keys(totals);

    if (requirementIds.length === 0) {
        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td colspan="7">
                No effort hours have been recorded yet.
            </td>
        `;

        tableBody.appendChild(row);

        return;
    }

    requirementIds.forEach(function (requirementId) {
        const requirement =
            totals[requirementId];

        const row =
            document.createElement("tr");

        row.innerHTML = `
            <td>${requirement.requirementId}</td>
            <td>${requirement.requirementType}</td>
            <td>${requirement.analysis.toFixed(2)}</td>
            <td>${requirement.designing.toFixed(2)}</td>
            <td>${requirement.coding.toFixed(2)}</td>
            <td>${requirement.testing.toFixed(2)}</td>
            <td>${requirement.projectManagement.toFixed(2)}</td>
        `;

        tableBody.appendChild(row);
    });
}

function clearEffortInputs() {
    effortDateInput.value = "";
    hoursReqAnalysis.value = "0";
    hoursDesigning.value = "0";
    hoursCoding.value = "0";
    hoursTesting.value = "0";
    hoursPM.value = "0";
}

logEffortBtn.addEventListener(
    "click",
    recordEffort
);

addTestRequirements();
updateEffortTotals();
