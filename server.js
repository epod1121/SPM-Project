
const express = require('express');
const cors = require('cors');
const { sql, connectDB } = require('./db');

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json({ limit: '2mb' }));

const phaseNames = [
    'Requirements Analysis',
    'Designing',
    'Coding',
    'Testing',
    'Project Management'
];

const isText = value =>
    typeof value === 'string' && value.trim().length > 0;

const isValidDate = value =>
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    !Number.isNaN(Date.parse(value));

function validateProject(project) {
    if (!project || typeof project !== 'object') {
        return 'Project data is required.';
    }

    if (!isText(project.projectName) ||
        !isText(project.projectDescription) ||
        !isText(project.projectOwner)) {
        return 'Project name, description, and owner are required.';
    }

    if (project.projectName.length > 150 ||
        project.projectOwner.length > 150) {
        return 'Project name and owner must be 150 characters or fewer.';
    }

    for (const field of ['teamMembers', 'risks', 'requirements']) {
        if (project[field] !== undefined &&
            !Array.isArray(project[field])) {
            return `${field} must be an array.`;
        }
    }

    for (const member of project.teamMembers || []) {
        if (!isText(member.name) || !isText(member.role) ||
            member.name.length > 150 || member.role.length > 150) {
            return 'Each team member needs a valid name and role.';
        }
    }

    for (const risk of project.risks || []) {
        if (!isText(risk.description) ||
            !['Low', 'Medium', 'High'].includes(risk.likelihood) ||
            !['Low', 'Medium', 'High'].includes(risk.impact) ||
            !['Identified', 'Monitoring', 'Mitigated',
              'Occurred', 'Closed'].includes(risk.status)) {
            return 'A risk has invalid information.';
        }
    }

    for (const requirement of project.requirements || []) {
        if (!isText(requirement.description) ||
            !['Functional', 'Non-Functional'].includes(requirement.type) ||
            (requirement.code != null &&
             (typeof requirement.code !== 'string' ||
              requirement.code.length > 50))) {
            return 'A requirement has invalid information.';
        }

        if (requirement.effortLogs !== undefined &&
            !Array.isArray(requirement.effortLogs)) {
            return 'Effort logs must be an array.';
        }

        for (const log of requirement.effortLogs || []) {
            if (!['Daily', 'Weekly'].includes(log.interval) ||
                !isValidDate(log.workDate) ||
                !log.hours || typeof log.hours !== 'object') {
                return 'An effort log has invalid information.';
            }

            for (const phase of phaseNames) {
                const hours = log.hours[phase] ?? 0;

                if (typeof hours !== 'number' ||
                    !Number.isFinite(hours) ||
                    hours < 0 || hours > 99999999.99) {
                    return `Invalid hours for ${phase}.`;
                }
            }
        }
    }

    return null;
}

// Backend status
app.get('/', (req, res) => {
    res.json({ message: 'SPM Project backend is running!' });
});

// Database connection test
app.get('/api/test-db', async (req, res) => {
    try {
        const pool = await connectDB();
        const result = await pool.request().query(
            'SELECT DB_NAME() AS DatabaseName'
        );

        res.json({
            success: true,
            database: result.recordset[0].DatabaseName
        });
    } catch (error) {
        console.error('Database test error:', error);
        res.status(500).json({
            success: false,
            error: 'Database connection failed.'
        });
    }
});

// Save complete project
app.post('/api/projects', async (req, res) => {
    const project = req.body;
    const validationError = validateProject(project);

    if (validationError) {
        return res.status(400).json({
            success: false,
            error: validationError
        });
    }

    let transaction;

    try {
        const pool = await connectDB();
        transaction = new sql.Transaction(pool);

        await transaction.begin();

        // 1. Save general project information
        const projectResult = await new sql.Request(transaction)
            .input('name', sql.NVarChar(150), project.projectName.trim())
            .input('description', sql.NVarChar(sql.MAX),
                project.projectDescription.trim())
            .input('owner', sql.NVarChar(150),
                project.projectOwner.trim())
            .query(`
                INSERT INTO dbo.Projects
                    (ProjectName, ProjectDescription, ProjectOwner)
                OUTPUT INSERTED.ProjectID
                VALUES (@name, @description, @owner)
            `);

        const projectId = projectResult.recordset[0].ProjectID;

        // 2. Save team members
        for (const member of project.teamMembers || []) {
            await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('name', sql.NVarChar(150), member.name.trim())
                .input('role', sql.NVarChar(150), member.role.trim())
                .query(`
                    INSERT INTO dbo.TeamMembers
                        (ProjectID, MemberName, MemberRole)
                    VALUES (@projectId, @name, @role)
                `);
        }

        // 3. Save risks
        for (const risk of project.risks || []) {
            await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('description', sql.NVarChar(sql.MAX),
                    risk.description.trim())
                .input('likelihood', sql.NVarChar(20), risk.likelihood)
                .input('impact', sql.NVarChar(20), risk.impact)
                .input('status', sql.NVarChar(30), risk.status)
                .query(`
                    INSERT INTO dbo.Risks
                        (ProjectID, RiskDescription, Likelihood,
                         Impact, RiskStatus)
                    VALUES
                        (@projectId, @description, @likelihood,
                         @impact, @status)
                `);
        }

        // 4. Get the development phase IDs
        const phaseResult = await new sql.Request(transaction)
            .query(`
                SELECT PhaseID, PhaseName
                FROM dbo.DevelopmentPhases
            `);

        const phaseIds = new Map(
            phaseResult.recordset.map(phase => [
                phase.PhaseName,
                phase.PhaseID
            ])
        );

        for (const name of phaseNames) {
            if (!phaseIds.has(name)) {
                throw new Error(`Missing development phase: ${name}`);
            }
        }

        // 5. Save requirements and effort tracking
        for (const requirement of project.requirements || []) {
            const requirementResult = await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('code', sql.NVarChar(50),
                    requirement.code?.trim() || null)
                .input('type', sql.NVarChar(30), requirement.type)
                .input('description', sql.NVarChar(sql.MAX),
                    requirement.description.trim())
                .query(`
                    INSERT INTO dbo.Requirements
                        (ProjectID, RequirementCode,
                         RequirementType, RequirementDescription)
                    OUTPUT INSERTED.RequirementID
                    VALUES (@projectId, @code, @type, @description)
                `);

            const requirementId =
                requirementResult.recordset[0].RequirementID;

            for (const log of requirement.effortLogs || []) {
                const logResult = await new sql.Request(transaction)
                    .input('requirementId', sql.Int, requirementId)
                    .input('interval', sql.NVarChar(20), log.interval)
                    .input('workDate', sql.Date, log.workDate)
                    .query(`
                        INSERT INTO dbo.EffortLogs
                            (RequirementID, TrackingInterval, WorkDate)
                        OUTPUT INSERTED.EffortLogID
                        VALUES (@requirementId, @interval, @workDate)
                    `);

                const effortLogId =
                    logResult.recordset[0].EffortLogID;

                for (const phaseName of phaseNames) {
                    await new sql.Request(transaction)
                        .input('logId', sql.Int, effortLogId)
                        .input('phaseId', sql.Int,
                            phaseIds.get(phaseName))
                        .input('hours', sql.Decimal(10, 2),
                            log.hours[phaseName] ?? 0)
                        .query(`
                            INSERT INTO dbo.EffortLogDetails
                                (EffortLogID, PhaseID, PersonHours)
                            VALUES (@logId, @phaseId, @hours)
                        `);
                }
            }
        }

        await transaction.commit();
        transaction = null;

        res.status(201).json({
            success: true,
            message: 'Complete project saved successfully!',
            projectId
        });

    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        console.error('Error saving project:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to save project.'
        });
    }
});

// Retrieve all projects
app.get('/api/projects', async (req, res) => {
    try {
        const pool = await connectDB();

        const result = await pool.request().query(`
            SELECT *
            FROM dbo.Projects
            ORDER BY ProjectID DESC
        `);

        res.json({
            success: true,
            projects: result.recordset
        });

    } catch (error) {
        console.error('Error retrieving projects:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve projects.'
        });
    }
});

// Retrieve a complete project
app.get('/api/projects/:id', async (req, res) => {
    const projectId = Number(req.params.id);

    if (!Number.isSafeInteger(projectId) || projectId <= 0) {
        return res.status(400).json({
            success: false,
            error: 'Invalid project ID.'
        });
    }

    try {
        const pool = await connectDB();

        const projectResult = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                SELECT *
                FROM dbo.Projects
                WHERE ProjectID = @id
            `);

        if (!projectResult.recordset.length) {
            return res.status(404).json({
                success: false,
                error: 'Project not found.'
            });
        }

        const teamResult = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                SELECT MemberID, MemberName, MemberRole
                FROM dbo.TeamMembers
                WHERE ProjectID = @id
                ORDER BY MemberID
            `);

        const riskResult = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                SELECT RiskID, RiskDescription,
                       Likelihood, Impact, RiskStatus
                FROM dbo.Risks
                WHERE ProjectID = @id
                ORDER BY RiskID
            `);

        const requirementResult = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                SELECT RequirementID, RequirementCode,
                       RequirementType, RequirementDescription
                FROM dbo.Requirements
                WHERE ProjectID = @id
                ORDER BY RequirementID
            `);

        const effortResult = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                SELECT
                    e.EffortLogID,
                    e.RequirementID,
                    e.TrackingInterval,
                    CONVERT(VARCHAR(10), e.WorkDate, 23) AS WorkDate,
                    p.PhaseName,
                    d.PersonHours
                FROM dbo.EffortLogs e
                JOIN dbo.Requirements r
                    ON e.RequirementID = r.RequirementID
                JOIN dbo.EffortLogDetails d
                    ON e.EffortLogID = d.EffortLogID
                JOIN dbo.DevelopmentPhases p
                    ON d.PhaseID = p.PhaseID
                WHERE r.ProjectID = @id
                ORDER BY e.EffortLogID, p.PhaseOrder
            `);

        const requirements = requirementResult.recordset.map(r => ({
            requirementId: r.RequirementID,
            code: r.RequirementCode,
            type: r.RequirementType,
            description: r.RequirementDescription,
            effortLogs: []
        }));

        const requirementsById = new Map(
            requirements.map(r => [r.requirementId, r])
        );

        const logsById = new Map();

        for (const row of effortResult.recordset) {
            let log = logsById.get(row.EffortLogID);

            if (!log) {
                log = {
                    effortLogId: row.EffortLogID,
                    interval: row.TrackingInterval,
                    workDate: row.WorkDate,
                    hours: {}
                };

                logsById.set(row.EffortLogID, log);

                requirementsById.get(row.RequirementID)
                    .effortLogs.push(log);
            }

            log.hours[row.PhaseName] = Number(row.PersonHours);
        }

        res.json({
            success: true,
            project: {
                ...projectResult.recordset[0],
                teamMembers: teamResult.recordset.map(m => ({
                    memberId: m.MemberID,
                    name: m.MemberName,
                    role: m.MemberRole
                })),
                risks: riskResult.recordset.map(r => ({
                    riskId: r.RiskID,
                    description: r.RiskDescription,
                    likelihood: r.Likelihood,
                    impact: r.Impact,
                    status: r.RiskStatus
                })),
                requirements
            }
        });

    } catch (error) {
        console.error('Error retrieving project:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to retrieve project.'
        });
    }
});

function validateProjectId(value) {
    const id = Number(value);

    if (!Number.isSafeInteger(id) || id <= 0 || id > 2147483647) {
        return null;
    }

    return id;
}

// UPDATE an existing project
app.put('/api/projects/:id', async (req, res) => {
    const projectId = validateProjectId(req.params.id);

    if (!projectId) {
        return res.status(400).json({
            success: false,
            error: 'Invalid project ID.'
        });
    }

    const project = req.body;
    const validationError = validateProject(project);

    if (validationError) {
        return res.status(400).json({
            success: false,
            error: validationError
        });
    }

    let transaction;

    try {
        const pool = await connectDB();
        transaction = new sql.Transaction(pool);

        await transaction.begin();

        // Check that the project exists and lock it for updating.
        const existing = await new sql.Request(transaction)
            .input('id', sql.Int, projectId)
            .query(`
                SELECT ProjectID
                FROM dbo.Projects WITH (UPDLOCK, HOLDLOCK)
                WHERE ProjectID = @id
            `);

        if (existing.recordset.length === 0) {
            await transaction.rollback();
            transaction = null;

            return res.status(404).json({
                success: false,
                error: 'Project not found.'
            });
        }

        // Update general project information.
        await new sql.Request(transaction)
            .input('id', sql.Int, projectId)
            .input('name', sql.NVarChar(150),
                project.projectName.trim())
            .input('description', sql.NVarChar(sql.MAX),
                project.projectDescription.trim())
            .input('owner', sql.NVarChar(150),
                project.projectOwner.trim())
            .query(`
                UPDATE dbo.Projects
                SET ProjectName = @name,
                    ProjectDescription = @description,
                    ProjectOwner = @owner,
                    UpdatedAt = SYSDATETIME()
                WHERE ProjectID = @id
            `);

        // Replace related records with the updated project data.
        // Deleting requirements cascades to their effort logs/details.
        await new sql.Request(transaction)
            .input('id', sql.Int, projectId)
            .query(`
                DELETE FROM dbo.TeamMembers WHERE ProjectID = @id;
                DELETE FROM dbo.Risks WHERE ProjectID = @id;
                DELETE FROM dbo.Requirements WHERE ProjectID = @id;
            `);

        // Reinsert team members.
        for (const member of project.teamMembers || []) {
            await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('name', sql.NVarChar(150), member.name.trim())
                .input('role', sql.NVarChar(150), member.role.trim())
                .query(`
                    INSERT INTO dbo.TeamMembers
                        (ProjectID, MemberName, MemberRole)
                    VALUES (@projectId, @name, @role)
                `);
        }

        // Reinsert risks.
        for (const risk of project.risks || []) {
            await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('description', sql.NVarChar(sql.MAX),
                    risk.description.trim())
                .input('likelihood', sql.NVarChar(20),
                    risk.likelihood)
                .input('impact', sql.NVarChar(20), risk.impact)
                .input('status', sql.NVarChar(30), risk.status)
                .query(`
                    INSERT INTO dbo.Risks
                        (ProjectID, RiskDescription, Likelihood,
                         Impact, RiskStatus)
                    VALUES
                        (@projectId, @description, @likelihood,
                         @impact, @status)
                `);
        }

        // Look up development phases.
        const phaseResult = await new sql.Request(transaction)
            .query(`
                SELECT PhaseID, PhaseName
                FROM dbo.DevelopmentPhases
            `);

        const phaseIds = new Map(
            phaseResult.recordset.map(phase => [
                phase.PhaseName,
                phase.PhaseID
            ])
        );

        for (const phaseName of phaseNames) {
            if (!phaseIds.has(phaseName)) {
                throw new Error(
                    `Missing development phase: ${phaseName}`
                );
            }
        }

        // Reinsert requirements and their effort records.
        for (const requirement of project.requirements || []) {
            const requirementResult = await new sql.Request(transaction)
                .input('projectId', sql.Int, projectId)
                .input('code', sql.NVarChar(50),
                    requirement.code?.trim() || null)
                .input('type', sql.NVarChar(30), requirement.type)
                .input('description', sql.NVarChar(sql.MAX),
                    requirement.description.trim())
                .query(`
                    INSERT INTO dbo.Requirements
                        (ProjectID, RequirementCode,
                         RequirementType, RequirementDescription)
                    OUTPUT INSERTED.RequirementID
                    VALUES
                        (@projectId, @code, @type, @description)
                `);

            const requirementId =
                requirementResult.recordset[0].RequirementID;

            for (const log of requirement.effortLogs || []) {
                const logResult = await new sql.Request(transaction)
                    .input('requirementId', sql.Int, requirementId)
                    .input('interval', sql.NVarChar(20),
                        log.interval)
                    .input('workDate', sql.Date, log.workDate)
                    .query(`
                        INSERT INTO dbo.EffortLogs
                            (RequirementID, TrackingInterval, WorkDate)
                        OUTPUT INSERTED.EffortLogID
                        VALUES
                            (@requirementId, @interval, @workDate)
                    `);

                const effortLogId =
                    logResult.recordset[0].EffortLogID;

                for (const phaseName of phaseNames) {
                    await new sql.Request(transaction)
                        .input('logId', sql.Int, effortLogId)
                        .input('phaseId', sql.Int,
                            phaseIds.get(phaseName))
                        .input('hours', sql.Decimal(10, 2),
                            log.hours[phaseName] ?? 0)
                        .query(`
                            INSERT INTO dbo.EffortLogDetails
                                (EffortLogID, PhaseID, PersonHours)
                            VALUES (@logId, @phaseId, @hours)
                        `);
                }
            }
        }

        await transaction.commit();
        transaction = null;

        res.json({
            success: true,
            message: 'Project updated successfully!',
            projectId
        });

    } catch (error) {
        if (transaction) {
            try {
                await transaction.rollback();
            } catch (rollbackError) {
                console.error('Rollback failed:', rollbackError);
            }
        }

        console.error('Error updating project:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to update project.'
        });
    }
});

// DELETE a project
app.delete('/api/projects/:id', async (req, res) => {
    const projectId = validateProjectId(req.params.id);

    if (!projectId) {
        return res.status(400).json({
            success: false,
            error: 'Invalid project ID.'
        });
    }

    try {
        const pool = await connectDB();

        // Related records are deleted automatically
        // through the database's ON DELETE CASCADE rules.
        const result = await pool.request()
            .input('id', sql.Int, projectId)
            .query(`
                DELETE FROM dbo.Projects
                WHERE ProjectID = @id
            `);

        if (result.rowsAffected[0] === 0) {
            return res.status(404).json({
                success: false,
                error: 'Project not found.'
            });
        }

        res.json({
            success: true,
            message: 'Project deleted successfully!',
            projectId
        });

    } catch (error) {
        console.error('Error deleting project:', error);

        res.status(500).json({
            success: false,
            error: 'Failed to delete project.'
        });
    }
});

// Start backend server
app.listen(PORT, () => {
    console.log(`SPM backend running at http://localhost:${PORT}`);
});