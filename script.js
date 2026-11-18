/* =========================================================
   PART A - General Project Information (popup page 1/3)
   ---------------------------------------------------------
   Handles:
     1. Project name / title
     2. High-level project description
     3. Project owner / project manager
     4. Team members  (add / remove)
     5. Risks + risk status (add / remove / update status)

   Exposes window.PartA so the save/load code and Parts B/C
   can read and fill this page:
     PartA.getData()    -> object with everything on page 1
     PartA.setData(obj) -> fills page 1 (used when opening a saved project)
     PartA.reset()      -> clears page 1 (used for a new project)
     PartA.validate()   -> { valid: true/false, errors: [...] }
   ========================================================= */
(function () {
  "use strict";

  // ---------- state for page 1 ----------
  let teamMembers = []; // { id, name, role }
  let risks = []; // { id, description, likelihood, impact, status }

  // ---------- small helpers ----------
  const $ = (id) => document.getElementById(id);

  function makeId(prefix) {
    return (
      prefix +
      "-" +
      Date.now().toString(36) +
      "-" +
      Math.random().toString(36).slice(2, 7)
    );
  }

  // Shows a message in the popup's feedback box (#modal-action-feedback)
  let feedbackTimer = null;
  function showFeedback(message, type) {
    const box = $("modal-action-feedback");
    if (!box) return;
    box.textContent = message;
    box.dataset.type = type || "error"; // "error" or "success"
    box.hidden = false;
    clearTimeout(feedbackTimer);
    feedbackTimer = setTimeout(function () {
      box.hidden = true;
    }, 3500);
  }

  // Marks a field as invalid (red outline via CSS) or clears it
  function markInvalid(input, isInvalid) {
    if (!input) return;
    if (isInvalid) {
      input.setAttribute("aria-invalid", "true");
    } else {
      input.removeAttribute("aria-invalid");
    }
  }

  // ---------- TEAM MEMBERS ----------
  function renderTeamMembers() {
    const list = $("team-members-list");
    const placeholder = $("no-team-members-msg");
    const template = $("team-member-item-template");
    if (!list || !template) return;

    // remove old rows (keep the placeholder <li>)
    list.querySelectorAll(".team-member-item").forEach((li) => li.remove());

    if (placeholder) placeholder.hidden = teamMembers.length > 0;

    teamMembers.forEach(function (member) {
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.memberId = member.id;
      row.querySelector(".member-name-display").textContent = member.name;
      row.querySelector(".member-role-display").textContent = member.role
        ? " - " + member.role
        : "";
      list.appendChild(row);
    });
  }

  function addTeamMember() {
    const nameInput = $("team-member-name-input");
    const roleInput = $("team-member-role-input");
    const name = nameInput.value.trim();
    const role = roleInput.value.trim();

    if (name === "") {
      markInvalid(nameInput, true);
      showFeedback("Please enter a team member name.");
      nameInput.focus();
      return;
    }

    const duplicate = teamMembers.some(
      (m) => m.name.toLowerCase() === name.toLowerCase()
    );
    if (duplicate) {
      markInvalid(nameInput, true);
      showFeedback('"' + name + '" is already on the team.');
      nameInput.focus();
      return;
    }

    teamMembers.push({ id: makeId("member"), name: name, role: role });
    renderTeamMembers();

    nameInput.value = "";
    roleInput.value = "";
    markInvalid(nameInput, false);
    nameInput.focus();
    showFeedback("Team member added: " + name, "success");
  }

  function removeTeamMember(memberId) {
    const member = teamMembers.find((m) => m.id === memberId);
    teamMembers = teamMembers.filter((m) => m.id !== memberId);
    renderTeamMembers();
    if (member) showFeedback("Team member removed: " + member.name, "success");
  }

  // ---------- RISKS ----------
  function renderRisks() {
    const tbody = $("project-risks-tbody");
    const emptyRow = $("no-risks-row");
    const template = $("risk-row-template");
    if (!tbody || !template) return;

    tbody.querySelectorAll(".risk-item-row").forEach((tr) => tr.remove());

    if (emptyRow) emptyRow.hidden = risks.length > 0;

    risks.forEach(function (risk) {
      const row = template.content.firstElementChild.cloneNode(true);
      row.dataset.riskId = risk.id;
      row.querySelector(".risk-desc-cell").textContent = risk.description;
      row.querySelector(".risk-likelihood-cell").textContent = risk.likelihood;
      row.querySelector(".risk-impact-cell").textContent = risk.impact;
      row.querySelector(".risk-status-updater").value = risk.status;
      tbody.appendChild(row);
    });
  }

  function addRisk() {
    const descInput = $("risk-description-input");
    const likelihoodSelect = $("risk-likelihood-select");
    const impactSelect = $("risk-impact-select");
    const statusSelect = $("risk-status-select");
    const description = descInput.value.trim();

    if (description === "") {
      markInvalid(descInput, true);
      showFeedback("Please enter a risk description.");
      descInput.focus();
      return;
    }

    risks.push({
      id: makeId("risk"),
      description: description,
      likelihood: likelihoodSelect.value,
      impact: impactSelect.value,
      status: statusSelect.value,
    });
    renderRisks();

    // reset the inputs back to their defaults
    descInput.value = "";
    likelihoodSelect.value = "Medium";
    impactSelect.value = "Medium";
    statusSelect.value = "Identified";
    markInvalid(descInput, false);
    descInput.focus();
    showFeedback("Risk added.", "success");
  }

  function removeRisk(riskId) {
    risks = risks.filter((r) => r.id !== riskId);
    renderRisks();
    showFeedback("Risk removed.", "success");
  }

  function updateRiskStatus(riskId, newStatus) {
    const risk = risks.find((r) => r.id === riskId);
    if (!risk) return;
    risk.status = newStatus;
    showFeedback("Risk status updated to " + newStatus + ".", "success");
  }

  // ---------- VALIDATION (required fields on page 1) ----------
  function validate() {
    const required = [
      { input: $("project-name-input"), label: "Project Name / Title" },
      { input: $("project-description-input"), label: "Project Description" },
      { input: $("project-owner-input"), label: "Owner / Project Manager" },
    ];

    const errors = [];
    let firstBad = null;

    required.forEach(function (field) {
      const empty = !field.input || field.input.value.trim() === "";
      markInvalid(field.input, empty);
      if (empty) {
        errors.push(field.label + " is required.");
        if (!firstBad) firstBad = field.input;
      }
    });

    if (errors.length > 0) {
      showFeedback(errors.join(" "));
      if (firstBad) firstBad.focus();
    }

    return { valid: errors.length === 0, errors: errors };
  }

  // ---------- PUBLIC FUNCTIONS (used by save/load + Parts B/C) ----------
  function getData() {
    return {
      projectName: $("project-name-input").value.trim(),
      projectDescription: $("project-description-input").value.trim(),
      projectOwner: $("project-owner-input").value.trim(),
      teamMembers: teamMembers.map((m) => Object.assign({}, m)),
      risks: risks.map((r) => Object.assign({}, r)),
    };
  }

  function setData(data) {
    data = data || {};
    $("project-name-input").value = data.projectName || "";
    $("project-description-input").value = data.projectDescription || "";
    $("project-owner-input").value = data.projectOwner || "";
    teamMembers = (data.teamMembers || []).map((m) => Object.assign({}, m));
    risks = (data.risks || []).map((r) => Object.assign({}, r));

    // clear any leftover typing / red outlines
    [
      "project-name-input",
      "project-description-input",
      "project-owner-input",
      "team-member-name-input",
      "risk-description-input",
    ].forEach((id) => markInvalid($(id), false));
    $("team-member-name-input").value = "";
    $("team-member-role-input").value = "";
    $("risk-description-input").value = "";

    renderTeamMembers();
    renderRisks();
  }

  function reset() {
    setData({});
  }

  // ---------- WIRE UP EVENTS ----------
  function init() {
    // Buttons
    $("add-team-member-btn").addEventListener("click", addTeamMember);
    $("add-risk-btn").addEventListener("click", addRisk);

    // Pressing Enter in these inputs adds the item instead of submitting the form
    ["team-member-name-input", "team-member-role-input"].forEach(function (id) {
      $(id).addEventListener("keydown", function (e) {
        if (e.key === "Enter") {
          e.preventDefault();
          addTeamMember();
        }
      });
    });
    $("risk-description-input").addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        e.preventDefault();
        addRisk();
      }
    });

    // Remove a team member (event delegation on the list)
    $("team-members-list").addEventListener("click", function (e) {
      const btn = e.target.closest(".btn-remove-member");
      if (!btn) return;
      const li = btn.closest(".team-member-item");
      removeTeamMember(li.dataset.memberId);
    });

    // Remove a risk / change a risk's status (event delegation on the table)
    const risksBody = $("project-risks-tbody");
    risksBody.addEventListener("click", function (e) {
      const btn = e.target.closest(".btn-remove-risk");
      if (!btn) return;
      const tr = btn.closest(".risk-item-row");
      removeRisk(tr.dataset.riskId);
    });
    risksBody.addEventListener("change", function (e) {
      if (!e.target.classList.contains("risk-status-updater")) return;
      const tr = e.target.closest(".risk-item-row");
      updateRiskStatus(tr.dataset.riskId, e.target.value);
    });

    // Clear the red outline as soon as the user types in a required field
    [
      "project-name-input",
      "project-description-input",
      "project-owner-input",
      "team-member-name-input",
      "risk-description-input",
    ].forEach(function (id) {
      $(id).addEventListener("input", function () {
        if (this.value.trim() !== "") markInvalid(this, false);
      });
    });

    renderTeamMembers();
    renderRisks();
  }

  window.PartA = {
    getData: getData,
    setData: setData,
    reset: reset,
    validate: validate,
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/* ===================== END PART A ===================== */


/* =========================================================
   APP / DASHBOARD - ties Parts A, B and C together
   ---------------------------------------------------------
   Handles:
     - "+ Add Project" button (opens the popup for a new project)
     - Popup close (x button / Esc), Next / Previous, 1-2-3 step buttons
     - "Save & Close Project" (saves to localStorage, makes a card)
     - Project cards: "Open / Manage" and "Delete"

   How it talks to each part:
     Each part puts an object on window (window.PartA, window.PartB,
     window.PartC) with these functions:
       getData()  -> returns that page's data as an object
       setData(d) -> fills that page from a saved object
       reset()    -> clears that page for a new project
       validate() -> (optional) returns { valid, errors }
     Part C may also provide getTotalHours() for the card badge.
     If Part B or C isn't written yet, it is simply skipped.
   ========================================================= */
(function () {
  "use strict";

  const STORAGE_KEY = "spm-group8-projects";
  const TOTAL_PAGES = 3;

  let projects = []; // [{ id, partA: {...}, partB: {...}, partC: {...} }]
  let currentPage = 1;

  const $ = (id) => document.getElementById(id);
  const parts = () => ({ A: window.PartA, B: window.PartB, C: window.PartC });

  // ---------- saving / loading (localStorage) ----------
  function loadProjects() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      projects = saved ? JSON.parse(saved) : [];
    } catch (e) {
      projects = [];
    }
  }

  function storeProjects() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
    } catch (e) {
      showBanner("Could not save to this browser's storage.");
    }
  }

  // ---------- banner message at the top of the page ----------
  let bannerTimer = null;
  function showBanner(message) {
    const banner = $("global-feedback-banner");
    const text = $("feedback-message");
    if (!banner || !text) return;
    text.textContent = message;
    banner.hidden = false;
    clearTimeout(bannerTimer);
    bannerTimer = setTimeout(function () {
      banner.hidden = true;
    }, 3500);
  }

  // ---------- project cards ----------
  function countHours(project) {
    const C = parts().C;
    if (C && typeof C.getTotalHours === "function" && project.partC) {
      return C.getTotalHours(project.partC);
    }
    return (project.partC && project.partC.totalHours) || 0;
  }

  function renderCards() {
    const grid = $("projects-grid");
    const empty = $("empty-projects-state");
    const template = $("project-card-template");
    if (!grid || !template) return;

    grid.innerHTML = "";
    if (empty) empty.hidden = projects.length > 0;

    projects.forEach(function (project) {
      const a = project.partA || {};
      const b = project.partB || {};
      const card = template.content.firstElementChild.cloneNode(true);
      card.dataset.projectId = project.id;
      card.querySelector(".card-project-title").textContent =
        a.projectName || "Untitled Project";
      card.querySelector(".owner-name-text").textContent = a.projectOwner || "";
      card.querySelector(".card-project-description").textContent =
        a.projectDescription || "";
      card.querySelector(".team-count").textContent = (a.teamMembers || []).length;
      card.querySelector(".risks-count").textContent = (a.risks || []).length;
      card.querySelector(".reqs-count").textContent = (b.requirements || []).length;
      card.querySelector(".hours-count").textContent = countHours(project);
      grid.appendChild(card);
    });
  }

  // ---------- popup pages ----------
  function goToPage(pageNumber) {
    currentPage = Math.min(Math.max(pageNumber, 1), TOTAL_PAGES);

    document.querySelectorAll(".modal-page").forEach(function (page) {
      const isCurrent = Number(page.dataset.pageNumber) === currentPage;
      page.hidden = !isCurrent;
      page.classList.toggle("active-page", isCurrent);
    });

    document.querySelectorAll(".step-dot").forEach(function (dot) {
      const isCurrent = Number(dot.dataset.targetPage) === currentPage;
      dot.classList.toggle("active", isCurrent);
      if (isCurrent) dot.setAttribute("aria-current", "step");
      else dot.removeAttribute("aria-current");
    });

    const headings = {
      1: "A. General Project Information",
      2: "B. Project Requirements",
      3: "C. Project Effort Monitoring and Tracking",
    };
    $("modal-step-heading").textContent = headings[currentPage];
    $("modal-page-indicator").textContent = currentPage + "/" + TOTAL_PAGES;
    $("modal-prev-btn").hidden = currentPage === 1;
    $("modal-next-btn").hidden = currentPage === TOTAL_PAGES;
  }

  // ---------- open / close the popup ----------
  function openPopup(project) {
    const p = parts();
    $("active-project-id").value = project ? project.id : "";

    ["A", "B", "C"].forEach(function (key) {
      const part = p[key];
      if (!part) return;
      const saved = project && project["part" + key];
      if (saved && typeof part.setData === "function") part.setData(saved);
      else if (typeof part.reset === "function") part.reset();
    });

    const feedback = $("modal-action-feedback");
    if (feedback) feedback.hidden = true;

    goToPage(1);
    const backdrop = $("project-modal-backdrop");
    backdrop.hidden = false;
    backdrop.setAttribute("aria-hidden", "false");
    $("project-name-input").focus();
  }

  function closePopup() {
    const backdrop = $("project-modal-backdrop");
    backdrop.hidden = true;
    backdrop.setAttribute("aria-hidden", "true");
    $("add-project-fab").focus();
  }

  // ---------- save ----------
  function saveProject(event) {
    event.preventDefault();
    const p = parts();

    // Check each part; jump to the first page that has a problem
    const pageOf = { A: 1, B: 2, C: 3 };
    for (const key of ["A", "B", "C"]) {
      const part = p[key];
      if (part && typeof part.validate === "function") {
        goToPage(pageOf[key]); // so the part's error message is visible
        const result = part.validate();
        if (result && result.valid === false) return;
      }
    }

    const id = $("active-project-id").value || "project-" + Date.now().toString(36);
    const project = { id: id };
    ["A", "B", "C"].forEach(function (key) {
      const part = p[key];
      if (part && typeof part.getData === "function") {
        project["part" + key] = part.getData();
      }
    });

    const index = projects.findIndex((x) => x.id === id);
    if (index >= 0) projects[index] = project;
    else projects.push(project);

    storeProjects();
    renderCards();
    closePopup();
    showBanner(
      'Saved "' + ((project.partA && project.partA.projectName) || "project") + '".'
    );
  }

  // ---------- delete ----------
  function deleteProject(id) {
    const project = projects.find((x) => x.id === id);
    const name = (project && project.partA && project.partA.projectName) || "this project";
    if (!window.confirm('Delete "' + name + '"? This cannot be undone.')) return;
    projects = projects.filter((x) => x.id !== id);
    storeProjects();
    renderCards();
    showBanner('Deleted "' + name + '".');
  }

  // ---------- wire up events ----------
  function init() {
    $("add-project-fab").addEventListener("click", function () {
      openPopup(null);
    });
    $("close-modal-btn").addEventListener("click", closePopup);
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && !$("project-modal-backdrop").hidden) closePopup();
    });

    $("modal-next-btn").addEventListener("click", function () {
      goToPage(currentPage + 1);
    });
    $("modal-prev-btn").addEventListener("click", function () {
      goToPage(currentPage - 1);
    });
    document.querySelectorAll(".step-dot").forEach(function (dot) {
      dot.addEventListener("click", function () {
        goToPage(Number(dot.dataset.targetPage));
      });
    });

    $("project-system-form").addEventListener("submit", saveProject);

    // Open / Delete buttons on the cards
    $("projects-grid").addEventListener("click", function (e) {
      const card = e.target.closest(".project-card");
      if (!card) return;
      const id = card.dataset.projectId;
      if (e.target.closest(".btn-card-open")) {
        openPopup(projects.find((x) => x.id === id));
      } else if (e.target.closest(".btn-card-delete")) {
        deleteProject(id);
      }
    });

    loadProjects();
    renderCards();
    closePopup();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
/* ================== END APP / DASHBOARD ================== */