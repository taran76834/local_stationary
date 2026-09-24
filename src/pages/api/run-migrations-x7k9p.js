import { exec } from 'child_process';
import path from 'path';
import { promisify } from 'util';

const execAsync = promisify(exec);

export default async function handler(req, res) {
  try {
    const migrationScript = path.resolve(process.cwd(), 'database/run-all-migrations.js');
    const { stdout, stderr } = await execAsync(`node "${migrationScript}"`);

    return res.status(200).json({
      success: true,
      message: 'All database migrations executed successfully.',
      output: stdout,
      error: stderr || null,
    });
  } catch (error) {
    console.error('Migration error:', error);
    return res.status(500).json({
      success: false,
      message: 'Migration execution encountered an error.',
      error: error.message,
      output: error.stdout || null,
    });
  }
}
