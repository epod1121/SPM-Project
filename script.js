document.addEventListener("DOMContentLoaded", async () => {
  // database
  if (typeof ProjectDB !== "undefined") {
    await ProjectDB.init();
  }

  let currentPage = 1;
  const totalPages = 3;

  // load projects from database
  let allSavedProjects =
    typeof ProjectDB !== "undefined" ? ProjectDB.getAllProjects() : [];

  // draft checking
  let projectDraft = {
    id: null,
    name: "",
    description: "",
    owner: "",
    teamMembers: [],
    risks: [],
    requirements: [],
    effortLogs: [],
  };

  // DOM Elements
  const backdrop = document.getElementById("project-modal-backdrop");
  const fabAddBtn = document.getElementById("add-project-fab");
  const closeModalBtn = document.getElementById("close-modal-btn");
  const modalPrevBtn = document.getElementById("modal-prev-btn");
  const modalNextBtn = document.getElementById("modal-next-btn");
  const modalSaveBtn = document.getElementById("modal-save-project-btn");
  const pageIndicator = document.getElementById("modal-page-indicator");
  const modalTitle = document.getElementById("modal-step-heading");
  const emptyState = document.getElementById("empty-projects-state");
  const projectsGrid = document.getElementById("projects-grid");
  const stepDots = document.querySelectorAll(".step-dot");
  const activeProjectIdInput = document.getElementById("active-project-id");

  const pages = [
    document.getElementById("modal-page-1"),
    document.getElementById("modal-page-2"),
    document.getElementById("modal-page-3"),
  ];

  const pageTitles = [
    "A. General Project Information",
    "B. Project Requirements",
    "C. Project Effort Monitoring & Tracking",
  ];

  // controls
  backdrop.classList.add("is-hidden");

  function openModal(startPage = 1) {
    backdrop.classList.remove("is-hidden");
    backdrop.removeAttribute("hidden");
    goToPage(startPage);
  }

  function closeModal() {
    backdrop.classList.add("is-hidden");
    backdrop.setAttribute("hidden", "true");
  }

  closeModalBtn.addEventListener("click", (e) => {
    e.preventDefault();
    closeModal();
  });

  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) {
      closeModal();
    }
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !backdrop.classList.contains("is-hidden")) {
      closeModal();
    }
  });

  // create project button
  fabAddBtn.addEventListener("click", () => {
    resetDraft();
    openModal(1);
  });

  // reopen project
  function openExistingProject(projectId) {
    const existing = allSavedProjects.find((p) => p.id === projectId);
    if (!existing) return;

    // copy data
    projectDraft = {
      id: existing.id,
      name: existing.name,
      description: existing.desc,
      owner: existing.owner,
      teamMembers: existing.team.map((m) => ({ ...m })),
      risks: existing.risks.map((r) => ({ ...r })),
      requirements: existing.requirements.map((req) => ({ ...req })),
      effortLogs: existing.effortLogs.map((log) => ({ ...log })),
    };

    // pg 1 inputs
    activeProjectIdInput.value = projectDraft.id;
    document.getElementById("project-name-input").value = projectDraft.name;
    document.getElementById("project-description-input").value =
      projectDraft.description;
    document.getElementById("project-owner-input").value = projectDraft.owner;

    // get all lists and tables
    renderTeamMembers();
    renderRisks();
    renderRequirements();
    refreshRequirementDropdown();
    renderEffortTotalsTable();
    renderEffortHistoryTable();

    openModal(1);
  }

  // manuvere buttons
  function goToPage(pageIndex) {
    currentPage = pageIndex;
    pages.forEach((page, idx) => {
      if (idx + 1 === currentPage) {
        page.hidden = false;
        page.classList.add("active-page");
      } else {
        page.hidden = true;
        page.classList.remove("active-page");
      }
    });

    pageIndicator.textContent = `${currentPage}/${totalPages}`;
    modalTitle.textContent = pageTitles[currentPage - 1];

    modalPrevBtn.hidden = false;
    modalNextBtn.hidden = false;
    modalSaveBtn.hidden = false;

    modalPrevBtn.disabled = currentPage === 1;
    modalNextBtn.disabled = currentPage === totalPages;

    stepDots.forEach((dot) => {
      const target = parseInt(dot.getAttribute("data-target-page"), 10);
      if (target === currentPage) {
        dot.classList.add("active");
      } else {
        dot.classList.remove("active");
      }
    });

    if (currentPage === 3) {
      refreshRequirementDropdown();
      renderEffortTotalsTable();
      renderEffortHistoryTable();
    }
  }

  modalPrevBtn.addEventListener("click", () => {
    if (currentPage > 1) goToPage(currentPage - 1);
  });

  modalNextBtn.addEventListener("click", () => {
    if (currentPage < totalPages) goToPage(currentPage + 1);
  });

  stepDots.forEach((dot) => {
    dot.addEventListener("click", () => {
      const target = parseInt(dot.getAttribute("data-target-page"), 10);
      goToPage(target);
    });
  });

  // pg 1
  const addTeamBtn = document.getElementById("add-team-member-btn");
  const teamNameInput = document.getElementById("team-member-name-input");
  const teamRoleInput = document.getElementById("team-member-role-input");
  const teamList = document.getElementById("team-members-list");

  addTeamBtn.addEventListener("click", () => {
    const name = teamNameInput.value.trim();
    const role = teamRoleInput.value.trim();
    if (!name) return alert("Please enter a team member name");

    const member = { id: "mem_" + Date.now(), name, role };
    projectDraft.teamMembers.push(member);
    teamNameInput.value = "";
    teamRoleInput.value = "";
    renderTeamMembers();
  });

  function renderTeamMembers() {
    teamList.innerHTML = "";
    if (projectDraft.teamMembers.length === 0) {
      teamList.innerHTML =
        '<li id="no-team-members-msg" class="empty-list-placeholder">No team members added yet.</li>';
      return;
    }
    projectDraft.teamMembers.forEach((m) => {
      const li = document.createElement("li");
      li.innerHTML = `<span><strong>${m.name}</strong> ${m.role ? `(${m.role})` : ""}</span>
                            <button type="button" class="btn-remove-item" data-id="${m.id}">Remove</button>`;
      li.querySelector("button").addEventListener("click", () => {
        projectDraft.teamMembers = projectDraft.teamMembers.filter(
          (item) => String(item.id) !== String(m.id),
        );
        renderTeamMembers();
      });
      teamList.appendChild(li);
    });
  }

  // risks
  const addRiskBtn = document.getElementById("add-risk-btn");
  const riskDescInput = document.getElementById("risk-description-input");
  const riskLikelihood = document.getElementById("risk-likelihood-select");
  const riskImpact = document.getElementById("risk-impact-select");
  const riskStatus = document.getElementById("risk-status-select");
  const risksTbody = document.getElementById("project-risks-tbody");

  addRiskBtn.addEventListener("click", () => {
    const desc = riskDescInput.value.trim();
    if (!desc) return alert("Please enter a risk description");

    const risk = {
      id: "risk_" + Date.now(),
      desc,
      likelihood: riskLikelihood.value,
      impact: riskImpact.value,
      status: riskStatus.value,
    };
    projectDraft.risks.push(risk);
    riskDescInput.value = "";
    renderRisks();
  });

  function renderRisks() {
    risksTbody.innerHTML = "";
    if (projectDraft.risks.length === 0) {
      risksTbody.innerHTML =
        '<tr class="empty-table-row"><td colspan="5">No project risks recorded yet.</td></tr>';
      return;
    }
    projectDraft.risks.forEach((r) => {
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${r.desc}</td>
                <td>${r.likelihood}</td>
                <td>${r.impact}</td>
                <td>
                    <select class="risk-status-updater" data-id="${r.id}">
                        <option value="Identified" ${r.status === "Identified" ? "selected" : ""}>Identified / Open</option>
                        <option value="Monitoring" ${r.status === "Monitoring" ? "selected" : ""}>Monitoring</option>
                        <option value="Mitigated" ${r.status === "Mitigated" ? "selected" : ""}>Mitigated</option>
                        <option value="Occurred" ${r.status === "Occurred" ? "selected" : ""}>Occurred / Active Issue</option>
                        <option value="Closed" ${r.status === "Closed" ? "selected" : ""}>Closed / Resolved</option>
                    </select>
                </td>
                <td><button type="button" class="btn-remove-item" data-id="${r.id}">Remove</button></td>
            `;
      tr.querySelector(".risk-status-updater").addEventListener(
        "change",
        (e) => {
          r.status = e.target.value;
        },
      );
      tr.querySelector(".btn-remove-item").addEventListener("click", () => {
        projectDraft.risks = projectDraft.risks.filter(
          (item) => String(item.id) !== String(r.id),
        );
        renderRisks();
      });
      risksTbody.appendChild(tr);
    });
  }

  // pg 2
  const addReqBtn = document.getElementById("add-requirement-btn");
  const reqCodeInput = document.getElementById("requirement-code-input");
  const reqTypeSelect = document.getElementById("requirement-type-select");
  const reqDescInput = document.getElementById("requirement-description-input");
  const funcList = document.getElementById("functional-requirements-list");
  const nonFuncList = document.getElementById(
    "non-functional-requirements-list",
  );

  addReqBtn.addEventListener("click", () => {
    const desc = reqDescInput.value.trim();
    if (!desc) return alert("Please enter requirement description");

    const code =
      reqCodeInput.value.trim() ||
      (reqTypeSelect.value === "Functional"
        ? `FR-${projectDraft.requirements.filter((r) => r.type === "Functional").length + 1}`
        : `NFR-${projectDraft.requirements.filter((r) => r.type === "Non-Functional").length + 1}`);

    const req = {
      id: "req_" + Date.now(),
      code,
      type: reqTypeSelect.value,
      description: desc,
    };

    projectDraft.requirements.push(req);
    reqCodeInput.value = "";
    reqDescInput.value = "";
    renderRequirements();
  });

  function renderRequirements() {
    funcList.innerHTML = "";
    nonFuncList.innerHTML = "";

    const func = projectDraft.requirements.filter(
      (r) => r.type === "Functional",
    );
    const nonFunc = projectDraft.requirements.filter(
      (r) => r.type === "Non-Functional",
    );

    if (func.length === 0) {
      funcList.innerHTML =
        '<li class="empty-list-placeholder">No functional requirements entered yet.</li>';
    } else {
      func.forEach((r) => appendReqItem(funcList, r));
    }

    if (nonFunc.length === 0) {
      nonFuncList.innerHTML =
        '<li class="empty-list-placeholder">No non-functional requirements entered yet.</li>';
    } else {
      nonFunc.forEach((r) => appendReqItem(nonFuncList, r));
    }
  }

  function appendReqItem(container, r) {
    const li = document.createElement("li");
    li.innerHTML = `
            <div>
                <strong>[${r.code}]</strong> <span>${r.description}</span>
            </div>
            <div>
                <button type="button" class="btn-secondary btn-edit-req" style="padding: 3px 8px; font-size: 0.78rem; margin-right: 4px;">Edit</button>
                <button type="button" class="btn-remove-item btn-remove-req" data-id="${r.id}">Remove</button>
            </div>
        `;

    // edit existing requirement
    li.querySelector(".btn-edit-req").addEventListener("click", () => {
      const updatedDesc = prompt(
        `Edit description for [${r.code}]:`,
        r.description,
      );
      if (updatedDesc !== null && updatedDesc.trim() !== "") {
        r.description = updatedDesc.trim();
        renderRequirements();
      }
    });

    li.querySelector(".btn-remove-req").addEventListener("click", () => {
      projectDraft.requirements = projectDraft.requirements.filter(
        (item) => String(item.id) !== String(r.id),
      );
      projectDraft.effortLogs = projectDraft.effortLogs.filter(
        (log) => String(log.reqId) !== String(r.id),
      );
      renderRequirements();
    });

    container.appendChild(li);
  }

  // pg 3
  const effortReqSelect = document.getElementById("effort-requirement-select");
  const effortPeriodSelect = document.getElementById(
    "effort-period-type-select",
  );
  const effortDateInput = document.getElementById("effort-date-input");
  const logEffortBtn = document.getElementById("log-effort-entry-btn");

  const inAnalysis = document.getElementById("hours-req-analysis-input");
  const inDesign = document.getElementById("hours-designing-input");
  const inCoding = document.getElementById("hours-coding-input");
  const inTesting = document.getElementById("hours-testing-input");
  const inPM = document.getElementById("hours-pm-input");

  const totalsTbody = document.getElementById("effort-totals-tbody");
  const effortHistoryTbody = document.getElementById("effort-history-tbody");

  function refreshRequirementDropdown() {
    const previousSelection = effortReqSelect.value;
    effortReqSelect.innerHTML =
      '<option value="" disabled selected>-- Select an entered requirement --</option>';
    projectDraft.requirements.forEach((r) => {
      const opt = document.createElement("option");
      opt.value = r.id;
      opt.textContent = `[${r.code}] ${r.description.length > 50 ? r.description.substring(0, 50) + "..." : r.description}`;
      if (String(r.id) === String(previousSelection)) {
        opt.selected = true;
      }
      effortReqSelect.appendChild(opt);
    });
  }

  logEffortBtn.addEventListener("click", () => {
    const reqId = effortReqSelect.value;
    if (!reqId) return alert("Please select a requirement first.");
    if (!effortDateInput.value)
      return alert("Please select a date or week starting date.");

    const analysis = parseFloat(inAnalysis.value) || 0;
    const design = parseFloat(inDesign.value) || 0;
    const coding = parseFloat(inCoding.value) || 0;
    const testing = parseFloat(inTesting.value) || 0;
    const pm = parseFloat(inPM.value) || 0;

    const totalEntry = analysis + design + coding + testing + pm;
    if (totalEntry === 0)
      return alert("Please enter at least some hours in one phase.");

    const log = {
      id: "log_" + Date.now(),
      reqId,
      date: effortDateInput.value,
      basis: effortPeriodSelect.value,
      analysis,
      design,
      coding,
      testing,
      pm,
      total: totalEntry,
    };

    projectDraft.effortLogs.push(log);

    inAnalysis.value = 0;
    inDesign.value = 0;
    inCoding.value = 0;
    inTesting.value = 0;
    inPM.value = 0;

    renderEffortTotalsTable();
    renderEffortHistoryTable();
  });

  function renderEffortTotalsTable() {
    totalsTbody.innerHTML = "";
    if (projectDraft.requirements.length === 0) {
      totalsTbody.innerHTML =
        '<tr class="empty-table-row"><td colspan="8">No requirements entered yet. Add them in Page 2.</td></tr>';
      updateGrandTotals(0, 0, 0, 0, 0, 0);
      return;
    }

    let gAnalysis = 0,
      gDesign = 0,
      gCoding = 0,
      gTesting = 0,
      gPm = 0,
      gAll = 0;

    projectDraft.requirements.forEach((r) => {
      const logs = projectDraft.effortLogs.filter(
        (l) => String(l.reqId) === String(r.id),
      );
      const a = logs.reduce((sum, l) => sum + Number(l.analysis), 0);
      const d = logs.reduce((sum, l) => sum + Number(l.design), 0);
      const c = logs.reduce((sum, l) => sum + Number(l.coding), 0);
      const t = logs.reduce((sum, l) => sum + Number(l.testing), 0);
      const p = logs.reduce((sum, l) => sum + Number(l.pm), 0);
      const rowTotal = a + d + c + t + p;

      gAnalysis += a;
      gDesign += d;
      gCoding += c;
      gTesting += t;
      gPm += p;
      gAll += rowTotal;

      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td><strong>[${r.code}]</strong> ${r.description}</td>
                <td>${r.type}</td>
                <td>${a}</td>
                <td>${d}</td>
                <td>${c}</td>
                <td>${t}</td>
                <td>${p}</td>
                <td><strong>${rowTotal}</strong></td>
            `;
      totalsTbody.appendChild(tr);
    });

    updateGrandTotals(gAnalysis, gDesign, gCoding, gTesting, gPm, gAll);
  }

  function updateGrandTotals(a, d, c, t, p, total) {
    document.getElementById("grand-total-req-analysis").textContent = a;
    document.getElementById("grand-total-designing").textContent = d;
    document.getElementById("grand-total-coding").textContent = c;
    document.getElementById("grand-total-testing").textContent = t;
    document.getElementById("grand-total-pm").textContent = p;
    document.getElementById("grand-total-all-phases").innerHTML =
      `<strong>${total}</strong>`;
  }

  function renderEffortHistoryTable() {
    effortHistoryTbody.innerHTML = "";
    if (projectDraft.effortLogs.length === 0) {
      effortHistoryTbody.innerHTML =
        '<tr class="empty-table-row"><td colspan="9">No individual effort logs recorded yet.</td></tr>';
      return;
    }

    projectDraft.effortLogs.forEach((l) => {
      const req = projectDraft.requirements.find(
        (r) => String(r.id) === String(l.reqId),
      );
      const reqLabel = req ? `[${req.code}]` : "Unknown";
      const tr = document.createElement("tr");
      tr.innerHTML = `
                <td>${l.date}</td>
                <td>${l.basis}</td>
                <td>${reqLabel}</td>
                <td>${l.analysis}</td>
                <td>${l.design}</td>
                <td>${l.coding}</td>
                <td>${l.testing}</td>
                <td>${l.pm}</td>
                <td><button type="button" class="btn-remove-item">Delete</button></td>
            `;
      tr.querySelector("button").addEventListener("click", () => {
        projectDraft.effortLogs = projectDraft.effortLogs.filter(
          (item) => String(item.id) !== String(l.id),
        );
        renderEffortHistoryTable();
        renderEffortTotalsTable();
      });
      effortHistoryTbody.appendChild(tr);
    });
  }

  // saving and updating
  const projectForm = document.getElementById("project-system-form");

  projectForm.addEventListener("submit", (e) => {
    e.preventDefault();

    const name =
      document.getElementById("project-name-input").value.trim() ||
      "Untitled Project";
    const desc = document
      .getElementById("project-description-input")
      .value.trim();
    const owner = document.getElementById("project-owner-input").value.trim();

    if (!desc || !owner) {
      alert(
        "Please fill out the Project Description and Owner Name on Page 1 before saving.",
      );
      goToPage(1);
      return;
    }

    // reuse id if needed
    const projectId = projectDraft.id || "proj_" + Date.now();

    const project = {
      id: projectId,
      name,
      desc,
      owner,
      team: projectDraft.teamMembers.map((m) => ({ ...m })),
      risks: projectDraft.risks.map((r) => ({ ...r })),
      requirements: projectDraft.requirements.map((req) => ({ ...req })),
      effortLogs: projectDraft.effortLogs.map((log) => ({ ...log })),
    };

    // update or push new
    const existingIndex = allSavedProjects.findIndex((p) => p.id === projectId);
    if (existingIndex !== -1) {
      allSavedProjects[existingIndex] = project;
    } else {
      allSavedProjects.push(project);
    }

    // Save to SQLite database
    if (typeof ProjectDB !== "undefined") {
      ProjectDB.saveProject(project);
    }

    renderProjectsGrid();
    closeModal();
  });

  function renderProjectsGrid() {
    projectsGrid.innerHTML = "";
    if (allSavedProjects.length === 0) {
      emptyState.hidden = false;
      return;
    }

    emptyState.hidden = true;
    allSavedProjects.forEach((proj) => {
      const card = document.createElement("article");
      card.className = "project-card";
      card.style.cursor = "pointer";

      const totalHours = proj.effortLogs.reduce(
        (sum, l) =>
          sum +
          (Number(l.analysis) +
            Number(l.design) +
            Number(l.coding) +
            Number(l.testing) +
            Number(l.pm)),
        0,
      );

      card.innerHTML = `
                <header class="project-card-header">
                    <h2 class="card-project-title">${proj.name}</h2>
                    <p class="card-project-owner"><strong>Owner/PM:</strong> ${proj.owner}</p>
                </header>
                <div class="project-card-body">
                    <p class="card-project-description">${proj.desc}</p>
                    <div class="card-summary-badges">
                        <span class="badge">Team: <strong>${proj.team.length}</strong></span>
                        <span class="badge">Risks: <strong>${proj.risks.length}</strong></span>
                        <span class="badge">Reqs: <strong>${proj.requirements.length}</strong></span>
                        <span class="badge">Total Effort: <strong>${totalHours}</strong> hrs</span>
                    </div>
                </div>
                <footer class="project-card-footer">
                    <button type="button" class="btn btn-secondary btn-card-open">Open / Edit</button>
                    <button type="button" class="btn btn-card-delete btn-remove-item">Delete</button>
                </footer>
            `;

      // reopen the same project
      card.addEventListener("click", (e) => {
        if (e.target.closest(".btn-card-delete")) return;
        openExistingProject(proj.id);
      });

      // deletion on both board and database
      card.querySelector(".btn-card-delete").addEventListener("click", (e) => {
        e.stopPropagation();
        if (typeof ProjectDB !== "undefined") {
          ProjectDB.deleteProject(proj.id);
        }
        allSavedProjects = allSavedProjects.filter((p) => p.id !== proj.id);
        renderProjectsGrid();
      });

      projectsGrid.appendChild(card);
    });
  }

  function resetDraft() {
    projectDraft = {
      id: null,
      name: "",
      description: "",
      owner: "",
      teamMembers: [],
      risks: [],
      requirements: [],
      effortLogs: [],
    };
    activeProjectIdInput.value = "";
    document.getElementById("project-name-input").value = "";
    document.getElementById("project-description-input").value = "";
    document.getElementById("project-owner-input").value = "";
    renderTeamMembers();
    renderRisks();
    renderRequirements();
    renderEffortTotalsTable();
    renderEffortHistoryTable();
  }

  // page load
  renderProjectsGrid();
});
