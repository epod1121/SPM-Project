const ProjectDB = (() => {
  let db = null;
  const STORAGE_KEY = "group8_pms_sqlite_db_v1";

  // init database from cloudflaire (need internet)
  async function init() {
    const SQL = await initSqlJs({
      locateFile: (file) =>
        `https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/${file}`,
    });

    const savedDbBase64 = localStorage.getItem(STORAGE_KEY);
    if (savedDbBase64) {
      const binaryArray = Uint8Array.from(atob(savedDbBase64), (c) =>
        c.charCodeAt(0),
      );
      db = new SQL.Database(binaryArray);
    } else {
      db = new SQL.Database();
    }

    createTables();
    persistToDisk();
    return db;
  }

  // get tables from database
  function createTables() {
    db.run(`PRAGMA foreign_keys = ON;`);

    db.run(`
            CREATE TABLE IF NOT EXISTS projects (
                project_id TEXT PRIMARY KEY,
                project_name TEXT NOT NULL,
                project_description TEXT NOT NULL,
                project_owner TEXT NOT NULL
            );
        `);

    db.run(`
            CREATE TABLE IF NOT EXISTS project_team_members (
                member_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                member_name TEXT NOT NULL,
                member_role TEXT,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );
        `);

    db.run(`
            CREATE TABLE IF NOT EXISTS project_risks (
                risk_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                risk_description TEXT NOT NULL,
                likelihood TEXT NOT NULL,
                impact TEXT NOT NULL,
                risk_status TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );
        `);

    db.run(`
            CREATE TABLE IF NOT EXISTS project_requirements (
                requirement_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                requirement_code TEXT NOT NULL,
                requirement_type TEXT NOT NULL,
                requirement_description TEXT NOT NULL,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE
            );
        `);

    db.run(`
            CREATE TABLE IF NOT EXISTS effort_records (
                effort_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL,
                requirement_id TEXT NOT NULL,
                tracking_interval TEXT NOT NULL,
                entry_date TEXT NOT NULL,
                hours_req_analysis REAL DEFAULT 0,
                hours_designing REAL DEFAULT 0,
                hours_coding REAL DEFAULT 0,
                hours_testing REAL DEFAULT 0,
                hours_project_management REAL DEFAULT 0,
                FOREIGN KEY (project_id) REFERENCES projects(project_id) ON DELETE CASCADE,
                FOREIGN KEY (requirement_id) REFERENCES project_requirements(requirement_id) ON DELETE CASCADE
            );
        `);
  }

  // save to local storage in base 64
  function persistToDisk() {
    const binaryArray = db.export();
    let binaryString = "";
    for (let i = 0; i < binaryArray.length; i++) {
      binaryString += String.fromCharCode(binaryArray[i]);
    }
    localStorage.setItem(STORAGE_KEY, btoa(binaryString));
  }

  // sql to js helper
  function queryAll(sql, params = []) {
    const stmt = db.prepare(sql);
    stmt.bind(params);
    const rows = [];
    while (stmt.step()) {
      rows.push(stmt.getAsObject());
    }
    stmt.free();
    return rows;
  }

  // save or overwrite
  function saveProject(project) {
    db.run("BEGIN TRANSACTION;");
    try {
      db.run("DELETE FROM effort_records WHERE project_id = ?;", [project.id]);
      db.run("DELETE FROM project_requirements WHERE project_id = ?;", [
        project.id,
      ]);
      db.run("DELETE FROM project_risks WHERE project_id = ?;", [project.id]);
      db.run("DELETE FROM project_team_members WHERE project_id = ?;", [
        project.id,
      ]);
      db.run("DELETE FROM projects WHERE project_id = ?;", [project.id]);

      // project
      db.run(
        `INSERT INTO projects (project_id, project_name, project_description, project_owner)
                 VALUES (?, ?, ?, ?);`,
        [project.id, project.name, project.desc, project.owner],
      );

      // team
      project.team.forEach((m) => {
        db.run(
          `INSERT INTO project_team_members (member_id, project_id, member_name, member_role)
                     VALUES (?, ?, ?, ?);`,
          [String(m.id), project.id, m.name, m.role || ""],
        );
      });

      // risks
      project.risks.forEach((r) => {
        db.run(
          `INSERT INTO project_risks (risk_id, project_id, risk_description, likelihood, impact, risk_status)
                     VALUES (?, ?, ?, ?, ?, ?);`,
          [String(r.id), project.id, r.desc, r.likelihood, r.impact, r.status],
        );
      });

      // requirements
      project.requirements.forEach((req) => {
        db.run(
          `INSERT INTO project_requirements (requirement_id, project_id, requirement_code, requirement_type, requirement_description)
                     VALUES (?, ?, ?, ?, ?);`,
          [String(req.id), project.id, req.code, req.type, req.description],
        );
      });

      // effort logged
      project.effortLogs.forEach((log) => {
        db.run(
          `INSERT INTO effort_records (
                        effort_id, project_id, requirement_id, tracking_interval, entry_date,
                        hours_req_analysis, hours_designing, hours_coding, hours_testing, hours_project_management
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?);`,
          [
            String(log.id),
            project.id,
            String(log.reqId),
            log.basis,
            log.date,
            log.analysis,
            log.design,
            log.coding,
            log.testing,
            log.pm,
          ],
        );
      });

      db.run("COMMIT;");
      persistToDisk();
    } catch (err) {
      db.run("ROLLBACK;");
      console.error("SQL Save Error:", err);
    }
  }

  // load all saves
  function getAllProjects() {
    const projects = queryAll("SELECT * FROM projects;");

    return projects.map((p) => {
      const teamRows = queryAll(
        "SELECT * FROM project_team_members WHERE project_id = ?;",
        [p.project_id],
      );
      const riskRows = queryAll(
        "SELECT * FROM project_risks WHERE project_id = ?;",
        [p.project_id],
      );
      const reqRows = queryAll(
        "SELECT * FROM project_requirements WHERE project_id = ?;",
        [p.project_id],
      );
      const effortRows = queryAll(
        "SELECT * FROM effort_records WHERE project_id = ?;",
        [p.project_id],
      );

      return {
        id: p.project_id,
        name: p.project_name,
        desc: p.project_description,
        owner: p.project_owner,
        team: teamRows.map((m) => ({
          id: m.member_id,
          name: m.member_name,
          role: m.member_role,
        })),
        risks: riskRows.map((r) => ({
          id: r.risk_id,
          desc: r.risk_description,
          likelihood: r.likelihood,
          impact: r.impact,
          status: r.risk_status,
        })),
        requirements: reqRows.map((req) => ({
          id: req.requirement_id,
          code: req.requirement_code,
          type: req.requirement_type,
          description: req.requirement_description,
        })),
        effortLogs: effortRows.map((l) => ({
          id: l.effort_id,
          reqId: l.requirement_id,
          date: l.entry_date,
          basis: l.tracking_interval,
          analysis: Number(l.hours_req_analysis),
          design: Number(l.hours_designing),
          coding: Number(l.hours_coding),
          testing: Number(l.hours_testing),
          pm: Number(l.hours_project_management),
        })),
      };
    });
  }

  // delete
  function deleteProject(projectId) {
    db.run("DELETE FROM effort_records WHERE project_id = ?;", [projectId]);
    db.run("DELETE FROM project_requirements WHERE project_id = ?;", [
      projectId,
    ]);
    db.run("DELETE FROM project_risks WHERE project_id = ?;", [projectId]);
    db.run("DELETE FROM project_team_members WHERE project_id = ?;", [
      projectId,
    ]);
    db.run("DELETE FROM projects WHERE project_id = ?;", [projectId]);
    persistToDisk();
  }

  function downloadSqliteFile() {
    const binaryArray = db.export();
    const blob = new Blob([binaryArray], { type: "application/x-sqlite3" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "group8_projects.sqlite";
    a.click();
  }

  return {
    init,
    saveProject,
    getAllProjects,
    deleteProject,
    downloadSqliteFile,
  };
})();
