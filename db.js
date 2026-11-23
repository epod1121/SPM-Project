require('dotenv').config();

const sql = require('mssql/msnodesqlv8');

const config = {
    connectionString:
        `Driver={ODBC Driver 17 for SQL Server};` +
        `Server=${process.env.DB_SERVER};` +
        `Database=${process.env.DB_NAME};` +
        `Trusted_Connection=Yes;` +
        `TrustServerCertificate=Yes;`
};

async function connectDB() {
    try {
        const pool = await sql.connect(config);
        console.log('Successfully connected to SPMProjectDB!');
        return pool;
    } catch (error) {
        console.error('Database connection failed:', error);
        throw error;
    }
}

module.exports = { sql, connectDB };